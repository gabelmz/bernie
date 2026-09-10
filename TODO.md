# TODO

Backlog falling out of [PLAN.md](PLAN.md), plus concrete defects found while
reading the code. Every item traces to a file that exists. Sizes: (S) under an
hour, (M) a session, (L) more than a session.

Items marked **SECURITY** are exploitable today or become exploitable the
moment the server leaves localhost. Part of it already has: the Cloudflare
Worker (`worker/index.ts`) is deployable and serves both `/api/workflows` and
`/api/integrations/execute`. It is gated on one shared secret, which is a
perimeter and not identity — so the Worker items below are the "today" kind.

---

## Execution engine

- [ ] Stop the Script node inventing input. `ScriptNode.tsx:27` falls back to
      `{ data: "sample input" }` when `data.inputData` is absent, so a
      misconnected node silently produces plausible garbage. Fail loudly. (S)
      — `src/components/nodes/ScriptNode.tsx`
- [ ] Reconcile `executionOrder` (`workflowCode.ts:40`) with the executor once
      Phase 1 lands. It deliberately reproduces the canvas's fan-in behaviour
      so the generated code matches the run; when the executor stops dropping
      the second parent's rows, the generator has to stop too or the Code tab
      starts lying. (S)
      — `src/lib/workflowCode.ts`
- [ ] Re-sync `scriptVal` when `data.script` changes externally.
      `ScriptNode.tsx:10` seeds it once, so an edit made in the settings pane
      (`NodeSettingsForm.tsx:172`) never appears in the on-canvas textarea, and
      the next keystroke there overwrites it. (S)
      — `src/components/nodes/ScriptNode.tsx`
- [ ] Make `simulateWorkflowExecution` a real topological sort. It marks a node
      visited on first dequeue (`workflowEngine.ts:602-647`), so on a fan-in it
      runs with only the first parent's rows and drops the rest. (M)
      — `src/lib/workflowEngine.ts`
- [ ] Emit `status: 'skipped'` for the downstream closure of a failed node.
      `StepExecutionResult` declares it (`workflowEngine.ts:35`) and nothing
      ever produces it; downstream nodes are simply missing from `steps`. (S)
      — `src/lib/workflowEngine.ts`
- [ ] Extract `executeGraph(nodes, edges, ctx)` with the operation runner
      injected rather than imported, so the module stays free of `src/server/`.
      This is Phase 1. (L)
      — `src/lib/workflowEngine.ts`
- [ ] Add `POST /api/workflows/run` that takes a graph and returns the step
      report. It belongs on the Worker beside `/api/workflows`
      (`worker/index.ts:295`), with its body in `src/server/` so Express can
      serve it too — the shape `executeCore.ts` already established. (M)
      — `worker/index.ts`, new `src/server/runCore.ts`, `server.ts`
- [ ] Add per-node error policy (`stop` / `continue` / error branch) to the
      step loop, copying n8n's "continue on fail". (M)
      — `src/lib/workflowEngine.ts`
- [ ] Repoint the canvas at `/api/workflows/run` and delete the ten
      `useEffect(() => { if (data.status === 'running') run(); })` blocks in
      `AiNode`, `AppNode`, `ChatNode`, `FlushNode`, `HttpNode`, `InsightsNode`,
      `JsonCardNode`, `MeetNode`, `ScriptNode`, `TextNode`. (L)
      — `src/components/Canvas.tsx`, `src/components/nodes/*.tsx`
- [ ] Delete `handleNodeDataUpdate` (`Canvas.tsx:254`) in favour of
      `propagateNodeData` (`workflowEngine.ts:291`). They are the same function
      written twice, and the canvas copy is the one with no tests. (M)
      — `src/components/Canvas.tsx`, `src/lib/workflowEngine.ts`
- [ ] Fix the canvas fan-in drop: `AppNode.tsx:110` depends only on
      `[data.status]`, so a node already `'running'` never re-fires when a
      second parent arrives. (M)
      — `src/components/nodes/AppNode.tsx` and the nine sibling nodes
- [ ] Remove `extractPayloadHeaders` (`workflowEngine.ts:52`) or wire it up —
      it is exported and used by nothing outside its own module. (S)
      — `src/lib/workflowEngine.ts`

## Persistence

- [ ] Wrap the autosave write in `try/catch`. `Canvas.tsx:204` calls
      `localStorage.setItem` inside a `setTimeout`, so a `QuotaExceededError`
      is an unhandled rejection with no user-visible failure. (S)
      — `src/components/Canvas.tsx`
