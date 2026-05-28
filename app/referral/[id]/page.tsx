import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import StatusBadge from '@/components/StatusBadge'
import { getReferralDetail, getAuthHistory } from '@/lib/queries'

type Params = Promise<{ id: string }>

export default async function ReferralDetailPage({ params }: { params: Params }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, facility_name')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const [referral, authHistory] = await Promise.all([
    getReferralDetail(id),
    getAuthHistory(id),
  ])

  if (!referral) notFound()

  if (
    profile.role === 'va_staff' &&
    referral.REFERRING_ORGANIZATION_ACCOUNT_NAME?.toUpperCase() !== profile.facility_name?.toUpperCase()
  ) {
    notFound()
  }

  // Active auth = most recent one (first in DESC-sorted authHistory)
  const activeAuth = authHistory[0] ?? null
  const hasMultipleAuths = authHistory.length > 1

  const fields = [
    { label: 'Referral ID', value: referral.CLIENT_REFERRAL_ID, mono: true },
    { label: 'Facility', value: referral.REFERRING_ORGANIZATION_ACCOUNT_NAME },
    { label: 'Type of Service', value: referral.REFERRAL_TYPE_OF_SERVICE ?? '—' },
    { label: 'Session Format', value: referral.SESSION_FORMAT_PREFERENCE ?? '—' },
  ]

  const timeline = [
    { label: 'Referral Received', value: referral.REFERRAL_RECEIVED_DATE?.slice(0, 10) },
    { label: 'First Scheduled', value: referral.REFERRAL_FIRST_SCHEDULE_DATE?.slice(0, 10) },
    { label: 'First Session', value: referral.REFERRAL_FIRST_SESSION_DATE?.slice(0, 10) },
    { label: 'Last Date of Service', value: referral.MOST_RECENT_DATE_OF_SERVICE?.slice(0, 10) },
    { label: 'Next Appointment', value: referral.NEXT_APPOINTMENT ? new Date(referral.NEXT_APPOINTMENT).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null },
  ]

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar facilityName={referral.REFERRING_ORGANIZATION_ACCOUNT_NAME} role={profile.role} />

      <div className="max-w-4xl mx-auto w-full px-6 py-8">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to referrals
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 font-mono">{referral.CLIENT_REFERRAL_ID}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{referral.REFERRING_ORGANIZATION_ACCOUNT_NAME}</p>
          </div>
          <StatusBadge status={referral.REFERRAL_STATUS_SIMPLIFIED} />
        </div>

        {/* Active authorization banner */}
        {activeAuth && (
          <div className={`rounded-xl border p-4 mb-6 ${activeAuth.IS_ACTIVE ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  {hasMultipleAuths ? 'Current Authorization' : 'Authorization'}
                </span>
                {activeAuth.IS_ACTIVE
                  ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Active</span>
                  : <span className="text-xs bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full font-medium">Expired</span>
                }
                {hasMultipleAuths && (
                  <span className="text-xs text-slate-400">({authHistory.length} total auths)</span>
                )}
              </div>
              <span className="font-mono text-xs text-slate-700">{activeAuth.VA_AUTHORIZATION_NUMBER}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Auth Start', value: activeAuth.AUTH_START?.slice(0, 10) ?? '—' },
                { label: 'Auth End', value: activeAuth.AUTH_END?.slice(0, 10) ?? '—' },
                { label: 'Sessions (this auth)', value: activeAuth.NUM_CLAIMS_CLEAN ?? 0 },
                { label: 'No-Shows (this auth)', value: activeAuth.NUM_NO_SHOWS_CLEAN ?? 0 },
              ].map(s => (
                <div key={s.label}>
                  <p className="text-xs text-slate-500">{s.label}</p>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>
            {activeAuth.VA_AUTHORIZATION_STATUS && (
              <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-200">
                Status: <span className="text-slate-700">{activeAuth.VA_AUTHORIZATION_STATUS}</span>
              </p>
            )}
          </div>
        )}

        {/* Stats row — lifetime totals */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Lifetime Sessions', value: referral.TOTAL_ATTENDED_SESSIONS ?? 0 },
            { label: 'Current Auth No-Shows', value: activeAuth?.NUM_NO_SHOWS_CLEAN ?? 0 },
            { label: 'Provider Matched', value: referral.IS_SCHEDULED ? 'Yes' : 'No' },
            { label: 'Notes Submitted', value: referral.HAS_SOAP_NOTES ? 'Yes' : referral.HAS_SOAP_NOTES === false ? 'No' : '—' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-4 py-4 text-center">
              <div className="text-2xl font-semibold text-slate-900">{s.value}</div>
              <div className="text-xs text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {/* Details */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Referral Details</h2>
            <dl className="space-y-3">
              {fields.map(f => (
                <div key={f.label} className="flex justify-between gap-4">
                  <dt className="text-xs text-slate-500 shrink-0">{f.label}</dt>
                  <dd className={`text-xs text-slate-800 text-right ${f.mono ? 'font-mono' : ''}`}>{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Timeline</h2>
            <ol className="relative border-l border-slate-200 ml-2 space-y-4">
              {timeline.map(t => (
                <li key={t.label} className="ml-4">
                  <div className={`absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full border-2 ${t.value ? 'bg-blue-500 border-blue-500' : 'bg-white border-slate-300'}`} />
                  <p className="text-xs font-medium text-slate-700">{t.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{t.value ?? 'Not yet'}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Authorization history — only show if multiple auths */}
        {hasMultipleAuths && (
          <div className="mt-6 bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Authorization History</h2>
            <div className="space-y-3">
              {authHistory.map((auth, i) => (
                <div key={auth.VA_AUTHORIZATION_NUMBER} className={`rounded-lg border px-4 py-3 ${i === 0 ? 'border-green-200 bg-green-50' : 'border-slate-100 bg-slate-50'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-medium text-slate-700">{auth.VA_AUTHORIZATION_NUMBER}</span>
                    <div className="flex items-center gap-2">
                      {i === 0 && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Current</span>}
                      <span className="text-xs text-slate-400">{auth.AUTH_START?.slice(0, 10)} → {auth.AUTH_END?.slice(0, 10)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    {auth.NUM_CLAIMS_CLEAN ?? 0} sessions · {auth.NUM_NO_SHOWS_CLEAN ?? 0} no-shows
                    {auth.VA_AUTHORIZATION_STATUS && ` · ${auth.VA_AUTHORIZATION_STATUS}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
