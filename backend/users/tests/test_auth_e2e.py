from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework.authtoken.models import Token


class AuthE2ETest(APITestCase):
    def test_register_and_token(self):
        """Register a user via /api/auth/register/ and obtain token via /api/auth/token/"""
        register_url = "/api/auth/register/"
        payload = {"username": "e2euser", "password": "e2e-pass", "email": "e2e@example.com"}

        resp = self.client.post(register_url, data=payload, format="json")
        self.assertEqual(resp.status_code, 200, msg=resp.content)
        data = resp.json()
        self.assertIn("token", data)

        # user exists
        User = get_user_model()
        user = User.objects.get(username="e2euser")
        self.assertIsNotNone(user)

        # token exists in DB and matches
        token_obj = Token.objects.get(user=user)
        self.assertEqual(token_obj.key, data["token"])

        # Obtain token via token endpoint
        token_resp = self.client.post("/api/auth/token/", data={"username": "e2euser", "password": "e2e-pass"}, format="json")
        self.assertEqual(token_resp.status_code, 200, msg=token_resp.content)
        self.assertIn("token", token_resp.json())
