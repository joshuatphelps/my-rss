'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from './AuthProvider'

export function Nav() {
  const { user } = useAuth()
  const pathname = usePathname()

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
      <nav className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <span className="font-semibold tracking-tight text-zinc-100">my-rss</span>
          <div className="flex items-center gap-0.5">
            <NavLink href="/reader" active={pathname === '/reader'}>Reader</NavLink>
            <NavLink href="/feeds" active={pathname === '/feeds'}>Feeds</NavLink>
          </div>
        </div>
        {user && (
          <button
            onClick={() => signOut(auth)}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Sign out
          </button>
        )}
      </nav>
    </header>
  )
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        active
          ? 'bg-zinc-800 text-zinc-100'
          : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50'
      }`}
    >
      {children}
    </Link>
  )
}
