'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchAllParticipants } from '@/lib/supabase/fetchAll'

interface Stats {
  active: number
  total: number
  eliminated: number
  currentRound: string | null
}

export default function LiveClient() {
  const supabase = createClient()
  const [stats, setStats] = useState<Stats>({ active: 0, total: 0, eliminated: 0, currentRound: null })
  const [tick, setTick] = useState(0)

  const fetchStats = async () => {
    const [participants, esRes] = await Promise.all([
      fetchAllParticipants(supabase, 'current_status, registered'),
      supabase.from('event_state').select('*, round:rounds(round_name)').eq('id', 1).single(),
    ])
    const registered = participants.filter(p => p.registered)
    setStats({
      total: registered.length,
      active: participants.filter(p => p.current_status === 'active').length,
      eliminated: participants.filter(p => p.current_status === 'eliminated').length,
      currentRound: esRes.data?.round?.round_name || null,
    })
  }

  useEffect(() => {
    fetchStats()
    const ch = supabase.channel('live-display')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_state' }, fetchStats)
      .subscribe()
    const timer = setInterval(() => setTick(t => t + 1), 1000)
    return () => { supabase.removeChannel(ch); clearInterval(timer) }
  }, [])

  return (
    <div className="live-display" style={{ fontFamily: "'Bebas Neue', sans-serif", position: 'relative', overflow: 'hidden' }}>
      {/* Animated background circles */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            borderRadius: '50%',
            border: `1px solid rgba(255,45,120,${0.05 + i * 0.02})`,
            width: `${(i + 1) * 300}px`,
            height: `${(i + 1) * 300}px`,
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
          }} />
        ))}
        <div style={{
          position: 'absolute', top: '10%', right: '8%',
          width: 60, height: 60, border: '2px solid rgba(255,45,120,0.15)',
        }} />
        <div style={{
          position: 'absolute', bottom: '15%', left: '8%',
          width: 0, height: 0,
          borderLeft: '40px solid transparent',
          borderRight: '40px solid transparent',
          borderBottom: '70px solid rgba(255,45,120,0.1)',
        }} />
        <div style={{
          position: 'absolute', top: '20%', left: '12%',
          width: 50, height: 50, borderRadius: '50%',
          border: '2px solid rgba(255,45,120,0.12)',
        }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{
          fontSize: 24, color: 'rgba(255,255,255,0.3)',
          letterSpacing: '0.3em', marginBottom: 16,
          fontFamily: "'Bebas Neue', sans-serif",
        }}>
          PARADOX26 · SQUID GAME
        </div>

        <div style={{ marginBottom: 8, fontSize: 20, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em' }}>
          PLAYERS REMAINING
        </div>
        <div className="live-count glow-pulse">{stats.active}</div>

        {stats.currentRound && (
          <>
            <div style={{ marginTop: 24, fontSize: 18, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em' }}>
              CURRENT ROUND
            </div>
            <div className="live-round" style={{ color: 'rgba(255,255,255,0.85)', marginTop: 8 }}>
              {stats.currentRound}
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 48, marginTop: 48, justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, color: 'var(--green)', fontFamily: "'Bebas Neue'" }}>{stats.total}</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em' }}>REGISTERED</div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, color: 'var(--red)', fontFamily: "'Bebas Neue'" }}>{stats.eliminated}</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em' }}>ELIMINATED</div>
          </div>
        </div>

        <div style={{
          position: 'fixed', top: 24, right: 24,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 16px', borderRadius: 100,
          background: 'rgba(255,45,120,0.15)',
          border: '1px solid rgba(255,45,120,0.3)',
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: tick % 2 === 0 ? 'var(--pink)' : 'rgba(255,45,120,0.3)',
            transition: 'background 0.3s',
          }} />
          <span style={{ fontSize: 13, color: 'var(--pink)', letterSpacing: '0.1em' }}>LIVE</span>
        </div>
      </div>
    </div>
  )
}
