# Parking Management — Bug Fixes & Changes

This document describes all bugs found and fixed across the three services:
Django backend, Go backend, and Next.js frontend.

---

## Summary

| # | Service | File | Bug | Severity |
|---|---------|------|-----|----------|
| 1 | Django | `parking/views.py` | Available slots returned occupied slots instead of free ones | Critical |
| 2 | Django | `parking/views.py` | Booking creation never marked slot as occupied | Critical |
| 3 | Django | `parking/serializers.py` | `depth=1` broke POST — serializer rejected integer FK fields | Critical |
| 4 | Django | `parking/serializers.py` | `start_time` required on POST but injected by view — failed validation | Critical |
| 5 | Django | `parking/views.py` + `urls.py` | No vehicles endpoint — frontend had no way to list valid vehicles | Missing feature |
| 6 | Django | `parking_project/settings.py` + `requirements.txt` | CORS not configured — browser blocked all frontend requests | Critical |
| 7 | Go | `main.go` | Wrong JOIN column `s.slot_id` (should be `s.id`) — query returned nothing | Critical |
| 8 | Go | `main.go` | Wrong WHERE clause `IS NOT NULL` — returned completed bookings as active | Critical |
| 9 | Frontend | `lib/api.js` | Django port was `8001` instead of `8000` | Critical |
| 10 | Frontend | `pages/index.js` | `fetchAvailableSlots()` called without `lotId` argument — URL was `/lots/undefined/slots/available/` | Critical |
| 11 | Frontend | `pages/index.js` | No guard when no lot selected — could fire request with empty lot ID | Bug |
| 12 | Frontend | `pages/index.js` | Stale closure on `loadSlots` — after booking, grid refreshed with wrong lot ID | Bug |
| 13 | Frontend | `pages/index.js` | Vehicle input was free text — users could enter non-existent IDs causing 400 errors | Bug |
| 14 | Frontend | `components/SlotGrid.js` | `fetchSlots()` never called after booking — grid stayed stale | Bug |
| 15 | Frontend | `lib/api.js` | Error message was generic — real server error was hidden from user | UX |

---

## Bug Details & Fixes

---

### Bug 1 — Available slots filter was inverted

**File:** `backend-django/parking/views.py`

**Problem:** The query filtered `is_occupied=True`, returning slots that are already taken.
Available slots have `is_occupied=False`.

```python
# Before (wrong)
slots = Slot.objects.filter(lot_id=lot_id, is_occupied=True)

# After (fixed)
slots = Slot.objects.filter(lot_id=lot_id, is_occupied=False)
```

---

### Bug 2 — Booking creation never marked slot as occupied

**File:** `backend-django/parking/views.py`

**Problem:** When a booking was created, the view saved the booking record but never
updated `slot.is_occupied = True`. This meant the same slot could be booked multiple
times simultaneously.

```python
# After serializer.save(), add:
booking.slot.is_occupied = True
booking.slot.save()
```

Also added an occupancy guard to reject double-bookings at the server level:

```python
slot = serializer.validated_data["slot"]
if slot.is_occupied:
    return Response(
        {"detail": "Slot is already occupied."},
        status=status.HTTP_400_BAD_REQUEST
    )
```

---

### Bug 3 — `depth=1` on BookingSerializer broke POST requests

**File:** `backend-django/parking/serializers.py`

**Problem:** DRF's `depth = 1` option auto-generates nested read-only serializers for FK
fields. When the frontend POSTed `{"vehicle": 1, "slot": 2}` as plain integers, DRF
rejected them because it was now expecting full nested objects.

```python
# Before (broken)
class Meta:
    model = Booking
    fields = "__all__"
    depth = 1

# After (fixed) — separate read vs write fields explicitly
class BookingSerializer(serializers.ModelSerializer):
    vehicle_detail = VehicleSerializer(source="vehicle", read_only=True)
    slot_detail = SlotSerializer(source="slot", read_only=True)

    class Meta:
        model = Booking
        fields = ["id", "vehicle", "slot", "vehicle_detail", "slot_detail", "start_time", "end_time"]
        read_only_fields = ["start_time", "end_time"]
```

