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
([Canvas.tsx:304](src/components/Canvas.tsx#L304)), which calls
`handleNodeDataUpdate` ([Canvas.tsx:254](src/components/Canvas.tsx#L254)) to
stamp `status: 'running'` on the direct downstream targets. Each of those runs
itself, reports back through `onDataFetched`, and the cascade continues one hop
at a time. Consequences:

- A workflow only runs while a tab is open and a human clicks **Run Workflow**.
- No run history; the only record is whatever is on the node.
- The working copy of a workflow lives in `localStorage` under
  `bernie-autosave` ([Canvas.tsx:182](src/components/Canvas.tsx#L182),
  [:204](src/components/Canvas.tsx#L204)) — per-browser. A named copy can now
  be pushed to a server (see below), but the canvas still boots from the local
  one.
- Credentials live in `localStorage` under `bernie-integrations`
  ([integrations.ts:16](src/lib/integrations.ts#L16)) and ride along in each
  request body from the browser ([AppNode.tsx:85](src/components/nodes/AppNode.tsx#L85)) —
  now to whichever API `apiBase()` resolves to, which may be a cross-origin
  Worker.

### What is solid

- **Operation registry** — [operations/index.ts](src/lib/operations/index.ts).
  82 declarative specs across 12 integrations: 25 Asana, 24 Supabase/Keepa/
  GitHub, 15 Sheets/Drive, 18 AI/MCP/HTTP. The picker and the server dispatch
  read the same list, so they cannot drift.
- **Pure request builder** — [operationEngine.ts:264](src/lib/operationEngine.ts#L264)
  turns a spec + params + rows into a concrete request. No I/O, unit tested.
- **Thin runner** — [operationRunner.ts:908](src/server/operationRunner.ts#L908),
  with 27 bespoke handlers ([:877](src/server/operationRunner.ts#L877)) only
  where an app is not a single REST call, behind one route,
  `POST /api/integrations/execute`.
- **That route is runtime-agnostic and already deployed.** Its body is
  `executeOperation` ([executeCore.ts:25](src/server/executeCore.ts#L25)), with
  no HTTP framework in it; Express
  ([executeRoute.ts:17](src/server/executeRoute.ts#L17)) and a Cloudflare
  Worker ([worker/index.ts:304](worker/index.ts#L304)) are two wrappers around
  the same call. This was the largest single piece of Phase 1's premise and it
  is done — see the phase notes below.
- **Credential precedence** — [nodeConfig.ts:51](src/lib/nodeConfig.ts#L51):
  node credentials → node params → saved connection → env
  ([runtime.ts:27](src/server/runtime.ts#L27), reading an injected env bag
  rather than `process.env`).
- **A real default graph** — [defaultWorkflow.ts:188](src/lib/defaultWorkflow.ts#L188)
  seeds a fresh canvas with 7-node ASIN issue triage, centred on the origin.
  The first graph in the repo worth running end to end, so it is the acceptance
  test for every phase.
- The test suite is green — 297 tests — and `npm run lint` and
  `npm run worker:lint` are both clean.

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
  ([server.ts:226](server.ts#L226) on) and `/api/openrouter/complete`,
  `/api/huggingface/complete`, `/api/opencode/prompt`, `/api/mcp/rpc`,
  `/api/drive/files` ([providerRoutes.ts:39](src/server/providerRoutes.ts#L39)
  on). No callers in `src/`; superseded by `/api/integrations/execute`. They
  now also duplicate, on Express only, what the Worker serves through one
  route — so the cost of keeping them went up and the reason for them did not.
- **No authentication, and an open proxy.** `app.use(cors())` with no origin
  allowlist ([server.ts:34](server.ts#L34)) plus `POST /api/proxy`
  ([server.ts:140](server.ts#L140)), which forwards an arbitrary URL, method,
  headers and body — so any page in any browser that can reach this server can
  use it to fetch internal hosts. Fine on localhost, disqualifying the moment
  it is deployed, which Phase 3 requires.
- **The Worker is deployed, gated on one shared secret, and that is the whole
  of its access control.** `denyUnlessAuthorized`
  ([worker/index.ts:55](worker/index.ts#L55)) checks `X-Bernie-Key` against
  `BERNIE_API_SECRET` and fails closed when none is set, which is the right
  shape and keeps the internet out of an endpoint that will fetch arbitrary
  URLs. But: everyone holds the same key, in `localStorage`; there is no
  revocation and no per-user distinction; `Access-Control-Allow-Origin` is `*`
  ([:34](worker/index.ts#L34)); there is no rate limiting; and the workflow
  owner is the `sub` claim of the Supabase access token **read without
  verifying the signature** ([:98](worker/index.ts#L98)), so past the shared
  secret one user can read and overwrite another's rows. Verifying against the
  Supabase project's JWKS is the first thing to fix — this is the debt the D1
  work took on knowingly.
- **No request timeouts.** `probe` ([runtime.ts:106](src/server/runtime.ts#L106))
  calls `fetch` with no `AbortSignal`, and the `timeoutMs` field the HTTP
  integration exposes ([integrationCore.ts:341](src/lib/integrationCore.ts#L341))
  is read by nothing.

Line references drift with every commit; the ones above were re-checked against
the tree at the time of writing. `/api/integrations/test` is an 11-branch
if-chain ([server.ts:453](server.ts#L453)), not 10.

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

**3. The operation layer is runtime-agnostic — and this is now proved, not
predicted.** The three Node-isms this section used to list have all been
removed, and the runner is running on a Worker:

| Was | Now |
|---|---|
| `Buffer.from(x, 'base64')` for GitHub file content | `atob` + `TextDecoder` ([operationRunner.ts:631](src/server/operationRunner.ts#L631)) |
| `process.env.*` for env fallbacks | `envConfig(id, env)` takes the env bag as an argument ([runtime.ts:27](src/server/runtime.ts#L27)) |
| `@google/genai` built at module load | injected as a `GeminiClient` ([operationRunner.ts:43](src/server/operationRunner.ts#L43)); Express passes the SDK, the Worker passes a REST implementation ([worker/index.ts:240](worker/index.ts#L240)) |

The old "unknown" — whether `@google/genai` runs on Workers — is moot: it is
never imported there. `src/server/runtime.ts` is now the line the split is
drawn on, and nothing in it may import express, the Gemini SDK, or a `node:`
module.

---

## Phases

### Phase 1 — Extract the executor  ← partly done, still the next step

Graph execution out of React and into a pure function that runs identically in
Express and a Worker.

```
executeGraph(nodes, edges, { credentials, googleToken, initialPayload, runOp })
  → { success, steps: StepExecutionResult[], errors }
```

**Done.** The *node*-level half of this, which was the risky half:

- The operation runner no longer contains anything Node-only, and the same
  `executeOperation` ([executeCore.ts:25](src/server/executeCore.ts#L25)) is
  served by Express and by a deployed Worker. Injection rather than import is
  already the pattern in use — `RunContext.gemini`
  ([operationRunner.ts:69](src/server/operationRunner.ts#L69)) is exactly the
  shape `runOp` was going to take.
- A statically hosted front end has a working API instead of a 405, which is
  what made "the executor runs somewhere other than this laptop" testable at
  all.

**Not done, and nothing runs with the tab closed because of it.** The executor
is still the React tree: ten node components still carry the
`status === 'running'` effect, `handleNodeDataUpdate`
([Canvas.tsx:254](src/components/Canvas.tsx#L254)) is still what propagates,
and closing the tab still stops the run mid-graph. What remains:

- `executeGraph` itself, extending `src/lib/workflowEngine.ts`. No Express,
  Worker or React imports — `runOperation` injected, not imported, so the pure
  module never reaches into `src/server/`.
- Real topological order: a node runs when *every* parent has produced output,
  and receives all of their rows. Fixes the fan-in drop. A failed node marks
  its whole downstream closure `'skipped'` and says so.
- Each step records node id, operation, input rows, output rows, duration,
  error — the record Phase 4 reads.
- Error policy per node: `stop` (default) / `continue` / route to an error
  branch. n8n's "continue on fail" is the pattern to copy.
- `POST /api/workflows/run` takes a graph and returns the step report, on the
  Worker beside `/api/workflows`. The canvas posts the graph and renders the
  result instead of ten components running themselves.

`src/lib/workflowCode.ts` is a useful check on the remaining work:
`executionOrder` ([:40](src/lib/workflowCode.ts#L40)) already walks the graph
in the order the canvas runs it, deliberately reproducing the fan-in bug. When
`executeGraph` lands, that walk and this one should agree — except on fan-in,
where the generator will need updating and the difference is the fix.

**Done when:** the default ASIN triage workflow runs to completion through
`POST /api/workflows/run` with the tab closed mid-run, and the step report
names all seven nodes.

**Touches:** `src/lib/workflowEngine.ts`, a new route on `worker/index.ts`,
`src/components/Canvas.tsx`, `tests/unit/workflowEngine.test.ts`.

### Phase 2 — Persist workflows and runs  ← workflows done, runs not

Workflow definitions and runs, off the browser and into a database.

**Done: workflow definitions.** They live in **Cloudflare D1**, not Supabase
Postgres as this plan previously assumed — `bernie-workflows`, one row per
workflow with the graph as JSON
([migrations/0001_workflows.sql](migrations/0001_workflows.sql)), served by
`/api/workflows` on the Worker
([worker/index.ts:149](worker/index.ts#L149)) and reached from the canvas
through `src/lib/workflowStore.ts` and the Saved tab of
`src/components/WorkflowPanel.tsx`. The dev server forwards `/api/workflows` to
the Worker ([server.ts:193](server.ts#L193)) so there is one implementation.
`localStorage` autosave is now the draft buffer this phase said it should
become.

Why D1 and not Supabase: the executor is going to Cloudflare regardless (see
below), and a workflow row is a blob with a name — it needs no joins, no RLS
policies and no relationship to the identity tables. Identity stays on
Supabase. The cost is that ownership is now enforced by hand rather than by
RLS, and it is currently enforced *badly* — the owner is an unverified JWT
claim (see "What is not solid"). That is the outstanding item of this phase,
not a footnote to it.

**Not done: runs.** There is no runs table, no run id, no step results, no
history — because there is no server-side executor to produce any. Phase 1
comes first. Saving is also create-only: the UI never passes an id, so saving
twice makes two rows rather than updating one.

**Done when:** a workflow saved in one browser opens in another *and the owner
check survives someone forging a token*, and a run started via the API is
readable from the database afterwards.

**Touches:** `worker/index.ts`, `migrations/`, `src/lib/workflowStore.ts`,
`src/components/WorkflowPanel.tsx`.

### Phase 3 — Triggers

The point at which Bernie stops needing a human. **Webhook:**
`POST /hooks/:workflowId` on the Worker, body becomes the initial payload,
per-workflow secret in the path or an HMAC header. **Schedule:** Cron Triggers
enqueue the workflow. **Polling:** later — it needs cursor state per workflow
(last-seen id or timestamp) so it does not re-emit the same rows.

The Worker that would host all three now exists, which removes the deployment
question but not the blocking ones: the credential decision below, and real
authentication rather than an unverified `sub`. A 3am cron run has no browser
to read `localStorage` from.

**Done when:** the ASIN triage workflow runs on a schedule, on its own, and the
run appears in the runs table.

### Phase 4 — Run history UI

What makes n8n debuggable: a list of runs, and per node the exact input and
output rows with the error if it failed. Phase 1's step records are already the
right shape. Needs the redaction pass in Guardrails first. **Touches:** a new
history page, `src/lib/workflowStore.ts`.

---

## Cloudflare mapping

**Yes, Workers**, and the Worker is now live: `wrangler.toml` /
`worker/index.ts`, serving `/api/workflows`, `/api/integrations/execute` and
`/api/health`, with a D1 binding. But the platform is still the vehicle, not
the step. "Runs without a browser" is the goal; do not let "port to Workers"
become the goal — the port has largely happened and the tab still has to stay
open, which is the whole point of the distinction.

Still ahead on the platform: Cron Triggers and webhook routes for Phase 3;
Queues for fan-out and backoff; and **Cloudflare Workflows** for durable
execution — retries, resume, multi-step state — which is most of an engine for
free.

**Storage has moved.** This plan previously said "workflow and run storage
stays in Supabase Postgres. Do not duplicate identity or workflow storage into
D1." Workflow storage is in D1. That was a deliberate reversal, on the grounds
that a workflow row is a self-contained blob and the executor is going to
Cloudflare anyway; identity was not duplicated and stays on Supabase. Runs are
undecided — they are read alongside workflows and written by the executor, so
D1 is the obvious default, but nothing has been built yet.

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
([runtime.ts:43](src/server/runtime.ts#L43)) — and a service role key in
`localStorage` bypasses every RLS policy in the project. Fix that specific case
before the general one. Newly urgent: those keys are now posted to whatever
`apiBase()` resolves to, which in a static deployment is a cross-origin Worker
rather than the page's own server.

**2. Cloudflare vs Supabase split — decided, partly.** Auth is on Supabase, and
Supabase could host all of this too (Edge Functions + `pg_cron`); going
Cloudflare means two backends. The call was **Cloudflare for execution,
Supabase for identity** — durable execution beats rolling retry/resume on
`pg_cron`, and Workers is the better webhook edge. Workflow storage went to D1
with the executor rather than staying next to identity; see "Cloudflare
mapping". Identity is not duplicated and must not be.

**3. Per-user auth on the Worker — needs a call before anything else here.**
The shared secret ([worker/index.ts:55](worker/index.ts#L55)) is a perimeter,
and a deliberate one; it is not identity. `ownerFrom`
([:98](worker/index.ts#L98)) reads the Supabase token's `sub` without checking
the signature, so inside the perimeter there is no separation at all. The
obvious fix is to verify against the project's JWKS in the Worker and cache the
keys, at which point the shared secret becomes belt-and-braces rather than the
only thing holding. The alternative — put the store behind Supabase and let RLS
do it — would undo the Phase 2 decision above, so pick one deliberately rather
than by drift.

---

## Deferred, in priority order

1. **Expression / field mapping** — the #2 gap and n8n's real power:
   `{{ $json.name }}` to wire one node's output field into another's parameter.
   Bernie has rows but every parameter is a literal. Do it after Phase 1; the
   executor is what makes per-item context available. The default workflow
   papers over this with two script nodes.
2. **Item-level iteration** — n8n runs a node once per item with per-item error
   handling; Bernie passes whole row sets. `runAsanaCreateTasks`
   ([operationRunner.ts:550](src/server/operationRunner.ts#L550)) is the first
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
  ([server.ts:453](server.ts#L453)). Left alone deliberately: each branch was
  verified live against a real API, and a refactor risks that for a linter
  score. Revisit if it grows again. Note it is Express-only — the Worker does
  not serve it, so a static deployment cannot smoke-test a credential.
- **The Drive Google Picker was removed** with the old single-purpose node; it
  needed `VITE_GOOGLE_API_KEY`, never set, so it almost certainly never worked.
- **`package.json` still calls the project `react-example`**, its `clean`
  script still shells out to `rm -rf`, and there is no `engines` field or
  linter beyond `tsc --noEmit` — now run twice, once for the app and once for
  the Worker (`npm run worker:lint`), because the two type-check against
  different global types.
- **`BERNIE_API_SECRET` has to match in three places** — the deployed Worker's
  secret, `.dev.vars` for `wrangler dev`, and `.env` for the dev server's
  `/api/workflows` proxy — and `.env.example`, which is meant to be the
  reference for names, does not list it.

---

## Guardrails

- The executor stays a pure function in `src/lib/` — no Express, no Worker, no
  React imports. That is what keeps it portable and testable.
- `src/server/runtime.ts` and everything reachable from it stays free of
  express, `@google/genai` and `node:` modules; anything Node-only goes in
  `integrationKit.ts` and is injected. `npm run worker:lint` is what catches a
  breach, so it belongs in CI alongside `npm run lint`.
- One implementation per route, two wrappers at most. If Express and the Worker
  ever answer `/api/integrations/execute` differently, that is a bug in a
  wrapper, not a feature of a runtime.
- Every operation stays a declarative spec. Adding a call type should remain a
  spec entry, never a new handler and route.
- Never log credentials or full row payloads in run history without a redaction
  pass. Bernie's rows carry Amazon sales data and Asana task bodies.
- A destructive operation (`rows.delete`, `tasks.delete`) needs a filter or an
  explicit id. That rule exists in the runner
  ([operationRunner.ts:269](src/server/operationRunner.ts#L269)); keep it when
  execution moves server-side and nobody is watching.
- `new Function()` runs user script with the privileges of whoever hosts it
  ([ScriptNode.tsx:26](src/components/nodes/ScriptNode.tsx#L26),
  [workflowEngine.ts:444](src/lib/workflowEngine.ts#L444)). In the browser that
  is the page, which holds every API key in `localStorage`; on a server it
  would be the process. Sandboxing the script node is a prerequisite for Phase
  1 leaving localhost, not a follow-up.
