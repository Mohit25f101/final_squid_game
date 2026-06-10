import { createClient } from '@/lib/supabase/server'
import { fetchAllParticipants } from '@/lib/supabase/fetchAll'
import ParticipantsClient from './ParticipantsClient'
export const dynamic = 'force-dynamic'
export default async function ParticipantsPage() {
  const supabase = await createClient()
  const participants = await fetchAllParticipants(
    supabase, 
    '*, round_results(round_id, result, round:rounds(round_name, round_order))',
    { order: { column: 'assigned_qr', ascending: true, nullsFirst: false } }
  )
  const { data: rounds } = await supabase.from('rounds').select('*').order('round_order')
  return <ParticipantsClient initialParticipants={participants || []} rounds={rounds || []} />
}
