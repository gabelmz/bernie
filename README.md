# Bernie

Bernie is a workflow-automation canvas. You wire nodes together on an
[@xyflow/react](https://reactflow.dev) graph; each app-scoped node runs one
declared operation — pull rows, push rows, mutate something — against a
third-party API, through a small server that makes the HTTP call. That server
comes in two shapes running the same code: an Express process in development
(`server.ts`) and a Cloudflare Worker for deployment (`worker/index.ts`).
Execution is browser-driven today: a graph runs while its tab is open, it
autosaves to `localStorage`, and it can be saved by name to a D1 database.

Architecture and the seams you will hit when changing something: [SPINE.md](SPINE.md).

---

## Quick start

**Prerequisites:** Node 20.6 or newer (developed on 22) and npm.

> Use **npm**, not bun. `bun install` fails with `EPERM` in this repo.

```sh
npm install
npm run dev
```

Open <http://localhost:3000>. `npm run dev` is `tsx server.ts` — one Express
process that serves both the API and the Vite dev middleware, so there is no
separate front-end port. The port is fixed at 3000 (`server.ts:32`).

Saved workflows live in Cloudflare D1, which only the Worker can reach, so for
the **Saved** tab to work locally run the Worker beside the dev server:

```sh
npm run worker:migrate:local   # once, to create the local D1 tables
npm run worker:dev             # wrangler dev on :8787
```

The Worker refuses every request that does not carry the shared secret, local
runs included, so set one in both places: `BERNIE_API_SECRET` in `.env` for the
dev server, and the same value in `.dev.vars` (gitignored) for `wrangler dev`.

Express forwards `/api/workflows` to `WORKER_URL` (default
`http://127.0.0.1:8787`, `server.ts:197`), adding the secret from its own
environment (`server.ts:209`) so the browser never has to hold it in
development. Forwarding rather than reimplementing means development exercises
the same store that deploys. Without the Worker running the canvas still works;
the Saved tab reports a 502 naming the URL it tried.

Both hosts answer `GET /api/health` — `server.ts:187` and `worker/index.ts:288`
— with the same shape, and on the Worker it is the one route that needs no
key, so "is the API there?" is one question wherever the page is served from.

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | `tsx server.ts` — Express + Vite middleware on :3000 |
| `npm test` | `vitest run` — 297 tests |
| `npm run test:watch` | `vitest` in watch mode |
| `npm run lint` | `tsc --noEmit`. There is no ESLint config in this repo. |
| `npm run build` | `vite build`, then esbuild bundles `server.ts` into `dist/server.cjs` |
| `npm start` | `node dist/server.cjs` |
| `npm run worker:dev` | `wrangler dev --port 8787 --local` — the Worker against local D1 |
| `npm run worker:deploy` | `wrangler deploy` |
| `npm run worker:migrate` | `wrangler d1 migrations apply bernie-workflows --remote` |
| `npm run worker:migrate:local` | the same against the local D1 |
| `npm run worker:lint` | `tsc -p worker/tsconfig.json --noEmit` — the Worker type-checks against `@cloudflare/workers-types`, not Node's |

`npm start` needs `NODE_ENV=production` set. The bundled server still branches
on it (`server.ts:669`) and will otherwise try to boot a Vite dev server out of
the production bundle.

### Where the API lives

The front end calls the API through `apiUrl()` (`src/lib/apiBase.ts:47`), which
resolves to same-origin by default — so `npm run dev`, where the page and the
API are the same Express process, needs no configuration at all.

Anything **static** — Google AI Studio, a built `dist/` on a file server,
Cloudflare Pages — has no Express process behind the page, so `POST /api/...`
is answered by the file server with **405 Method Not Allowed**. That was a live
bug: every connected node failed with a 405 that named nothing. Three things
changed:

- The API is deployable. `npm run worker:deploy` puts
  `/api/integrations/execute` on a Worker that shares its implementation with
  Express (`src/server/executeCore.ts`). One is deployed at
  `https://bernie-api.gabelmz.workers.dev` — `/api/health` there is open, so
  it can be checked without the key.
- The client can be pointed at it, either at runtime with the `localStorage`
  key `bernie-api-base` (no rebuild, which matters when the build environment
  is not yours) or at build time with `VITE_API_BASE_URL`. The **API endpoint**
  card at the top of Connections & APIs
  (`src/components/ApiEndpointCard.tsx`) is the runtime way: a URL field, a key
  field, and a **Test** button that checks `/api/health` and then a gated route
  so "unreachable" and "wrong key" are different answers. It also probes
  same-origin `/api/health` on open and warns if the page is being served by
  something that cannot run the API.
- The Worker gates on a shared secret. `apiHeaders()`
  (`src/lib/apiBase.ts:76`) adds `X-Bernie-Key` from the `localStorage` key
  `bernie-api-key` to every call that goes through `postJson`
  (`src/lib/nodeApi.ts`) or the workflow store.

`describeApiFailure` (`src/lib/apiBase.ts:98`) turns the statuses that follow
from this into sentences rather than numbers: 405/501 means a static file
server answered, 401 means the key was rejected, 503 means the Worker has no
`BERNIE_API_SECRET` set.

### Environment

```sh
cp .env.example .env
```

`.env.example` is the reference for every variable name; `.env` is gitignored
(`.gitignore` ignores `.env*` and re-includes `.env.example`) and is where real
values go. Never put a real secret in `.env.example`, or in any other file that
is committed.

Most of `.env.example` is optional. The integration variables are **server-side
fallbacks only** — the normal path is to enter credentials in the UI (left nav
→ **Integrations**, called "Connections & APIs" in the in-app copy), which
stores them in the browser and sends them with each run.

`server.ts:1` imports `dotenv/config`, so the dev server reads `.env` at boot.
Nothing else does — the Worker takes its own values from `wrangler` bindings
and `.dev.vars`, and the Vite build reads only `VITE_`-prefixed names.

`GEMINI_API_KEY` is the one variable with process-wide effect: it builds a
shared Gemini client at boot (`src/server/integrationKit.ts:22`). Under the
Worker there is no `process.env`, so Gemini goes over REST with the key from
the Worker's own `env` binding (`worker/index.ts:240`).

The Cloudflare block is the exception to "optional": `wrangler` needs
`CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` to deploy the Worker or
apply a remote D1 migration. `.env` also carries the R2 keys
(`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_S3_ENDPOINT`), which nothing
in the app reads yet. Three more names live there rather than in the UI:

- `BERNIE_API_SECRET` — the shared secret the Worker gates on. `wrangler secret
  put BERNIE_API_SECRET` sets it on a deployed Worker; `.dev.vars` sets it for
  `wrangler dev`; `.env` is where the Express dev server reads the copy it
  forwards. All three have to match. Not yet listed in `.env.example`.
- `WORKER_URL` — where the dev server forwards `/api/workflows`.
- `VITE_API_BASE_URL` — the build-time API base described above.

---

## The default workflow

A canvas with nothing saved opens on a seven-node ASIN issue triage graph
(`src/lib/defaultWorkflow.ts`), not an empty pane, centred on the canvas
origin. `CANVAS_CENTER` is `(0, 0)` (`defaultWorkflow.ts:156`); `centerLayout`
(`:170`) shifts the seeded graph so its bounding box centres there, and the
camera opens at the same point via `instance.setCenter` in `onInit`
(`Canvas.tsx:715`) at `DEFAULT_ZOOM` 0.55. A small crosshair is drawn at the
origin through React Flow's `ViewportPortal` so "home" is visible rather than
implied.

```
Trigger
  └─ Google Sheets  values.pull      (tab "Issues")
      └─ Keepa      product.lookup   (mergeInputRows on)
          └─ Script "Rank Issues"
              ├─ Google Sheets  values.update   (writes the ranking back)
              └─ Script "Top 10 → Tasks"
                  └─ Asana  tasks.create
```

To run it you need:

- **A Google account** signed in on the Integrations page. Both Sheets nodes
  authorize with the Google `provider_token` from that sign-in, not with a
  stored key.
- **A spreadsheet with a tab named `Issues`.** The first row is the header.
  Two columns matter: **`asin`** (what Keepa is looked up by) and **`issue`**
  (what becomes the Asana task title). Set the spreadsheet ID once as the
  Sheets connection default, or per node in the `spreadsheetId` param.
- **A Keepa API key.** The lookup node has `mergeInputRows` on, so each
  product's fields — including `sales_rank` and `monthly_sold` — merge back
  into the sheet row its ASIN came from, keeping the issue text alongside them.
- **An Asana personal access token**, plus a project or workspace GID on the
  Create Asana Tasks node. That node POSTs once per input row, so it opens up
  to ten real tasks.

Gemini is not needed for this graph.

Press **Run Workflow** on the trigger node. Each node runs when its status
flips to `running`, so the graph executes as results arrive downstream.

One caveat before you run it against a sheet you care about: the write-back
node has a known gap — see "Known rough edges" in [SPINE.md](SPINE.md).

---

## The workflow panel

Three buttons sit next to pan & select in the top-centre toolbar
(`Canvas.tsx:786` on). Each opens the same right-hand panel
(`src/components/WorkflowPanel.tsx`) on one of its three tabs.

**Code** renders the graph as the code that runs it —
`generateWorkflowCode` (`src/lib/workflowCode.ts:94`). Not pseudocode: each app
node becomes the `POST /api/integrations/execute` call it actually makes, with
the operation and params it actually carries, and each script node's body is
the body that is actually evaluated. The order is `executionOrder` (`:40`), a
breadth-first walk from the entry nodes that mirrors how the canvas propagates,
including the fan-in "last writer wins" behaviour. Sticky notes are emitted as
`// note:` comments.

**Mermaid** goes both ways (`src/lib/mermaid.ts`). `toMermaid` (`:231`) renders
the canvas as a `flowchart LR`. `parseMermaid` (`:135`) takes a pasted
flowchart and builds real nodes and edges: a label naming an app — Sheets,
Keepa, Asana, Supabase, Drive, GitHub, Gemini, HTTP, MCP, OpenRouter, Hugging
Face, opencode — becomes that node type on its default operation; `trigger` and
`script` labels become those node types; anything unrecognised comes in as a
note rather than being dropped, with a warning saying so. The result is laid
out by dependency depth and centred on the origin. Import adds to the canvas
rather than replacing it, and ids are remapped so importing the same diagram
twice does not collide.

**Saved** is the D1-backed store (`src/lib/workflowStore.ts`): name a workflow
and save it, list what is saved, open one — which replaces the canvas — or
delete it. Rows are scoped to the signed-in Supabase account; signed out, they
save as `anonymous`. `serializeGraph` (`workflowStore.ts:42`) strips callbacks
and live run state before saving, so a workflow saved mid-run does not come
back still claiming to be running.

That scoping separates one person's list from another's; it is not access
control, because the Worker reads the token's `sub` claim without verifying the
signature. Do not save anything you would mind another user of the same
deployment reading — see section 6 of [SPINE.md](SPINE.md).

`bernie-autosave` in `localStorage` is unchanged and still the per-browser
scratch buffer for whatever is on the canvas right now; the Saved tab is the
deliberate act of keeping one.

Sticky notes are added from the fourth toolbar button. A note is annotation:
`StickyNote` (`src/components/nodes/StickyNote.tsx`) renders no handles, so it
cannot be wired into the graph, it never executes, mermaid import drops any
edge touching one, and the code view emits it as a comment. Five tones, mixed
against the theme's own surface so they read on both the light and dark canvas.

---

## How credentials resolve

Highest wins:

1. Credentials typed into a node's Edit pane (`data.credentials`)
2. Non-secret overrides on the node (`data.params`, for keys the integration
   schema recognizes)
3. The saved connection from the Integrations page (`localStorage`, key
   `bernie-integrations`)
4. Server-side environment variables

Layers 1–3 are merged in the browser by `nodeConfigFor`
(`src/lib/nodeConfig.ts:51`) and sent with the request. The server slides the
env fallback underneath with `mergedConfig` (`src/server/runtime.ts:84`), which
reads from whatever env bag its host hands in — `process.env` under Express,
the Worker's `env` binding under Cloudflare. A blank value never overwrites a
set one at any level.

Google Sheets and Drive are the exception: they authorize with the OAuth token
from Supabase Google sign-in, which the node fetches separately and sends as
`accessToken` (`src/components/nodes/AppNode.tsx:80`).

---

## Repo layout

```
server.ts                  Express host: Vite middleware in dev, static dist in prod,
                           and a proxy for /api/workflows to the Worker
wrangler.toml              The Worker: entry point, D1 binding, compatibility flags
migrations/                D1 schema, applied with npm run worker:migrate
vite.config.ts             React + Tailwind; "@" resolves to the repo root
vitest.config.ts           jsdom, tests/setup.ts
PLAN.md                    Roadmap toward running with the browser closed
TODO.md                    Backlog and known defects, sized

worker/
  index.ts                 The Worker: /api/workflows on D1, /api/integrations/execute,
                           /api/health
  tsconfig.json            Workers types instead of Node's; npm run worker:lint

src/
  App.tsx                  ErrorBoundary > ThemeProvider > ReactFlowProvider > Canvas
  types.ts                 Node data shapes; AppNodeData is the app-scoped one
  components/
    Canvas.tsx             Graph state, autosave, downstream propagation
    WorkflowPanel.tsx      The right-hand Code / Mermaid / Saved panel
    NavigationBar.tsx      Opens the Docs / Integrations / Node Gallery / Settings pages
    IntegrationsPage.tsx   API endpoint, Google account, and per-integration forms
    ApiEndpointCard.tsx    Worker URL + API key, with a reachability test
    NodeOperationForm.tsx  Renders an operation's declared fields in the node editor
    nodes/AppNode.tsx      The single app-scoped node component
    nodes/appNodes.tsx     Per-app styling; binds AppNode to an integration
    nodes/StickyNote.tsx   Annotation; no handles, never runs
    nodes/*.tsx            Older single-purpose and utility nodes (script, text, http, ...)
  lib/
    operations/            The operation registry: types, asana, google, data, tools
    operationEngine.ts     Pure spec + params + rows -> a concrete HTTP request
    integrationCore.ts     Config schemas, validation, row normalization (no DOM, no Node)
    nodeConfig.ts          Credential precedence
    integrations.ts        localStorage credential store
    apiBase.ts             Where the API lives; same origin, or a deployed Worker
    nodeApi.ts             postJson, routed through apiBase
    workflowStore.ts       Saved workflows over /api/workflows
    workflowCode.ts        The graph rendered as the code that runs it
    mermaid.ts             Flowchart in and out of the canvas
    defaultWorkflow.ts     The graph a fresh canvas opens with, and CANVAS_CENTER
    providerRequests.ts    Per-vendor URL builders and response normalizers
    workflowEngine.ts      Graph validation and a simulated executor (tests only)
    auth.ts, authCore.ts   Supabase Google sign-in
    companionCode.ts       Apps Script / Edge Function generators for blocked paths
  server/
    executeCore.ts         executeOperation — the route body, no HTTP framework in it
    executeRoute.ts        The Express wrapper around it, injecting the Gemini SDK
    runtime.ts             Env config, probe, readJsonResponse — nothing Node-only
    operationRunner.ts     runOperation plus the custom handlers
    providerRoutes.ts      Older per-provider routes (see SPINE.md)
    integrationKit.ts      Gemini SDK client; re-exports runtime.ts for old importers

tests/
  unit/                    Pure logic: engine, runner, registry, core, providers,
                           auth, mermaid, code generation, and the default
                           workflow's scripts
  integration/             React: app-scoped nodes, palette, nav, node components
```
