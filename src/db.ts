import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";

export const db = new DatabaseSync("./data.db");

db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS equipment (
    id       TEXT PRIMARY KEY,
    name     TEXT NOT NULL,
    location TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id            TEXT PRIMARY KEY,
    equipment_id  TEXT NOT NULL REFERENCES equipment(id),
    borrower_name TEXT NOT NULL,
    start_at      TEXT NOT NULL,
    end_at        TEXT NOT NULL,
    purpose       TEXT NOT NULL
  );
`);

const { count } = db
  .prepare("SELECT COUNT(*) AS count FROM equipment")
  .get() as { count: number };

if (count === 0) {
  const insert = db.prepare(
    "INSERT INTO equipment (id, name, location) VALUES (?, ?, ?)"
  );
  insert.run("eq-1", "Projector A", "Building 1");
  insert.run("eq-2", "Camera A", "Building 2");
}

export function newId() {
  return randomUUID();
}
