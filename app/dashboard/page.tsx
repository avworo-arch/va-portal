import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, facility_name, full_name')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  return (
    <DashboardClient
      role={profile.role}
      facilityName={profile.facility_name}
      fullName={profile.full_name}
    />
  )
}
