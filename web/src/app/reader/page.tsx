'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { Nav } from '@/components/Nav'
import { ClusterCard } from '@/components/ClusterCard'
import { subscribeToClusters, subscribeToReadClusters } from '@/lib/firestore'
import type { Cluster } from '@/lib/types'

export default function ReaderPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [showRead, setShowRead] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    const unsub1 = subscribeToClusters(user.uid, setClusters)
    const unsub2 = subscribeToReadClusters(user.uid, setReadIds)
    return () => { unsub1(); unsub2() }
  }, [user])

  if (loading) return null

  const now = new Date()
  const visible = clusters
    .filter(c => c.expiresAt > now)
    .filter(c => showRead || !readIds.has(c.id))

  const unreadCount = clusters.filter(c => c.expiresAt > now && !readIds.has(c.id)).length

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-4 pt-20 pb-16">
        <div className="flex items-center justify-between py-5">
          <div className="flex items-center gap-2.5">
            <h1 className="font-semibold">Stories</h1>
            {unreadCount > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowRead(v => !v)}
            className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            {showRead ? 'Hide read' : 'Show all'}
          </button>
        </div>

        {visible.length === 0 ? (
          <EmptyState hasFeeds={true} showRead={showRead} />
        ) : (
          <div className="space-y-2">
            {visible.map(cluster => (
              <ClusterCard
                key={cluster.id}
                cluster={cluster}
                isRead={readIds.has(cluster.id)}
                uid={user!.uid}
              />
            ))}
          </div>
        )}
      </main>
    </>
  )
}

function EmptyState({ showRead }: { hasFeeds: boolean; showRead: boolean }) {
  return (
    <div className="text-center py-24 space-y-1">
      <p className="text-zinc-400 font-medium">
        {showRead ? 'No stories yet.' : "You're all caught up."}
      </p>
      {!showRead && (
        <p className="text-sm text-zinc-600">New stories appear here as your feeds are fetched.</p>
      )}
    </div>
  )
}
