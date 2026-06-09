import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Public endpoint — no auth required
// Players self-register by entering their name when scanning their QR
export async function POST(request: Request) {
  try {
    const { qrId, name } = await request.json()

    if (!qrId || !name?.trim()) {
      return NextResponse.json({ success: false, error: 'QR ID and name are required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Check if QR already linked to a participant
    const { data: existing } = await supabase
      .from('participants')
      .select('*')
      .eq('assigned_qr', qrId.toUpperCase())
      .single()

    if (existing) {
      // Already registered — just return the existing participant
      return NextResponse.json({ success: true, participant: existing, already_existed: true })
    }

    // Create new participant — use QR ID as roll_no since we're self-registering
    const { data, error } = await supabase
      .from('participants')
      .insert({
        roll_no: qrId.toUpperCase(),
        name: name.trim(),
        gender: 'O',
        registered: true,
        assigned_qr: qrId.toUpperCase(),
        current_status: 'active',
        registered_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      // If roll_no conflict (QR already used as roll_no from CSV), try to update
      if (error.code === '23505') {
        const { data: updated, error: updateError } = await supabase
          .from('participants')
          .update({
            assigned_qr: qrId.toUpperCase(),
            registered: true,
            current_status: 'active',
            registered_at: new Date().toISOString(),
          })
          .eq('roll_no', qrId.toUpperCase())
          .select()
          .single()

        if (updateError) {
          return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
        }
        return NextResponse.json({ success: true, participant: updated })
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, participant: data })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
