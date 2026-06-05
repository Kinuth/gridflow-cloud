from rest_framework.permissions import BasePermission

class IsOrgMember(BasePermission):
    """
    Custom permission to only allow members of an organization to access its resources.
    """

    def has_permission(self, request, view):
        # Check if the user is authenticated
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Get the organization ID from the URL kwargs
        org_id = view.kwargs.get('org_id')
        
        # Check if the user is a member of the organization
        return getattr(request.user, 'organization_id', None) == org_id