from django.db import models

class Organization(models.Model):
    ORG_TYPE_CHOICES =(
        ("HOUSEHOLD", 'Household'),
        ("SME", "Small and Medium Enterprise"),
        ("CI", "Commercial and Industrial"),
    )
 
    name = models.CharField(max_length=255)
    org_type = models.CharField(max_length=20, choices=ORG_TYPE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name