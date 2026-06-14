import json
from channels.generic.websocket import AsyncWebsocketConsumer

class SignalConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        print("WS CONNECTED:", self.channel_name)
        self.group_name = "live_signals"
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        print("RECEIVED:", data)

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "broadcast_signal",
                "gesture": data.get("gesture"),
                "message": data.get("message"),
                "time": data.get("time"),
            }
        )

    async def broadcast_signal(self, event):
        await self.send(text_data=json.dumps(event))

