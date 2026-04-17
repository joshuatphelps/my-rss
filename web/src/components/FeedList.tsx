'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { type Feed } from '@/lib/types'
import { RssIcon, TrashIcon } from './icons'

interface Props {
  feeds: Feed[]
  onDelete: (feedId: string) => Promise<void>
}

export function FeedList({ feeds, onDelete }: Props) {
  const [deleting, setDeleting] = useState<string | null>(null)

  if (feeds.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-600 text-sm">
        No feeds yet. Add one above to get started.
      </div>
    )
  }

  async function handleDelete(feedId: string) {
    setDeleting(feedId)
    try {
      await onDelete(feedId)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-2">
      {feeds.map(feed => (
        <div
          key={feed.id}
          className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl"
        >
          <RssIcon className="w-4 h-4 text-zinc-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-zinc-200 truncate">{feed.title}</div>
            <div className="text-xs text-zinc-600 truncate mt-0.5">{feed.url}</div>
            {feed.lastFetchedAt && (
              <div className="text-xs text-zinc-700 mt-0.5">
                Fetched {formatDistanceToNow(feed.lastFetchedAt, { addSuffix: true })}
              </div>
            )}
          </div>
          <button
            onClick={() => handleDelete(feed.id)}
            disabled={deleting === feed.id}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-zinc-700 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-40"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
