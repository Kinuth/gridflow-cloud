from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet

from .models import Organization
from .serializers import OrganizationSerializer


class OrganizationViewSet(ModelViewSet):
	queryset = Organization.objects.all()
	serializer_class = OrganizationSerializer
	permission_classes = [IsAuthenticated]

	def get_queryset(self):
		user = self.request.user
		if user.is_staff or getattr(user, 'role', None) == 'ADMIN':
			return Organization.objects.all()

		organization = getattr(user, 'organization', None)
		if organization is None:
			return Organization.objects.none()

		return Organization.objects.filter(pk=organization.pk)
