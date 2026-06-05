from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from .models import Device
from .serializers import DeviceSerializer

class DeviceViewSet(ModelViewSet):
    queryset = Device.objects.all()
    serializer_class = DeviceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or getattr(user, 'role', None) == 'ADMIN':
            return Device.objects.all()

        organization = getattr(user, 'organization', None)
        if organization is None:
            return Device.objects.none()

        return Device.objects.filter(organization=organization)

    def perform_create(self, serializer):
        user = self.request.user
        if user.is_staff or getattr(user, 'role', None) == 'ADMIN':
            serializer.save()
            return

        serializer.save(organization=user.organization)