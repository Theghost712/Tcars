"""Create demo accounts and listings so the site can be explored locally.

Usage:  python manage.py seed_demo          (idempotent: re-running updates nothing new)
        python manage.py seed_demo --reset  (deletes demo accounts and listings first)
"""

from datetime import timedelta
from io import BytesIO

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.utils import timezone
from PIL import Image, ImageDraw, ImageFont

from apps.accounts.models import Role, User
from apps.dealers.models import Dealer, Verification, VerificationStatus
from apps.vehicles.models import Status, Vehicle, VehicleImage
from apps.vehicles.services import log_action  # noqa: F401  (ensures moderation app loads)

DEMO_PASSWORD = "DemoPass123!"
DEMO_DOMAIN = "demo.tzcars.test"

PALETTE = [(30, 64, 175), (185, 28, 28), (21, 128, 61), (217, 119, 6), (75, 85, 99), (236, 236, 236), (15, 23, 42)]

CARS = [
    # title, make, model, year, price, km, fuel, gear, cc, body, region, city, featured, dealer
    ("Toyota Land Cruiser Prado TX", "Toyota", "Land Cruiser Prado", 2016, 92_000_000, 98000, "diesel", "automatic", 2982, "suv", "Dar es Salaam", "Masaki", True, True),
    ("Toyota Hiace 14-seater", "Toyota", "Hiace", 2014, 68_500_000, 150000, "diesel", "manual", 2982, "minibus", "Arusha", "Arusha City", False, True),
    ("Toyota Vitz 2012 low km", "Toyota", "Vitz", 2012, 14_800_000, 84000, "petrol", "automatic", 1300, "hatchback", "Dar es Salaam", "Kinondoni", True, False),
    ("Nissan X-Trail 4x4", "Nissan", "X-Trail", 2015, 32_000_000, 120000, "petrol", "cvt", 2000, "suv", "Mwanza", "Ilemela", False, False),
    ("Mitsubishi L200 Double Cab", "Mitsubishi", "L200", 2013, 44_000_000, 175000, "diesel", "manual", 2500, "pickup", "Dodoma", "Dodoma City", False, True),
    ("Honda Fit Hybrid", "Honda", "Fit", 2011, 11_500_000, 110000, "hybrid", "automatic", 1300, "hatchback", "Dar es Salaam", "Ubungo", False, False),
    ("Suzuki Swift 2018", "Suzuki", "Swift", 2018, 22_000_000, 60000, "petrol", "manual", 1200, "hatchback", "Mbeya", "Mbeya City", False, False),
    ("Toyota Noah 2010 family van", "Toyota", "Noah", 2010, 19_500_000, 165000, "petrol", "automatic", 1800, "van", "Tanga", "Tanga City", False, False),
    ("Mercedes-Benz C200 Avantgarde", "Mercedes-Benz", "C200", 2009, 26_000_000, 142000, "petrol", "automatic", 1800, "sedan", "Dar es Salaam", "Oysterbay", False, True),
    ("Isuzu D-Max 4x4", "Isuzu", "D-Max", 2019, 58_000_000, 48000, "diesel", "manual", 3000, "pickup", "Arusha", "Njiro", True, True),
    ("Subaru Forester XT", "Subaru", "Forester", 2008, 17_000_000, 190000, "petrol", "automatic", 2000, "suv", "Zanzibar", "Zanzibar City", False, False),
    ("Toyota Corolla Fielder", "Toyota", "Corolla Fielder", 2013, 16_200_000, 128000, "petrol", "automatic", 1500, "wagon", "Morogoro", "Morogoro Town", False, False),
]


def make_photo(title: str, index: int) -> ContentFile:
    color = PALETTE[index % len(PALETTE)]
    img = Image.new("RGB", (1200, 800), (226, 232, 240))
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 560, 1200, 800], fill=(51, 65, 85))
    draw.rounded_rectangle([220, 360, 980, 620], radius=60, fill=color)
    draw.rounded_rectangle([340, 260, 860, 400], radius=50, fill=color)
    for x in (360, 840):
        draw.ellipse([x - 70, 560, x + 70, 700], fill=(15, 23, 42))
    try:
        font = ImageFont.load_default(size=36)
    except TypeError:
        font = ImageFont.load_default()
    draw.text((40, 40), title[:48], fill=(15, 23, 42), font=font)
    draw.text((40, 90), "Demo photo", fill=(71, 85, 105), font=font)
    buffer = BytesIO()
    img.save(buffer, format="JPEG", quality=85)
    return ContentFile(buffer.getvalue(), name=f"demo-{index}.jpg")


