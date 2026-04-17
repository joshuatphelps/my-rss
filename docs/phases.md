# Delivery Phases

## Phase 1 — Web MVP (target: 2–3 weeks)

**Goal:** Deployed web app where users can sign in, add RSS feeds, and read grouped articles.

### Scope
- [ ] Firebase Auth (Google sign-in)
- [ ] Add, list, and delete RSS feed subscriptions
- [ ] Cloud Scheduler → Cloud Run feed fetcher → Pub/Sub pipeline
- [ ] Article processor with naive title-similarity grouping (normalized title hashing; no ML yet)
- [ ] Expiration logic (default 48h, configurable per feed)
- [ ] Read state written to Firestore, synced in real time
- [ ] Next.js web UI
  - [ ] Sign in / sign out
  - [ ] Feed management screen
  - [ ] Clustered article list (unread by default)
  - [ ] Article detail / open original
  - [ ] Mark cluster as read
- [ ] Deploy to Firebase Hosting + Cloud Run

### Out of scope for Phase 1
- Semantic ML grouping
- Reddit / Substack
- Mobile apps

---

## Phase 2 — Smart Grouping + Polish (target: 2 weeks)

**Goal:** Replace naive grouping with semantic embeddings; improve UX.

### Scope
- [ ] Integrate Vertex AI `text-embedding-004` in the article processor
- [ ] Cluster centroid management in Firestore
- [ ] Cluster topic label derivation
- [ ] Per-feed expiry settings in the UI
- [ ] PWA manifest + basic offline support
- [ ] Performance and loading state polish

---

## Phase 3 — Social Sources (target: 2–3 weeks)

**Goal:** Connect Reddit and Substack alongside RSS.

### Scope
- [ ] Reddit OAuth2 flow in the web app
- [ ] Reddit feed fetcher (subscribed subreddits + home feed)
- [ ] Substack RSS auto-detection from publication URL
- [ ] Source badges in cluster view (show which outlets covered a story)
- [ ] Account linking UI (connect/disconnect Reddit)

---

## Phase 4 — iOS (target: 4–6 weeks)

**Goal:** Native iOS app with feature parity to web.

### Scope
- [ ] Harden Cloud Run API (versioned REST, documented contracts)
- [ ] Swift package with shared API client
- [ ] SwiftUI app: feed list, cluster reader, settings
- [ ] Firebase Auth (Google + Apple sign-in)
- [ ] Firestore real-time listeners
- [ ] FCM push notifications for high-priority clusters
- [ ] App Store submission

---

## Phase 5 — Android (target: 4–6 weeks, can overlap with Phase 4)

**Goal:** Native Android app with feature parity to web.

### Scope
- [ ] Kotlin + Compose app: feed list, cluster reader, settings
- [ ] Firebase Auth (Google sign-in)
- [ ] Firestore SDK
- [ ] FCM push notifications
- [ ] Play Store submission

---

## Open Questions

| Question | Default assumption | Needs decision |
|---|---|---|
| Similarity threshold for grouping | 0.85 cosine similarity | Tune in Phase 2 |
| Default expiry window | 48h news, 7d features | Yes — expose as user setting |
| Auth providers at launch | Google only | Email/password too? |
| Substack paywalled content | RSS only (free posts) | OAuth stretch goal |
| Feed fetch frequency | Every 15 minutes | May need per-feed overrides |
| Hard-delete retention | 30 days post-expiry | Confirm with storage cost targets |
