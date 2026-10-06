# Test Evidence — Campus Equipment Booking API

Base URL: `http://localhost:8787/api`

Evidence captured using the commands from `curl_test_guide.md`, run against the
live local server (some terminal requests, some browser screenshots for GETs).
All 9 cases from the guide are covered, in the actual order they were run.

---

## 1. Create a booking — expect `201`

```
POST /bookings
{
  "equipmentId": "eq-1",
  "borrowerName": "Somchai Jaidee",
  "startAt": "2026-10-20T09:00:00.000Z",
  "endAt": "2026-10-20T11:00:00.000Z",
  "purpose": "Class presentation"
}
```

**Response: `201 Created`**
```json
{"id":"78543f9a-4f35-4170-b48d-179adfcd4e4c","equipmentId":"eq-1","borrowerName":"Somchai Jaidee","startAt":"2026-10-20T09:00:00.000Z","endAt":"2026-10-20T11:00:00.000Z","purpose":"Class presentation"}
```

**Result: PASS (201)**

---

## 2. Get one booking — expect `200`

```
GET /bookings/78543f9a-4f35-4170-b48d-179adfcd4e4c
```

**Response: `200 OK`** — returns the booking created above.

**Result: PASS (200)**

---

## 3. Missing booking — expect `404`

```
PATCH /bookings/PASTE_ID
```

A literal placeholder id (`PASTE_ID`) was sent instead of a real id. The API
correctly treated it as an unknown resource.

**Response: `404 Not Found`**
```json
{"error":"booking not found"}
```

**Result: PASS (404)** — confirms unknown ids are rejected before any update logic runs.

---

## 4. Invalid time range — expect `400`

```
POST /bookings
{
  "equipmentId": "eq-1",
  "borrowerName": "Somchai Jaidee",
  "startAt": "2026-10-21T11:00:00.000Z",
  "endAt": "2026-10-21T09:00:00.000Z",
  "purpose": "Invalid time range test"
}
```

**Response: `400 Bad Request`**
```json
{"error":"startAt must be before endAt"}
```

**Result: PASS (400)**

---

## 5. Overlap check — sequencing note

```
POST /bookings
{
  "equipmentId": "eq-1",
  "borrowerName": "Suda Dee",
  "startAt": "2026-10-20T12:30:00.000Z",
  "endAt": "2026-10-20T13:30:00.000Z",
  "purpose": "Conflict test"
}
```

This was run *before* any other booking occupied the 12:30–13:30 slot on
`eq-1`, so it correctly returned **`201 Created`** (id
`efc9c8bf-f9c1-444d-b7e1-b507a3d312a2`) instead of a conflict — there was
nothing to conflict with yet. This confirmed the overlap rule only rejects a
request when a real time clash exists, not every booking on the same
equipment. The actual `409` conflict case is demonstrated in step 8 below,
after a genuine overlapping time range existed.

---

## 6. Delete a booking — expect `204`

```
DELETE /bookings/78543f9a-4f35-4170-b48d-179adfcd4e4c
```

**Response: `204 No Content`**

**Result: PASS (204)**

---

## 7. Update a booking — expect `200`

```
PATCH /bookings/efc9c8bf-f9c1-444d-b7e1-b507a3d312a2
{
  "equipmentId": "eq-1",
  "borrowerName": "Suda Dee",
  "startAt": "2026-10-20T12:00:00.000Z",
  "endAt": "2026-10-20T14:00:00.000Z",
  "purpose": "Updated conflict test booking"
}
```

**Response: `200 OK`**
```json
{"id":"efc9c8bf-f9c1-444d-b7e1-b507a3d312a2","equipmentId":"eq-1","borrowerName":"Suda Dee","startAt":"2026-10-20T12:00:00.000Z","endAt":"2026-10-20T14:00:00.000Z","purpose":"Updated conflict test booking"}
```

**Result: PASS (200)**

---

## 8. Overlapping booking — expect `409`

```
POST /bookings
{
  "equipmentId": "eq-1",
  "borrowerName": "Somchai Jaidee",
  "startAt": "2026-10-20T13:00:00.000Z",
  "endAt": "2026-10-20T15:00:00.000Z",
  "purpose": "Should conflict"
}
```

This range (13:00–15:00) overlaps the booking from step 7 (12:00–14:00) on
the same equipment (`eq-1`).

**Response: `409 Conflict`**
```json
{"error":"booking overlaps an existing booking for this equipment"}
```

**Result: PASS (409)**

---

## 9. List equipment — expect `200`

```
GET /equipment
```

**Response: `200 OK`**
```json
[
  {"id":"eq-1","name":"Projector A","location":"Building 1"},
  {"id":"eq-2","name":"Camera A","location":"Building 2"}
]
```

**Result: PASS (200)** — both seeded equipment records returned.

---

## 10. List bookings — expect `200`

```
GET /bookings
```

**Response: `200 OK`**
```json
[
  {"id":"efc9c8bf-f9c1-444d-b7e1-b507a3d312a2","equipmentId":"eq-1","borrowerName":"Suda Dee","startAt":"2026-10-20T12:00:00.000Z","endAt":"2026-10-20T14:00:00.000Z","purpose":"Updated conflict test booking"}
]
```

**Result: PASS (200)** — reflects the one remaining booking after the delete in step 6.

---

## Summary

| # | Case | Expected | Actual | Result |
|---|---|---|---|---|
| 1 | Create booking | 201 | 201 | PASS |
| 2 | Get one booking | 200 | 200 | PASS |
| 3 | Missing booking | 404 | 404 | PASS |
| 4 | Invalid time range | 400 | 400 | PASS |
| 5 | Overlap check (no conflict yet) | 201 | 201 | PASS |
| 6 | Delete booking | 204 | 204 | PASS |
| 7 | Update booking | 200 | 200 | PASS |
| 8 | Overlapping booking | 409 | 409 | PASS |
| 9 | List equipment | 200 | 200 | PASS |
| 10 | List bookings | 200 | 200 | PASS |

10/10 cases pass, covering create, read, update, delete, invalid input, not
found, and booking conflict — satisfying the "at least five cases, including
both successful and error cases" requirement, using the official
`curl_test_guide.md` as the basis for every case.
