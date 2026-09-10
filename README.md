# Bernie

Bernie is a workflow-automation canvas. You wire nodes together on an
[@xyflow/react](https://reactflow.dev) graph; each app-scoped node runs one
declared operation — pull rows, push rows, mutate something — against a
third-party API, through a small Express server that holds the credentials and
makes the HTTP call. Execution is browser-driven today: a graph runs while its
tab is open, and it autosaves to `localStorage`.

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
separate front-end port. The port is fixed at 3000 (`server.ts:30`).

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | `tsx server.ts` — Express + Vite middleware on :3000 |
| `npm test` | `vitest run` |
| `npm run test:watch` | `vitest` in watch mode |
| `npm run lint` | `tsc --noEmit`. There is no ESLint config in this repo. |
| `npm run build` | `vite build`, then esbuild bundles `server.ts` into `dist/server.cjs` |
| `npm start` | `node dist/server.cjs` |

`npm start` needs `NODE_ENV=production` set. The bundled server still branches
on it (`server.ts:619`) and will otherwise try to boot a Vite dev server out of
the production bundle.

### Environment

```sh
cp .env.example .env
```

Everything in `.env.example` is optional. Those variables are **server-side
fallbacks only** — the normal path is to enter credentials in the UI (left nav
→ **Integrations**, called "Connections & APIs" in the in-app copy), which
stores them in the browser and sends them with each run.

Nothing in the app calls `dotenv.config()` — `dotenv` is in `package.json` but
is never imported — so a `.env` file is not read on its own. If you want the
fallbacks, export the variables in your shell or start the server with Node's
env-file flag:

```sh
npx tsx --env-file=.env server.ts
```

`GEMINI_API_KEY` is the one variable with process-wide effect: it builds a
shared Gemini client at boot (`src/server/integrationKit.ts:21`).

---

## The default workflow

A canvas with nothing saved opens on a seven-node ASIN issue triage graph
(`src/lib/defaultWorkflow.ts`), not an empty pane:

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
env fallback underneath with `mergedConfig`
(`src/server/integrationKit.ts:92`). A blank value never overwrites a set one
at any level.

Google Sheets and Drive are the exception: they authorize with the OAuth token
from Supabase Google sign-in, which the node fetches separately and sends as
`accessToken` (`src/components/nodes/AppNode.tsx:80`).

---

## Repo layout

```
server.ts                  Express host: Vite middleware in dev, static dist in prod
vite.config.ts             React + Tailwind; "@" resolves to the repo root
vitest.config.ts           jsdom, tests/setup.ts
PLAN.md                    Roadmap toward running with the browser closed

src/
  App.tsx                  ErrorBoundary > ThemeProvider > ReactFlowProvider > Canvas
  types.ts                 Node data shapes; AppNodeData is the app-scoped one
  components/
    Canvas.tsx             Graph state, autosave, downstream propagation
    NavigationBar.tsx      Opens the Docs / Integrations / Node Gallery / Settings pages
    IntegrationsPage.tsx   Google account card plus per-integration credential forms
    NodeOperationForm.tsx  Renders an operation's declared fields in the node editor
    nodes/AppNode.tsx      The single app-scoped node component
    nodes/appNodes.tsx     Per-app styling; binds AppNode to an integration
    nodes/*.tsx            Older single-purpose and utility nodes (script, text, http, ...)
  lib/
    operations/            The operation registry: types, asana, google, data, tools
    operationEngine.ts     Pure spec + params + rows -> a concrete HTTP request
    integrationCore.ts     Config schemas, validation, row normalization (no DOM, no Node)
    nodeConfig.ts          Credential precedence
    integrations.ts        localStorage credential store
    defaultWorkflow.ts     The graph a fresh canvas opens with
    providerRequests.ts    Per-vendor URL builders and response normalizers
    workflowEngine.ts      Graph validation and a simulated executor (tests only)
    auth.ts, authCore.ts   Supabase Google sign-in
    companionCode.ts       Apps Script / Edge Function generators for blocked paths
  server/
    executeRoute.ts        POST /api/integrations/execute — the one execution route
    operationRunner.ts     runOperation plus the custom handlers
    providerRoutes.ts      Older per-provider routes (see SPINE.md)
    integrationKit.ts      Env fallbacks, Gemini client, fetch wrapper

tests/
  unit/                    Pure logic: engine, runner, registry, core, providers,
                           auth, and the default workflow's scripts
  integration/             React: app-scoped nodes, palette, nav, node components
```
