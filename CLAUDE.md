# CLAUDE.md — GreenStruct Agro

Read `README.md` before changing anything. It is the single source of truth for the product, the 6 categories, the formulas, the funds and the decisions (§13). If a decision changes, update the README first, then the code.

## Rules

1. **The LLM never calculates.** Every number shown to a user comes from `backend/src/engine/` (pure functions with tests). Agents call the engine through tools; the backend recomputes and overwrites any figure an agent writes.
2. **No constants in code.** Thresholds, rates, emission factors, efficiencies and prices live in `config/` or `backend/src/categories/*.json`, each with its source noted next to it.
3. **Everything works offline.** The app must run end to end without AWS credentials and without internet (recorded demo runs, mock external APIs, map without base tiles). Bedrock is enabled only when keys are present in `.env`.
4. **All external sources are mocks** (ANAF, APIA, ANSVSA, Open Banking, risk maps), each with the interface of the real service.
5. **Demo data is clearly fictional.** Fictional names, CUIs `DEMO-0001` … `DEMO-0006`. Never real company data.
6. **Agents end with a `submit_*` tool** whose input is validated with zod from `shared/`. No free-text parsing.
7. **`shared/` is the contract** between frontend, backend and agents.
8. **Language:** UI text in Romanian; code, identifiers, comments and commits in English (Conventional Commits).
9. **Every engine function ships with tests** on fixed values from the demo farms.
10. **Secrets only in `.env`**, never in code or commits.

## Stack

Vite + React + TypeScript + Tailwind + shadcn/ui (frontend) · Node.js + TypeScript + Fastify (backend) · zod · vitest · npm workspaces (`frontend/`, `backend/`, `shared/`), started with `npm run dev`.

## Git

Work on the `B2B_Agro` branch in small commits.