---

### Bug 4 — `start_time` was required on POST but set by the view

**File:** `backend-django/parking/serializers.py`

**Problem:** DRF validates all fields before `save()` is called. The view injected
`start_time` via `serializer.save(start_time=timezone.now())`, but DRF blocked the
request before reaching that line because `start_time` was not in the POST body.

**Fix:** Add `start_time` and `end_time` to `read_only_fields` so DRF skips validation
for them on input but still returns them on output.

```python
read_only_fields = ["start_time", "end_time"]
```

---

### Bug 5 — No vehicles endpoint

**Files:** `backend-django/parking/views.py`, `backend-django/parking/urls.py`

**Problem:** There was no API endpoint to list vehicles. The frontend had to use a free
text input for Vehicle ID, causing users to enter IDs that don't exist in the database,
leading to intermittent 400 errors.

**Fix:** Added a new endpoint:

```python
# views.py
@api_view(["GET"])
def list_vehicles(request):
    vehicles = Vehicle.objects.all().order_by("id")
    serializer = VehicleSerializer(vehicles, many=True)
    return Response(serializer.data)

# urls.py
path("vehicles/", list_vehicles, name="list-vehicles"),
```

---

### Bug 6 — CORS not configured

**Files:** `backend-django/requirements.txt`, `backend-django/parking_project/settings.py`

**Problem:** The browser blocked all API calls from `localhost:3000` to `localhost:8000`
because Django did not send `Access-Control-Allow-Origin` headers.

**Fix:** Install and configure `django-cors-headers`:

```
# requirements.txt
django-cors-headers>=4.3
```

```python
# settings.py
INSTALLED_APPS = [
    "corsheaders",   # must be before other apps
    ...
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",   # must be first
    ...
]

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
]
```

---

### Bug 7 — Wrong JOIN column in Go active-bookings SQL

**File:** `backend-go/main.go`

**Problem:** The SQL joined `b.slot_id = s.slot_id`, but Django names the primary key
`id`, not `slot_id`. This column does not exist, so the query returned no rows.

```sql
-- Before (wrong)
JOIN parking_slot s ON b.slot_id = s.slot_id

-- After (fixed)
JOIN parking_slot s ON b.slot_id = s.id
```

---

### Bug 8 — Wrong WHERE clause in Go active-bookings SQL

**File:** `backend-go/main.go`

**Problem:** Active bookings are ones where `end_time IS NULL` (still in progress).
The query used `IS NOT NULL`, which returned completed bookings instead — the exact
opposite of the intended behaviour.

```sql
-- Before (wrong)
WHERE b.end_time IS NOT NULL

-- After (fixed)
WHERE b.end_time IS NULL
```

---

### Bug 9 — Wrong Django API port in frontend

**File:** `frontend-nextjs/lib/api.js`

**Problem:** The base URL pointed to port `8001` but Django runs on port `8000`.
Every single API call from the frontend failed with connection refused.

```js
// Before (wrong)
const API_DJANGO_BASE = "http://localhost:8001/api";

// After (fixed)
const API_DJANGO_BASE = "http://localhost:8000/api";
```

---

### Bug 10 — `fetchAvailableSlots()` called without argument

**File:** `frontend-nextjs/pages/index.js`

**Problem:** The `loadSlots` function called `fetchAvailableSlots()` with no argument,
so `lotId` was `undefined` and the request URL became `/lots/undefined/slots/available/`,
returning a 404 every time.

```js
// Before (wrong)
const parsed = await fetchAvailableSlots();

// After (fixed)
const parsed = await fetchAvailableSlots(selectedLot);
```

---

