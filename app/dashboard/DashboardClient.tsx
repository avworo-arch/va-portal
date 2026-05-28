'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import StatusBadge from '@/components/StatusBadge'

type ReferralRow = {
  CLIENT_REFERRAL_ID: string
  VA_AUTHORIZATION_NUMBER: string | null
  REFERRING_ORGANIZATION_ACCOUNT_NAME: string
  REFERRAL_STATUS_SIMPLIFIED: string | null
  REFERRAL_RECEIVED_DATE: string | null
  IS_SCHEDULED: boolean | null
  IS_CONVERTED: boolean | null
  MOST_RECENT_DATE_OF_SERVICE: string | null
  TOTAL_ATTENDED_SESSIONS: number | null
  HAS_FUTURE_SESSION: boolean | null
  NEXT_APPOINTMENT: string | null
}

type Props = {
  role: string
  facilityName: string | null
  fullName: string | null
}

export default function DashboardClient({ role, facilityName, fullName }: Props) {
  const router = useRouter()
  const [referrals, setReferrals] = useState<ReferralRow[]>([])
  const [facilities, setFacilities] = useState<{ name: string; count: number }[]>([])

  // Filter state
  const [selectedFacility, setSelectedFacility] = useState<string>(facilityName ?? '')
  const [referralId, setReferralId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [hasSearched, setHasSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)

  const isAM = role === 'am' || role === 'admin'

  const hasFilter = selectedFacility || referralId || dateFrom || dateTo
  const facilityNeedsDateRange = selectedFacility && !referralId && (!dateFrom || !dateTo)
  const dateRangeBackwards = dateFrom && dateTo && dateFrom > dateTo
  const canSearch = hasFilter && !facilityNeedsDateRange && !dateRangeBackwards

  useEffect(() => {
    if (!isAM) return
    fetch('/api/facilities')
      .then(r => r.json())
      .then(data => setFacilities(Array.isArray(data) ? data : []))
      .catch(console.error)
  }, [isAM])

  async function runSearch(pageOverride = 1) {
    if (!hasFilter) return
    setLoading(true)
    setError('')
    setHasSearched(true)

    const params = new URLSearchParams()
    if (selectedFacility) params.set('facility', selectedFacility)
    if (referralId) params.set('referralId', referralId)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    params.set('page', String(pageOverride))

    const res = await fetch(`/api/referrals?${params}`)
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong')
      setReferrals([])
    } else {
      setReferrals(Array.isArray(data) ? data : [])
    }
    setLoading(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSearch) return
    setPage(1)
    runSearch(1)
  }

  function handleClear() {
    setSelectedFacility(facilityName ?? '')
    setReferralId('')
    setDateFrom('')
    setDateTo('')
    setReferrals([])
    setHasSearched(false)
    setError('')
    setPage(1)
  }

  function handlePage(next: number) {
    setPage(next)
    runSearch(next)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F5F0E8' }}>
      <Navbar facilityName={isAM ? selectedFacility || undefined : facilityName || undefined} role={role} />

      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold" style={{ color: '#001219' }}>VA Referral Portal</h1>
          {fullName && <p className="text-sm mt-0.5" style={{ color: '#615171' }}>Welcome, {fullName}</p>}
        </div>

        {/* Filter panel */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-5 mb-6" style={{ borderColor: '#bdb29f' }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: '#004455' }}>
            Search Filters — enter at least one
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* VAMC */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#004455' }}>VAMC / Facility</label>
              {isAM ? (
                <select
                  value={selectedFacility}
                  onChange={e => setSelectedFacility(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All facilities</option>
                  {facilities.map(f => (
                    <option key={f.name} value={f.name}>{f.name}</option>
                  ))}
                </select>
              ) : (
                <div className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-600">
                  {facilityName ?? '—'}
                </div>
              )}
            </div>

            {/* Referral ID */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#004455' }}>Referral ID or Auth Number</label>
              <input
                type="text"
                value={referralId}
                onChange={e => setReferralId(e.target.value)}
                placeholder="e.g. 1929286 or VA0058592343"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Date From */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#004455' }}>Referral Date — From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#004455' }}>Referral Date — To</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {facilityNeedsDateRange && (
            <p className="mt-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              A date range (From and To) is required when searching by facility.
            </p>
          )}
          {dateRangeBackwards && (
            <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              "From" date must be before "To" date.
            </p>
          )}

          <div className="flex gap-3 mt-4">
            <button
              type="submit"
              disabled={!canSearch || loading}
              className="text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-opacity"
              style={{ backgroundColor: '#004455' }}
            >
              {loading ? 'Searching…' : 'Search'}
            </button>
            {hasSearched && (
              <button
                type="button"
                onClick={handleClear}
                className="px-4 py-2 rounded-lg text-sm border transition-colors"
                style={{ borderColor: '#bdb29f', color: '#004455' }}
              >
                Clear
              </button>
            )}
          </div>
        </form>

        {/* Results */}
        <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#bdb29f' }}>
          {!hasSearched ? (
            <div className="flex flex-col items-center justify-center py-16" style={{ color: '#bdb29f' }}>
              <svg className="w-10 h-10 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-sm">Use the filters above to search for referrals</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-16 text-sm" style={{ color: '#615171' }}>
              Loading referrals…
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-16 text-sm text-red-500">{error}</div>
          ) : referrals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16" style={{ color: '#615171' }}>
              <p className="text-sm">No referrals found matching your filters</p>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b flex items-center" style={{ backgroundColor: '#E3EDEC', borderColor: '#bdb29f' }}>
                <span className="text-xs font-medium" style={{ color: '#004455' }}>
                  {referrals.length} result{referrals.length !== 1 ? 's' : ''}
                  {referrals.length === 200 && ' — showing first 200, narrow your date range to see more'}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ backgroundColor: '#E3EDEC', borderColor: '#bdb29f' }}>
                      {['Referral ID','Auth #', ...(isAM ? ['Facility'] : []), 'Status','Received','Sessions','Next Appt','Last DOS'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: '#004455' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map((r, i) => (
                      <tr
                        key={r.CLIENT_REFERRAL_ID}
                        onClick={() => router.push(`/referral/${r.CLIENT_REFERRAL_ID}`)}
                        className="cursor-pointer border-b transition-colors"
                        style={{ borderColor: '#e8e6e3', backgroundColor: i % 2 === 0 ? '#fff' : '#fdfbf7' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#E3EDEC')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? '#fff' : '#fdfbf7')}
                      >
                        <td className="px-4 py-3 font-mono text-xs font-medium" style={{ color: '#0d6a97' }}>{r.CLIENT_REFERRAL_ID}</td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: '#615171' }}>{r.VA_AUTHORIZATION_NUMBER ?? '—'}</td>
                        {isAM && <td className="px-4 py-3 text-xs max-w-40 truncate" style={{ color: '#001219' }}>{r.REFERRING_ORGANIZATION_ACCOUNT_NAME}</td>}
                        <td className="px-4 py-3"><StatusBadge status={r.REFERRAL_STATUS_SIMPLIFIED} /></td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#615171' }}>{r.REFERRAL_RECEIVED_DATE?.slice(0, 10) ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-center" style={{ color: '#001219' }}>{r.TOTAL_ATTENDED_SESSIONS ?? 0}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#615171' }}>
                          {r.NEXT_APPOINTMENT ? new Date(r.NEXT_APPOINTMENT).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#615171' }}>{r.MOST_RECENT_DATE_OF_SERVICE?.slice(0, 10) ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
