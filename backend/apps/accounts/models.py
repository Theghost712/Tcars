from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone


class Role(models.TextChoices):
    BUYER = "buyer", "Buyer"
    SELLER = "seller", "Individual seller"
    DEALER = "dealer", "Dealer"
    ADMIN = "admin", "Administrator"


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("An email address is required.")
        user = self.model(email=self.normalize_email(email).lower(), **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.update(is_staff=True, is_superuser=True, role=Role.ADMIN)
        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Marketplace account. Email is the login identifier."""

    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=120)
    phone = models.CharField(max_length=20, blank=True)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.BUYER)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    suspension_reason = models.CharField(max_length=255, blank=True)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        ordering = ["-date_joined"]

    def __str__(self):
        return self.email

    def save(self, *args, **kwargs):
        # Administrators need Django admin access, so keep is_staff in step with the role.
        if self.role == Role.ADMIN or self.is_superuser:
            self.is_staff = True
        super().save(*args, **kwargs)

    @property
    def display_name(self) -> str:
        return self.full_name or self.email


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    region = models.CharField(max_length=40, blank=True)
    city = models.CharField(max_length=80, blank=True)
    is_verified = models.BooleanField(default=False, help_text="Identity or seller verification approved.")
    verified_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Profile of {self.user}"
