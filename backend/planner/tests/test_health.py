import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_health_check_returns_200_ok():
    """Verify GET /api/health/ returns 200 with {'status': 'ok'}."""
    client = APIClient()
    response = client.get("/api/health/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
