# API Contract — Campus Equipment Booking

Base URL: `http://localhost:8787/api`

## Data Model

```
equipment
  id           TEXT PRIMARY KEY
  name         TEXT NOT NULL
  location     TEXT NOT NULL

bookings
  id             TEXT PRIMARY KEY
  equipment_id   TEXT NOT NULL REFERENCES equipment(id)
  borrower_name  TEXT NOT NULL
  start_at       TEXT NOT NULL   -- ISO datetime
  end_at         TEXT NOT NULL   -- ISO datetime
  purpose        TEXT NOT NULL
```

Relationship: one equipment → many bookings.

Business rules:
- `equipmentId` must reference an existing equipment row.
- `startAt` must be before `endAt`.
- A booking must not overlap an existing booking for the same `equipmentId`.
  Two ranges overlap if `startAt < other.endAt AND endAt > other.startAt`.

## Endpoint List

| Method | Path | Success | Error |
|---|---|---|---|
| GET | `/equipment` | 200 | — |
| GET | `/bookings` | 200 | — |
| GET | `/bookings/:id` | 200 | 404 |
| POST | `/bookings` | 201 | 400, 404, 409 |
| PATCH | `/bookings/:id` | 200 | 400, 404, 409 |
| DELETE | `/bookings/:id` | 204 | 404 |

## Endpoints

All errors use: `{ "error": "message" }`

### `GET /equipment`

Response `200`:
```json
[
  { "id": "eq-1", "name": "Projector A", "location": "Building 1" }
]
```

---

### `GET /bookings`

Response `200`:
```json
[
  {
    "id": "bk-1",
    "equipmentId": "eq-1",
    "borrowerName": "Somchai Jaidee",
    "startAt": "2026-10-20T09:00:00.000Z",
    "endAt": "2026-10-20T11:00:00.000Z",
    "purpose": "Class presentation"
  }
]
```

---

### `GET /bookings/:id`

Response `200`:
```json
{
  "id": "bk-1",
  "equipmentId": "eq-1",
  "borrowerName": "Somchai Jaidee",
  "startAt": "2026-10-20T09:00:00.000Z",
  "endAt": "2026-10-20T11:00:00.000Z",
  "purpose": "Class presentation"
}
```

Response `404`: booking `id` not found.

---

### `POST /bookings`

Request body:
```json
{
  "equipmentId": "eq-1",
  "borrowerName": "Somchai Jaidee",
  "startAt": "2026-10-20T09:00:00.000Z",
  "endAt": "2026-10-20T11:00:00.000Z",
  "purpose": "Class presentation"
}
```

Response `201`:
```json
{
  "id": "bk-1",
  "equipmentId": "eq-1",
  "borrowerName": "Somchai Jaidee",
  "startAt": "2026-10-20T09:00:00.000Z",
  "endAt": "2026-10-20T11:00:00.000Z",
  "purpose": "Class presentation"
}
```

Errors:
- `400` — missing/invalid field, or `startAt >= endAt`
- `404` — `equipmentId` does not exist
- `409` — overlaps an existing booking for the same equipment

---

### `PATCH /bookings/:id`

Request body: same shape as `POST`, partial fields allowed.

Response `200`:
```json
{
  "id": "bk-1",
  "equipmentId": "eq-1",
  "borrowerName": "Somchai Jaidee",
  "startAt": "2026-10-20T09:00:00.000Z",
  "endAt": "2026-10-20T11:00:00.000Z",
  "purpose": "Class presentation"
}
```

Errors:
- `400` — invalid field value, or `startAt >= endAt`
- `404` — booking `id` not found, or `equipmentId` does not exist
- `409` — updated time range overlaps another booking for the same equipment

---

### `DELETE /bookings/:id`

Response `204`: no body.
Response `404`: booking `id` not found.
