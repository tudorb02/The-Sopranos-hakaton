-- Version 2 of the demo model: facts instead of frozen screen copy.
-- The demo data is fictional and reseeded; version 1 tables are replaced, not converted.
DROP TABLE IF EXISTS merchant_rules;
DROP TABLE IF EXISTS decisions;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS questions;
DROP TABLE IF EXISTS historical_spending;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS pots;
DROP TABLE IF EXISTS goals;
DROP TABLE IF EXISTS budgets;
DROP TABLE IF EXISTS commitments;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS cycles;
DROP TABLE IF EXISTS personas;
DROP TABLE IF EXISTS demo_accounts;
DROP TABLE IF EXISTS seed_runs;

CREATE TABLE demo_accounts (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE CHECK (slug IN ('pf', 'student')),
  iban_masked TEXT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'RON',
  birth_date DATE NOT NULL,
  presentation JSONB NOT NULL,
  client JSONB NOT NULL,
  -- Running balance before the first ledger row; every later balance is computed.
  ledger_opening_minor BIGINT NOT NULL CHECK (ledger_opening_minor BETWEEN 0 AND 9007199254740991)
);
CREATE TABLE personas (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL UNIQUE REFERENCES demo_accounts(id) ON DELETE CASCADE,
  budget_method TEXT NOT NULL CHECK (budget_method IN ('fixed_first', 'envelopes')),
  income_day INTEGER NOT NULL CHECK (income_day BETWEEN 1 AND 28),
  has_categories BOOLEAN NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  templates JSONB NOT NULL,
  preferences JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE merchants (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category_default TEXT NOT NULL,
  UNIQUE(persona_id, name)
);
CREATE TABLE merchant_rules (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE(persona_id, merchant_id)
);
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('statement', 'receipt')),
  -- Receipt owner; not a foreign key because imports reference documents and transactions reference imports.
  transaction_id UUID,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  content BYTEA NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('stored', 'processed', 'failed', 'unsupported')),
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX documents_persona ON documents(persona_id, created_at);
CREATE TABLE imports (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('account', 'statement')),
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  period_from DATE,
  period_to DATE,
  status TEXT NOT NULL CHECK (status IN ('processing', 'done', 'failed')),
  rows_total INTEGER NOT NULL DEFAULT 0,
  rows_imported INTEGER NOT NULL DEFAULT 0,
  rows_duplicate INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ
);
CREATE INDEX imports_persona ON imports(persona_id, created_at);
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  -- Stable key used in routes (t1, m13, h-…); external_id deduplicates bank/statement rows.
  legacy_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  account_key TEXT NOT NULL DEFAULT 'current',
  import_id UUID REFERENCES imports(id) ON DELETE SET NULL,
  merchant_id UUID NOT NULL REFERENCES merchants(id),
  occurred_at TIMESTAMPTZ NOT NULL,
  local_date DATE NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor <> 0 AND amount_minor BETWEEN -9007199254740991 AND 9007199254740991),
  currency CHAR(3) NOT NULL DEFAULT 'RON',
  category TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('income', 'saving', 'fixed', 'variable', 'pot')),
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('pending', 'booked')),
  description_raw TEXT NOT NULL,
  excluded BOOLEAN NOT NULL DEFAULT FALSE,
  pot_key TEXT,
  display JSONB NOT NULL DEFAULT '{}',
  splits JSONB NOT NULL DEFAULT '[]',
  UNIQUE(persona_id, legacy_id),
  UNIQUE(persona_id, external_id)
);
CREATE INDEX tx_persona_date ON transactions(persona_id, local_date);
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  subscription_key TEXT NOT NULL,
  merchant_id UUID NOT NULL REFERENCES merchants(id),
  name TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  period TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly', 'yearly')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancel_planned', 'cancelled')),
  has_app BOOLEAN NOT NULL,
  app_label TEXT,
  monitored BOOLEAN NOT NULL,
  plan_note TEXT,
  sort_order INTEGER NOT NULL,
  UNIQUE(persona_id, subscription_key)
);
CREATE TABLE usage_signals (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('screen_time', 'geofence', 'health', 'manual')),
  occurred_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX usage_signals_subscription ON usage_signals(subscription_id, occurred_at);
