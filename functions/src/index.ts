import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { PubSub } from '@google-cloud/pubsub'
import Parser from 'rss-parser'

initializeApp()

const db = getFirestore()
const pubsub = new PubSub()
const parser = new Parser()

const TOPIC = 'raw-articles'

export const onFeedAdded = onDocumentCreated('users/{uid}/feeds/{feedId}', async event => {
  const { uid, feedId } = event.params
  const feed = event.data?.data()
  if (!feed || feed.type !== 'rss') return

  const topic = pubsub.topic(TOPIC)
  let published = 0

  const parsed = await parser.parseURL(feed.url as string)

  for (const item of parsed.items) {
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
    await topic.publishMessage({ json: message })
    published++
  }

  await db.collection('users').doc(uid).collection('feeds').doc(feedId)
    .update({ lastFetchedAt: Timestamp.now() })

  console.log(`onFeedAdded: published ${published} articles for feed ${feedId}`)
})
