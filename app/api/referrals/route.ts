import { createClient } from '@/lib/supabase/server'
import { queryReferrals } from '@/lib/queries'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url)
  const referralId = searchParams.get('referralId')?.trim() || undefined
  const facilityParam = searchParams.get('facility')?.trim() || undefined
  const dateFrom = searchParams.get('dateFrom')?.trim() || undefined
  const dateTo = searchParams.get('dateTo')?.trim() || undefined
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = 200
  const offset = (page - 1) * limit

  // VA staff locked to their facility; AMs can filter freely
  const facility = profile.role === 'va_staff' ? profile.facility_name ?? undefined : facilityParam

  // Require at least one filter to prevent full-table scans
  if (!facility && !referralId && !dateFrom && !dateTo) {
    return NextResponse.json({ error: 'At least one filter is required' }, { status: 400 })
  }

  // If facility is provided without a referral ID, require a date range
  if (facility && !referralId && (!dateFrom || !dateTo)) {
    return NextResponse.json({ error: 'A date range is required when searching by facility' }, { status: 400 })
  }

  // Enforce max 90-day window to keep results manageable
  if (dateFrom && dateTo) {
    const diff = (new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24)
    if (diff > 90) {
      return NextResponse.json({ error: 'Date range cannot exceed 90 days' }, { status: 400 })
    }
  }

  try {
    const raw = await queryReferrals({ facility, referralId, dateFrom, dateTo, limit, offset })
    // Snowflake returns uppercase keys — pass through as-is (frontend uses uppercase)
    return NextResponse.json(raw)
  } catch (err) {
    console.error('Referrals query failed:', err)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }
}
