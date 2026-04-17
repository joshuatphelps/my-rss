'use client'

import { useState } from 'react'
import { PlusIcon } from './icons'

interface Props {
  onAdd: (url: string, title: string) => Promise<void>
}

export function AddFeedForm({ onAdd }: Props) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    try {
      let hostname = url.trim()
      try { hostname = new URL(url).hostname } catch { /* use raw url */ }
      await onAdd(url.trim(), title.trim() || hostname)
      setUrl('')
      setTitle('')
    } catch {
      setError('Could not add feed. Check the URL and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-6">
      <div className="flex flex-col sm:flex-row gap-2.5">
        <input
          type="url"
          placeholder="https://example.com/feed.xml"
          value={url}
          onChange={e => setUrl(e.target.value)}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
          required
        />
        <input
          type="text"
          placeholder="Display name (optional)"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="sm:w-44 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Add
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </form>
  )
}
