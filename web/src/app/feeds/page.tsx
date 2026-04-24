'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { Nav } from '@/components/Nav'
import { AddFeedForm } from '@/components/AddFeedForm'
import { FeedList } from '@/components/FeedList'
import { getUserFeeds, addFeed, deleteFeed } from '@/lib/firestore'
import type { Feed } from '@/lib/types'

export default function FeedsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [feeds, setFeeds] = useState<Feed[]>([])
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    getUserFeeds(user.uid).then(f => {
      setFeeds(f)
      setFetching(false)
    })
  }, [user])

  async function handleAdd(url: string, title: string) {
    if (!user) return
    const id = await addFeed(user.uid, { type: 'rss', url, title, expiryHours: null })
    setFeeds(prev => [
      { id, type: 'rss', url, title, expiryHours: null, addedAt: new Date(), lastFetchedAt: null },
      ...prev,
    ])
  }

  async function handleDelete(feedId: string) {
    if (!user) return
    await deleteFeed(user.uid, feedId)
    setFeeds(prev => prev.filter(f => f.id !== feedId))
  }

  if (loading) return null

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-4 pt-20 pb-16">
        <div className="py-5">
          <h1 className="font-semibold">Feeds</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Paste any RSS feed URL to subscribe.</p>
        </div>
        <AddFeedForm onAdd={handleAdd} />
        {!fetching && <FeedList feeds={feeds} onDelete={handleDelete} />}
      </main>
    </>
  )
}
