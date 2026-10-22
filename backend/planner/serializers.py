"""Serializers for request validation and API responses."""
from rest_framework import serializers


class HealthCheckResponseSerializer(serializers.Serializer):
    """Serializer documenting health check response structure."""

    status = serializers.CharField()
