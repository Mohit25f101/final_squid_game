import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function RootPage() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userData?.role === 'admin') {
      redirect('/admin/dashboard')
    } else {
      redirect('/team/scan')
    }
  } catch (e: unknown) {
    // Re-throw Next.js redirect errors (they use throw internally)
    if (e && typeof e === 'object' && 'digest' in e) throw e
    redirect('/login')
  }
}

