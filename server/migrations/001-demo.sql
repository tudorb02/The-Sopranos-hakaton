CREATE TABLE demo_accounts (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE CHECK (slug IN ('pf', 'student')),
  presentation JSONB NOT NULL,
  client JSONB NOT NULL
);
CREATE TABLE personas (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL UNIQUE REFERENCES demo_accounts(id),
  mode TEXT NOT NULL CHECK (mode IN ('salary', 'student')),
  has_categories BOOLEAN NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  templates JSONB NOT NULL,
  preferences JSONB NOT NULL
);
CREATE TABLE cycles (
  persona_id UUID PRIMARY KEY REFERENCES personas(id) ON DELETE CASCADE,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  opening_minor BIGINT NOT NULL CHECK (opening_minor BETWEEN 0 AND 9007199254740991)
);
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  legacy_id TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'current' CHECK (scope IN ('current', 'comparison')),
  occurred_at TIMESTAMPTZ NOT NULL,
  local_date DATE NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor BETWEEN -9007199254740991 AND 9007199254740991),
  currency CHAR(3) NOT NULL DEFAULT 'RON',
  category TEXT NOT NULL,
  merchant TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('income', 'saving', 'fixed', 'variable', 'pot')),
  excluded BOOLEAN NOT NULL DEFAULT FALSE,
  visible BOOLEAN NOT NULL,
  sort_order INTEGER NOT NULL,
  pot_key TEXT,
  presentation JSONB NOT NULL,
  splits JSONB NOT NULL DEFAULT '[]',
  UNIQUE(persona_id, legacy_id)
);
CREATE INDEX tx_persona_date ON transactions(persona_id, local_date);
CREATE TABLE commitments (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0)
);
CREATE TABLE budgets (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  budget_key TEXT NOT NULL,
  category TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('count', 'amount', 'paid', 'pause', 'protected')),
  period TEXT NOT NULL CHECK (period IN ('week', 'cycle')),
  limit_minor BIGINT CHECK (limit_minor > 0 AND limit_minor <= 9007199254740991),
  count_limit INTEGER CHECK (count_limit > 0 AND count_limit <= 100),
  warn_at_percent INTEGER,
  presentation JSONB NOT NULL,
  sort_order INTEGER NOT NULL,
  UNIQUE(persona_id, budget_key)
);
CREATE TABLE goals (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL UNIQUE REFERENCES personas(id) ON DELETE CASCADE,
  target_minor BIGINT NOT NULL CHECK (target_minor > 0),
  opening_minor BIGINT NOT NULL CHECK (opening_minor >= 0),
  presentation JSONB NOT NULL,
  schedule JSONB NOT NULL,
  funding JSONB NOT NULL
);
CREATE TABLE pots (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  pot_key TEXT NOT NULL,
  target_minor BIGINT NOT NULL,
  planned BOOLEAN NOT NULL,
  sort_order INTEGER NOT NULL,
  presentation JSONB NOT NULL,
  UNIQUE(persona_id, pot_key)
);
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  subscription_key TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  monitored BOOLEAN NOT NULL,
  profile JSONB NOT NULL,
  app JSONB,
  sort_order INTEGER NOT NULL,
  UNIQUE(persona_id, subscription_key)
);
CREATE TABLE historical_spending (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  group_name TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor < 0),
  sort_order INTEGER NOT NULL,
  UNIQUE(persona_id, month, group_name)
);
CREATE TABLE questions (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  definition JSONB NOT NULL,
  answer JSONB NOT NULL,
  sort_order INTEGER NOT NULL,
  UNIQUE(persona_id, question_key)
);
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  payload JSONB NOT NULL,
  UNIQUE(persona_id, position)
);
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('statement', 'receipt')),
  transaction_key TEXT,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  content BYTEA NOT NULL,
  presentation JSONB NOT NULL,
  sort_order INTEGER NOT NULL
);
CREATE TABLE services (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  service_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  decision TEXT,
  sort_order INTEGER NOT NULL,
  UNIQUE(persona_id, service_key)
);
CREATE TABLE decisions (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  decision_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  UNIQUE(persona_id, decision_key)
);
CREATE TABLE merchant_rules (
  id UUID PRIMARY KEY,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  merchant TEXT NOT NULL,
  payload JSONB NOT NULL,
  UNIQUE(persona_id, merchant)
);
CREATE TABLE seed_runs (version TEXT PRIMARY KEY);