### Bug 11 — No guard when no lot is selected

**File:** `frontend-nextjs/pages/index.js`

**Problem:** Clicking "Load Available Slots" without selecting a lot silently fired a
request with an empty lot ID.

```js
// Added guard at top of loadSlots
if (!selectedLot) {
  setError("Please select a parking lot first.");
  return;
}
```

---

### Bug 12 — Stale closure on `loadSlots`

**File:** `frontend-nextjs/pages/index.js`

**Problem:** `loadSlots` was defined as a plain `async function`, which captures
`selectedLot` from the render in which it was created. When `SlotGrid` called
`fetchSlots()` after a booking, it used the old version of the function where
`selectedLot` was still `""`, causing the slot grid to refresh with the wrong lot.

**Fix:** Wrap in `useCallback` with `selectedLot` as a dependency so `SlotGrid` always
receives a fresh reference:

```js
const loadSlots = useCallback(async () => {
  ...
}, [selectedLot]);
```

---

### Bug 13 — Vehicle input was free text allowing invalid IDs

**File:** `frontend-nextjs/pages/index.js`

**Problem:** The vehicle field was a number `<input>`. Users could type any integer,
including IDs that do not exist in the database. Django would return a 400 with
`{"vehicle": ["Invalid pk X - object does not exist."]}`. This was the root cause of
intermittent booking failures.

**Fix:** Replace the text input with a `<select>` dropdown populated from the new
`/api/vehicles/` endpoint. Invalid vehicle IDs become impossible to submit.

```jsx
// Before
<input type="number" value={selectedVehicle} onChange={...} />

// After
<select value={selectedVehicle} onChange={...}>
  <option value="">Select vehicle</option>
  {vehicles.map((v) => (
    <option key={v.id} value={v.id}>{v.number_plate} (ID: {v.id})</option>
  ))}
</select>
```

---

### Bug 14 — Slot grid not refreshed after booking

**File:** `frontend-nextjs/components/SlotGrid.js`

**Problem:** After a successful booking, `fetchSlots` was never called. The booked slot
remained visible in the grid as if it were still available.

```js
// Before
alert("Booking created");

// After
alert("Booking created");
await fetchSlots();   // refresh grid — booked slot disappears
```

---

### Bug 15 — Generic error message hid real server errors

**File:** `frontend-nextjs/lib/api.js`

**Problem:** `createBooking` threw a generic `"Failed to create booking"` string on any
error. The actual server message (e.g. `"Slot is already occupied."`) was discarded,
making debugging nearly impossible.

```js
// Before
if (!res.ok) throw new Error("Failed to create booking");

// After
if (!res.ok) {
  const err = await res.json().catch(() => ({}));
  const msg = err.detail || JSON.stringify(err);
  throw new Error(msg);
}
```

---

## Files Changed

| File | Changes |
|------|---------|
| `backend-django/requirements.txt` | Added `django-cors-headers` |
| `backend-django/parking_project/settings.py` | Added CORS middleware and allowed origins |
| `backend-django/parking/views.py` | Fixed available slots filter, added occupancy guard, mark slot occupied on booking, added `list_vehicles` view |
| `backend-django/parking/serializers.py` | Removed `depth=1`, added explicit read fields, added `read_only_fields` for timestamps |
| `backend-django/parking/urls.py` | Added `/vehicles/` route |
| `backend-go/main.go` | Fixed JOIN column (`s.slot_id` → `s.id`), fixed WHERE clause (`IS NOT NULL` → `IS NULL`) |
| `frontend-nextjs/lib/api.js` | Fixed port `8001` → `8000`, added `fetchVehicles`, improved error messages |
| `frontend-nextjs/pages/index.js` | Added `useCallback`, lot selection guard, vehicles dropdown, stale closure fix |
| `frontend-nextjs/components/SlotGrid.js` | Call `fetchSlots()` after booking success, improved vehicle ID validation |
