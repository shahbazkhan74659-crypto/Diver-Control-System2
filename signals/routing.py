from django.urls import re_path
from .consumers import SignalConsumer

websocket_urlpatterns = [
    re_path(r"ws/signals/$", SignalConsumer.as_asgi()),
]