- [ ] Strip runtime output before autosaving. `Canvas.tsx:204` serializes whole
      node `data`, including `jsonData` / `inputData` / `result` / `response`
      row payloads. A Keepa or Sheets pull blows the ~5MB quota. The D1 save
      already does this — reuse `serializeGraph` (`workflowStore.ts:42`)
      rather than writing a second stripper. (M)
      — `src/components/Canvas.tsx`, `src/lib/workflowStore.ts`
- [ ] Strip `status` before autosaving. A tab closed mid-run persists
      `status: 'running'`, and the re-attach effect (`Canvas.tsx:321`) restores
      it, so a reload silently re-runs live API calls. Same fix as above:
      `TRANSIENT_NODE_FIELDS` (`workflowStore.ts:32`) already lists it. (S)
      — `src/components/Canvas.tsx`
- [ ] Guard the `bernie-custom-nodes` read/write the same way
      (`Canvas.tsx:482`, `:490`). (S)
      — `src/components/Canvas.tsx`
- [ ] Let saving update an existing workflow. `SavedTab` calls `saveWorkflow`
      with no `id` (`WorkflowPanel.tsx:210`) and the Worker mints a fresh UUID
      when one is absent (`worker/index.ts:128`), so saving twice under the
      same name leaves two rows. The upsert path exists; track the loaded id on
      the canvas and pass it. (S)
      — `src/components/WorkflowPanel.tsx`, `src/components/Canvas.tsx`
- [ ] Make the canvas boot from the saved workflow, not just `bernie-autosave`.
      Loading from the Saved tab replaces the graph (`Canvas.tsx:365`) but the
      next reload comes back from `localStorage`, so "which workflow am I
      looking at" is still not a fact the app holds. (M)
      — `src/components/Canvas.tsx`, `src/lib/workflowStore.ts`
- [ ] Add the `runs` table (id, workflow_id, owner, trigger source, status,
      started/finished, step results) as `migrations/0002_runs.sql`. Blocked on
      Phase 1: nothing produces a step report yet. (M)
      — new `migrations/0002_runs.sql`, `worker/index.ts`
- [ ] Decide what happens to rows owned by `anonymous`. Every signed-out user
      shares that owner string (`worker/index.ts:101`), so they can all see and
      delete each other's saved workflows. Either refuse to save signed out or
      scope them to something per-browser. (S)
      — `worker/index.ts`, `src/lib/workflowStore.ts`

## Credentials & security

- [ ] **SECURITY** Verify the Supabase JWT in the Worker. `ownerFrom`
      (`worker/index.ts:98`) base64-decodes the token and trusts the `sub`
      claim **without checking the signature**, so anyone past the shared
      secret can mint a token with any `sub` and read, overwrite or delete that
      owner's saved workflows. This separates lists; it is not access control,
      and the Worker is deployed. Verify against the Supabase project's JWKS
      (`<project>/auth/v1/.well-known/jwks.json`), cache the keys, and reject a
      token that fails. (M)
      — `worker/index.ts`
- [ ] **SECURITY** Give the Worker per-user credentials rather than one shared
      secret. `denyUnlessAuthorized` (`worker/index.ts:55`) is a perimeter and
      a correct one — it fails closed, and it compares in constant time — but
      every user holds the same `BERNIE_API_SECRET` in `localStorage` under
      `bernie-api-key` (`apiBase.ts:19`), so it cannot be revoked for one
      person, cannot be rotated without breaking everyone at once, and any XSS
      hands over the whole API. Folds into the JWT item above. (M)
      — `worker/index.ts`, `src/lib/apiBase.ts`
- [ ] **SECURITY** Replace `Access-Control-Allow-Origin: *` on the Worker
      (`worker/index.ts:34`) with an allowlist of the origins Bernie is
      actually served from. The shared secret is the only thing gating callers
      today; an origin allowlist would mean a stolen key is not enough on its
      own. (S)
      — `worker/index.ts`
- [ ] **SECURITY** Rate-limit the Worker. Neither `/api/workflows` nor
      `/api/integrations/execute` has any limit, and each request costs a D1
      query or a call to a third-party API on someone's key. Cloudflare's
      Rate Limiting rules or a Durable Object counter. (M)
      — `worker/index.ts`, `wrangler.toml`
- [ ] **SECURITY** Route `AiNode` and `HttpNode` through `apiHeaders()`.
      `AiNode.tsx:20` and `HttpNode.tsx:27` / `:61` build their own headers, so
      `/api/ai/execute`, `/api/ai/parse-request` and `/api/proxy` carry no API
      key — which also means those three nodes have no working path on a static
      deployment, since the Worker does not serve those routes either. Decide
      whether they move to the Worker or stop pretending to work off-Express.
      (S)
      — `src/components/nodes/AiNode.tsx`, `src/components/nodes/HttpNode.tsx`
