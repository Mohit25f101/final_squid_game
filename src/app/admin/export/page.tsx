import { createClient } from '@/lib/supabase/server'
import { fetchAllParticipants } from '@/lib/supabase/fetchAll'
import ExportClient from './ExportClient'
export const dynamic = 'force-dynamic'
export default async function ExportPage() {
  const supabase = await createClient()
  const participants = await fetchAllParticipants(
    supabase, 
    '*, round_results(round_id, result, round:rounds(round_name, round_order))',
    { order: { column: 'assigned_qr' } }
  )
  return <ExportClient participants={participants || []} />
}
