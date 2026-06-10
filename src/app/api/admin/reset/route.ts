import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

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

  // Service client bypasses RLS — neq() with nil UUID satisfies WHERE clause requirement
  const service = createServiceClient()

  const NIL = '00000000-0000-0000-0000-000000000000'

  try {
    // 1. Delete all round results
    const rr = await service.from('round_results').delete().neq('id', NIL)
    if (rr.error) throw new Error('round_results: ' + rr.error.message)

    // 2. Delete all audit logs
    const al = await service.from('audit_logs').delete().neq('id', NIL)
    // audit_logs is non-critical — ignore errors if table doesn't exist

    // 3. Reset participants: unregister, reset status back to active
    const pp = await service.from('participants').update({
      registered: false,
      registered_at: null,
      current_status: 'active',
    }).neq('participant_id', NIL)
    if (pp.error) throw new Error('participants: ' + pp.error.message)

    // 4. Clear the active round
    const es = await service.from('event_state').update({
      current_round_id: null,
      updated_at: new Date().toISOString(),
    }).eq('id', 1)
    if (es.error) throw new Error('event_state: ' + es.error.message)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Reset error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}
