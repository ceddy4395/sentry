import pytest

from sentry.backup.comparators import get_default_comparators
from sentry.backup.dependencies import NormalizedModelName
from sentry.backup.findings import ComparatorFindingKind, InstanceID
from sentry.testutils.helpers.backups import (
    ValidationError,
    clear_database,
    import_export_from_fixture_then_validate,
)
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all(transaction=True, reset_sequences=True)
def test_good_fresh_install(tmp_path):
    import_export_from_fixture_then_validate(
        tmp_path, "fresh-install.json", get_default_comparators()
    )


@django_db_all(transaction=True, reset_sequences=True)
def test_bad_unequal_json(tmp_path):
    # Without calling `get_default_comparators()` as the third argument to
    # `import_export_from_fixture_then_validate()`, the `date_updated` fields will not be compared
    # using the special comparator logic, and will try to use (and fail on) simple JSON string
    # comparison instead.
    with pytest.raises(ValidationError) as execinfo:
        import_export_from_fixture_then_validate(tmp_path, "fresh-install.json")
    findings = execinfo.value.info.findings

    assert len(findings) >= 3
    assert findings[0].kind == ComparatorFindingKind.UnequalJSON
    assert findings[1].kind == ComparatorFindingKind.UnequalJSON
    assert findings[2].kind == ComparatorFindingKind.UnequalJSON


@django_db_all(transaction=True, reset_sequences=True)
def test_date_updated_with_zeroed_milliseconds(tmp_path):
    import_export_from_fixture_then_validate(tmp_path, "datetime-with-zeroed-millis.json")


@django_db_all(transaction=True, reset_sequences=True)
def test_date_updated_with_unzeroed_milliseconds(tmp_path):
    with pytest.raises(ValidationError) as execinfo:
        import_export_from_fixture_then_validate(tmp_path, "datetime-with-unzeroed-millis.json")
    findings = execinfo.value.info.findings
    assert len(findings) == 1
    assert findings[0].kind == ComparatorFindingKind.UnequalJSON
    assert findings[0].on == InstanceID(NormalizedModelName("sentry.option"), 1)
    assert findings[0].left_pk == 1
    assert findings[0].right_pk == 1
    assert """-  "last_updated": "2023-06-22T00:00:00Z",""" in findings[0].reason
    assert """+  "last_updated": "2023-06-22T00:00:00.000Z",""" in findings[0].reason


@django_db_all(transaction=True, reset_sequences=True)
def test_good_continuing_sequences(tmp_path):
    # Populate once to set the sequences.
    import_export_from_fixture_then_validate(
        tmp_path, "fresh-install.json", get_default_comparators()
    )

    # Empty the database without resetting primary keys.
    clear_database()

    # Test that foreign keys are properly re-pointed to newly allocated primary keys as they are
    # assigned.
    import_export_from_fixture_then_validate(
        tmp_path, "fresh-install.json", get_default_comparators()
    )


# User models are unique and important enough that we target them with a specific test case.
@django_db_all(transaction=True)
def test_user_pk_mapping(tmp_path):
    import_export_from_fixture_then_validate(
        tmp_path, "user-pk-mapping.json", get_default_comparators()
    )


# The import should be robust to usernames and organization slugs that have had random suffixes
# added on due to conflicts in the existing database.
@django_db_all(transaction=True)
def test_auto_suffix_username_and_organization_slug(tmp_path):
    import_export_from_fixture_then_validate(
        tmp_path, "duplicate-username-and-organization-slug.json", get_default_comparators()
    )


# Apps are often owned by a fake "proxy_user" with an autogenerated name and no email. This empty email is represented as such in the database, with an empty string as the entry in the `Email` table. This test ensures that this relationship is preserved through an import/export cycle.
@django_db_all(transaction=True)
def test_app_user_with_empty_email(tmp_path):
    import_export_from_fixture_then_validate(
        tmp_path, "app-user-with-empty-email.json", get_default_comparators()
    )