- [ ] **SECURITY** Delete or authenticate `POST /api/proxy` (`server.ts:140`).
      It forwards an arbitrary URL, method, headers and body with no allowlist
      — a full SSRF relay into anything the host can reach, including cloud
      metadata endpoints. Only `HttpNode.tsx:59` calls it. (S)
      — `server.ts`, `src/components/nodes/HttpNode.tsx`
- [ ] **SECURITY** Replace bare `app.use(cors())` (`server.ts:34`) with an
      origin allowlist. Any page in any browser can currently reach every
      route, including the proxy above. (S)
      — `server.ts`
- [ ] **SECURITY** Delete the nine dead routes that still accept credentials:
      `/api/asana/tasks` (`server.ts:226`), `/api/keepa/products` (`:261`),
      `/api/supabase/rows` (`:294`), `/api/sheets/rows` (`:333`), and
      `/api/openrouter/complete`, `/api/huggingface/complete`,
      `/api/opencode/prompt`, `/api/mcp/rpc`, `/api/drive/files`
      (`providerRoutes.ts:39`, `:81`, `:120`, `:182`, `:281`). No caller
      remains in `src/`, and they now duplicate on Express only what the Worker
      serves through `/api/integrations/execute` — a second, older, unshared
      implementation of the same vendors. (M)
      — `server.ts`, `src/server/providerRoutes.ts`
- [ ] **SECURITY** Sandbox script evaluation. `new Function('input', script)`
      runs at `ScriptNode.tsx:26` with the page's privileges — the same page
      that holds every API key in `localStorage` — and at
      `workflowEngine.ts:444`, which becomes the server process once Phase 1
      lands. A worker with no `fetch`/`localStorage`, or a real interpreter. (L)
      — `src/components/nodes/ScriptNode.tsx`, `src/lib/workflowEngine.ts`
- [ ] **SECURITY** Reject a `service_role` JWT in the Supabase `apiKey` field.
      `envConfig` prefers `SUPABASE_SERVICE_ROLE_KEY`
      (`runtime.ts:43`) and the same field is stored in the browser
      (`integrationCore.ts:62`), so a service role key in `localStorage`
      bypasses every RLS policy in the project. Validate the JWT `role` claim
      before saving. (M)
      — `src/lib/integrationCore.ts`, `src/components/IntegrationConfigForm.tsx`
- [ ] **SECURITY** Add authentication to `/api/integrations/execute` on
      Express. The Worker now gates it behind the shared secret
      (`worker/index.ts:292`); `executeRoute.ts:17` still takes credentials
      from the request body with no check at all, and `server.ts` binds to
      `0.0.0.0` (`:683`). (M)
      — `src/server/executeRoute.ts`, `server.ts`
- [ ] **SECURITY** Stop shipping credentials from the browser.
      `AppNode.tsx:85` posts `nodeConfigFor(...)` — resolved API keys — in
      every run request, and that request now goes wherever `apiBase()`
      resolves (`apiBase.ts:42`) — in a static deployment a cross-origin Worker
      rather than the page's own server. Same keys, longer journey, CORS `*` at
      the far end. Resolve config server-side from a stored, encrypted per-user
      record instead. Blocks Phase 3. (L)
      — `src/components/nodes/AppNode.tsx`, `src/lib/nodeConfig.ts`,
      `src/lib/apiBase.ts`, `src/server/executeCore.ts`
- [ ] **SECURITY** Move credentials out of `localStorage`
      (`integrations.ts:16`, `:50`). Any XSS on the page reads every key for
      Asana, Keepa, Supabase, GitHub, OpenRouter and Hugging Face at once.
      Decide Supabase Vault vs Cloudflare Secrets Store first — see PLAN.md,
      Open decisions. (L)
      — `src/lib/integrations.ts`, `src/lib/nodeConfig.ts`
- [ ] **SECURITY** Redact before logging. `executeRoute.ts:32` logs
      `outcome.body.error`, and `fail()` (`operationRunner.ts:82`) builds that
      message from up to 300 characters of the upstream payload, which can echo
      request data back into the log — now into Cloudflare's observability
      stream too, which `wrangler.toml` enables. (S)
      — `src/server/executeRoute.ts`, `src/server/operationRunner.ts`,
      `worker/index.ts`
- [ ] **SECURITY** Add a redaction pass for step records before any of them are
      persisted or rendered as run history. Rows carry Amazon sales data and
      Asana task bodies. Prerequisite for Phase 4. (M)
      — `src/lib/workflowEngine.ts`
