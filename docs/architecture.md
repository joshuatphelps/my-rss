# Architecture

## Infrastructure (GCP)

| Service | Role |
|---|---|
| Firebase Auth | Identity — shared across web, iOS, Android |
| Cloud Firestore | Primary database — users, feeds, clusters, read state |
| Cloud Run | Stateless API + background services |
| Cloud Scheduler | Triggers periodic feed fetch jobs |
| Cloud Pub/Sub | Decouples feed fetcher from article processor |
| Vertex AI (text-embedding-004) | Semantic embeddings for article grouping |
| Firebase Hosting | Serves the Next.js web app |

## Services

```
┌──────────────────┐     Cloud Scheduler (every 15 min)
│  Feed Fetcher    │◄────────────────────────────────────
│  (Cloud Run)     │
│                  │  fetches RSS, Reddit, Substack
└────────┬─────────┘
         │ publishes raw articles
         ▼
    [Pub/Sub topic: raw-articles]
         │
         ▼
┌──────────────────┐
│Article Processor │  - normalizes articles
│  (Cloud Run)     │  - computes text embeddings (Vertex AI)
│                  │  - finds or creates cluster
│                  │  - sets expiresAt
└────────┬─────────┘
         │ writes
         ▼
    [Cloud Firestore]
         │
         ▼
┌──────────────────┐
│   API Service    │  REST, authenticated via Firebase Auth
│  (Cloud Run)     │  consumed by web + mobile clients
└──────────────────┘
```

## Data Model

### `users/{uid}`
```
{
  email: string,
  displayName: string,
  createdAt: timestamp,
  settings: {
    defaultExpiryHours: number   // default: 48
  }
}
```

### `users/{uid}/feeds/{feedId}`
```
{
  type: "rss" | "reddit" | "substack",
  url: string,                   // RSS URL or account identifier
  title: string,
  expiryHours: number | null,    // null = use user default
  addedAt: timestamp,
  lastFetchedAt: timestamp
}
```

### `articles/{articleId}`
```
{
  feedId: string,
  uid: string,                   // owner user
  sourceUrl: string,
  title: string,
  body: string,
  author: string | null,
  publishedAt: timestamp,
  expiresAt: timestamp,
  clusterId: string | null,
  embeddingVector: number[],     // stored for similarity lookup
  source: string                 // human-readable source name
}
```

### `clusters/{clusterId}`
```
{
  uid: string,
  topic: string,                 // derived label (most common headline words)
  articleIds: string[],
  sources: string[],             // list of source names
  firstSeenAt: timestamp,
  latestAt: timestamp,
  expiresAt: timestamp,
  centroidVector: number[]       // mean of member article embeddings
}
```

### `users/{uid}/readClusters/{clusterId}`
```
{
  readAt: timestamp
}
```

## Article Grouping Logic

1. New article arrives from processor.
2. Compute text embedding via Vertex AI `text-embedding-004`.
3. Load all non-expired clusters for this user created within a configurable time window (default: 48h).
4. Compute cosine similarity between article embedding and each cluster's `centroidVector`.
5. If similarity ≥ threshold (default: 0.85), add article to that cluster and update centroid.
6. Otherwise, create a new cluster with this article as the seed.
7. Set `expiresAt` on the article and cluster based on feed's `expiryHours`.

## Article Expiration

- Each article and cluster has an `expiresAt` timestamp.
- The API filters out expired clusters from responses by default.
- A nightly Cloud Scheduler job hard-deletes documents older than 30 days to control storage costs.
- Expiry defaults: breaking news feeds = 48h, feature/magazine feeds = 7d, user-configurable per feed.

## Authentication Flow

- Firebase Auth handles sign-in (Google OAuth initially; email/password and Apple ID in later phases).
- Web: Firebase client SDK manages tokens; API service verifies via Firebase Admin SDK.
- Mobile: Firebase SDK handles token refresh natively.

## Social Source Integration

### Reddit
- User authenticates via Reddit OAuth2.
- Feed fetcher uses Reddit API to pull subscribed subreddits and home feed.
- Posts normalized into the standard article schema.
- Rate limits: 60 requests/minute per OAuth token.

### Substack
- Most Substack publications expose standard RSS feeds — no auth required for free content.
- OAuth integration for paywalled content is a future stretch goal.
