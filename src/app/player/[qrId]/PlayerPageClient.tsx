'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import PlayerScoreboardClient from './PlayerScoreboardClient'

type State = 'loading' | 'name_entry' | 'registering' | 'scoreboard'

interface Participant {
  participant_id: string
  name: string
  assigned_qr: string
  roll_no: string
  current_status: string
  registered: boolean
}

export default function PlayerPageClient({ qrId }: { qrId: string }) {
  const supabase = createClient()
  const [state, setState] = useState<State>('loading')
  const [name, setName] = useState('')
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [rounds, setRounds] = useState<any[]>([])
  const [results, setResults] = useState<any[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    // Try to find existing participant for this QR
    supabase
      .from('participants')
      .select('*')
      .eq('assigned_qr', qrId)
      .single()
      .then(({ data }) => {
        if (data?.registered) {
          loadScoreboard(data)
        } else {
          setState('name_entry')
        }
      })
  }, [qrId])

  const loadScoreboard = async (p: Participant) => {
    const [{ data: r }, { data: rr }] = await Promise.all([
      supabase.from('rounds').select('*').order('round_order'),
      supabase.from('round_results').select('*').eq('participant_id', p.participant_id),
    ])
    setParticipant(p)
    setRounds(r || [])
    setResults(rr || [])
    setState('scoreboard')
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setError('')
    setState('registering')

    try {
      const res = await fetch('/api/player/self-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrId, name: name.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        await loadScoreboard(data.participant)
      } else {
        setError(data.error || 'Registration failed. Please try again.')
        setState('name_entry')
      }
    } catch {
      setError('Network error. Please try again.')
      setState('name_entry')
    }
  }

  // ── LOADING ─────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0a0f',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16,
        fontFamily: "'Outfit', 'Inter', sans-serif",
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          border: '3px solid #1a1a2e',
          borderTop: '3px solid #E31B6D',
          animation: 'spin 0.8s linear infinite',
        }} />
        <div style={{ color: '#555', fontSize: 13, letterSpacing: '0.1em' }}>LOADING...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── SCOREBOARD ──────────────────────────────────────────────
  if (state === 'scoreboard' && participant) {
    return <PlayerScoreboardClient participant={participant as any} rounds={rounds} initialResults={results} />
  }

  // ── NAME ENTRY FORM ─────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: "'Outfit', 'Inter', sans-serif",
    }}>
      <div style={{
        width: '100%', maxWidth: 380,
        background: '#111',
        borderRadius: 20,
        overflow: 'hidden',
        border: '1px solid #1e1e1e',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1a0510 0%, #2d0a1a 100%)',
          padding: '32px 24px 24px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 52, marginBottom: 10 }}>🦑</div>
          <div style={{
            fontSize: 20, fontWeight: 900, color: '#E31B6D',
            letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4,
          }}>
            SQUID GAME
          </div>
          <div style={{ fontSize: 10, color: '#555', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            PARADOX26 · THE GAME BEGINS
          </div>
        </div>

        {/* QR ID badge */}
        <div style={{ padding: '20px 24px 0', textAlign: 'center' }}>
          <div style={{
            display: 'inline-block',
            padding: '5px 18px',
            borderRadius: 100,
            background: 'rgba(227,27,109,0.1)',
            border: '1px solid rgba(227,27,109,0.3)',
            color: '#E31B6D',
            fontWeight: 900, fontSize: 16, letterSpacing: '0.15em',
          }}>
            {qrId}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleRegister} style={{ padding: '24px' }}>
          <div style={{ marginBottom: 8 }}>
            <label style={{
              display: 'block', fontSize: 11, fontWeight: 700,
              color: '#666', letterSpacing: '0.12em',
              textTransform: 'uppercase', marginBottom: 8,
            }}>
              Enter Your Full Name
            </label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Rahul Kumar"
              required
              disabled={state === 'registering'}
              style={{
                width: '100%',
                padding: '14px 16px',
                background: '#1a1a1a',
                border: '1px solid #2a2a2a',
                borderRadius: 10,
                color: '#fff',
                fontSize: 16,
                fontWeight: 600,
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => { e.target.style.borderColor = '#E31B6D' }}
              onBlur={e => { e.target.style.borderColor = '#2a2a2a' }}
            />
          </div>

          {error && (
            <div style={{
              padding: '10px 12px', borderRadius: 8, marginBottom: 12,
              background: 'rgba(229,57,53,0.1)', border: '1px solid rgba(229,57,53,0.3)',
              color: '#ff5252', fontSize: 12,
            }}>
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={state === 'registering' || !name.trim()}
            style={{
              width: '100%',
              padding: '14px',
              marginTop: 12,
              background: state === 'registering' || !name.trim()
                ? '#1a1a1a'
                : 'linear-gradient(135deg, #E31B6D, #c0144f)',
              border: 'none',
              borderRadius: 10,
              color: state === 'registering' || !name.trim() ? '#444' : '#fff',
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: '0.08em',
              cursor: state === 'registering' || !name.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'inherit',
            }}
          >
            {state === 'registering' ? '⏳ Registering...' : '→ View My Scoreboard'}
          </button>

          <div style={{
            marginTop: 16, fontSize: 11, color: '#444',
            textAlign: 'center', lineHeight: 1.6,
          }}>
            Your name will be permanently linked to this QR card.<br />
            Make sure you enter the correct name.
          </div>
        </form>
      </div>
    </div>
  )
}
