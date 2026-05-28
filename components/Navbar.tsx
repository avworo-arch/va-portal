'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Props = {
  facilityName?: string
  role?: string
}

export default function Navbar({ facilityName, role }: Props) {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="px-6 py-3 flex items-center justify-between border-b" style={{ backgroundColor: '#004455', borderColor: '#003344' }}>
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 bg-white rounded-md flex items-center justify-center">
          <svg className="w-4 h-4" fill="none" stroke="#004455" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white text-sm">SonderMind</span>
          <span className="text-white/40 text-sm">|</span>
          <span className="text-white/70 text-sm">VA Referral Portal</span>
          {facilityName && (
            <span className="text-white/40 text-xs ml-1">— {facilityName}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4">
        {role && (
          <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: '#0d6a97', color: '#E3EDEC' }}>
            {role === 'va_staff' ? 'VA Staff' : role === 'am' ? 'Account Manager' : 'Admin'}
          </span>
        )}
        <button
          onClick={handleSignOut}
          className="text-sm text-white/60 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
