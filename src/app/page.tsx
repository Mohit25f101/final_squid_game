import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function RootPage() {
  let destination = '/login'

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (userData?.role === 'admin') {
        destination = '/admin/dashboard'
      } else {
        destination = '/team/scan'
      }
    }
  } catch {
    // Supabase connection or auth error — fall through to redirect to /login
  }

  redirect(destination)
}

