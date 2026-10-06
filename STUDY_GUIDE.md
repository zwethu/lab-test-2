# Midterm Practical Lab Test — Quick Reference
Tue 6 Oct 2026, 13:00–17:00 · Individual hands-on REST API build

Based on your course labs (Wk03 API workshop, Wk04 Database, Wk05 Security, Wk06
Integration), your stack is almost certainly **Cloudflare Workers + Hono + D1 +
TypeScript** (every lab uses this combo). If the prompt specifies something else
(Express, Next.js route handlers — both appear briefly in Wk06), swap the
syntax but keep the same design thinking below.

AI tools are allowed as assistants — you still have to explain every line.
After minute 30, go back and run the **AI Quality Gate**: re-read your own
code, check validation/status codes/SQL binding, and fix anything you can't
explain.

---

## 1. REST API Design & CRUD

Design the contract **before** coding: resource → fields → endpoints → status
codes. Standard CRUD shape for a resource (swap `tasks` for whatever the
scenario names):

| Method | Endpoint          | Purpose        | Success | Error |
|--------|-------------------|----------------|---------|-------|
| GET    | `/api/tasks`      | List all       | 200     | —     |
| GET    | `/api/tasks/:id`  | Get one        | 200     | 404   |
| POST   | `/api/tasks`      | Create         | 201     | 400   |
| PATCH/PUT | `/api/tasks/:id` | Update partial/full | 200 | 400, 404 |
| DELETE | `/api/tasks/:id`  | Delete         | 204     | 404   |
| GET    | `/api/health`     | Health check   | 200     | —     |

Conventions used in every lab:
- Plural nouns, no verbs in the URL (`/tasks`, not `/getTasks`).
- Wrap collection/item responses as `{ "data": ... }`, errors as `{ "error": "..." }`.
- `id` as path param, never in the body for GET/DELETE.

Minimal Hono skeleton:

```typescript
import { Hono } from "hono";

type Bindings = { DB: D1Database };
const app = new Hono<{ Bindings: Bindings }>();

app.get("/api/health", (c) => c.json({ status: "ok" }));

app.get("/api/tasks", async (c) => {
  const result = await c.env.DB
    .prepare("SELECT * FROM tasks ORDER BY created_at DESC")
    .all();
  return c.json({ data: result.results });
});

export default app;
```

---

## 2. Database Modelling / ERD / Schema

D1 is SQLite. Typical table for this course's "task-like" resource:

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,                 -- or INTEGER PRIMARY KEY AUTOINCREMENT
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'doing', 'done')),
  owner_id TEXT,                       -- FK-ish reference if scenario needs ownership
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE INDEX idx_tasks_status ON tasks(status);
```

ERD basics to mention when asked to "explain":
- **Primary key** uniquely identifies a row (`id`).
- **NOT NULL** = required field.
- **DEFAULT** = value used when omitted.
- **CHECK** = enforces an enum/range at the DB level, not just in app code.
- **Foreign key** (e.g. `owner_id REFERENCES users(id)`) = relationship between tables — draw this as a one-to-many arrow if the scenario has users → tasks.
- Index on columns you filter/sort by often (`status`, `owner_id`).

Migration commands (if using wrangler/D1 locally):

```bash
npx wrangler d1 migrations create DB create_tasks
npx wrangler d1 migrations apply DB --local
npx wrangler d1 execute DB --local --command="SELECT * FROM tasks"
```

---

## 3. Input Validation, Error Handling, HTTP Status Codes

Validate before touching the DB. Return **400** for bad client input, not 500.

```typescript
app.post("/api/tasks", async (c) => {
  const body = await c.req.json<{ title?: string; description?: string }>();

  if (!body.title?.trim()) {
    return c.json({ error: "title is required" }, 400);
  }

  const status = body.status ?? "pending";
  if (!["pending", "doing", "done"].includes(status)) {
    return c.json({ error: "invalid status" }, 400);
  }

  // ...insert...
  return c.json({ data: task }, 201);
});
```

Status code cheat sheet:

| Code | Meaning | When |
|------|---------|------|
| 200  | OK | successful GET/PATCH/PUT |
| 201  | Created | successful POST |
| 204  | No Content | successful DELETE (no body) |
| 400  | Bad Request | missing/invalid fields, failed validation |
| 401  | Unauthorized | missing/invalid credentials |
| 403  | Forbidden | authenticated but not allowed |
| 404  | Not Found | id doesn't exist (also used instead of 403 to avoid leaking existence of a resource you don't own) |
| 409  | Conflict | duplicate / idempotency conflict |
| 500  | Server Error | unexpected — catch and log, never leak stack traces to the client |

Wrap unexpected errors so you never return a raw stack trace:

```typescript
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal server error" }, 500);
});
```

---

## 4. SQL Parameter Binding & Basic API Security

**Never** concatenate user input into SQL strings. Always use `.prepare(sql).bind(values)`:

```typescript
// ❌ SQL injection risk
await c.env.DB.exec(`SELECT * FROM tasks WHERE id = '${id}'`);

