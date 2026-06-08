'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Participant, Round } from '@/lib/types'

interface RoundResult {
  round_id: string
  result: 'survived' | 'eliminated'
}

interface Props {
  participant: Participant
  rounds: Round[]
  initialResults: RoundResult[]
}

export default function PlayerScoreboardClient({ participant, rounds, initialResults }: Props) {
  const supabase = createClient()
  const [results, setResults] = useState<RoundResult[]>(initialResults)

  // Realtime updates
  useEffect(() => {
    const ch = supabase
      .channel(`player-${participant.participant_id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'round_results',
        filter: `participant_id=eq.${participant.participant_id}`,
      }, () => {
        supabase
          .from('round_results')
          .select('round_id, result')
          .eq('participant_id', participant.participant_id)
          .then(({ data }) => { if (data) setResults(data) })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const getResult = (roundId: string) =>
    results.find(r => r.round_id === roundId)?.result ?? null

  const isEliminated = participant.current_status === 'eliminated'
  const isWinner = participant.current_status === 'winner'

  // Only show rounds that are in the card image (up to 7, but image shows 5 nicely)
  // We'll show all rounds dynamically in the round progress bar
  const roundsToShow = rounds.slice(0, 7)

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: '0',
      fontFamily: "'Outfit', 'Inter', sans-serif",
    }}>

      {/* Card container — matches image aspect ratio ~1:1.4 */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: 480,
        margin: '0 auto',
      }}>

        {/* Base image */}
        <img
          src="/player-card.png"
          alt="Player Card"
          style={{ width: '100%', display: 'block' }}
          draggable={false}
        />

        {/* ── PLAYER NAME overlay ────────────────────────────────
            The dark oval is roughly at 57–64% from top, 6–72% width from left */}
        <div style={{
          position: 'absolute',
          top: '56.5%',
          left: '5%',
          width: '68%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{
            color: '#ffffff',
            fontSize: 'clamp(13px, 3.5vw, 20px)',
            fontWeight: 800,
            letterSpacing: '0.04em',
            textShadow: '0 1px 4px rgba(0,0,0,0.8)',
            textAlign: 'center',
            lineHeight: 1.2,
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {participant.name.toUpperCase()}
          </span>
        </div>

        {/* ── PLAYER ID overlay ─────────────────────────────────
            The dark rectangle is roughly at 68–73% from top */}
        <div style={{
          position: 'absolute',
          top: '69%',
          left: '5%',
          width: '38%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{
            color: '#ff2d78',
            fontSize: 'clamp(11px, 3vw, 17px)',
            fontWeight: 900,
            letterSpacing: '0.12em',
            textShadow: '0 1px 6px rgba(0,0,0,0.9)',
          }}>
            {participant.assigned_qr}
          </span>
        </div>

        {/* ── ROUND PROGRESS result bars ─────────────────────────
            5 bars at the bottom of the card, roughly 88–93% from top
            Evenly spaced across the width */}
        <div style={{
          position: 'absolute',
          bottom: '4.5%',
          left: '1%',
          width: '98%',
          display: 'flex',
          justifyContent: 'space-around',
          gap: '1%',
        }}>
          {roundsToShow.map((round) => {
            const result = getResult(round.round_id)
            const survived = result === 'survived'
            const eliminated = result === 'eliminated'
            const pending = result === null

            return (
              <div
                key={round.round_id}
                style={{
                  flex: 1,
                  height: 'clamp(14px, 3.5vw, 22px)',
                  borderRadius: 3,
                  background: pending
                    ? 'rgba(20,10,10,0.85)'
                    : survived
                    ? '#00c853'
                    : '#e53935',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.5s ease',
                  boxShadow: pending ? 'none' : `0 0 8px ${survived ? '#00c85388' : '#e5393588'}`,
                }}
              >
                {!pending && (
                  <span style={{
                    color: '#fff',
                    fontSize: 'clamp(5px, 1.5vw, 9px)',
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}>
                    {survived ? '✓ SURVIVED' : '✗ ELIM'}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* ── STATUS BADGE — shown if eliminated or winner ───────── */}
        {(isEliminated || isWinner) && (
          <div style={{
            position: 'absolute',
            top: '48%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-12deg)',
            padding: '6px 20px',
            borderRadius: 4,
            border: `3px solid ${isWinner ? '#ffd700' : '#e53935'}`,
            background: isWinner ? 'rgba(255,215,0,0.15)' : 'rgba(229,57,53,0.15)',
            backdropFilter: 'blur(2px)',
            pointerEvents: 'none',
          }}>
            <span style={{
              color: isWinner ? '#ffd700' : '#ff4444',
              fontSize: 'clamp(18px, 5vw, 28px)',
              fontWeight: 900,
              letterSpacing: '0.15em',
              textShadow: `0 0 20px ${isWinner ? '#ffd700' : '#ff4444'}`,
            }}>
              {isWinner ? '🏆 WINNER' : '☠ ELIMINATED'}
            </span>
          </div>
        )}
      </div>

      {/* Below-card: round details list */}
      <div style={{
        width: '100%',
        maxWidth: 480,
        background: '#111',
        borderTop: '2px solid #E31B6D',
      }}>
        {roundsToShow.map((round, i) => {
          const result = getResult(round.round_id)
          return (
            <div key={round.round_id} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              borderBottom: i < roundsToShow.length - 1 ? '1px solid #222' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, color: '#E31B6D', flexShrink: 0,
                }}>
                  {i + 1}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#ddd' }}>
                  {round.round_name}
                </span>
              </div>
              <div style={{
                padding: '3px 12px',
                borderRadius: 100,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.06em',
                background: result === 'survived'
                  ? 'rgba(0,200,83,0.12)'
                  : result === 'eliminated'
                  ? 'rgba(229,57,53,0.12)'
                  : 'rgba(255,255,255,0.05)',
                color: result === 'survived'
                  ? '#00c853'
                  : result === 'eliminated'
                  ? '#ff5252'
                  : '#555',
                border: `1px solid ${result === 'survived' ? 'rgba(0,200,83,0.3)' : result === 'eliminated' ? 'rgba(229,57,53,0.3)' : '#222'}`,
              }}>
                {result === 'survived' ? '✓ SURVIVED'
                  : result === 'eliminated' ? '✗ ELIMINATED'
                  : '— PENDING'}
              </div>
            </div>
          )
        })}

        {/* Footer */}
        <div style={{
          padding: '14px 16px',
          textAlign: 'center',
          fontSize: 10,
          color: '#444',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          TRUST NO ONE · PLAY FAIR · WIN BIG · PARADOX26
        </div>
      </div>
    </div>
  )
}
