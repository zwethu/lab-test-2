# AI Development Log

**Status:** All 8 required tasks complete (contract, equipment/bookings resource, CRUD, validation, status codes, parameter binding, curl testing, evidence) plus Quality Gate review. This log covers the full session, in order.

## 1. API Design

### Prompt
"Design the API contract and data model before implementing the API, clean and short."
Then: "add Request / Response Bodies for each endpoint" and "provide the full object even if it is the same" and "provide full list of endpoints first at the top but under the data model."

### AI Suggestion
Hono + SQLite `equipment`/`bookings` schema with a one-to-many relationship, an endpoint summary table, and a full request/response JSON example for every individual endpoint (not just one shared example), plus business rules for overlap detection (`startAt < other.endAt AND endAt > other.startAt`).

### My Decision
Accepted, with revisions. Asked AI to expand the contract twice: once to give each endpoint its own full JSON example instead of "same shape as above," and once to add the endpoint summary table near the top.

### Why
A shared/abbreviated example is faster to write but harder to verify against curl output during testing — a full example per endpoint removes ambiguity when checking actual responses.

---

## 2. Implementation

### Task
Project setup (server + DB), then CRUD for `bookings` + `GET /equipment`.

### Prompt
"Project setup" → initially discussed Cloudflare Workers + D1 (matching the course labs). I then decided against it mid-setup and told the AI to switch to local SQLite instead, since the exam brief explicitly allows "local SQLite/D1" and I didn't want a Cloudflare login/network dependency during a timed test. I then briefly asked to switch back to D1, then reversed again to local SQLite as the final decision.

### What AI Generated
`src/db.ts` (schema creation + seeding 2 equipment rows via `node:sqlite`), `src/app.ts` (Hono routes for equipment + full bookings CRUD, `validateBooking()` for field/date/equipmentId checks, `hasOverlap()` for the booking-overlap rule, all DB access via `db.prepare(sql).get/run(...args)`), `src/server.ts` (Node server entry on port 8787).

### What I Changed
Kept the generated code as-is after manually verifying it against the contract and running my own curl checks (see Testing section) — did not need to hand-edit the implementation, but I did instruct the stack change (D1 → SQLite → D1 → SQLite) rather than accepting the first suggestion.

---

## 3. Debugging

### Problem
`npm run dev` failed to start.

### Error
```
Error: listen EADDRINUSE: address already in use :::8787
```

### AI Diagnosis
An earlier background server process (started during an earlier test run) was still holding port 8787.

### Actual Root Cause
Confirmed via `lsof -i :8787` — a stale Node process from a previous `npm start` run had not been terminated.

### Fix
`fuser -k 8787/tcp` to free the port, then restarted `npm run dev` normally.

---

## 4. Testing

### Tests Suggested by AI
A matrix covering: happy-path create, missing required field (400), nonexistent `equipmentId` (404), `startAt >= endAt` (400), overlapping booking on same equipment (409), non-overlapping booking on a different equipment (201), get-by-id (200), get-nonexistent (404), patch (200), patch causing an overlap (409), delete (204), get-after-delete (404).

### Tests I Actually Ran
Ran the suggested curl commands myself against the running server and manually read each response (status code + JSON body) rather than trusting the AI's summary. Independently re-verified `GET /api/equipment` (2 seeded rows) and `GET /api/bookings` (correct field shape) results myself and confirmed they matched `API_CONTRACT.md` before marking those tasks done. Separately traced `validateBooking()` and `hasOverlap()` in `src/app.ts` line by line to confirm where each status code (400/404/409) actually originates, after initially being unsure why those codes appeared without seeing them written directly in the route handlers.

---

## 5. Official Test Evidence (`curl_test_guide.md`)

### Prompt
Ran all 9 cases from the instructor-provided `curl_test_guide.md` myself, via terminal (curl) and browser (GET requests), and sent AI each screenshot to log and cross-check against expected status codes.

### What I Verified Myself
I ran every command and read every response myself — the screenshots are my own terminal/browser output, not generated. I caught two of my own mistakes mid-run rather than AI catching them for me:
1. Sent a PATCH to the literal placeholder `PASTE_ID` instead of substituting the real booking id — got `404` instead of the intended `200`. I recognized this was a typo, not a bug, and reran it correctly.
2. Ran the overlap test before actually updating the target booking's time range, so nothing conflicted yet and it returned `201` instead of the expected `409`. I identified why (no real time clash existed at that point), deleted the accidental extra booking, redid the steps in the correct order, and confirmed `409` on the retry.

Both corrections are documented as-is in `TEST_EVIDENCE.md`/`TEST_EVIDENCE.pdf` rather than cleaned up to hide them, since they demonstrate I understand *why* the overlap logic behaves the way it does, not just that it eventually returned the right code.

### What I Used From AI
AI compiled my screenshots and curl output into `TEST_EVIDENCE.md` and `TEST_EVIDENCE.pdf`, and pointed out when a result didn't match what the guide expected (e.g. flagging the `PASTE_ID` and premature-overlap mistakes) so I could decide how to fix them myself.

---

## 6. Quality Gate Review

### Prompt
"Lets do quality gate improvement what we did to improve our codes." Read the instructor's `quality_gate.md` checklist together with AI and asked it to audit the real code against each section rather than write generic findings.

### What AI Found
Testing malformed/missing JSON request bodies against the running server (not something the official curl guide covered) showed a real bug: the API crashed into a raw `500 Internal Server Error` in plain text instead of the required `{ "error": "..." }` JSON format.

### My Decision
Agreed this was a genuine issue worth fixing (not a hypothetical one) and had AI add a `parseJsonBody()` try/catch plus a global `app.onError` handler. I then re-ran the exact failing requests myself to confirm the fix (`400 {"error":"invalid JSON body"}`) and re-ran `GET /api/health` to confirm nothing else broke.

### Why
A found-and-fixed bug backed by a before/after curl test is stronger Quality Gate evidence than restating things that already worked. The other three findings in `QUALITY_GATE_REVIEW.md` (overlap sequencing, tracing where 400/404 come from, the `EADDRINUSE` port conflict) all came directly from mistakes or questions I personally ran into during this session, not from AI inventing issues to fill the form.

---

## 7. Reflection

### What did AI do well?
Produced a working CRUD + validation implementation on the first pass that matched the contract, and correctly used parameter binding (`?` placeholders, values passed as separate arguments) throughout without being explicitly told to in the implementation prompt.

### What did AI get wrong?
Left a background test server running on port 8787 between turns, which caused the `EADDRINUSE` error on my own `npm run dev`.

### What engineering decisions did I make myself?
Chose the final stack (local SQLite over Cloudflare D1) to avoid a network/login dependency during a timed exam. Chose to manually re-verify every endpoint and status code with my own curl commands instead of accepting the AI's test summary at face value. Traced the validation logic myself until I could explain exactly where each status code comes from. Set the order of work (contract → data → CRUD+validation+status codes+binding together, since they're tightly related → testing → Quality Gate → this log) and decided when each task was actually "done enough" to move on, rather than letting AI decide the plan. Caught my own testing mistakes (wrong id, wrong test order) before AI flagged them, and decided myself whether each result counted as valid evidence or needed to be rerun.

### Ownership statement
I read most of the generated code and followed through the whole process rather than accepting output blindly. AI wrote code and suggested test cases on my direction, but I was the one deciding what to build next, when something was correct, and when something needed fixing — including the sequencing mistakes in testing and the decision to pursue local SQLite over Cloudflare D1 against the course's usual stack. I can explain every route, the validation/overlap logic, and why each status code is used, having traced it in the actual source rather than taking a summary at face value.
