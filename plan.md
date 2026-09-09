# Bernie — Roadmap to n8n / Zapier parity

**Goal, in one sentence:** a saved workflow runs with the browser closed.

That is the whole gap. Everything else — more integrations, nicer canvas, more
operations — is incremental. This one is categorical.

---

## Where we are

Bernie's execution engine *is* the React tree. Ten node components each carry:

```tsx
useEffect(() => { if (data.status === 'running') run(); }, [data.status]);
```

…and [Canvas.tsx](src/components/Canvas.tsx) propagates `status: 'running'` to
downstream nodes after each node reports its output. Consequences:

- A workflow only runs while a tab is open and a human clicks **Run**.
- There is no run history; the only record is whatever is on the node.
- Workflows live in `localStorage` (`bernie-autosave`), so they are per-browser.
- Credentials live in `localStorage` and ride along in each request from the
  browser.

What is already solid and worth building on:

- **Operation registry** — 6 files in [src/lib/operations/](src/lib/operations/),
  ~24 Asana operations plus Sheets / Supabase / Drive / GitHub / Keepa / the AI
  providers / MCP / Custom HTTP. Each is a declarative spec.
- **Pure request builder** — [operationEngine.ts:262](src/lib/operationEngine.ts:262)
  turns a spec + params + rows into a concrete `fetch` request.
- **Thin runner** — [operationRunner.ts:795](src/server/operationRunner.ts:795)
  executes one operation, with bespoke branches only where an app is not a
  single REST call.
- **One route** — `POST /api/integrations/execute`.
- **Credential precedence** — [nodeConfig.ts:51](src/lib/nodeConfig.ts:51):
  node credentials → node params → saved connection → env.

---

## Why this step is cheap here

Two things make it far smaller than it sounds.

**1. The topological executor already exists.**
[`simulateWorkflowExecution`](src/lib/workflowEngine.ts:564) already does cycle
detection, ordered traversal, per-node input/output capture, and a step report.
It calls [`executeNodeSimulation`](src/lib/workflowEngine.ts:361) — the fake.
Swap that one call for `runOperation` and it is a real engine.

**2. The operation layer is already runtime-agnostic.**
Execution is `fetch` plus pure functions. The only Node-isms in the whole path:

| Where | What | Fix |
|---|---|---|
| `operationRunner.ts:521` | `Buffer.from(x, 'base64')` for GitHub file content | `atob` |
| `integrationKit.ts` | `process.env.*` for env fallbacks | Worker `env` binding |

Unknown: `@google/genai` on Workers is untested. The Gemini REST API works
there, so worst case that one node calls REST directly.

---

## Phases

### Phase 1 — Extract the executor  ← start here

Pull graph execution out of React into a pure function that runs identically in
Express today and a Worker later.

```
executeGraph(nodes, edges, { credentials, googleToken, initialPayload })
  → { success, steps: StepResult[], errors }
```

- Lives in `src/lib/` (not `src/server/`), so it stays runtime-agnostic.
- Reuses the traversal from `simulateWorkflowExecution`; calls `runOperation`
  per node instead of the simulator.
- Each step records: node id, operation, input rows, output rows, duration,
  error. This is what the run-history UI later reads.
- Error policy per node: `stop` (default) / `continue` / route to an error
  branch. n8n's "continue on fail" is the pattern to copy.
- The canvas keeps working: the browser path becomes "POST the graph to
  `/api/workflows/run` and render the returned steps", rather than ten
  components running themselves.

Self-contained, testable with no Cloudflare account, and a prerequisite for
everything below.

### Phase 2 — Persist workflows and runs

- Workflow definitions: id, name, graph JSON, owner, updated_at.
- Runs: id, workflow_id, trigger source, status, started/finished, step results.
- Store in **Supabase Postgres** (identity already lives there — see the
  decision below).
- Replaces `localStorage` autosave as the source of truth; keep local autosave
  as a draft buffer.

### Phase 3 — Triggers

The point at which Bernie stops needing a human.

- **Webhook:** `POST /hooks/:workflowId` on a Worker. Body becomes the initial
  payload. Per-workflow secret in the path or an HMAC header.