- [ ] **SECURITY** Give the Supabase session a shorter blast radius.
      `auth.ts:27` / `:63` store the access token and the Google
      `provider_token` in `localStorage`, readable by any script on the
      page. (M)
      — `src/lib/auth.ts`
- [ ] Add an `AbortSignal` timeout to `probe` (`runtime.ts:106`). No request in
      the app can time out today, so one hung upstream holds an Express handler
      open indefinitely — or burns a Worker's CPU budget. Honour the `timeoutMs`
      field the HTTP integration already exposes (`integrationCore.ts:341`,
      default 15000 at `:375`) — nothing reads it. (S)
      — `src/server/runtime.ts`, `src/lib/operationEngine.ts`
- [ ] Reconsider `express.json({ limit: "25mb" })` (`server.ts:36`) once the
      server is reachable from outside localhost; 25MB unauthenticated is a
      cheap memory-exhaustion lever. (S)
      — `server.ts`

## Integrations

- [ ] Warn instead of truncating in Keepa. `buildKeepaProductUrl`
      (`providerRequests.ts:311`) silently `slice(0, 100)`s the ASIN list; the
      default workflow feeds it a whole sheet. Batch, or surface the drop. (M)
      — `src/lib/providerRequests.ts`, `src/server/operationRunner.ts`
- [ ] Follow Asana's `next_page.offset` cursor. Every list operation exposes a
      `limit` page size (`operations/asana.ts:29`, `:118`, `:148`, `:183`,
      `:252`, `:315`, `:333`, `:353`, `:381`, `:399`) and no operation reads
      the cursor, so results stop at one page with no signal. (M)
      — `src/lib/operations/asana.ts`, `src/server/operationRunner.ts`
- [ ] Same for Drive `nextPageToken` and GitHub `Link` headers. (M)
      — `src/server/operationRunner.ts`
- [ ] Record partial success in `runAsanaCreateTasks`
      (`operationRunner.ts:550`). It POSTs one row at a time and throws on the
      first failure, so tasks already created are lost from the response with
      no way to resume. Return created ids alongside the error. (M)
      — `src/server/operationRunner.ts`
- [ ] Same for `runGithubCreateIssues` (`operationRunner.ts:591`). (M)
      — `src/server/operationRunner.ts`
- [ ] Bound concurrency and add backoff for those per-row loops; a 500-row
      Asana batch is 500 serial requests against a rate-limited API. (M)
      — `src/server/operationRunner.ts`
- [ ] Decide what `mergeKeepaIntoRows` (`operationRunner.ts:354`) should do
      with products whose ASIN matches no input row — they are dropped today
      whenever `rows.length > 0`. Document it or emit them. (S)
      — `src/server/operationRunner.ts`
- [ ] Keep the two Gemini implementations honest. The Express host passes the
      `@google/genai` SDK (`executeRoute.ts:21`) and the Worker passes a REST
      client (`worker/index.ts:240`); only the SDK path has ever been run.
      Exercise both against the same prompt, or the REST one will drift. (M)
      — `worker/index.ts`, `src/server/executeRoute.ts`
- [ ] The Worker's Gemini default model is a second copy of the same string.
      `AI_MODEL` (`integrationKit.ts:17`) and the literal at
      `worker/index.ts:245` are `gemini-3.1-pro-preview` in two places; move it
      somewhere both can import. (S)
      — `worker/index.ts`, `src/server/integrationKit.ts`

## Testing

- [ ] Cover the fan-in case in `simulateWorkflowExecution` — two parents into
      one node — which currently has no test and is currently wrong. (S)
      — `tests/unit/workflowEngine.test.ts`
- [ ] Cover the error path: assert that nodes downstream of a failure appear as
      `'skipped'` rather than vanishing from `steps`. (S)
      — `tests/unit/workflowEngine.test.ts`
- [ ] Test `executeOperation` (`executeCore.ts:25`) against a mocked `fetch`:
      unknown operation, missing config, upstream 4xx, happy path. It is now
      the shared body of both hosts and it has no test. (M)
      — new `tests/unit/executeCore.test.ts`
- [ ] Test the Worker's request handling — routing, `ownerFrom`, the
      workflow upsert's ownership `WHERE`, the 405/404 fallbacks. Nothing in
      `worker/index.ts` is covered; `vitest-pool-workers` or a hand-rolled
      `Request`/stub-D1 pair. (M)
      — new `tests/unit/worker.test.ts`
