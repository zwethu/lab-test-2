# Quality Gate Review — Campus Equipment Booking API

Reviewed using `quality_gate.md` (instructor-provided) after the first ~30
minutes of work, against the running implementation and `TEST_EVIDENCE.md`.

## Findings

| Quality Gate area | Finding | Action taken | Evidence |
|---|---|---|---|
| Accuracy / Reliability | A malformed or missing JSON body on `POST`/`PATCH /bookings` crashed into a raw `500 Internal Server Error` in **plain text**, not the required `{ "error": "..." }` JSON format — violating the "every error response is JSON" rule even though it wasn't a case the curl guide happened to test. | Added `parseJsonBody()` to catch the JSON parse failure and return `400 {"error":"invalid JSON body"}` instead, in both `POST` and `PATCH`. Also added a global `app.onError` handler so any other unexpected error still returns JSON, not a raw server error page. | Re-tested with `curl -X POST ... -d '{not valid json'` and with no body at all: both now return `400` with `{"error":"invalid JSON body"}` instead of `500` plain text. Confirmed `GET /api/health` still returns `200` after the change (no regression). |
| Reliability | During testing, an overlap check was run (`POST` for `eq-1`, 12:30–13:30) *before* any other booking occupied that slot, and it correctly returned `201` rather than `409` — initially looked like the overlap rule wasn't firing, but it hadn't been given anything to conflict with yet. | Re-ran the sequence in the right order: updated an existing booking onto `eq-1` 12:00–14:00, then retried the same overlapping `POST` — it correctly returned `409`. This confirmed the overlap check (`start_at < ? AND end_at > ?`, scoped to the same `equipment_id`, excluding the row's own id) only rejects genuine clashes, not every booking on busy equipment. | `TEST_EVIDENCE.md` case 5 (201, no conflict yet) vs. case 8 (409, real conflict) — same equipment, different outcome depending on actual time-range overlap. |
| Reasoning / You Own It | Initially couldn't point to where the `400`/`404` status codes were actually produced — the `POST`/`PATCH` route handlers only contain `return c.json({ error: error.message }, error.status)`, with no literal `400` or `404` visible in the handler itself. | Traced the code: both codes are decided inside the shared `validateBooking()` helper (required-field check → `400`, date-order check → `400`, `equipmentExists()` check → `404`), which the route handlers just forward. Verified this by triggering each branch individually with curl and matching the response to the specific `if` block that must have produced it. | Confirmed via curl: missing field → `400`, bad `startAt`/`endAt` order → `400`, unknown `equipmentId` → `404` — each traced back to its exact line in `validateBooking()` in `src/app.ts`. |
| Delivery Quality / Execution Value | `npm run dev` failed with `Error: listen EADDRINUSE: address already in use :::8787` — a leftover server process from an earlier run was still holding the port, so the API couldn't start. | Identified the stale process with `lsof -i :8787` / `fuser -k 8787/tcp`, killed it, and restarted cleanly. Documented this exact symptom and fix in `README.md`'s troubleshooting section so it's reproducible without re-debugging. | `npm run dev` started successfully afterward (`API running at http://localhost:8787/api`); the fix command is now written down in `README.md`. |

## Submission Decision

**READY** — all required deliverables (contract, CRUD, validation, status
codes, parameter binding, test evidence, this review) are complete and
verified against the instructor's own checklist and curl guide. The one real
bug found during review (malformed JSON body) is fixed and re-tested with no
regressions.
