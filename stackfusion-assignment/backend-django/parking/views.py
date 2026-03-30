from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Booking, ParkingLot, Slot , Vehicle
from .serializers import BookingSerializer, ParkingLotSerializer, SlotSerializer , VehicleSerializer




@api_view(["GET"])
def list_vehicles(request):
    vehicles = Vehicle.objects.all().order_by("id")
    serializer = VehicleSerializer(vehicles, many=True)
    return Response(serializer.data)

    
@api_view(["GET"])
def list_lots(request):
    lots = ParkingLot.objects.all().order_by("id")
    serializer = ParkingLotSerializer(lots, many=True)
    return Response(serializer.data)


@api_view(["GET"])
def get_available_slots(request, lot_id):
    slots = Slot.objects.filter(lot_id=lot_id, is_occupied=False).order_by("number")
    serializer = SlotSerializer(slots, many=True)
    return Response(serializer.data)


@api_view(["GET", "POST"])
def bookings(request):
    if request.method == "GET":
        booking_list = Booking.objects.select_related("vehicle", "slot", "slot__lot").all().order_by("-start_time")
        serializer = BookingSerializer(booking_list, many=True)
        return Response(serializer.data)

    serializer = BookingSerializer(data=request.data)
    if serializer.is_valid():
        slot = serializer.validated_data["slot"]

        # ← add this guard
        if slot.is_occupied:
            return Response(
                {"detail": "Slot is already occupied."},
                status=status.HTTP_400_BAD_REQUEST
            )

        booking = serializer.save(start_time=timezone.now())

        # mark slot occupied
        slot.is_occupied = True
        slot.save()

        return Response(BookingSerializer(booking).data, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["PATCH"])
def checkout_booking(request, booking_id):
    try:
        booking = Booking.objects.select_related("slot").get(id=booking_id)
    except Booking.DoesNotExist:
        return Response({"detail": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)

    if booking.end_time is not None:
        return Response({"detail": "Booking already checked out."}, status=status.HTTP_400_BAD_REQUEST)

    booking.end_time = timezone.now()
    booking.save()

    booking.slot.is_occupied = True
    booking.slot.save()

    return Response(BookingSerializer(booking).data)
