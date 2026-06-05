from django.db import models
from django.contrib.auth.models import AbstractUser
from organizations.models import Organization

class User(AbstractUser):
    ROLE_CHOICES = (
        ("OWNER", "Owner"),
        ("OPERATOR", "Operator"),
        ("VIEWER", "Viewer"),
        ("ADMIN", "Platform Admin"),
    )

    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='users', null=True, blank=True)

    def __str__(self):
        return self.username