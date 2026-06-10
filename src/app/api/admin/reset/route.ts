import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  // Verify caller is authenticated admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users').select('role').eq('id', user.id).single()
  if (userData?.role !== 'admin') {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
  }

  // Call the SECURITY DEFINER SQL function — runs as postgres, bypasses RLS
  const { data, error } = await supabase.rpc('reset_all_data')

  if (error) {
    console.error('Reset RPC error:', error)
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