// ✅ parameterized
await c.env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first();
```

Basic API security checklist (don't need full OAuth/RBAC unless asked):
- Parameterized queries everywhere (above).
- Validate **every** field from the client — type, length, enum membership.
- Never trust client-supplied `id`/`owner_id` for who the user is — derive identity from auth (token/header), not from the request body.
- Return **404** (not 403) when a user requests a resource they don't own, so you don't leak that the resource exists.
- Don't echo secrets, DB errors, or stack traces in responses.
- If an API key/token is required, check it in middleware before the handler runs:

```typescript
app.use("/api/*", async (c, next) => {
  const auth = c.req.header("Authorization");
  if (!auth || auth !== `Bearer ${c.env.API_TOKEN}`) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
});
```

---

## 5. CORS & Connecting to a Provided Frontend Tester

If the frontend tester runs on a different origin/port than your API, the
browser will block requests unless you enable CORS. With Hono:

```typescript
import { cors } from "hono/cors";

app.use("/api/*", cors({
  origin: "*",                              // or a specific origin for stricter setups
  allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));
```

Plain Express equivalent (if the scenario uses Express instead):

```javascript
const cors = require("cors");
app.use(cors({ origin: "*" }));
```

Notes:
- If frontend and API are served from the **same origin** (same dev server / same Worker), CORS isn't needed — use relative URLs (`fetch("/api/tasks")`), not absolute `http://localhost:...` URLs.
- CORS errors show up in the **browser console**, not in your terminal — if the tester "can't connect" but curl works fine, it's almost always a missing/misconfigured CORS header.
- Put the CORS middleware **before** your route handlers so it applies to all `/api/*` routes, including preflight `OPTIONS` requests.

---

## 6. Testing Success and Error Cases

For every endpoint, test at minimum:

1. **Happy path** — valid request → expected status + body.
2. **Missing required field** → 400.
3. **Invalid value** (e.g. bad enum/status) → 400.
4. **Nonexistent id** → 404.
5. **Delete then re-fetch** → 404 confirms it's gone.

```bash
# happy path
curl -X POST http://localhost:8787/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Test task"}'

# missing field -> 400
curl -X POST http://localhost:8787/api/tasks \
  -H "Content-Type: application/json" -d '{}'

# not found -> 404
curl http://localhost:8787/api/tasks/does-not-exist
```

Keep a short checklist as you go (mirrors Wk03 lab Part 10):

```text
[ ] GET    /api/health         -> 200
[ ] GET    /api/tasks          -> 200, {data:[...]}
[ ] GET    /api/tasks/:id      -> 200 / 404
[ ] POST   /api/tasks          -> 201 / 400
[ ] PATCH  /api/tasks/:id      -> 200 / 400 / 404
[ ] DELETE /api/tasks/:id      -> 204 / 404
[ ] Frontend tester can call the API (CORS OK)
```

---

## 7. Fast Workflow for the 4 Hours

1. Read the scenario fully; write the API contract (table above) on paper/comment first.
2. Create schema + migration, apply locally, verify with a `SELECT`.
3. Build endpoints one at a time: health → GET list → GET one → POST → PATCH → DELETE.
4. Add validation + status codes as you go, not at the end.
5. Add CORS, point the provided frontend tester at your API, confirm it loads.
6. Test every success + error case from section 6.
7. **30-min mark onward:** re-read your own code (AI Quality Gate) — can you explain every line? Fix validation gaps, confirm all SQL uses `.bind()`, check status codes match the table above.