CREATE TABLE commitments (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  due_day INTEGER CHECK (due_day BETWEEN 1 AND 31),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL
);
CREATE INDEX commitments_persona ON commitments(persona_id);
CREATE TABLE expected_incomes (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  expected_on DATE NOT NULL,
  certain BOOLEAN NOT NULL
);
CREATE TABLE budgets (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  budget_key TEXT NOT NULL,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('count', 'amount', 'paid', 'pause', 'protected')),
  period TEXT NOT NULL CHECK (period IN ('week', 'cycle')),
  limit_minor BIGINT CHECK (limit_minor > 0 AND limit_minor <= 9007199254740991),
  count_limit INTEGER CHECK (count_limit > 0 AND count_limit <= 100),
  warn_at_percent INTEGER CHECK (warn_at_percent BETWEEN 1 AND 100),
  group_key TEXT,
  on_home BOOLEAN NOT NULL DEFAULT FALSE,
  note_style TEXT CHECK (note_style IN ('count', 'pace', 'occasions', 'per_day', 'limit', 'paid', 'due', 'description', 'agreed')),
  description TEXT,
  paused_until DATE,
  notify JSONB,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CHECK ((kind = 'count') = (count_limit IS NOT NULL)),
  CHECK ((kind = 'amount') = (limit_minor IS NOT NULL)),
  CHECK (kind <> 'pause' OR paused_until IS NOT NULL),
  UNIQUE(persona_id, budget_key)
);
CREATE TABLE goals (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  goal_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'planned', 'done', 'cancelled')),
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  target_minor BIGINT NOT NULL CHECK (target_minor > 0),
  opening_minor BIGINT NOT NULL DEFAULT 0 CHECK (opening_minor >= 0),
  starts_on DATE,
  rule JSONB,
  schedule JSONB NOT NULL DEFAULT '[]',
  funding JSONB NOT NULL DEFAULT '[]',
  copy JSONB NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE(persona_id, goal_key)
);
CREATE TABLE pots (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  pot_key TEXT NOT NULL,
  icon TEXT NOT NULL,
  target_minor BIGINT NOT NULL CHECK (target_minor > 0),
  planned_on DATE,
  event_month DATE,
  copy JSONB NOT NULL,
  sort_order INTEGER NOT NULL,
  UNIQUE(persona_id, pot_key)
);
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  phrase TEXT,
  starts_on DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('birthday', 'holiday', 'marked', 'deadline')),
  audience TEXT CHECK (audience IN ('friends', 'family')),
  source TEXT NOT NULL CHECK (source IN ('google', 'phone', 'user')),
  gifts BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT
);
CREATE INDEX calendar_events_persona ON calendar_events(persona_id, starts_on);
CREATE TABLE questions (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  definition JSONB NOT NULL,
  answer JSONB NOT NULL,
  sort_order INTEGER NOT NULL,
  UNIQUE(persona_id, question_key)
);
CREATE TABLE user_memory (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  memory_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('problem', 'preference', 'decision', 'context', 'correction')),
  content TEXT NOT NULL,
  amount_minor BIGINT,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE(persona_id, memory_key)
);
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('coach', 'user')),
  kind TEXT NOT NULL CHECK (kind IN ('text', 'proposal', 'service')),
  body JSONB NOT NULL,
  decision TEXT,
  decided_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE(persona_id, position)
);
CREATE TABLE services (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  service_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  decision TEXT,
  decided_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL,
  UNIQUE(persona_id, service_key)
);
CREATE TABLE analysis_runs (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('running', 'done', 'failed')),
  as_of DATE NOT NULL,
  steps JSONB NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ
);
CREATE INDEX analysis_runs_persona ON analysis_runs(persona_id, started_at);
CREATE TABLE insights (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'seen', 'accepted', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE access_log (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  actor TEXT NOT NULL CHECK (actor IN ('coach', 'user')),
  action TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE decisions (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  decision_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE(persona_id, decision_key)
);
CREATE TABLE seed_runs (version TEXT PRIMARY KEY);
