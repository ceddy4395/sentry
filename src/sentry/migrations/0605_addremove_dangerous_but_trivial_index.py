# Generated by Django 3.2.23 on 2023-11-15 23:26

from django.db import migrations, models

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    # not dangerous, just testing the post-deploy-migrations pipeline
    is_dangerous = True

    dependencies = [
        ("sentry", "0604_remove_dangerous_but_trivial_index"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="broadcast",
            index=models.Index(
                fields=["date_added"],
                name="dangerous_but_trivial_idx",
            ),
        ),
        migrations.RemoveIndex(
            model_name="broadcast",
            name="dangerous_but_trivial_idx",
        ),
    ]
