import 'dotenv/config'
import express from 'express'
import Parser from 'rss-parser'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { PubSub } from '@google-cloud/pubsub'
import { BigQuery } from '@google-cloud/bigquery'

initializeApp()

const app = express()
app.use(express.json())

const db = getFirestore()
const pubsub = new PubSub()
const parser = new Parser()
const bq = new BigQuery()

const TOPIC = process.env.PUBSUB_TOPIC ?? 'raw-articles'
const PROCESSOR_URL = process.env.ARTICLE_PROCESSOR_URL
const BQ_DATASET = process.env.BQ_DATASET ?? 'my_rss_analytics'

function log(severity: 'INFO' | 'WARNING' | 'ERROR', data: Record<string, unknown>) {
  console.log(JSON.stringify({ severity, ...data }))
}

function writeToBQ(table: string, row: Record<string, unknown>): void {
  bq.dataset(BQ_DATASET).table(table).insert([row]).catch((err: unknown) => {
    log('WARNING', { event: 'bq_insert_failed', table, error: String(err) })
  })
}

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/fetch', async (_req, res) => {
  const errors: Array<{ feedId: string; error: string }> = []
  let published = 0
  const startedAt = Date.now()

  try {
    const feedsSnap = await db.collectionGroup('feeds').get()
    const rssFeedCount = feedsSnap.docs.filter(d => d.data().type === 'rss').length
    const topic = PROCESSOR_URL ? null : pubsub.topic(TOPIC)

    log('INFO', { event: 'fetch_started', feedCount: rssFeedCount })
    writeToBQ('fetch_runs', { timestamp: new Date(), event: 'fetch_started', feed_count: rssFeedCount })

    for (const feedDoc of feedsSnap.docs) {
      const uid = feedDoc.ref.parent.parent!.id
      const feed = feedDoc.data()
      if (feed.type !== 'rss') continue

      const feedId = feedDoc.id
      const feedTitle = (feed.title as string) ?? feed.url

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
            feedId,
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

        log('INFO', { event: 'feed_fetched', feedId, feedTitle, articlesPublished: newItems.length })
        writeToBQ('feed_fetches', { timestamp: new Date(), feed_id: feedId, feed_title: feedTitle, articles_published: newItems.length })
        await feedDoc.ref.update({ lastFetchedAt: Timestamp.now() })
      } catch (err) {
        const error = String(err)
        errors.push({ feedId, error })
        log('ERROR', { event: 'feed_fetch_error', feedId, feedTitle, error })
        writeToBQ('fetch_errors', { timestamp: new Date(), feed_id: feedId, feed_title: feedTitle, error })
      }
    }

    const durationMs = Date.now() - startedAt
    log('INFO', { event: 'fetch_complete', totalPublished: published, totalErrors: errors.length, durationMs })
    writeToBQ('fetch_completions', { timestamp: new Date(), total_published: published, total_errors: errors.length, duration_ms: durationMs })

    res.json({ published, errors })
  } catch (err) {
    const fatalDurationMs = Date.now() - startedAt
    log('ERROR', { event: 'fetch_fatal', error: String(err), durationMs: fatalDurationMs })
    writeToBQ('fetch_fatals', { timestamp: new Date(), error: String(err), duration_ms: fatalDurationMs })
    res.status(500).json({ error: String(err) })
  }
})

const port = parseInt(process.env.PORT ?? '8080')
app.listen(port, () => console.log(`feed-fetcher listening on :${port}`))
