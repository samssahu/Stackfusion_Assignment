from rest_framework import serializers

from .models import Booking, ParkingLot, Slot, Vehicle


class ParkingLotSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParkingLot
        fields = "__all__"


class SlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = Slot
        fields = "__all__"


class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = "__all__"


class BookingSerializer(serializers.ModelSerializer):
    vehicle_detail = VehicleSerializer(source="vehicle", read_only=True)
    slot_detail = SlotSerializer(source="slot", read_only=True)

    class Meta:
        model = Booking
        fields = ["id", "vehicle", "slot", "vehicle_detail", "slot_detail", "start_time", "end_time"]
        read_only_fields = ["start_time", "end_time"]
