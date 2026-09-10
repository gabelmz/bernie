# TODO

Backlog falling out of [PLAN.md](PLAN.md), plus concrete defects found while
reading the code. Every item traces to a file that exists. Sizes: (S) under an
hour, (M) a session, (L) more than a session.

Items marked **SECURITY** are exploitable today or become exploitable the
moment the server leaves localhost, which Phase 3 requires.

---

## Execution engine

- [ ] Stop the Script node inventing input. `ScriptNode.tsx:27` falls back to
      `{ data: "sample input" }` when `data.inputData` is absent, so a
      misconnected node silently produces plausible garbage. Fail loudly. (S)
      — `src/components/nodes/ScriptNode.tsx`
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
      report, registered alongside `registerExecuteRoute` (`server.ts:181`). (M)
      — new `src/server/workflowRoute.ts`, `server.ts`
- [ ] Add per-node error policy (`stop` / `continue` / error branch) to the
      step loop, copying n8n's "continue on fail". (M)
      — `src/lib/workflowEngine.ts`
- [ ] Repoint the canvas at `/api/workflows/run` and delete the ten
      `useEffect(() => { if (data.status === 'running') run(); })` blocks in
      `AiNode`, `AppNode`, `ChatNode`, `FlushNode`, `HttpNode`, `InsightsNode`,
      `JsonCardNode`, `MeetNode`, `ScriptNode`, `TextNode`. (L)
      — `src/components/Canvas.tsx`, `src/components/nodes/*.tsx`
- [ ] Delete `handleNodeDataUpdate` (`Canvas.tsx:241`) in favour of
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

- [ ] Wrap the autosave write in `try/catch`. `Canvas.tsx:195` calls
      `localStorage.setItem` inside a `setTimeout`, so a `QuotaExceededError`
      is an unhandled rejection with no user-visible failure. (S)
      — `src/components/Canvas.tsx`
- [ ] Strip runtime output before autosaving. `Canvas.tsx:195` serializes whole
      node `data`, including `jsonData` / `inputData` / `result` / `response`
      row payloads. A Keepa or Sheets pull blows the ~5MB quota. (M)
      — `src/components/Canvas.tsx`
- [ ] Strip `status` before autosaving. A tab closed mid-run persists
      `status: 'running'`, and the re-attach effect (`Canvas.tsx:299`) restores
      it, so a reload silently re-runs live API calls. (S)
      — `src/components/Canvas.tsx`
- [ ] Guard the `bernie-custom-nodes` read/write the same way
      (`Canvas.tsx:422`, `:430`). (S)
      — `src/components/Canvas.tsx`
- [ ] Add `src/lib/workflowStore.ts`: load/save/list workflow definitions
      against Supabase, with the `localStorage` autosave demoted to a draft
      buffer. Phase 2. (L)
      — new `src/lib/workflowStore.ts`, `src/components/Canvas.tsx`
- [ ] Write the Supabase migration for `workflows` and `runs` (ids, owner,
      graph JSON, trigger source, status, timings, step results) with RLS
      scoped to the owner. (M)
- [ ] Give workflows a name and an id in the UI; today a browser holds exactly
      one unnamed graph. (L)
      — `src/components/Canvas.tsx`, `src/components/NavigationBar.tsx`

## Credentials & security

- [ ] **SECURITY** Delete or authenticate `POST /api/proxy` (`server.ts:138`).
      It forwards an arbitrary URL, method, headers and body with no allowlist
      — a full SSRF relay into anything the host can reach, including cloud
      metadata endpoints. Only `HttpNode.tsx:58` calls it. (S)
      — `server.ts`, `src/components/nodes/HttpNode.tsx`
- [ ] **SECURITY** Replace bare `app.use(cors())` (`server.ts:32`) with an
      origin allowlist. Any page in any browser can currently reach every
      route, including the proxy above. (S)
      — `server.ts`
