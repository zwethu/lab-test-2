import { Hono, type Context } from "hono";
import { db, newId } from "./db.js";

export const app = new Hono();

app.get("/api/health", (c) => c.json({ status: "ok" }));

// ---- Equipment ----

app.get("/api/equipment", (c) => {
  const rows = db.prepare("SELECT id, name, location FROM equipment").all();
  return c.json(rows);
});

// ---- Bookings ----

type BookingRow = {
  id: string;
  equipment_id: string;
  borrower_name: string;
  start_at: string;
  end_at: string;
  purpose: string;
};

type BookingInput = {
  equipmentId: string;
  borrowerName: string;
  startAt: string;
  endAt: string;
  purpose: string;
};

function toResponse(row: BookingRow) {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    borrowerName: row.borrower_name,
    startAt: row.start_at,
    endAt: row.end_at,
    purpose: row.purpose,
  };
}

function equipmentExists(equipmentId: string): boolean {
  const row = db
    .prepare("SELECT id FROM equipment WHERE id = ?")
    .get(equipmentId);
  return row !== undefined;
}

// Two ranges overlap if startA < endB AND endA > startB.
function hasOverlap(
  equipmentId: string,
  startAt: string,
  endAt: string,
  excludeId?: string
): boolean {
  const row = db
    .prepare(
      `SELECT id FROM bookings
       WHERE equipment_id = ?
         AND id != ?
         AND start_at < ?
         AND end_at > ?
       LIMIT 1`
    )
    .get(equipmentId, excludeId ?? "", endAt, startAt);
  return row !== undefined;
}

/** Validates required fields and business rules.
 *  Returns an error { status, message } or null if valid. */
function validateBooking(
  body: Record<string, unknown>
): { status: 400 | 404; message: string } | null {
  const { equipmentId, borrowerName, startAt, endAt, purpose } = body;

  if (
    typeof equipmentId !== "string" ||
    typeof borrowerName !== "string" ||
    typeof startAt !== "string" ||
    typeof endAt !== "string" ||
    typeof purpose !== "string" ||
    !equipmentId ||
    !borrowerName ||
    !startAt ||
    !endAt ||
    !purpose
  ) {
    return {
      status: 400,
      message:
        "equipmentId, borrowerName, startAt, endAt, purpose are required strings",
    };
  }

  const start = Date.parse(startAt);
  const end = Date.parse(endAt);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return { status: 400, message: "startAt and endAt must be valid dates" };
  }
  if (start >= end) {
    return { status: 400, message: "startAt must be before endAt" };
  }

  if (!equipmentExists(equipmentId)) {
    return { status: 404, message: "equipmentId not found" };
  }

  return null;
}

app.get("/api/bookings", (c) => {
  const rows = db.prepare("SELECT * FROM bookings").all() as BookingRow[];
  return c.json(rows.map(toResponse));
});

app.get("/api/bookings/:id", (c) => {
  const row = db
    .prepare("SELECT * FROM bookings WHERE id = ?")
    .get(c.req.param("id")) as BookingRow | undefined;

  if (!row) return c.json({ error: "booking not found" }, 404);
  return c.json(toResponse(row));
});

async function parseJsonBody(c: Context): Promise<Record<string, unknown> | null> {
  try {
    return await c.req.json<Record<string, unknown>>();
  } catch {
    return null;
  }
}

app.post("/api/bookings", async (c) => {
  const body = await parseJsonBody(c);
  if (body === null) return c.json({ error: "invalid JSON body" }, 400);

  const error = validateBooking(body);
  if (error) return c.json({ error: error.message }, error.status);

  const input = body as unknown as BookingInput;

  if (hasOverlap(input.equipmentId, input.startAt, input.endAt)) {
    return c.json(
      { error: "booking overlaps an existing booking for this equipment" },
      409
    );
  }

  const id = newId();
  db.prepare(
    `INSERT INTO bookings (id, equipment_id, borrower_name, start_at, end_at, purpose)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, input.equipmentId, input.borrowerName, input.startAt, input.endAt, input.purpose);

  const row = db.prepare("SELECT * FROM bookings WHERE id = ?").get(id) as BookingRow;
  return c.json(toResponse(row), 201);
});

app.patch("/api/bookings/:id", async (c) => {
  const id = c.req.param("id");
  const existing = db
    .prepare("SELECT * FROM bookings WHERE id = ?")
    .get(id) as BookingRow | undefined;
  if (!existing) return c.json({ error: "booking not found" }, 404);

  const body = await parseJsonBody(c);
  if (body === null) return c.json({ error: "invalid JSON body" }, 400);

  const merged: Record<string, unknown> = {
    equipmentId: body.equipmentId ?? existing.equipment_id,
    borrowerName: body.borrowerName ?? existing.borrower_name,
    startAt: body.startAt ?? existing.start_at,
    endAt: body.endAt ?? existing.end_at,
    purpose: body.purpose ?? existing.purpose,
  };

  const error = validateBooking(merged);
  if (error) return c.json({ error: error.message }, error.status);

  const input = merged as unknown as BookingInput;

  if (hasOverlap(input.equipmentId, input.startAt, input.endAt, id)) {
    return c.json(
      { error: "booking overlaps an existing booking for this equipment" },
      409
    );
  }

  db.prepare(
    `UPDATE bookings
     SET equipment_id = ?, borrower_name = ?, start_at = ?, end_at = ?, purpose = ?
     WHERE id = ?`
  ).run(input.equipmentId, input.borrowerName, input.startAt, input.endAt, input.purpose, id);

  const row = db.prepare("SELECT * FROM bookings WHERE id = ?").get(id) as BookingRow;
  return c.json(toResponse(row));
});

app.delete("/api/bookings/:id", (c) => {
  const id = c.req.param("id");
  const existing = db.prepare("SELECT id FROM bookings WHERE id = ?").get(id);
  if (!existing) return c.json({ error: "booking not found" }, 404);

  db.prepare("DELETE FROM bookings WHERE id = ?").run(id);
  return c.body(null, 204);
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal server error" }, 500);
});
