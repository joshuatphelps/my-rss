import 'dotenv/config'
import express from 'express'
import Parser from 'rss-parser'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { PubSub } from '@google-cloud/pubsub'

initializeApp()

const app = express()
app.use(express.json())

const db = getFirestore()
const pubsub = new PubSub()
const parser = new Parser()

const TOPIC = process.env.PUBSUB_TOPIC ?? 'raw-articles'
// When set, POSTs directly to the processor instead of Pub/Sub (local dev only)
const PROCESSOR_URL = process.env.ARTICLE_PROCESSOR_URL

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/fetch', async (_req, res) => {
  const errors: string[] = []
  let published = 0

  try {
    const feedsSnap = await db.collectionGroup('feeds').get()
    const topic = PROCESSOR_URL ? null : pubsub.topic(TOPIC)

    for (const feedDoc of feedsSnap.docs) {
      const uid = feedDoc.ref.parent.parent!.id
        const feed = feedDoc.data()
        if (feed.type !== 'rss') continue

        try {
          const parsed = await parser.parseURL(feed.url as string)
          const lastFetched: Date = (feed.lastFetchedAt as Timestamp | null)?.toDate() ?? new Date(0)

          const newItems = parsed.items.filter(item => {
            if (!item.isoDate) return true
            return new Date(item.isoDate) > lastFetched
          })

          for (const item of newItems) {
            const message = {
              uid,
              feedId: feedDoc.id,
              expiryHours: (feed.expiryHours as number | null) ?? 48,
              article: {
                title: item.title ?? 'Untitled',
                sourceUrl: item.link ?? '',
                body: item.contentSnippet ?? item.content ?? '',
                author: item.creator ?? null,
                publishedAt: item.isoDate ?? new Date().toISOString(),
                source: (feed.title as string) ?? new URL(feed.url as string).hostname,
              },
            }
            if (PROCESSOR_URL) {
              const encoded = Buffer.from(JSON.stringify(message)).toString('base64')
              const resp = await fetch(PROCESSOR_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: { data: encoded } }),
              })
              if (!resp.ok) throw new Error(`Processor returned ${resp.status}`)
            } else {
              await topic!.publishMessage({ json: message })
            }
            published++
          }

          await feedDoc.ref.update({ lastFetchedAt: Timestamp.now() })
        } catch (err) {
          errors.push(`feed ${feedDoc.id}: ${err}`)
          console.error(`Error fetching feed ${feedDoc.id}:`, err)
        }
    }

    res.json({ published, errors })
  } catch (err) {
    console.error('Fatal fetch error:', err)
    res.status(500).json({ error: String(err) })
  }
})

const port = parseInt(process.env.PORT ?? '8080')
app.listen(port, () => console.log(`feed-fetcher listening on :${port}`))