- **Schedule:** Cloudflare Cron Triggers → enqueue the workflow.
- **Polling:** later. It needs cursor state per workflow (last-seen id or
  timestamp) so it does not re-emit the same rows.

### Phase 4 — Run history UI

The thing that makes n8n debuggable: a list of runs, and per node the exact
input and output rows with the error if it failed. Phase 1's step records are
already the right shape for this.

---

## Cloudflare mapping

Recommendation: **yes, Workers** — but the platform is the vehicle, not the
step. "Runs without a browser" is the goal; do not let "port to Workers" become
the goal.

| Need | Primitive |
|---|---|
| Webhook endpoint per workflow | Worker route |
| Schedules | Cron Triggers |
| Durable multi-step runs, retries, resume | **Cloudflare Workflows** — durable execution as a primitive, which is most of an engine for free |
| Fan-out, backoff | Queues |
| Workflow + run storage | Supabase Postgres (see decision) |

---

## Open decisions

### 1. Credential storage — needs a call before Phase 3

A 3am cron run has no browser, so keys cannot stay in `localStorage`. They must
be stored server-side and **encrypted at rest**. Options:

- **Cloudflare Secrets Store** — good if the executor is fully on Cloudflare.
- **Supabase Vault / encrypted column, keyed per user** — keeps secrets next to
  identity; one backend for user data.

Leaning Supabase Vault, because auth already lives there and per-user key
scoping falls out of RLS. This is a real security decision, not a detail.

### 2. Cloudflare vs Supabase split

Auth moved to Supabase, and Supabase could host all of this too (Edge Functions
+ `pg_cron`). Going Cloudflare means two backends.

Recommendation: **Cloudflare for execution, Supabase for data and identity.**
Cloudflare Workflows as durable execution is a genuinely better fit than
rolling retry/resume on `pg_cron`, and Workers is the better webhook edge. Do
not duplicate identity or workflow storage into D1. Use D1 only if the executor
needs to be self-contained.

---

## Deferred, in priority order

1. **Expression / field mapping** — the #2 gap, and n8n's real power:
   `{{ $json.name }}` to wire one node's output field into another's parameter.
   Bernie has rows but every parameter is a literal. Do this after Phase 1;
   the executor is what makes per-item context available.
2. **Item-level iteration** — n8n runs a node once per item with per-item
   error handling. Bernie passes whole row sets.
3. **Polling triggers** — needs the cursor state described in Phase 3.
4. **Sub-workflows / reusable groups.**

---

## Known carry-over items

Tracked so they do not get lost between sessions.

- **Supabase Google sign-in round trip is unverified.** The pure logic is unit
  tested (URL building, fragment parsing, JWT decode, expiry) but the live
  redirect needs a configured Supabase project: Google enabled under
  Authentication → Providers, and the app origin under Authentication → URL
  Configuration → Redirect URLs.
- **Google token lifetime.** Supabase does not refresh the Google
  `provider_token`, so Drive/Sheets access lapses after an hour. The account
  card detects this and offers a reconnect. A server-side run will hit the same
  wall — the companion Apps Script path exists precisely to avoid it.
- **Sheets/Drive happy paths are unit-tested only**, never run against a live
  Google account.
- **`/api/integrations/test` is a 10-branch if-chain** the complexity checker
  dislikes. Left alone deliberately: each branch was verified live against a
  real API, and a refactor risks that for a linter score. Revisit if it grows.
- **The Drive Google Picker was removed** with the old single-purpose node. It
  required `VITE_GOOGLE_API_KEY`, which was never set, so it almost certainly
  never worked. `files.list` + a file-ID param covers the same need.

---

## Guardrails

- The executor stays a pure function in `src/lib/` — no Express, no Worker, no
  React imports. That is what keeps it portable and testable.
- Every operation stays a declarative spec. Adding a call type should remain a
  spec entry, never a new handler and route.
- Never log credentials or full row payloads in run history without a redaction
  pass.
- A destructive operation (`rows.delete`, `tasks.delete`) needs a filter or an
  explicit id. That rule already exists in the runner; keep it when execution
  moves server-side and nobody is watching.
