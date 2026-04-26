# CLAUDE.md

Guidelines for working with Claude Code in this repo.

## Git workflow

- **Never push directly to `main`.** Always create a branch, open a PR, and let the human merge.
- Branch naming: `feature/`, `fix/`, `docs/` prefixes.
- Commit `package-lock.json` alongside `package.json` whenever dependencies change — `npm ci` in Docker requires it.

## Node

- Node 22 (LTS) is used across all services and the Cloud Function.
- nvm is used locally. Source it before running node commands: `. $NVM_DIR/nvm.sh`

## Local development

### Services

Each service has a `.env` file (copied from `.env.example`) for local config. dotenv is loaded automatically via `import 'dotenv/config'` at the top of each service entry point.

```bash
# article-processor (port 8082)
cd services/article-processor && npm run dev

# feed-fetcher (port 8081) — posts directly to article-processor locally
cd services/feed-fetcher && npm run dev

# trigger a fetch
curl -X POST http://localhost:8081/fetch
```

### Web

```bash
cd web && npm run dev
```

Requires a `.env.local` with the `NEXT_PUBLIC_FIREBASE_*` values from Firebase Console.

## Deploying

All deployments happen via GitHub Actions on merge to `main`. There is no manual deploy process.

| Service | Workflow | Trigger |
|---|---|---|
| `web` | `deploy-web.yml` | changes to `web/**` |
| `feed-fetcher` | `deploy-feed-fetcher.yml` | changes to `services/feed-fetcher/**` |
| `article-processor` | `deploy-article-processor.yml` | changes to `services/article-processor/**` |
| `onFeedAdded` function | `deploy-functions.yml` | changes to `functions/**` or `firebase.json` |

The functions workflow also has `workflow_dispatch` for manual triggering via the GitHub Actions UI or `gh workflow run deploy-functions.yml`.

## Firebase / Firestore

- Firestore security rules live in `firestore.rules`. Deploy them via the Firebase Rules REST API or Firebase CLI (`firebase deploy --only firestore:rules`).
- The `users/{uid}` document is **never explicitly created** — only the `users/{uid}/feeds/{feedId}` subcollection is written. Any query that needs all feeds must use `db.collectionGroup('feeds')`.

## Structured logging

`feed-fetcher` emits structured JSON logs to stdout, which Cloud Run forwards to Cloud Logging. Log events:

| Event | Key fields |
|---|---|
| `fetch_started` | `feedCount` |
| `feed_fetched` | `feedId`, `feedTitle`, `articlesPublished` |
| `feed_fetch_error` | `feedId`, `feedTitle`, `error` |
| `fetch_complete` | `totalPublished`, `totalErrors`, `durationMs` |
| `fetch_fatal` | `error`, `durationMs` |

Query in Log Explorer:
```
resource.type="cloud_run_revision"
resource.labels.service_name="feed-fetcher"
jsonPayload.event="feed_fetch_error"
```

## Planning

For non-trivial implementation tasks or technical decisions, propose a plan using the ADR format before writing code:

```
# ADR-[number]: [Title]
**Status:** Proposed | Accepted
**Date:** [Date]

## Context
## Decision
## Options Considered (with trade-off table)
## Consequences
## Action Items
```

Use `/architecture` to invoke this explicitly.

## GCP project

- Project ID: `my-rss-prod`
- Region: `us-central1`
- Firestore: `nam5` (multi-region)
