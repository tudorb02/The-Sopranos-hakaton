# CLAUDE.md — GreenStruct Agro

Read `README.md` before changing anything. It is the single source of truth for the product, the 6 categories, the formulas, the funds and the decisions (§13). If a decision changes, update the README first, then the code.

`main` and the other branches belong to other teams. We work on `B2B_Agro` and do not change them.

## Rules

1. **The LLM never calculates.** Every number shown to a user comes from `backend/src/main/java/ro/greenstruct/agro/engine/` (pure functions, `BigDecimal`, with tests). Agents call the engine through tools and refer to results by `calcId`; the backend resolves the figures.
2. **No constants in code.** Thresholds, rates, emission factors, efficiencies and prices live in `config/` (and the catalogs in `data/catalog/`), each with its source noted next to it.
3. **Everything works offline.** The app must run end to end without AWS credentials and without internet (recorded demo runs, mock external APIs; the satellite map tiles are optional, the parcels still show without them). Bedrock is enabled only when credentials are configured (AWS profile or environment variables).
4. **External sources:** ANAF is live (public API, no key) for any CUI that is not a demo farm; APIA, ANSVSA, Open Banking and risk maps are mocks with the interface of the real service. `GREENSTRUCT_ANAF_ENABLED=false` turns ANAF off; the tests turn it off in `backend/src/test/resources/config/application.yml`.
5. **Demo data is clearly fictional.** Fictional names and numeric CUIs that do not exist at ANAF. Never real client data.
6. **Agents end with a `submit_*` tool** whose input is validated against `contracts/schemas/`. No free-text parsing.
7. **`contracts/` is the contract** between frontend, backend and agents (OpenAPI, JSON Schema, events, fixtures). Format changes start there and are announced to the roles affected.
8. **Language:** UI text, backend user-visible text and agent output in English; the demo input documents stay Romanian (keep the Romanian matching words, add English ones). Field names with the `Ro` suffix are kept for contract stability. Code, identifiers, comments and commits in English (Conventional Commits).
9. **Every engine function ships with JUnit tests** on values calculated independently (by hand or in Excel).
10. **Secrets only in the environment or the AWS profile**, never in code or commits.

## Stack

Vite + React + TypeScript + Tailwind + shadcn/ui (`frontend/`) · Java 21 + Spring Boot 3.5 + Maven (`backend/`) · AWS Bedrock Converse API (AWS SDK for Java v2) · JSON Schema + OpenAPI (`contracts/`) · JUnit 5.

## Commands

```bash
cd backend && mvn test                              # backend tests
cd backend && mvn spring-boot:run                   # API on http://localhost:8080
cd contracts && npm install && npm run check        # contract lint + schema checks
cd contracts && npm run mock                        # Prism mock of the API on :4010
```

If the default Java is not 21, set `JAVA_HOME` to a JDK 21 before running `mvn`.

## Git

Work on the `B2B_Agro` branch in small commits.