class Command(BaseCommand):
    help = "Create demo users, dealers and listings for local exploration."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Delete existing demo data first.")

    def handle(self, *args, **options):
        if options["reset"]:
            User.objects.filter(email__endswith=f"@{DEMO_DOMAIN}").delete()
            self.stdout.write("Removed previous demo data.")

        admin, _ = self._user("admin", "Platform Admin", Role.ADMIN)
        seller, _ = self._user("seller", "Amina Juma", Role.SELLER, region="Dar es Salaam", city="Kinondoni")
        seller2, _ = self._user("seller2", "Neema Mollel", Role.SELLER, region="Arusha", city="Arusha City")
        buyer, _ = self._user("buyer", "Joseph Mwakyusa", Role.BUYER)
        dealer_user, _ = self._user("dealer", "Kariakoo Motors Owner", Role.DEALER, region="Dar es Salaam", city="Ilala")

        dealer, _ = Dealer.objects.get_or_create(
            owner=dealer_user,
            defaults={
                "business_name": "Kariakoo Motors Ltd",
                "description": "Family-run dealership with over a decade of trusted used-car sales.",
                "phone": "+255712000111", "whatsapp_number": "+255712000111",
                "region": "Dar es Salaam", "city": "Ilala", "address": "Kariakoo Street, Plot 14",
                "verification_status": VerificationStatus.VERIFIED, "verified_at": timezone.now(),
            },
        )
        dealer_user.profile.is_verified = True
        dealer_user.profile.verified_at = timezone.now()
        dealer_user.profile.save()
        if not Verification.objects.filter(user=dealer_user).exists():
            Verification.objects.create(
                user=dealer_user, dealer=dealer, kind=Verification.Kind.DEALER,
                reference_number="TIN-DEMO-000111", status=Verification.Status.APPROVED,
                reviewed_by=admin, reviewed_at=timezone.now(), admin_note="Demo verification.",
            )

        if Vehicle.objects.filter(seller__email__endswith=f"@{DEMO_DOMAIN}").exists():
            self.stdout.write("Demo listings already exist; skipping listing creation.")
            return

        now = timezone.now()
        owners = [seller, seller2, dealer_user]
        for index, car in enumerate(CARS):
            title, make, model, year, price, km, fuel, gear, cc, body, region, city, featured, with_dealer = car
            owner = dealer_user if with_dealer else owners[index % 2]
            vehicle = Vehicle.objects.create(
                seller=owner,
                dealer=dealer if with_dealer else None,
                title=title, make=make, model=model, year=year, price_tzs=price, mileage_km=km,
                fuel_type=fuel, transmission=gear, engine_cc=cc, body_type=body,
                condition="used", color="", region=region, city=city,
                description=(
                    f"{title}. Well maintained, documents in order, ready for transfer. "
                    "Viewing welcome at a convenient location; test drive available."
                ),
                contact_phone=owner.phone or "+255712345678", whatsapp_number=owner.phone or "+255712345678",
                is_featured=featured, views_count=(index * 37) % 180,
            )
            for photo_index in range(3):
                VehicleImage.objects.create(
                    vehicle=vehicle, position=photo_index,
                    image=make_photo(title, index + photo_index),
                )
            if index == 3:
                vehicle.status = Status.PENDING
                vehicle.save(update_fields=["status"])
            elif index == 7:
                vehicle.publish(now=now - timedelta(days=5))
                vehicle.status = Status.SOLD
                vehicle.sold_at = now
                vehicle.save(update_fields=["status", "sold_at"])
            elif index == 10:
                vehicle.status = Status.PENDING
                vehicle.save(update_fields=["status"])
            else:
                vehicle.publish(now=now - timedelta(days=index))

        self.stdout.write(self.style.SUCCESS(
            f"Demo data ready. Sign in with any of these accounts (password {DEMO_PASSWORD}):\n"
            + "\n".join(f"  {email}" for email in self._emails())
        ))

    def _emails(self):
        return [f"{name}@{DEMO_DOMAIN}" for name in ("admin", "seller", "seller2", "buyer", "dealer")]

    def _user(self, name, full_name, role, **profile):
        email = f"{name}@{DEMO_DOMAIN}"
        user, created = User.objects.get_or_create(
            email=email, defaults={"full_name": full_name, "role": role, "phone": "+255712000000"}
        )
        if created:
            user.set_password(DEMO_PASSWORD)
            user.save()
        for key, value in profile.items():
            setattr(user.profile, key, value)
        user.profile.save()
        return user, created
