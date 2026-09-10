# Bernie — Roadmap to n8n / Zapier parity

**Goal, in one sentence:** a saved workflow runs with the browser closed.

That is the whole gap. Everything else — more integrations, nicer canvas, more
operations — is incremental. This one is categorical.

---

## Where we are

Bernie's execution engine *is* the React tree. Ten node components carry the
same effect — `AiNode`, `AppNode`, `ChatNode`, `FlushNode`, `HttpNode`,
`InsightsNode`, `JsonCardNode`, `MeetNode`, `ScriptNode`, `TextNode`:

```tsx
useEffect(() => { if (data.status === 'running') run(); }, [data.status]);
```

A run starts when the Trigger node's button calls `runWorkflow`
([Canvas.tsx:291](src/components/Canvas.tsx#L291)), which calls
`handleNodeDataUpdate` ([Canvas.tsx:241](src/components/Canvas.tsx#L241)) to
stamp `status: 'running'` on the direct downstream targets. Each of those runs
itself, reports back through `onDataFetched`, and the cascade continues one hop
at a time. Consequences:

- A workflow only runs while a tab is open and a human clicks **Run Workflow**.
- No run history; the only record is whatever is on the node.
- Workflows live in `localStorage` under `bernie-autosave`
  ([Canvas.tsx:173](src/components/Canvas.tsx#L173),
  [:195](src/components/Canvas.tsx#L195)) — per-browser.
- Credentials live in `localStorage` under `bernie-integrations`
  ([integrations.ts:16](src/lib/integrations.ts#L16)) and ride along in each
  request body from the browser ([AppNode.tsx:85](src/components/nodes/AppNode.tsx#L85)).

### What is solid

- **Operation registry** — [operations/index.ts](src/lib/operations/index.ts).
  73 declarative specs across 12 integrations: 24 Asana, 21 Supabase/Keepa/
  GitHub, 13 Sheets/Drive, 15 AI/MCP/HTTP. The picker and the server dispatch
  read the same list, so they cannot drift.
- **Pure request builder** — [operationEngine.ts:264](src/lib/operationEngine.ts#L264)
  turns a spec + params + rows into a concrete request. No I/O, unit tested.
- **Thin runner** — [operationRunner.ts:869](src/server/operationRunner.ts#L869),
  with 27 bespoke handlers ([:838](src/server/operationRunner.ts#L838)) only
  where an app is not a single REST call, behind one route,
  `POST /api/integrations/execute` ([executeRoute.ts:17](src/server/executeRoute.ts#L17)).
- **Credential precedence** — [nodeConfig.ts:51](src/lib/nodeConfig.ts#L51):
  node credentials → node params → saved connection → env
  ([integrationKit.ts:35](src/server/integrationKit.ts#L35)).
- **A real default graph** — [defaultWorkflow.ts:142](src/lib/defaultWorkflow.ts#L142)
  seeds a fresh canvas with 7-node ASIN issue triage. The first graph in the
  repo worth running end to end, so it is the acceptance test for every phase.
- The test suite is green and `tsc --noEmit` is clean.

### What is not solid

- **`src/lib/workflowEngine.ts` is imported by nothing but its own test.**
  670 lines, well covered, zero production callers; the canvas re-implements
  propagation itself. The previous draft read this module as "the executor we
  already have." It is a correct, tested, orphaned skeleton — which means
  nothing depends on its signature and Phase 1 can repoint it without breaking
  a caller. Cheaper, not harder.
- **Neither executor is a topological sort.** The canvas cascade and
  `simulateWorkflowExecution` ([workflowEngine.ts:564](src/lib/workflowEngine.ts#L564))
  both run a node the moment its *first* parent finishes. On a fan-in the
  second parent's rows are dropped — silently in the canvas, because
  `data.status` is already `'running'` and the effect does not re-fire. The
  default workflow fans out but never in, which is why nobody has hit this.
- **A failed node stops the world without saying so.** Downstream nodes are
  never enqueued after an error, so they are simply absent from `steps`.
  `StepExecutionResult` declares `status: 'skipped'`
  ([workflowEngine.ts:35](src/lib/workflowEngine.ts#L35)); nothing emits it.
- **The Script node fabricates input.** `ScriptNode.tsx:27` falls back to
  `{ data: "sample input" }` when nothing is connected, so a misconnected node
  produces plausible garbage instead of failing. (Its sibling bug — canvas
  edits never reaching node data — was fixed by the write-through at
  `ScriptNode.tsx:17`, which is what unblocks Phase 1.)
- **Nine dead API routes** still accept credentials: `/api/asana/tasks`,
  `/api/keepa/products`, `/api/supabase/rows`, `/api/sheets/rows`
  ([server.ts:183](server.ts#L183) on) and `/api/openrouter/complete`,
  `/api/huggingface/complete`, `/api/opencode/prompt`, `/api/mcp/rpc`,
  `/api/drive/files` ([providerRoutes.ts:39](src/server/providerRoutes.ts#L39)
  on). No callers in `src/`; superseded by `/api/integrations/execute`.
- **No authentication, and an open proxy.** `app.use(cors())` with no origin
  allowlist ([server.ts:32](server.ts#L32)) plus `POST /api/proxy`
  ([server.ts:138](server.ts#L138)), which forwards an arbitrary URL, method,
  headers and body — so any page in any browser that can reach this server can
  use it to fetch internal hosts. Fine on localhost, disqualifying the moment
  it is deployed, which Phase 3 requires.
- **No request timeouts.** `probe` ([integrationKit.ts:145](src/server/integrationKit.ts#L145))
  calls `fetch` with no `AbortSignal`, and the `timeoutMs` field the HTTP
  integration exposes ([integrationCore.ts:341](src/lib/integrationCore.ts#L341))
  is read by nothing.

Line references in the previous draft had drifted: `runOperation` is at 869,
not 795; the `Buffer.from` Node-ism at 594, not 521; `/api/integrations/test`
is an 11-branch if-chain, not 10.

---

## Why the next step is cheap here

**1. The traversal is written and tested.** `simulateWorkflowExecution` does
cycle detection, ordered traversal, per-node input/output capture and a step
report, then calls `executeNodeSimulation`
([workflowEngine.ts:361](src/lib/workflowEngine.ts#L361)) — the fake. Swap that
one call for `runOperation` and it is a real engine. Its fan-in and skip bugs
need fixing anyway, and a pure function with an existing test file is the
cheapest place that will ever happen.

**2. Nothing imports it,** so Phase 1 is additive until the canvas is
repointed — a separate, revertible commit.

**3. The operation layer is already runtime-agnostic** — `fetch` plus pure
functions. The only Node-isms in the whole path:

| Where | What | Fix |
|---|---|---|
| [operationRunner.ts:594](src/server/operationRunner.ts#L594) | `Buffer.from(x, 'base64')` for GitHub file content | `atob` |
| [integrationKit.ts:35](src/server/integrationKit.ts#L35) | `process.env.*` for env fallbacks | Worker `env` binding |
| [integrationKit.ts:21](src/server/integrationKit.ts#L21) | `@google/genai` client built at module load | lazy, or Gemini REST |

Unknown: `@google/genai` on Workers is untested. The Gemini REST API works
there, so worst case that one node calls REST directly.

---

## Phases

### Phase 1 — Extract the executor  ← start here

Graph execution out of React and into a pure function that runs identically in
Express today and a Worker later.

```
executeGraph(nodes, edges, { credentials, googleToken, initialPayload, runOp })
  → { success, steps: StepExecutionResult[], errors }
```

- Extends `src/lib/workflowEngine.ts`. No Express, Worker or React imports —
  `runOperation` is injected, not imported, so the pure module never reaches
  into `src/server/`.
- Real topological order: a node runs when *every* parent has produced output,
  and receives all of their rows. Fixes the fan-in drop. A failed node marks
  its whole downstream closure `'skipped'` and says so.
- Each step records node id, operation, input rows, output rows, duration,
  error — the record Phase 4 reads.
- Error policy per node: `stop` (default) / `continue` / route to an error
  branch. n8n's "continue on fail" is the pattern to copy.
- `POST /api/workflows/run` takes a graph and returns the step report. The
  canvas posts the graph and renders the result instead of ten components
  running themselves.

**Done when:** the default ASIN triage workflow runs to completion through
`POST /api/workflows/run` with the tab closed mid-run, and the step report
names all seven nodes.

**Touches:** `src/lib/workflowEngine.ts`, new `src/server/workflowRoute.ts`,
`src/components/Canvas.tsx`, `tests/unit/workflowEngine.test.ts`.

### Phase 2 — Persist workflows and runs

Workflow definitions (id, name, graph JSON, owner, updated_at) and runs (id,
workflow_id, trigger source, status, started/finished, step results) in
**Supabase Postgres** — identity already lives there
([auth.ts:72](src/lib/auth.ts#L72)). Replaces the `localStorage` autosave as
source of truth; local autosave stays a draft buffer.

**Done when:** a workflow saved in one browser opens in another, and a run
started via the API is readable from the database afterwards.

**Touches:** `src/components/Canvas.tsx`, new `src/lib/workflowStore.ts`, new
server routes, a Supabase migration.

### Phase 3 — Triggers

The point at which Bernie stops needing a human. **Webhook:**
`POST /hooks/:workflowId`, body becomes the initial payload, per-workflow
secret in the path or an HMAC header. **Schedule:** Cron Triggers enqueue the
workflow. **Polling:** later — it needs cursor state per workflow (last-seen id
or timestamp) so it does not re-emit the same rows.

Blocked on the credential decision below and on the server growing
authentication. A 3am cron run has no browser to read `localStorage` from.

**Done when:** the ASIN triage workflow runs on a schedule, on its own, and the
run appears in the runs table.

### Phase 4 — Run history UI

What makes n8n debuggable: a list of runs, and per node the exact input and
output rows with the error if it failed. Phase 1's step records are already the
right shape. Needs the redaction pass in Guardrails first. **Touches:** a new
history page, `src/lib/workflowStore.ts`.

---

## Cloudflare mapping

**Yes, Workers** — but the platform is the vehicle, not the step. "Runs without
a browser" is the goal; do not let "port to Workers" become the goal. Webhook
routes and Cron Triggers cover Phase 3; Queues cover fan-out and backoff; and
**Cloudflare Workflows** gives durable execution — retries, resume, multi-step
state — as a primitive, which is most of an engine for free. Workflow and run
storage stays in Supabase Postgres.

---

## Open decisions

**1. Credential storage — needs a call before Phase 3.** Keys cannot stay in
`localStorage`; they must be stored server-side and **encrypted at rest**.
Cloudflare Secrets Store if the executor is fully on Cloudflare, Supabase Vault
or an encrypted column keyed per user if secrets should sit next to identity.
Leaning Vault, because auth already lives there and per-user scoping falls out
of RLS. Sharpened since the last draft: the Supabase integration's `apiKey`
([integrationCore.ts:62](src/lib/integrationCore.ts#L62)) may hold a service
role key — `envConfig` prefers `SUPABASE_SERVICE_ROLE_KEY`
([integrationKit.ts:51](src/server/integrationKit.ts#L51)) — and a service role
key in `localStorage` bypasses every RLS policy in the project. Fix that
specific case before the general one.

**2. Cloudflare vs Supabase split.** Auth is on Supabase, and Supabase could
host all of this too (Edge Functions + `pg_cron`); going Cloudflare means two
backends. Recommendation: **Cloudflare for execution, Supabase for data and
identity.** Durable execution beats rolling retry/resume on `pg_cron`, and
Workers is the better webhook edge. Do not duplicate identity or workflow
storage into D1.

---

## Deferred, in priority order

1. **Expression / field mapping** — the #2 gap and n8n's real power:
   `{{ $json.name }}` to wire one node's output field into another's parameter.
   Bernie has rows but every parameter is a literal. Do it after Phase 1; the
   executor is what makes per-item context available. The default workflow
   papers over this with two script nodes.
2. **Item-level iteration** — n8n runs a node once per item with per-item error
   handling; Bernie passes whole row sets. `runAsanaCreateTasks`
   ([operationRunner.ts:514](src/server/operationRunner.ts#L514)) is the first
   per-row handler and shows the problem: it loops sequentially and throws on
   the first failure, leaving earlier tasks created with no record of which.
3. **Polling triggers** — needs the cursor state described in Phase 3.
4. **Sub-workflows / reusable groups.**
5. **Pagination.** No operation pages results; Asana and Sheets cap silently.

---

## Known carry-over items

- **Supabase Google sign-in is unverified end to end.** The pure logic is unit
  tested (URL building, fragment parsing, JWT decode, expiry); the live
  redirect needs Google enabled under Authentication → Providers and the app
  origin listed under URL Configuration → Redirect URLs.
- **Google token lifetime.** Supabase does not refresh the `provider_token`, so
  Drive/Sheets access lapses after an hour
  ([auth.ts:28](src/lib/auth.ts#L28)). A server-side run hits the same wall —
  the companion Apps Script path
  ([companionCode.ts:524](src/lib/companionCode.ts#L524)) exists to avoid it.
- **Sheets/Drive happy paths are unit-tested only**, never run against a live
  Google account. Same for the default workflow's two Sheets nodes.
- **`/api/integrations/test` is an 11-branch if-chain**
  ([server.ts:410](server.ts#L410)). Left alone deliberately: each branch was
  verified live against a real API, and a refactor risks that for a linter
  score. Revisit if it grows again.
- **The Drive Google Picker was removed** with the old single-purpose node; it
  needed `VITE_GOOGLE_API_KEY`, never set, so it almost certainly never worked.
- **`package.json` still calls the project `react-example`**, its `clean`
  script still shells out to `rm -rf`, and there is no `engines` field or
  linter beyond `tsc --noEmit`.

---

## Guardrails

- The executor stays a pure function in `src/lib/` — no Express, no Worker, no
  React imports. That is what keeps it portable and testable.
- Every operation stays a declarative spec. Adding a call type should remain a
  spec entry, never a new handler and route.
- Never log credentials or full row payloads in run history without a redaction
  pass. Bernie's rows carry Amazon sales data and Asana task bodies.
- A destructive operation (`rows.delete`, `tasks.delete`) needs a filter or an
  explicit id. That rule exists in the runner
  ([operationRunner.ts:250](src/server/operationRunner.ts#L250)); keep it when
  execution moves server-side and nobody is watching.
- `new Function()` runs user script with the privileges of whoever hosts it
  ([ScriptNode.tsx:26](src/components/nodes/ScriptNode.tsx#L26),
  [workflowEngine.ts:444](src/lib/workflowEngine.ts#L444)). In the browser that
  is the page, which holds every API key in `localStorage`; on a server it
  would be the process. Sandboxing the script node is a prerequisite for Phase
  1 leaving localhost, not a follow-up.