- [ ] Extend `operationRunner.test.ts` past its two handlers. 27 entries in
      `CUSTOM_HANDLERS` (`operationRunner.ts:877`), 2 covered. Prioritise
      `runSupabaseWrite` (it enforces the destructive-filter rule at `:269`)
      and `runSheetsWrite`. (M)
      — `tests/unit/operationRunner.test.ts`
- [ ] Test the canvas autosave round trip: seed, save, reload, and assert
      callbacks are re-attached (`Canvas.tsx:321`) and no `'running'` status
      survives. (M)
      — new `tests/integration/canvasPersistence.test.tsx`
- [ ] Test `serializeGraph` (`workflowStore.ts:42`) drops every field in
      `TRANSIENT_NODE_FIELDS` — it is the only thing standing between a
      mid-run canvas and a saved workflow that reloads as `running`. (S)
      — new `tests/unit/workflowStore.test.ts`
- [ ] Test the `ScriptNode` write-through: an edit must survive a remount, and
      an external change to `data.script` must reach the textarea. (S)
      — `tests/integration/nodes.test.tsx`
- [ ] Set coverage thresholds in `vitest.config.ts`; the reporter is
      configured but nothing fails on a drop. (S)
      — `vitest.config.ts`
- [ ] Add a CI workflow running `npm run lint`, `npm run worker:lint` and
      `npm test`. There is no `.github/` directory, and `worker:lint` is the
      only thing that catches a Node built-in creeping back onto the shared
      execution path. (S)
      — new `.github/workflows/ci.yml`
- [ ] Run the default ASIN triage workflow against live Sheets, Keepa and
      Asana accounts once, and write down what broke. Every Sheets and Drive
      path is unit-tested only. (M)

## Repo hygiene

- [ ] Rename the package from `"react-example"` to `"bernie"`. (S)
      — `package.json`
- [ ] Fix the `clean` script — `rm -rf dist server.js` fails under the default
      Windows shell, which is what this repo is developed on. (S)
      — `package.json`
- [ ] Add an `engines` field or `.nvmrc`. Nothing records the Node version the
      Express server and `tsx` need. (S)
      — `package.json`
- [ ] Add a real linter. `"lint": "tsc --noEmit"` type-checks and catches no
      lint; `worker:lint` is the same tool with different global types. (S)
      — `package.json`
- [ ] Drop `INTEGRATIONS_WITH_OPERATIONS` and `hasOperations`
      (`operations/index.ts:59`, `:63`) or use them — both are exported and
      called from nowhere. (S)
      — `src/lib/operations/index.ts`
- [ ] Commit `database_id` deliberately or move it. `wrangler.toml` carries a
      real D1 id for one account; a second person running `worker:dev` against
      their own Cloudflare account has to edit a tracked file to do it. (S)
      — `wrangler.toml`

## Docs

- [ ] Document the seven-node default workflow: which Google Sheet columns it
      needs (`asin`, `issue` — `defaultWorkflow.ts:21`), which three accounts
      must be connected, and what "connect and run" looks like. It is the first
      thing a new user sees. (M)
- [ ] Add `BERNIE_API_SECRET` to `.env.example`. The Worker refuses every
      request without it (`worker/index.ts:57`), it has to match in three
      places — `wrangler secret put`, `.dev.vars`, and `.env` for the dev
      proxy — and the file that is meant to be the reference for names does
      not mention it. Same for `.dev.vars`: it is gitignored with no example
      beside it. (S)
      — `.env.example`
- [ ] Correct `.env.example`: `SUPABASE_ANON_KEY` is documented as a server env
      var, but sign-in reads the anon key from the Connections page
      (`auth.ts:72`), not from the environment. (S)
      — `.env.example`
- [ ] Document that `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never
      be entered in the browser's Supabase card. (S)
      — `.env.example`, `src/components/IntegrationsPage.tsx`
- [ ] Write down the operation-spec contract — `id`, `direction`, `body`,
      `result`, `custom` (`operations/types.ts:56`) — so adding an integration
      does not require reading `operationRunner.ts` end to end. (M)
      — `src/lib/operations/types.ts`
- [ ] Write down the deployment path end to end: `worker:migrate`,
      `worker:deploy`, where the front end is hosted, and how it is pointed at
      the Worker. README covers each piece; nothing covers the sequence. (S)
      — `README.md`
- [ ] Say in the UI which mermaid labels map to which app. `MermaidTab` lists
      eight (`WorkflowPanel.tsx:138`) but `INTEGRATION_HINTS`
      (`mermaid.ts:25`) matches twelve, plus aliases like "spreadsheet",
      "postgres" and "webhook". (S)
      — `src/components/WorkflowPanel.tsx`
