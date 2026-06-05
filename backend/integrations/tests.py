from datetime import datetime, timezone
import json
from unittest.mock import Mock, patch

from django.test import SimpleTestCase

from integrations.clients.solarman import SolarmanClient


class SolarmanClientTests(SimpleTestCase):
    def setUp(self):
        self.client = SolarmanClient(
            base_url="https://api.example.test",
            app_id="app-id",
            app_secret="app-secret",
            email="operator@example.com",
            password_hash="a" * 64,
        )
        self.client._token = "cached-token"

    @patch.object(SolarmanClient, "authenticate", return_value="cached-token")
    def test_current_data_uses_device_id_language_and_collection_time(self, _authenticate):
        response_payload = {
            "code": None,
            "msg": None,
            "success": True,
            "requestId": "req-123",
            "deviceSn": "2304082604",
            "deviceId": 236378998,
            "deviceType": "INVERTER",
            "deviceState": 1,
            "collectionTime": 1763534845,
            "dataList": [
                {"name": "Power", "value": "178", "unit": "W"},
                {"name": "Grid Tie Power", "value": "0", "unit": "W"},
                {"name": "Today", "value": "5.7", "unit": "KWH"},
                {"name": "Total", "value": "3.78", "unit": "MWh"},
                {"name": "PV1-V", "value": "225", "unit": "V"},
                {"name": "PV2-V", "value": "224", "unit": "V"},
                {"name": "SOC", "value": "100", "unit": "%"},
            ],
        }
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = response_payload
        captured = {}

        def fake_request(method, url, params=None, data=None, headers=None, timeout=None):
            captured["method"] = method
            captured["url"] = url
            captured["params"] = params
            captured["data"] = data
            captured["headers"] = headers
            captured["timeout"] = timeout
            return response

        self.client._session.request = Mock(side_effect=fake_request)

        reading = self.client.get_realtime_data(
            "2304082604",
            device_id=236378998,
        )

        self.assertEqual(captured["method"], "POST")
        self.assertEqual(captured["url"], "https://api.example.test/device/v1.0/currentData")
        self.assertEqual(captured["params"], {"language": "en"})
        self.assertEqual(json.loads(captured["data"].decode("utf-8")), {
            "deviceSn": "2304082604",
            "deviceId": 236378998,
        })
        self.assertEqual(captured["headers"]["Authorization"], "bearer cached-token")
        self.assertEqual(reading.device_sn, "2304082604")
        self.assertEqual(reading.timestamp, datetime.fromtimestamp(1763534845, tz=timezone.utc))
        self.assertEqual(reading.power_w, 178.0)
        self.assertEqual(reading.grid_power_w, 0.0)
        self.assertEqual(reading.energy_today_kwh, 5.7)
        self.assertEqual(reading.energy_total_kwh, 3.78)
        self.assertEqual(reading.voltage_ac, None)
        self.assertEqual(reading.raw_response, response_payload)
