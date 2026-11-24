from django.core.management.base import BaseCommand

from apps.vehicles.services import expire_stale_listings


class Command(BaseCommand):
    help = "Mark approved listings whose listing period has ended as expired. Run daily (cron or scheduler)."

    def handle(self, *args, **options):
        count = expire_stale_listings()
        self.stdout.write(self.style.SUCCESS(f"Expired {count} listing(s)."))