- [ ] **SECURITY** Delete the nine dead routes that still accept credentials:
      `/api/asana/tasks` (`server.ts:183`), `/api/keepa/products` (`:218`),
      `/api/supabase/rows` (`:251`), `/api/sheets/rows` (`:290`), and
      `/api/openrouter/complete`, `/api/huggingface/complete`,
      `/api/opencode/prompt`, `/api/mcp/rpc`, `/api/drive/files`
      (`providerRoutes.ts:39`, `:81`, `:120`, `:182`, `:281`). No caller
      remains in `src/`. (M)
      — `server.ts`, `src/server/providerRoutes.ts`
- [ ] **SECURITY** Sandbox script evaluation. `new Function('input', script)`
      runs at `ScriptNode.tsx:26` with the page's privileges — the same page
      that holds every API key in `localStorage` — and at
      `workflowEngine.ts:444`, which becomes the server process once Phase 1
      lands. A worker with no `fetch`/`localStorage`, or a real interpreter. (L)
      — `src/components/nodes/ScriptNode.tsx`, `src/lib/workflowEngine.ts`
- [ ] **SECURITY** Reject a `service_role` JWT in the Supabase `apiKey` field.
      `envConfig` prefers `SUPABASE_SERVICE_ROLE_KEY`
      (`integrationKit.ts:51`) and the same field is stored in the browser
      (`integrationCore.ts:62`), so a service role key in `localStorage`
      bypasses every RLS policy in the project. Validate the JWT `role` claim
      before saving. (M)
      — `src/lib/integrationCore.ts`, `src/components/IntegrationConfigForm.tsx`
- [ ] **SECURITY** Add authentication to `/api/integrations/execute`
      (`executeRoute.ts:17`). It is unauthenticated and takes credentials from
      the request body. (M)
      — `src/server/executeRoute.ts`, `server.ts`
- [ ] **SECURITY** Stop shipping credentials from the browser.
      `AppNode.tsx:85` posts `nodeConfigFor(...)` — resolved API keys — in
      every run request. Resolve config server-side from a stored, encrypted
      per-user record instead. Blocks Phase 3. (L)
      — `src/components/nodes/AppNode.tsx`, `src/lib/nodeConfig.ts`,
      `src/server/executeRoute.ts`
- [ ] **SECURITY** Move credentials out of `localStorage`
      (`integrations.ts:16`, `:50`). Any XSS on the page reads every key for
      Asana, Keepa, Supabase, GitHub, OpenRouter and Hugging Face at once.
      Decide Supabase Vault vs Cloudflare Secrets Store first — see PLAN.md,
      Open decisions. (L)
      — `src/lib/integrations.ts`, `src/lib/nodeConfig.ts`
- [ ] **SECURITY** Redact before logging. `executeRoute.ts:71` logs
      `err.message`, and `fail()` (`operationRunner.ts:64`) builds that message
      from up to 300 characters of the upstream payload, which can echo request
      data back into the log. (S)
      — `src/server/executeRoute.ts`, `src/server/operationRunner.ts`
- [ ] **SECURITY** Add a redaction pass for step records before any of them are
      persisted or rendered as run history. Rows carry Amazon sales data and
      Asana task bodies. Prerequisite for Phase 4. (M)
      — `src/lib/workflowEngine.ts`
- [ ] **SECURITY** Give the Supabase session a shorter blast radius.
      `auth.ts:27` / `:63` store the access token and the Google
      `provider_token` in `localStorage`, readable by any script on the
      page. (M)
      — `src/lib/auth.ts`
- [ ] Add an `AbortSignal` timeout to `probe` (`integrationKit.ts:145`). No
      request in the app can time out today, so one hung upstream holds an
      Express handler open indefinitely. Honour the `timeoutMs` field the HTTP
      integration already exposes (`integrationCore.ts:341`, default 15000 at
      `:375`) — nothing reads it. (S)
      — `src/server/integrationKit.ts`, `src/lib/operationEngine.ts`
