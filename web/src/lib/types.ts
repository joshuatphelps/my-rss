export interface Feed {
  id: string
  type: 'rss' | 'reddit' | 'substack'
  url: string
  title: string
  expiryHours: number | null
  addedAt: Date
  lastFetchedAt: Date | null
}

export interface Article {
  id: string
  feedId: string
  uid: string
  sourceUrl: string
  title: string
  body: string
  author: string | null
  publishedAt: Date
  expiresAt: Date
  clusterId: string | null
  source: string
}

export interface Cluster {
  id: string
  uid: string
  topic: string
  primaryArticleUrl: string
  articleIds: string[]
  sources: string[]
  firstSeenAt: Date
  latestAt: Date
  expiresAt: Date
}
