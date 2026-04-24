'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { type Cluster, type Article } from '@/lib/types'
import { getClusterArticles, markClusterRead, markClusterUnread } from '@/lib/firestore'
import { ChevronDownIcon, CheckIcon, ExternalLinkIcon } from './icons'

const BADGE_COLORS = [
  'bg-blue-500/15 text-blue-400',
  'bg-violet-500/15 text-violet-400',
  'bg-emerald-500/15 text-emerald-400',
  'bg-amber-500/15 text-amber-400',
  'bg-rose-500/15 text-rose-400',
  'bg-cyan-500/15 text-cyan-400',
]

function SourceBadge({ source, index }: { source: string; index: number }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${BADGE_COLORS[index % BADGE_COLORS.length]}`}>
      {source}
    </span>
  )
}

interface Props {
  cluster: Cluster
  isRead: boolean
  uid: string
}

export function ClusterCard({ cluster, isRead, uid }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [articles, setArticles] = useState<Article[]>([])
  const [loadingArticles, setLoadingArticles] = useState(false)
  const [marking, setMarking] = useState(false)

  async function handleExpand() {
    if (!expanded && articles.length === 0 && cluster.articleIds.length > 1) {
      setLoadingArticles(true)
      const fetched = await getClusterArticles(cluster.articleIds)
      setArticles(fetched)
      setLoadingArticles(false)
    }
    setExpanded(v => !v)
  }

  async function toggleRead() {
    setMarking(true)
    try {
      if (isRead) {
        await markClusterUnread(uid, cluster.id)
      } else {
        await markClusterRead(uid, cluster.id)
      }
    } finally {
      setMarking(false)
    }
  }

  const extraCount = cluster.articleIds.length - 1

  return (
    <article
      className={`rounded-xl border transition-all duration-150 ${
        isRead
          ? 'bg-zinc-900/30 border-zinc-800/40'
          : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
      }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Source badges + time */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {cluster.sources.map((source, i) => (
                <SourceBadge key={source} source={source} index={i} />
              ))}
              <span className="text-xs text-zinc-600">
                {formatDistanceToNow(cluster.latestAt, { addSuffix: true })}
              </span>
            </div>

            {/* Headline */}
            <a
              href={cluster.primaryArticleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`group inline-flex items-start gap-1.5 font-medium leading-snug transition-colors ${
                isRead
                  ? 'text-zinc-600 hover:text-zinc-400'
                  : 'text-zinc-100 hover:text-indigo-400'
              }`}
            >
              <span>{cluster.topic}</span>
              <ExternalLinkIcon className="mt-0.5 w-3.5 h-3.5 flex-shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
            </a>

            {/* Expand toggle */}
            {extraCount > 0 && (
              <button
                onClick={handleExpand}
                className="mt-2.5 flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                <ChevronDownIcon
                  className={`w-3.5 h-3.5 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
                />
                {extraCount} more from {cluster.sources.length} source{cluster.sources.length !== 1 ? 's' : ''}
              </button>
            )}

            {/* Expanded article list */}
            {expanded && (
              <div className="mt-3 pl-3 border-l border-zinc-800 space-y-2">
                {loadingArticles ? (
                  <div className="text-xs text-zinc-600 py-1">Loading…</div>
                ) : (
                  articles.map(article => (
                    <a
                      key={article.id}
                      href={article.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block group"
                    >
                      <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors leading-snug">
                        {article.title}
                      </span>
                      <span className="ml-2 text-xs text-zinc-600">{article.source}</span>
                    </a>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Mark read button */}
          <button
            onClick={toggleRead}
            disabled={marking}
            title={isRead ? 'Mark unread' : 'Mark as read'}
            className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
              isRead
                ? 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
                : 'bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25'
            }`}
          >
            <CheckIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </article>
  )
}
