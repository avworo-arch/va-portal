import { createClient } from '@/lib/supabase/server'
import { getFacilityList } from '@/lib/queries'
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

  try {
    const raw = await getFacilityList()
    // Snowflake returns uppercase keys — normalize to lowercase for the frontend
    const facilities = raw.map((r: Record<string, unknown>) => ({
      name: r.NAME ?? r.name,
      count: r.COUNT ?? r.count,
    }))
    return NextResponse.json(facilities)
  } catch (err) {
    console.error('Facilities query failed:', err)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }
}
