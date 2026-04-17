import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Feed, Cluster, Article } from './types'

// ── Feeds ─────────────────────────────────────────────────────────────────────

export async function getUserFeeds(uid: string): Promise<Feed[]> {
  const snap = await getDocs(
    query(collection(db, 'users', uid, 'feeds'), orderBy('addedAt', 'desc'))
  )
  return snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
    addedAt: d.data().addedAt?.toDate() ?? new Date(),
    lastFetchedAt: d.data().lastFetchedAt?.toDate() ?? null,
  } as Feed))
}

export async function addFeed(
  uid: string,
  feed: Pick<Feed, 'type' | 'url' | 'title' | 'expiryHours'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'users', uid, 'feeds'), {
    ...feed,
    addedAt: serverTimestamp(),
    lastFetchedAt: null,
  })
  return ref.id
}

export async function deleteFeed(uid: string, feedId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'feeds', feedId))
}

// ── Clusters ──────────────────────────────────────────────────────────────────

export function subscribeToClusters(
  uid: string,
  onUpdate: (clusters: Cluster[]) => void
): () => void {
  const q = query(
    collection(db, 'clusters'),
    where('uid', '==', uid),
    orderBy('latestAt', 'desc')
  )
  return onSnapshot(q, snap => {
    onUpdate(
      snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        firstSeenAt: d.data().firstSeenAt?.toDate() ?? new Date(),
        latestAt: d.data().latestAt?.toDate() ?? new Date(),
        expiresAt: d.data().expiresAt?.toDate() ?? new Date(),
      } as Cluster))
    )
  })
}

export async function getClusterArticles(articleIds: string[]): Promise<Article[]> {
  const results = await Promise.all(
    articleIds.map(async id => {
      const snap = await getDoc(doc(db, 'articles', id))
      if (!snap.exists()) return null
      const d = snap.data()!
      return {
        id: snap.id,
        ...d,
        publishedAt: d.publishedAt?.toDate() ?? new Date(),
        expiresAt: d.expiresAt?.toDate() ?? new Date(),
      } as Article
    })
  )
  return (results.filter(Boolean) as Article[]).sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()
  )
}

// ── Read state ────────────────────────────────────────────────────────────────

export function subscribeToReadClusters(
  uid: string,
  onUpdate: (readIds: Set<string>) => void
): () => void {
  return onSnapshot(collection(db, 'users', uid, 'readClusters'), snap => {
    onUpdate(new Set(snap.docs.map(d => d.id)))
  })
}

export async function markClusterRead(uid: string, clusterId: string): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'readClusters', clusterId), {
    readAt: serverTimestamp(),
  })
}

export async function markClusterUnread(uid: string, clusterId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'readClusters', clusterId))
}
