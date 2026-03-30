import { createBooking } from "../lib/api";

export default function SlotGrid({ slots, selectedVehicle, fetchSlots }) {
  async function handleBook(slotId) {
    const vehicleId = Number(selectedVehicle);
  
    // ← stronger guard: checks for empty, 0, NaN
    if (!vehicleId || isNaN(vehicleId) || vehicleId <= 0) {
      alert("Please enter a valid Vehicle ID (a positive number)");
      return;
    }
  
    try {
      await createBooking({
        vehicle: vehicleId,
        slot: slotId
      });
      alert("Booking created");
      await fetchSlots();   // refresh grid so booked slot disappears
    } catch (err) {
      alert(err.message);
    }
  }

  if (!slots.length) {
    return <p>No slots found.</p>;
  }

  return (
    <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "repeat(3, 1fr)" }}>
      {slots.map((slot) => (
        <button key={slot.id} onClick={() => handleBook(slot.id)}>
          Slot {slot.number} - {slot.is_occupied ? "Occupied" : "Free"}
        </button>
      ))}
    </div>
  );
}
