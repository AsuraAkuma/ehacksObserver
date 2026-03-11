# ehacksObserver

## Overview
`ehacksObserver` is a read-only GitHub App used during hackathons to track repository activity and convert that activity into points and achievements.

It provides a reliable scoring pipeline for organizers while giving participants transparent progress signals.

## Why This Project Exists
Hackathons move quickly, and manual progress tracking does not scale. This service automates scoring by ingesting GitHub events and applying consistent rules across all teams.

## Core Capabilities
- Ingests GitHub webhook events for repository activity.
- Evaluates repository, commit, branch, and file-based challenge rules.
- Persists challenge completions and points in MySQL.
- Recalculates high-load aggregate checks on a scheduled interval.
- Exposes deterministic behavior suitable for leaderboard and reporting systems.

## High-Level Architecture
1. GitHub sends webhook events to `/api/webhook`.
2. Event handlers under `hooks/` normalize data and dispatch processing.
3. Rule logic in `lib/checks.js` evaluates eligibility.
4. The points engine in `lib/pointsEngine.js` writes challenge completions and score updates.
5. SQL schema and seed data are maintained via `eHacks.sql` and initialization logic.

## Technology Stack
- Runtime: Node.js (CommonJS)
- Data: MySQL (`mysql2`)
- GitHub integration: `octokit`
- Process/env management: `dotenv`, `nodemon`
- Tests: Node built-in test runner (`node --test`)
- CI: GitHub Actions (unit tests, e2e tests, build artifacts)

## Repository Structure
- `app.js`: Application bootstrap, webhook server, and scheduler startup.
- `hooks/`: Webhook handlers by event domain.
- `lib/`: Rule checks, points engine, and supporting services.
- `scripts/`: Operational scripts for backfill, audits, and points maintenance.
- `tests/`: Unit and e2e test suites.
- `challenge-fixtures/`: Fixture data used by tests.
- `.github/workflows/`: CI/CD workflows.

## Quick Start
### 1) Prerequisites
- Node.js 20+
- npm
- MySQL 8+
- A configured GitHub App with webhook delivery enabled

### 2) Install
```bash
npm ci
```

### 3) Configure Environment
Create a `.env` file with at least:

```env
APP_ID=<github_app_id>
WEBHOOK_SECRET=<github_webhook_secret>
PRIVATE_KEY_PATH=<absolute_path_to_private_key_pem>
WEBHOOK_HOST=0.0.0.0
WEBHOOK_PORT=5508

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USERNAME=<db_user>
DB_PASSWORD=<db_password>
DB_DATABASE=<db_name>
DB_POOL_LIMIT=10

HIGH_LOAD_INTERVAL_MINUTES=30
```

### 4) Run
```bash
npm run dev
```

## Testing and Quality
Run all tests:

```bash
npm test
```

Run unit tests only:

```bash
npm run test:unit
```

Run e2e tests only:

```bash
npm run test:e2e
```

## CI/CD
The CI workflow on `main` executes:
- Unit tests
- E2E tests
- Build artifact generation

Deployment is gated behind successful CI completion.

## Security and Access Model
- App permissions are read-only for repository content and metadata.
- Webhook signatures are validated via `WEBHOOK_SECRET`.
- Secrets are loaded from environment variables; no credentials are hardcoded.

## Operational Scripts
- `npm run verify:points`: Validate points setup.
- `npm run points:total`: Calculate challenge points totals.
- `npm run backfill:github`: Backfill repository GitHub data.
- `npm run job:audit:missed-challenges`: Audit missed challenge awards.
- `npm run job:cleanup:challenge-duplicates`: Remove duplicate challenge completions.
- `npm run job:recalculate:points`: Recompute team and member points.

## Current Status
This repository is actively maintained as a production-oriented hackathon scoring backend and includes CI coverage, test suites, and scheduled maintenance jobs for scoring integrity.

## License
This project is licensed under the terms of the license in `LICENSE`.
