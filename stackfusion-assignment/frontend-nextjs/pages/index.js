import { useCallback, useEffect, useState } from "react";
import SlotGrid from "../components/SlotGrid";
import { fetchAvailableSlots, fetchLots, fetchVehicles } from "../lib/api";

export default function HomePage() {
  const [lots, setLots] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [slots, setSlots] = useState([]);
  const [selectedLot, setSelectedLot] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchLots().then(setLots).catch((err) => setError(err.message));
    fetchVehicles().then(setVehicles).catch((err) => setError(err.message));
  }, []);

  const loadSlots = useCallback(async () => {
    if (!selectedLot) {
      setError("Please select a parking lot first.");
      return;
    }
    try {
      setError("");
      const parsed = await fetchAvailableSlots(selectedLot);
      setSlots(parsed);
    } catch (err) {
      setError(err.message);
    }
  }, [selectedLot]);

  return (
    <main style={{ maxWidth: 800, margin: "20px auto", fontFamily: "sans-serif" }}>
      <h1>Parking Management Dashboard</h1>

      <div style={{ marginBottom: 12 }}>
        <label htmlFor="lot">Parking Lot: </label>
        <select id="lot" value={selectedLot} onChange={(e) => setSelectedLot(e.target.value)}>
          <option value="">Select lot</option>
          {lots.map((lot) => (
            <option key={lot.id} value={lot.id}>
              {lot.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label htmlFor="vehicle">Vehicle: </label>
        <select id="vehicle" value={selectedVehicle} onChange={(e) => setSelectedVehicle(e.target.value)}>
          <option value="">Select vehicle</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.number_plate} (ID: {v.id})
            </option>
          ))}
        </select>
      </div>

      <button onClick={loadSlots}>Load Available Slots</button>

      {error ? <p style={{ color: "red" }}>{error}</p> : null}

      <h3 style={{ marginTop: 24 }}>Slots</h3>
      <SlotGrid slots={slots} selectedVehicle={selectedVehicle} fetchSlots={loadSlots} />
    </main>
  );
}