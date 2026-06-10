'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DashboardStats, Round } from '@/lib/types'
import toast from 'react-hot-toast'

// ─── Reset Confirmation Modal ─────────────────────────────────────────────────
function ResetModal({ onClose, onConfirmed }: { onClose: () => void; onConfirmed: () => void }) {
  const [typed, setTyped] = useState('')
  const [resetting, setResetting] = useState(false)


  const handleReset = async () => {
    setResetting(true)
    try {
      const res = await fetch('/api/admin/reset', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error('Reset failed: ' + (data.message || 'Unknown error'))
        setResetting(false)
        return
      }
      toast.success('All data reset successfully!')
      // Hard reload after 1s so server-fetched stats fully refresh
      setTimeout(() => window.location.reload(), 1000)
    } catch (err: any) {
      toast.error('Reset failed: ' + err.message)
      setResetting(false)
    }
  }


  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      backdropFilter: 'blur(4px)',
    }}>
      <div className="card" style={{
        width: '100%', maxWidth: 440,
        border: '1px solid rgba(255,68,68,0.4)',
        position: 'relative',
      }}>
        {/* Red top stripe */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--red)', borderRadius: 'var(--radius) var(--radius) 0 0' }} />

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(255,68,68,0.12)', border: '2px solid rgba(255,68,68,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, margin: '0 auto 16px',
          }}>⚠️</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--red)', marginBottom: 8 }}>
            Reset All Data
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            This will permanently delete <strong style={{ color: 'var(--text-primary)' }}>all participants</strong>,{' '}
            <strong style={{ color: 'var(--text-primary)' }}>round results</strong>, and{' '}
            <strong style={{ color: 'var(--text-primary)' }}>audit logs</strong>.
            The active round will be cleared. This cannot be undone.
          </div>
        </div>

        <div className="form-group">
          <label className="label" style={{ textAlign: 'center', display: 'block', marginBottom: 8 }}>
            Type <strong style={{ color: 'var(--red)', letterSpacing: 2 }}>RESET</strong> to confirm
          </label>
          <input
            id="reset-confirm-input"
            className="input"
            placeholder="RESET"
            value={typed}
            onChange={e => setTyped(e.target.value.toUpperCase())}
            style={{
              textAlign: 'center', fontWeight: 800, fontSize: 18, letterSpacing: 4,
              borderColor: typed === 'RESET' ? 'var(--red)' : undefined,
            }}
            autoFocus
          />
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button
            className="btn btn-ghost"
            style={{ flex: 1 }}
            onClick={onClose}
            disabled={resetting}
            id="reset-cancel-btn"
          >
            Cancel
          </button>
          <button
            className="btn"
            id="reset-confirm-btn"
            style={{
              flex: 1,
              background: typed === 'RESET' ? 'var(--red)' : 'rgba(255,68,68,0.15)',
              color: typed === 'RESET' ? '#fff' : 'rgba(255,68,68,0.4)',
              border: '1px solid rgba(255,68,68,0.3)',
              fontWeight: 700, cursor: typed === 'RESET' ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
            }}
            disabled={typed !== 'RESET' || resetting}
            onClick={handleReset}
          >
            {resetting ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                <div className="spinner" style={{ width: 16, height: 16 }} /> Resetting...
              </span>
            ) : '🗑️ Reset Everything'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardClient({ initialStats, rounds }: { initialStats: DashboardStats, rounds: Round[] }) {
  const [stats, setStats] = useState(initialStats)
  const [showReset, setShowReset] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'round_results' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_state' }, () => refetch())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const refetch = async () => {
    const [pRes, rrRes, esRes] = await Promise.all([
      supabase.from('participants').select('current_status, registered'),
      supabase.from('round_results').select('round_id, result'),
      supabase.from('event_state').select('*, round:rounds(*)').eq('id', 1).single(),
    ])
    const participants = pRes.data || []
    const roundResults = rrRes.data || []
    const eventState = esRes.data
    const total = participants.length
    const registered = participants.filter(p => p.registered).length
    const active = participants.filter(p => p.current_status === 'active').length
    const eliminated = participants.filter(p => p.current_status === 'eliminated').length
    const roundStats = rounds.map(round => {
      const results = roundResults.filter(r => r.round_id === round.round_id)
      return { round, survived: results.filter(r => r.result === 'survived').length, eliminated: results.filter(r => r.result === 'eliminated').length }
    })
    setStats({ total, registered, not_registered: total - registered, active, eliminated, current_round: eventState?.round || null, round_stats: roundStats })
  }

  const handleResetDone = () => {
    setShowReset(false)
    refetch()
  }

  const maxPlayers = stats.total || 1

  return (
    <>
      {showReset && <ResetModal onClose={() => setShowReset(false)} onConfirmed={handleResetDone} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Dashboard</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Live event statistics — auto-updating</p>
          </div>
          <button
            id="reset-data-btn"
            onClick={() => setShowReset(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', borderRadius: 'var(--radius-sm)',
              background: 'rgba(255,68,68,0.08)',
              border: '1px solid rgba(255,68,68,0.25)',
              color: 'rgba(255,68,68,0.7)',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              const b = e.currentTarget
              b.style.background = 'rgba(255,68,68,0.15)'
              b.style.borderColor = 'rgba(255,68,68,0.5)'
              b.style.color = 'var(--red)'
            }}
            onMouseLeave={e => {
              const b = e.currentTarget
              b.style.background = 'rgba(255,68,68,0.08)'
              b.style.borderColor = 'rgba(255,68,68,0.25)'
              b.style.color = 'rgba(255,68,68,0.7)'
            }}
          >
            🗑️ Reset All Data
          </button>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <div className="stat-card pink">
            <div className="stat-value" style={{ color: 'var(--pink)' }}>{stats.total}</div>
            <div className="stat-label">Total Participants</div>
          </div>
          <div className="stat-card teal">
            <div className="stat-value" style={{ color: 'var(--teal)' }}>{stats.registered}</div>
            <div className="stat-label">Registered</div>
          </div>
          <div className="stat-card" style={{ '--color': 'var(--text-muted)' } as React.CSSProperties}>
            <div className="stat-value" style={{ color: 'var(--text-secondary)' }}>{stats.not_registered}</div>
            <div className="stat-label">Not Registered</div>
          </div>
          <div className="stat-card green">
            <div className="stat-value" style={{ color: 'var(--green)' }}>{stats.active}</div>
            <div className="stat-label">Active Players</div>
          </div>
          <div className="stat-card red">
            <div className="stat-value" style={{ color: 'var(--red)' }}>{stats.eliminated}</div>
            <div className="stat-label">Eliminated</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Round Analytics */}
          <div className="card">
            <div className="section-header">
              <div>
                <div className="section-title">Round Analytics</div>
                <div className="section-subtitle">Results per round</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {stats.round_stats.map((rs, i) => (
                <div key={rs.round.round_id} style={{
                  padding: '12px 0', borderBottom: i < stats.round_stats.length - 1 ? '1px solid var(--border)' : 'none'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{rs.round.round_order}. {rs.round.round_name}</span>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <span style={{ color: 'var(--teal)' }}>✓ {rs.survived}</span>
                      <span style={{ color: 'var(--red)' }}>✗ {rs.eliminated}</span>
                    </div>
                  </div>
                  {(rs.survived + rs.eliminated) > 0 && (
                    <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${(rs.survived / (rs.survived + rs.eliminated)) * 100}%`,
                        background: 'linear-gradient(90deg, var(--teal), var(--green))',
                        transition: 'width 0.8s ease',
                      }} />
                    </div>
                  )}
                </div>
              ))}
              {stats.round_stats.every(r => r.survived + r.eliminated === 0) && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  No round results yet
                </div>
              )}
            </div>
          </div>

          {/* Survival Funnel */}
          <div className="card">
            <div className="section-header">
              <div>
                <div className="section-title">Survival Funnel</div>
                <div className="section-subtitle">Player progression</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div className="funnel-step">
                <div style={{ width: 80, fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>Start</div>
                <div style={{ flex: 1 }}>
                  <div className="funnel-bar" style={{ width: '100%' }} />
                </div>
                <div style={{ width: 50, textAlign: 'right', fontWeight: 700 }}>{stats.total}</div>
              </div>
              {stats.round_stats.filter(r => r.survived + r.eliminated > 0).map((rs) => {
                const playersAfter = rs.survived
                const pct = (playersAfter / maxPlayers) * 100
                return (
                  <div key={rs.round.round_id} className="funnel-step">
                    <div style={{ width: 80, fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {rs.round.round_name.split(' ').slice(0, 2).join(' ')}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="funnel-bar" style={{ width: `${pct}%` }} />
                    </div>
                    <div style={{ width: 50, textAlign: 'right', fontWeight: 700, color: pct < 30 ? 'var(--red)' : 'var(--green)' }}>{playersAfter}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Current Round Banner */}
        {stats.current_round && (
          <div className="card" style={{ background: 'var(--pink-subtle)', border: '1px solid rgba(255,45,120,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--pink)', flexShrink: 0 }} className="pulse" />
              <div>
                <div style={{ fontSize: 12, color: 'var(--pink)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Current Round</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{stats.current_round.round_name}</div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--green)' }}>{stats.active}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Players</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
