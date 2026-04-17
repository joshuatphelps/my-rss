# my-rss

A cross-platform RSS reader with semantic article grouping, source aggregation, and expiration-based feed management.

## Vision

Most RSS readers track every article individually. This reader groups similar stories from different sources into a single cluster — one tap marks all coverage of a topic as read. Stories expire automatically, keeping your feed clean without manual triage.

## Platforms

| Platform | Stack | Status |
|---|---|---|
| Web | Next.js, Firebase Auth, Firestore | Phase 1 — in progress |
| iOS | Swift, SwiftUI, Firebase SDK | Phase 4 |
| Android | Kotlin, Compose, Firebase SDK | Phase 4 |

## Key Features

- **Semantic article grouping** — articles covering the same story are clustered together across sources
- **Mark cluster as read** — reading one story marks all coverage of it as read
- **Article expiration** — breaking news expires in 24–48h; features last longer; configurable per feed
- **Social sources** — connect Reddit and Substack accounts alongside standard RSS feeds
- **Cross-platform sync** — account, subscriptions, and read state sync via Firestore

## Architecture

See [`docs/architecture.md`](docs/architecture.md) for the full system design.

## Development

See [`docs/phases.md`](docs/phases.md) for the phased delivery plan.

### Quick start (web)

```bash
cd web
npm install
npm run dev
```

Requires environment variables — see [`web/.env.example`](web/.env.example) once scaffolded.
