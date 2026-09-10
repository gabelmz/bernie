-- Saved workflows. One row per workflow, the graph stored as JSON.
--
-- The graph is opaque to SQL on purpose: nodes and edges change shape as the
-- canvas grows, and a schema that mirrored them would need a migration every
-- time a node gained a field. The columns here are only what the list view and
-- access control need to answer without parsing the graph.
CREATE TABLE IF NOT EXISTS workflows (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  -- Supabase user id when the request carried a session, else 'anonymous'.
  owner         TEXT NOT NULL DEFAULT 'anonymous',
  graph         TEXT NOT NULL,
  node_count    INTEGER NOT NULL DEFAULT 0,
  edge_count    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- The list view is always "my workflows, most recently touched first".
CREATE INDEX IF NOT EXISTS workflows_owner_updated
  ON workflows (owner, updated_at DESC);
