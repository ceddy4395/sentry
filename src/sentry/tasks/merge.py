import logging
from typing import List

from django.db import DataError, IntegrityError, router, transaction
from django.db.models import F

from sentry import eventstream, similarity, tsdb
from sentry.issues.escalating import invalidate_group_hourly_count_cache
from sentry.issues.escalating_group_forecast import EscalatingGroupForecast
from sentry.issues.forecasts import generate_and_save_forecasts
from sentry.models.group import Group
from sentry.models.grouphistory import GroupHistory
from sentry.models.groupinbox import GroupInbox
from sentry.tasks.base import instrumented_task, track_group_async_operation
from sentry.tsdb.base import TSDBModel

logger = logging.getLogger("sentry.merge")
delete_logger = logging.getLogger("sentry.deletions.async")


EXTRA_MERGE_MODELS = []


@instrumented_task(
    name="sentry.tasks.merge.merge_groups",
    queue="merge",
    default_retry_delay=60 * 5,
    max_retries=None,
)
@track_group_async_operation
def merge_groups(
    from_object_ids=None,
    to_object_id=None,
    transaction_id=None,
    recursed=False,
    eventstream_state=None,
    handle_forecasts_ids: List[int] = None,
    merge_forecasts: bool = False,
    **kwargs,
):
    """
    Recursively merge groups by deleting group models and groups, and merging times_seen,
    and num_comments

    `handle_forecasts_ids`: Group ids whose forecasts need to be deleted
    `merge_forecasts`: Boolean if the forecast needs to be regenerated after the merge
    """
    # TODO(mattrobenolt): Write tests for all of this
    from sentry.models import (
        Activity,
        Environment,
        EventAttachment,
        Group,
        GroupAssignee,
        GroupEnvironment,
        GroupHash,
        GroupMeta,
        GroupRedirect,
        GroupRuleStatus,
        GroupSubscription,
        UserReport,
        get_group_with_redirect,
    )

    if not (from_object_ids and to_object_id):
        logger.error("group.malformed.missing_params", extra={"transaction_id": transaction_id})
        return False

    # Delete the forecasts and invalidate event count cache if needed once before recursion
    if handle_forecasts_ids:
        handle_forecasts_groups = list(Group.objects.filter(id__in=handle_forecasts_ids))
        invalidate_merge_group_hourly_count_cache(handle_forecasts_groups)
        delete_outdated_forecasts(handle_forecasts_groups)

    # Operate on one "from" group per task iteration. The task is recursed
    # until each group has been merged.
    from_object_id = from_object_ids[0]

    try:
        new_group, _ = get_group_with_redirect(to_object_id)
    except Group.DoesNotExist:
        logger.warning(
            "group.malformed.invalid_id",
            extra={"transaction_id": transaction_id, "old_object_ids": from_object_ids},
        )
        return False

    if not recursed:
        logger.info(
            "merge.queued",
            extra={
                "transaction_id": transaction_id,
                "new_group_id": new_group.id,
                "old_group_ids": from_object_ids,
                # TODO(jtcunning): figure out why these are full seq scans and/or alternative solution
                # 'new_event_id': getattr(new_group.event_set.order_by('-id').first(), 'id', None),
                # 'old_event_id': getattr(group.event_set.order_by('-id').first(), 'id', None),
                # 'new_hash_id': getattr(new_group.grouphash_set.order_by('-id').first(), 'id', None),
                # 'old_hash_id': getattr(group.grouphash_set.order_by('-id').first(), 'id', None),
            },
        )

    try:
        group = Group.objects.select_related("project").get(id=from_object_id)
    except Group.DoesNotExist:
        from_object_ids.remove(from_object_id)

        logger.warning(
            "group.malformed.invalid_id",
            extra={"transaction_id": transaction_id, "old_object_id": from_object_id},
        )
    else:
        model_list = tuple(EXTRA_MERGE_MODELS) + (
            Activity,
            GroupAssignee,
            GroupEnvironment,
            GroupHash,
            GroupRuleStatus,
            GroupSubscription,
            EventAttachment,
            UserReport,
            GroupRedirect,
            GroupMeta,
        )

        has_more = merge_objects(
            model_list, group, new_group, logger=logger, transaction_id=transaction_id
        )

        if not has_more:
            # There are no more objects to merge for *this* "from" group, remove it
            # from the list of "from" groups that are being merged, and finish the
            # work for this group.
            from_object_ids.remove(from_object_id)

            similarity.merge(group.project, new_group, [group], allow_unsafe=True)

            environment_ids = list(
                Environment.objects.filter(projects=group.project).values_list("id", flat=True)
            )

            for model in [TSDBModel.group]:
                tsdb.merge(
                    model,
                    new_group.id,
                    [group.id],
                    environment_ids=environment_ids
                    if model in tsdb.models_with_environment_support
                    else None,
                )

            for model in [TSDBModel.users_affected_by_group]:
                tsdb.merge_distinct_counts(
                    model,
                    new_group.id,
                    [group.id],
                    environment_ids=environment_ids
                    if model in tsdb.models_with_environment_support
                    else None,
                )

            for model in [
                TSDBModel.frequent_releases_by_group,
                TSDBModel.frequent_environments_by_group,
            ]:
                tsdb.merge_frequencies(
                    model,
                    new_group.id,
                    [group.id],
                    environment_ids=environment_ids
                    if model in tsdb.models_with_environment_support
                    else None,
                )

            previous_group_id = group.id

            with transaction.atomic(router.db_for_write(GroupRedirect)):
                GroupRedirect.create_for_group(group, new_group)
                group.delete()
            delete_logger.info(
                "object.delete.executed",
                extra={
                    "object_id": previous_group_id,
                    "transaction_id": transaction_id,
                    "model": Group.__name__,
                },
            )
            GroupHistory.objects.filter(group=group).delete()
            GroupInbox.objects.filter(group=group).delete()

            new_group.update(
                # TODO(dcramer): ideally these would be SQL clauses
                first_seen=min(group.first_seen, new_group.first_seen),
                last_seen=max(group.last_seen, new_group.last_seen),
            )
            try:
                # it's possible to hit an out of range value for counters
                new_group.update(
                    times_seen=F("times_seen") + group.times_seen,
                    num_comments=F("num_comments") + group.num_comments,
                )
            except DataError:
                pass

    if from_object_ids:
        # This task is recursed until `from_object_ids` is empty and all
        # "from" groups have merged into the `to_group_id`.
        merge_groups.delay(
            from_object_ids=from_object_ids,
            to_object_id=to_object_id,
            transaction_id=transaction_id,
            recursed=True,
            eventstream_state=eventstream_state,
            merge_forecasts=merge_forecasts,
        )
    elif eventstream_state:
        # All `from_object_ids` have been merged!
        eventstream.backend.end_merge(eventstream_state)
        # Delay the forecast generation by one minute so snuba event counts can update
        if merge_forecasts:
            regenerate_primary_group_forecast.apply_async(
                kwargs={"group_id": to_object_id}, queue="merge", countdown=60
            )


