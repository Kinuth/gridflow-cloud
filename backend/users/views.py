from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet

from .models import User
from .serializers import UserSerializer


class UserViewSet(ModelViewSet):
	queryset = User.objects.select_related('organization').all()
	serializer_class = UserSerializer
	permission_classes = [IsAuthenticated]

	def get_queryset(self):
		user = self.request.user
		if user.is_staff or getattr(user, 'role', None) == 'ADMIN':
			return User.objects.select_related('organization').all()

		organization = getattr(user, 'organization', None)
		if organization is None:
			return User.objects.none()

		return User.objects.select_related('organization').filter(organization=organization)

	def perform_create(self, serializer):
		user = self.request.user
		if user.is_staff or getattr(user, 'role', None) == 'ADMIN':
			serializer.save()
			return

		serializer.save(organization=user.organization)
