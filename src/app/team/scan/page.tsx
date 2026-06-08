'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'
import { createClient } from '@/lib/supabase/client'
import { Participant, Round } from '@/lib/types'
import toast from 'react-hot-toast'

type State = 'scanning' | 'loaded' | 'already_recorded' | 'submitting' | 'result_shown' | 'locked'
type ScanResult = { success: boolean; message: string; error?: string }

export default function RoundScanPage() {
  const supabase = createClient()
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const [state, setState] = useState<State>('scanning')
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [scannedQR, setScannedQR] = useState('')
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [activeRound, setActiveRound] = useState<Round | null>(null)
  const [existingResult, setExistingResult] = useState<'survived' | 'eliminated' | null>(null)
  const activeRoundRef = useRef<Round | null>(null)

  // Keep ref in sync so scanner callback can access latest round
  useEffect(() => { activeRoundRef.current = activeRound }, [activeRound])

  useEffect(() => {
    supabase.from('event_state').select('*, round:rounds(*)').eq('id', 1).single()
      .then(({ data }) => setActiveRound(data?.round || null))
    const ch = supabase.channel('team-event-state')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'event_state' }, () => {
        supabase.from('event_state').select('*, round:rounds(*)').eq('id', 1).single()
          .then(({ data }) => setActiveRound(data?.round || null))
      }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const startScanner = useCallback(async () => {
    setState('scanning')
    setParticipant(null)
    setScannedQR('')
    setScanResult(null)
    setExistingResult(null)
    try {
      const reader = new BrowserQRCodeReader()
      const devices = await BrowserQRCodeReader.listVideoInputDevices()
      const deviceId = devices[devices.length - 1]?.deviceId
      const controls = await reader.decodeFromVideoDevice(deviceId, videoRef.current!, async (result) => {
        if (result) {
          const text = result.getText()
          const qrId = text.split('/').pop() || text
          if (qrId.startsWith('SG-') || text.includes('player')) {
            controls.stop()
            setScannedQR(qrId)

            // 1. Fetch participant
            const { data: p } = await supabase
              .from('participants')
              .select('*')
              .eq('assigned_qr', qrId)
              .single()

            if (!p) {
              toast.error('QR not registered yet')
              setTimeout(startScanner, 2000)
              return
            }

            setParticipant(p)

            // 2. Globally eliminated → locked forever
            if (p.current_status === 'eliminated') {
              setState('locked')
              return
            }

            // 3. Check if result already recorded for THIS round
            const currentRound = activeRoundRef.current
            if (currentRound) {
              const { data: rr } = await supabase
                .from('round_results')
                .select('result')
                .eq('participant_id', p.participant_id)
                .eq('round_id', currentRound.round_id)
                .single()

              if (rr) {
                setExistingResult(rr.result as 'survived' | 'eliminated')
                setState('already_recorded')
                return
              }
            }

            // 4. Fresh — show buttons
            setState('loaded')
          }
        }
      })
      controlsRef.current = controls
    } catch (err) { console.error(err) }
  }, [])

  useEffect(() => {
    startScanner()
    return () => { controlsRef.current?.stop() }
  }, [])

  const handleResult = async (result: 'survived' | 'eliminated') => {
    setState('submitting')
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.rpc('save_round_result', {
      p_qr_id: scannedQR,
      p_result: result,
      p_actor_id: user?.id,
    })
    if (error || !data?.success) {
      const msg = data?.message || error?.message || 'Failed'
      setScanResult({ success: false, message: msg, error: data?.error })
      setState('result_shown')
      toast.error(msg)
    } else {
      setScanResult({ success: true, message: result === 'survived' ? `${data.participant.name} — Survived ✓` : `${data.participant.name} — Eliminated` })
      setState('result_shown')
      if (result === 'survived') toast.success('Survived ✓')
      else toast.error('Eliminated')
    }
    setTimeout(() => startScanner(), 2500)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, paddingTop: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 22, fontWeight: 800 }}>Round Scanner</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Scan QR → Record result</p>
      </div>

      {/* Active round pill */}
      {activeRound ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 100, background: 'var(--pink-subtle)', border: '1px solid rgba(255,45,120,0.3)' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--pink)' }} className="pulse" />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--pink)' }}>{activeRound.round_name}</span>
        </div>
      ) : (
        <div className="alert alert-warning" style={{ width: '100%', maxWidth: 400 }}>
          ⚠️ No active round set. Ask admin to activate a round.
        </div>
      )}

      {/* Scanner view */}
      {state === 'scanning' && (
        <div className="scanner-container">
          <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
          <div className="scanner-overlay">
            <div style={{ position: 'relative', width: 200, height: 200 }}>
              <div className="scan-frame" />
              <div className="scan-line" />
            </div>
          </div>
        </div>
      )}

      {/* ── ALREADY RECORDED for this round ── */}
      {state === 'already_recorded' && participant && existingResult && (
        <div className="card" style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
          {/* Result banner */}
          <div style={{
            padding: '16px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 16,
            background: existingResult === 'survived' ? 'rgba(0,212,170,0.1)' : 'rgba(255,68,68,0.1)',
            border: `1px solid ${existingResult === 'survived' ? 'rgba(0,212,170,0.3)' : 'rgba(255,68,68,0.3)'}`,
          }}>
            <div style={{ fontSize: 44, marginBottom: 8 }}>
              {existingResult === 'survived' ? '✅' : '❌'}
            </div>
            <div style={{
              fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em',
              color: existingResult === 'survived' ? 'var(--teal)' : 'var(--red)',
              marginBottom: 4,
            }}>
              Already Recorded — {existingResult === 'survived' ? 'Survived' : 'Eliminated'}
            </div>
          </div>

          {/* Participant info */}
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>{participant.name}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 4 }}>{participant.roll_no}</div>
          <div style={{
            display: 'inline-block', padding: '3px 12px', borderRadius: 100,
            background: 'var(--pink-subtle)', border: '1px solid rgba(255,45,120,0.3)',
            color: 'var(--pink)', fontWeight: 800, fontSize: 13, letterSpacing: 1, marginBottom: 16,
          }}>{scannedQR}</div>

          {activeRound && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              Round: <strong style={{ color: 'var(--pink)' }}>{activeRound.round_name}</strong>
            </div>
          )}

          <div style={{
            padding: '10px 14px', borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            fontSize: 12, color: 'var(--text-muted)', marginBottom: 16,
          }}>
            Result is locked. Scan a different participant or contact admin to correct.
          </div>

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={startScanner} id="rescan-recorded-btn">
            Scan Next
          </button>
        </div>
      )}

      {/* ── GLOBALLY ELIMINATED (locked forever) ── */}
      {state === 'locked' && participant && (
        <div className="card" style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            Eliminated — Locked
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 2 }}>{participant.name}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
            {participant.roll_no} · {scannedQR}
          </div>
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            This participant has been eliminated and cannot receive further results.
          </div>
          <button className="btn btn-ghost" style={{ width: '100%' }} onClick={startScanner} id="rescan-locked-btn">
            Scan Next
          </button>
        </div>
      )}

      {/* ── READY TO RECORD ── */}
      {state === 'loaded' && participant && (
        <div className="card" style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{participant.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>{participant.roll_no}</div>
              </div>
              <div className="badge badge-active">{scannedQR}</div>
            </div>
            {activeRound && (
              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
                Round: <strong style={{ color: 'var(--pink)' }}>{activeRound.round_name}</strong>
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button className="btn btn-success btn-lg" onClick={() => handleResult('survived')} id="btn-survived" style={{ fontSize: 16 }}>
              ✅ Survived
            </button>
            <button className="btn btn-danger btn-lg" onClick={() => handleResult('eliminated')} id="btn-eliminated" style={{ fontSize: 16 }}>
              ❌ Eliminated
            </button>
          </div>
          <button className="btn btn-ghost" style={{ marginTop: 12, width: '100%' }} onClick={startScanner}>Rescan</button>
        </div>
      )}

      {/* Submitting */}
      {state === 'submitting' && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div className="spinner" style={{ margin: '0 auto 16px', width: 36, height: 36 }} />
          <p style={{ color: 'var(--text-muted)' }}>Saving result...</p>
        </div>
      )}

      {/* Result flash */}
      {state === 'result_shown' && scanResult && (
        <div
          className={`alert ${scanResult.success ? (scanResult.message.includes('Survived') ? 'alert-success' : 'alert-error') : 'alert-error'}`}
          style={{ width: '100%', maxWidth: 400, justifyContent: 'center', textAlign: 'center', flexDirection: 'column' }}
        >
          <div style={{ fontSize: 36 }}>{scanResult.success ? (scanResult.message.includes('Survived') ? '✅' : '❌') : '⚠️'}</div>
          <div style={{ fontWeight: 700, fontSize: 15, marginTop: 8 }}>{scanResult.message}</div>
          <div style={{ fontSize: 12, marginTop: 8, opacity: 0.6 }}>Scanner reopening...</div>
        </div>
      )}
    </div>
  )
}
