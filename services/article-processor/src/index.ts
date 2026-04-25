import 'dotenv/config'
import express from 'express'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore'

initializeApp()

const app = express()
app.use(express.json())

const db = getFirestore()

// ── Title similarity (Jaccard on stopword-filtered tokens) ───────────────────

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'was', 'are', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'can', 'it', 'its', 'this', 'that',
  'as', 'up', 'out', 'after', 'over', 'into', 'about', 'how', 'says',
])

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOPWORDS.has(w))
  )
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let intersection = 0
  for (const w of a) if (b.has(w)) intersection++
  const union = new Set([...a, ...b]).size
  return union === 0 ? 0 : intersection / union
}

const SIMILARITY_THRESHOLD = 0.3

// ── Types ────────────────────────────────────────────────────────────────────

interface ArticlePayload {
  uid: string
  feedId: string
  expiryHours: number
  article: {
    title: string
    sourceUrl: string
    body: string
    author: string | null
    publishedAt: string
    source: string
  }
}

// ── Routes ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

// Pub/Sub push endpoint — receives base64-encoded JSON message
app.post('/', async (req, res) => {
  try {
    const encoded = req.body?.message?.data
    if (!encoded) {
      res.status(400).json({ error: 'missing message.data' })
      return
    }

    const payload: ArticlePayload = JSON.parse(
      Buffer.from(encoded as string, 'base64').toString('utf-8')
    )

    await processArticle(payload)
    res.status(204).send()
  } catch (err) {
    console.error('Processing error:', err)
    // Ack the message to avoid infinite retries on bad data
    res.status(200).json({ error: String(err) })
  }
})

// ── Core processing ──────────────────────────────────────────────────────────

async function processArticle(payload: ArticlePayload) {
  const { uid, feedId, expiryHours, article } = payload

  const publishedAt = new Date(article.publishedAt)
  const now = new Date()
  const expiresAt = new Date(publishedAt.getTime() + expiryHours * 60 * 60 * 1000)

  if (expiresAt < now) return // already expired

  // Deduplicate by URL
  const dupeSnap = await db.collection('articles')
    .where('uid', '==', uid)
    .where('sourceUrl', '==', article.sourceUrl)
    .limit(1)
    .get()
  if (!dupeSnap.empty) return

  // Find candidate clusters within the expiry window
  const windowStart = new Date(now.getTime() - expiryHours * 60 * 60 * 1000)
  const clustersSnap = await db.collection('clusters')
    .where('uid', '==', uid)
    .where('latestAt', '>', Timestamp.fromDate(windowStart))
    .get()

  const articleTokens = tokenize(article.title)
  let bestClusterId: string | null = null
  let bestScore = 0

  for (const clusterDoc of clustersSnap.docs) {
    const score = jaccard(articleTokens, tokenize(clusterDoc.data().topic as string))
    if (score > bestScore) {
      bestScore = score
      bestClusterId = clusterDoc.id
    }
  }

  const articleRef = db.collection('articles').doc()
  const articleData = {
    uid,
    feedId,
    ...article,
    publishedAt: Timestamp.fromDate(publishedAt),
    expiresAt: Timestamp.fromDate(expiresAt),
  }

  if (bestClusterId && bestScore >= SIMILARITY_THRESHOLD) {
    // Merge into existing cluster
    const clusterRef = db.collection('clusters').doc(bestClusterId)
    await db.runTransaction(async tx => {
      tx.create(articleRef, { ...articleData, clusterId: bestClusterId })
      tx.update(clusterRef, {
        articleIds: FieldValue.arrayUnion(articleRef.id),
        sources: FieldValue.arrayUnion(article.source),
        latestAt: Timestamp.fromDate(publishedAt < now ? publishedAt : now),
        // Extend cluster expiry if this article expires later
        expiresAt: Timestamp.fromDate(expiresAt),
      })
    })
  } else {
    // Create new cluster seeded by this article
    const clusterRef = db.collection('clusters').doc()
    await db.runTransaction(async tx => {
      tx.create(articleRef, { ...articleData, clusterId: clusterRef.id })
      tx.create(clusterRef, {
        uid,
        topic: article.title,
        primaryArticleUrl: article.sourceUrl,
        articleIds: [articleRef.id],
        sources: [article.source],
        firstSeenAt: Timestamp.fromDate(now),
        latestAt: Timestamp.fromDate(publishedAt < now ? publishedAt : now),
        expiresAt: Timestamp.fromDate(expiresAt),
      })
    })
  }
}

const port = parseInt(process.env.PORT ?? '8080')
app.listen(port, () => console.log(`article-processor listening on :${port}`))
