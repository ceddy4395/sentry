# Generated by Django 2.2.28 on 2023-04-18 23:12
from enum import Enum

from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


# Corresponds to the enum sentry.models.options.option.UpdateChannel
class UpdateChannel(Enum):
    UNKNOWN = "unknown"
    APPLICATION = "application"
    ADMIN = "admin"
    AUTOMATOR = "automator"
    CLI = "cli"
    KILLSWITCH = "killswitch"

    @classmethod
    def choices(cls):
        return [(i.name, i.value) for i in cls]


class Migration(CheckedMigration):
    # This flag is used to mark that a migration shouldn't be automatically run in production. For
    # the most part, this should only be used for operations where it's safe to run the migration
    # after your code has deployed. So this should not be used for most operations that alter the
    # schema of a table.
    # Here are some things that make sense to mark as dangerous:
    # - Large data migrations. Typically we want these to be run manually by ops so that they can
    #   be monitored and not block the deploy for a long period of time while they run.
    # - Adding indexes to large tables. Since this can take a long time, we'd generally prefer to
    #   have ops run this and not block the deploy. Note that while adding an index is a schema
    #   change, it's completely safe to run the operation after the code has deployed.
    is_dangerous = False

    dependencies = [
        ("sentry", "0457_sentry_monitorcheckin_date_added_index"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    """
                    ALTER TABLE "sentry_option" ADD COLUMN "last_updated_by" VARCHAR(16) NOT NULL DEFAULT 'unknown';
                    """,
                    reverse_sql="""
                    ALTER TABLE "sentry_option" DROP COLUMN "last_updated_by";
                    """,
                    hints={"tables": ["sentry_option"]},
                ),
                migrations.RunSQL(
                    """
                    ALTER TABLE "sentry_controloption" ADD COLUMN "last_updated_by" VARCHAR(16) NOT NULL DEFAULT 'unknown';
                    """,
                    reverse_sql="""
                    ALTER TABLE "sentry_controloption" DROP COLUMN "last_updated_by";
                    """,
                    hints={"tables": ["sentry_controloption"]},
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="option",
                    name="last_updated_by",
                    field=models.CharField(
                        default=UpdateChannel.UNKNOWN.value,
                        max_length=16,
                        choices=UpdateChannel.choices(),
                    ),
                ),
                migrations.AddField(
                    model_name="controloption",
                    name="last_updated_by",
                    field=models.CharField(
                        default=UpdateChannel.UNKNOWN.value,
                        max_length=16,
                        choices=UpdateChannel.choices(),
                    ),
                ),
            ],
        ),
    ]
