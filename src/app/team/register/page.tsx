'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

type State = 'scanning' | 'already_registered' | 'entering_roll' | 'submitting' | 'success' | 'error'

export default function RegisterPage() {
  const supabase = createClient()
  const videoRef = useRef<HTMLVideoElement>(null)
  const codeReaderRef = useRef<BrowserQRCodeReader | null>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const [state, setState] = useState<State>('scanning')
  const [scannedQR, setScannedQR] = useState('')
  const [rollNo, setRollNo] = useState('')
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string } | null>(null)
  const [existingParticipant, setExistingParticipant] = useState<{ name: string; roll_no: string; assigned_qr: string } | null>(null)

  const startScanner = useCallback(async () => {
    setState('scanning')
    setScannedQR('')
    setRollNo('')
    setExistingParticipant(null)
    try {
      const reader = new BrowserQRCodeReader()
      codeReaderRef.current = reader
      const devices = await BrowserQRCodeReader.listVideoInputDevices()
      const deviceId = devices[devices.length - 1]?.deviceId
      const controls = await reader.decodeFromVideoDevice(
        deviceId,
        videoRef.current!,
        async (result, error) => {
          if (result) {
            const text = result.getText()
            const qrId = text.split('/').pop() || text
            if (qrId.startsWith('SG-') || text.includes('player')) {
              controls.stop()
              setScannedQR(qrId)
              // Check if this QR is already registered
              const { data: existing } = await supabase
                .from('participants')
                .select('name, roll_no, assigned_qr')
                .eq('assigned_qr', qrId)
                .single()
              if (existing) {
                setExistingParticipant(existing)
                setState('already_registered')
              } else {
                setExistingParticipant(null)
                setState('entering_roll')
              }
            }
          }
        }
      )
      controlsRef.current = controls
    } catch (err) {
      console.error(err)
    }
  }, [])

  useEffect(() => {
    startScanner()
    return () => { controlsRef.current?.stop() }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('submitting')
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.rpc('register_participant', {
      p_qr_id: scannedQR,
      p_roll_no: rollNo.toUpperCase().trim(),
      p_actor_id: user?.id,
    })
    if (error || !data?.success) {
      const msg = data?.message || error?.message || 'Registration failed'
      setLastResult({ success: false, message: msg })
      setState('error')
      toast.error(msg)
    } else {
      setLastResult({ success: true, message: `${data.participant.name} registered as ${data.participant.assigned_qr}` })
      setState('success')
      toast.success('Registration successful!')
    }
    setTimeout(() => startScanner(), 2500)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, paddingTop: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 22, fontWeight: 800 }}>Registration Scanner</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Scan QR → Enter Roll Number → Register</p>
      </div>

      {/* Scanner */}
      {(state === 'scanning') && (
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

      {/* Already registered — show existing participant, block re-registration */}
      {state === 'already_registered' && existingParticipant && (
        <div className="card" style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Already Registered</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{existingParticipant.name}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 4 }}>{existingParticipant.roll_no}</div>
          <div style={{
            display: 'inline-block', padding: '4px 14px', borderRadius: 100,
            background: 'var(--pink-subtle)', border: '1px solid rgba(255,45,120,0.3)',
            color: 'var(--pink)', fontWeight: 800, fontSize: 15, letterSpacing: 1, marginBottom: 20,
          }}>{existingParticipant.assigned_qr}</div>
          <div className="alert alert-warning" style={{ marginBottom: 16, textAlign: 'left' }}>
            This QR card is already linked to <strong>{existingParticipant.name}</strong>. It cannot be reassigned.
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={startScanner} id="rescan-after-registered-btn">
            Scan Next Card
          </button>
        </div>
      )}

      {/* Roll entry form */}
      {state === 'entering_roll' && (
        <div className="card" style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div className="badge badge-active">✓ QR Scanned</div>
            <span style={{ fontWeight: 700, color: 'var(--teal)' }}>{scannedQR}</span>
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="label" htmlFor="roll-no">Roll Number</label>
              <input
                id="roll-no"
                className="input"
                placeholder="e.g. CS24B001"
                value={rollNo}
                onChange={e => setRollNo(e.target.value)}
                autoFocus
                required
                style={{ fontSize: 18, textAlign: 'center', fontWeight: 700, letterSpacing: '0.1em' }}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-lg" id="register-submit-btn">
              Register Participant
            </button>
            <button type="button" className="btn btn-ghost" onClick={startScanner}>
              Rescan
            </button>
          </form>
        </div>
      )}

      {/* Submitting */}
      {state === 'submitting' && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div className="spinner" style={{ margin: '0 auto 16px', width: 36, height: 36 }} />
          <p style={{ color: 'var(--text-muted)' }}>Registering...</p>
        </div>
      )}

      {/* Result */}
      {(state === 'success' || state === 'error') && lastResult && (
        <div className={`alert ${lastResult.success ? 'alert-success' : 'alert-error'}`} style={{ width: '100%', maxWidth: 400, justifyContent: 'center', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{lastResult.success ? '✅' : '❌'}</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{lastResult.success ? 'Registration Successful' : 'Registration Failed'}</div>
            <div style={{ fontSize: 13, marginTop: 4, opacity: 0.8 }}>{lastResult.message}</div>
            <div style={{ fontSize: 12, marginTop: 12, opacity: 0.6 }}>Scanner reopening...</div>
          </div>
        </div>
      )}
    </div>
  )
}