- [ ] Reconsider `express.json({ limit: "25mb" })` (`server.ts:34`) once the
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
      (`operationRunner.ts:514`). It POSTs one row at a time and throws on the
      first failure, so tasks already created are lost from the response with
      no way to resume. Return created ids alongside the error. (M)
      — `src/server/operationRunner.ts`
- [ ] Same for `runGithubCreateIssues` (`operationRunner.ts:555`). (M)
      — `src/server/operationRunner.ts`
- [ ] Bound concurrency and add backoff for those per-row loops; a 500-row
      Asana batch is 500 serial requests against a rate-limited API. (M)
      — `src/server/operationRunner.ts`
- [ ] Decide what `mergeKeepaIntoRows` (`operationRunner.ts:318`) should do
      with products whose ASIN matches no input row — they are dropped today
      whenever `rows.length > 0`. Document it or emit them. (S)
      — `src/server/operationRunner.ts`
- [ ] Replace `Buffer.from(x, 'base64')` with `atob` at
      `operationRunner.ts:594` — the only Node built-in on the execution
      path. (S)
      — `src/server/operationRunner.ts`
- [ ] Build the Gemini client lazily. `integrationKit.ts:21` constructs it at
      module load from `process.env.GEMINI_API_KEY`, which will not work under
      a Worker `env` binding. (S)
      — `src/server/integrationKit.ts`
- [ ] Route `envConfig` (`integrationKit.ts:35`) through an injected env object
      instead of reading `process.env` directly, so the same module runs on a
      Worker. (M)
      — `src/server/integrationKit.ts`
- [ ] Verify `@google/genai` on Workers, or switch `runGemini`
      (`operationRunner.ts:777`) to the Gemini REST API. (M)
      — `src/server/operationRunner.ts`

## Testing

- [ ] Cover the fan-in case in `simulateWorkflowExecution` — two parents into
      one node — which currently has no test and is currently wrong. (S)
      — `tests/unit/workflowEngine.test.ts`
- [ ] Cover the error path: assert that nodes downstream of a failure appear as
      `'skipped'` rather than vanishing from `steps`. (S)
      — `tests/unit/workflowEngine.test.ts`
- [ ] Test `/api/integrations/execute` end to end against a mocked `fetch`:
      unknown operation, missing config, upstream 4xx, happy path. The route
      has no test. (M)
      — new `tests/unit/executeRoute.test.ts`
- [ ] Extend `operationRunner.test.ts` past its two handlers. 27 entries in
      `CUSTOM_HANDLERS` (`operationRunner.ts:838`), 2 covered. Prioritise
      `runSupabaseWrite` (it enforces the destructive-filter rule at `:250`)
      and `runSheetsWrite`. (M)
      — `tests/unit/operationRunner.test.ts`
- [ ] Test the canvas autosave round trip: seed, save, reload, and assert
      callbacks are re-attached (`Canvas.tsx:299`) and no `'running'` status
      survives. (M)
      — new `tests/integration/canvasPersistence.test.tsx`
- [ ] Test `ScriptNode` code persistence once it is fixed — an edit must
      survive a remount. (S)
      — `tests/integration/nodes.test.tsx`
- [ ] Set coverage thresholds in `vitest.config.ts`; the reporter is
      configured but nothing fails on a drop. (S)
      — `vitest.config.ts`
- [ ] Add a CI workflow running `npm run lint` and `npm test`. There is no
      `.github/` directory. (S)
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
      lint. (S)
      — `package.json`
- [ ] Drop `INTEGRATIONS_WITH_OPERATIONS` and `hasOperations`
      (`operations/index.ts:59`, `:63`) or use them — both are exported and
      called from nowhere. (S)
      — `src/lib/operations/index.ts`

## Docs

- [ ] Document the seven-node default workflow: which Google Sheet columns it
      needs (`asin`, `issue` — `defaultWorkflow.ts:21`), which three accounts
      must be connected, and what "connect and run" looks like. It is the first
      thing a new user sees. (M)
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
