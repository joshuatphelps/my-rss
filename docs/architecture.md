# Architecture

## Infrastructure (GCP)

| Service | Role | Status |
|---|---|---|
| Firebase Auth | Identity — shared across web, iOS, Android | Live |
| Cloud Firestore | Primary database — users, feeds, clusters, read state | Live |
| Cloud Run | Stateless services (web, feed-fetcher, article-processor) | Live |
| Cloud Scheduler | Triggers periodic feed fetch every 15 min | Live |
| Cloud Pub/Sub | Decouples feed fetcher from article processor | Live |
| Cloud Functions | Event-driven triggers (e.g. onFeedAdded) | Live |
| Vertex AI (text-embedding-004) | Semantic embeddings for article grouping | Planned |
| Firebase Hosting | Serves the Next.js web app | Not used (web on Cloud Run) |

## Services

```
┌──────────────────┐     Cloud Scheduler (every 15 min)
│  Feed Fetcher    │◄────────────────────────────────────
│  (Cloud Run)     │◄────────────────────────────────────── onFeedAdded
│                  │  fetches RSS feeds                     (Cloud Function,
└────────┬─────────┘                                        Firestore trigger)
         │ publishes raw articles
         ▼
    [Pub/Sub topic: raw-articles]
         │ (push subscription)
         ▼
┌──────────────────┐
│Article Processor │  - deduplicates by URL
│  (Cloud Run)     │  - clusters by Jaccard title similarity
│                  │  - sets expiresAt
└────────┬─────────┘
         │ writes
         ▼
    [Cloud Firestore]
         │
         ▼
┌──────────────────┐
│   Web (Next.js)  │  authenticated via Firebase Auth
│  (Cloud Run)     │  reads clusters + articles directly from Firestore
└──────────────────┘
```

## Key implementation notes

- **Clustering** uses Jaccard similarity on stopword-filtered title tokens (no embeddings yet). Threshold: 0.3.
- **Feed fetcher** queries feeds via `db.collectionGroup('feeds')` — the parent `users/{uid}` document is never explicitly created, only the subcollection.
- **onFeedAdded** fires on `users/{uid}/feeds/{feedId}` document creation, fetches the new feed immediately, and publishes articles to Pub/Sub — articles appear within seconds of adding a feed rather than waiting up to 15 min for the scheduler.
- **Pub/Sub push** delivers to article-processor at its Cloud Run URL, authenticated via `pubsub-push-sa` with `roles/run.invoker`.

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

Current implementation (Jaccard similarity):

1. New article arrives via Pub/Sub push to article-processor.
2. Deduplicate by `sourceUrl` — skip if already stored.
3. Load all non-expired clusters for this user within the expiry window.
4. Tokenize article title (lowercase, strip punctuation, remove stopwords).
5. Compute Jaccard similarity between article tokens and each cluster's `topic` tokens.
6. If best score ≥ 0.3, merge article into that cluster.
7. Otherwise, create a new cluster seeded by this article's title.
8. Set `expiresAt` on article and cluster based on feed's `expiryHours` (default: 48h).

Planned upgrade: replace Jaccard with Vertex AI `text-embedding-004` cosine similarity for better semantic matching across paraphrased headlines.

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
