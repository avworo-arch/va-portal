import { createClient } from '@/lib/supabase/server'
import { getReferralDetail, getAuthHistory } from '@/lib/queries'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request)
  if (!rateLimit(ip, { limit: 30, windowMs: 60_000 })) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, facility_name')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

  const { id } = await params

  try {
    const [referral, authHistory] = await Promise.all([
      getReferralDetail(id),
      getAuthHistory(id),
    ])

    if (!referral) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (
      profile.role === 'va_staff' &&
      referral.REFERRING_ORGANIZATION_ACCOUNT_NAME?.toUpperCase() !==
        profile.facility_name?.toUpperCase()
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ ...referral, AUTH_HISTORY: authHistory })
  } catch (err) {
    console.error('Referral detail query failed:', err)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }
}