def _get_event_environment(event, project, cache):
    from sentry.models import Environment

    environment_name = event.get_tag("environment")

    if environment_name not in cache:
        try:
            environment = Environment.get_for_organization_id(
                project.organization_id, environment_name
            )
        except Environment.DoesNotExist:
            logger.warning(
                "event.environment.does_not_exist",
                extra={"project_id": project.id, "environment_name": environment_name},
            )
            environment = Environment.get_or_create(project, environment_name)

        cache[environment_name] = environment

    return cache[environment_name]


def merge_objects(models, group, new_group, limit=1000, logger=None, transaction_id=None):
    has_more = False
    for model in models:
        all_fields = [f.name for f in model._meta.get_fields()]

        # Not all models have a 'project' or 'project_id' field, but we make a best effort
        # to filter on one if it is available.
        # Also note that all_fields doesn't contain f.attname
        # (django ForeignKeys have only attribute "attname" where "_id" is implicitly appended)
        # but we still want to check for "project_id" because some models define a project_id bigint.
        has_project = "project_id" in all_fields or "project" in all_fields

        if has_project:
            project_qs = model.objects.filter(project_id=group.project_id)
        else:
            project_qs = model.objects.all()

        has_group = "group" in all_fields
        if has_group:
            queryset = project_qs.filter(group=group)
        else:
            queryset = project_qs.filter(group_id=group.id)

        for obj in queryset[:limit]:
            try:
                with transaction.atomic(using=router.db_for_write(model)):
                    if has_group:
                        project_qs.filter(id=obj.id).update(group=new_group)
                    else:
                        project_qs.filter(id=obj.id).update(group_id=new_group.id)
            except IntegrityError:
                delete = True
            else:
                delete = False

            if delete:
                # Before deleting, we want to merge in counts
                if hasattr(model, "merge_counts"):
                    obj.merge_counts(new_group)

                obj_id = obj.id
                obj.delete()

                if logger is not None:
                    delete_logger.debug(
                        "object.delete.executed",
                        extra={
                            "object_id": obj_id,
                            "transaction_id": transaction_id,
                            "model": model.__name__,
                        },
                    )
            has_more = True

        if has_more:
            return True
    return has_more


@instrumented_task(
    name="sentry.tasks.merge.regenerate_primary_group_forecast",
    queue="merge",
    max_retries=None,
)
def regenerate_primary_group_forecast(group_id: int, **kwargs) -> None:
    group = Group.objects.filter(id=group_id)
    generate_and_save_forecasts(group)


def delete_outdated_forecasts(groups: List[Group]):
    for group in groups:
        EscalatingGroupForecast.delete(group.project.id, group.id)


def invalidate_merge_group_hourly_count_cache(groups: List[Group]):
    for group in groups:
        invalidate_group_hourly_count_cache(group)
