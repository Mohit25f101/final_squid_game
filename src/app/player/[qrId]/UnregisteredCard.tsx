// Shown when a player scans their QR before a volunteer has registered them
export default function UnregisteredCard({ qrId }: { qrId: string }) {
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
      {/* Card image as background reference */}
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: '#111',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid #2a2a2a',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }}>
        {/* Top banner */}
        <div style={{
          background: 'linear-gradient(135deg, #1a0510 0%, #2d0a1a 100%)',
          padding: '32px 24px',
          textAlign: 'center',
          borderBottom: '1px solid #2a0a1a',
        }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>🦑</div>
          <div style={{
            fontSize: 22,
            fontWeight: 900,
            color: '#E31B6D',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: 4,
          }}>
            SQUID GAME
          </div>
          <div style={{
            fontSize: 11,
            color: '#666',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
          }}>
            PARADOX26 · THE GAME BEGINS
          </div>
        </div>

        {/* QR ID */}
        <div style={{
          padding: '20px 24px 0',
          textAlign: 'center',
        }}>
          <div style={{
            display: 'inline-block',
            padding: '6px 20px',
            borderRadius: 100,
            background: 'rgba(227,27,109,0.1)',
            border: '1px solid rgba(227,27,109,0.3)',
            color: '#E31B6D',
            fontWeight: 900,
            fontSize: 18,
            letterSpacing: '0.15em',
            marginBottom: 20,
          }}>
            {qrId}
          </div>
        </div>

        {/* Status message */}
        <div style={{ padding: '0 24px 28px', textAlign: 'center' }}>
          <div style={{
            background: 'rgba(255,180,0,0.07)',
            border: '1px solid rgba(255,180,0,0.25)',
            borderRadius: 12,
            padding: '20px',
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
            <div style={{
              fontSize: 16,
              fontWeight: 800,
              color: '#ffb400',
              marginBottom: 6,
            }}>
              Not Yet Registered
            </div>
            <div style={{
              fontSize: 13,
              color: '#888',
              lineHeight: 1.5,
            }}>
              This QR card hasn't been linked to a participant yet.
              Please find a volunteer to get registered.
            </div>
          </div>

          {/* Steps */}
          <div style={{ textAlign: 'left' }}>
            {[
              { step: '1', text: 'Find a registration desk volunteer' },
              { step: '2', text: 'Show them this QR card' },
              { step: '3', text: 'They will link it to your roll number' },
              { step: '4', text: 'Scan again to see your scoreboard' },
            ].map(({ step, text }) => (
              <div key={step} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '8px 0',
                borderBottom: step !== '4' ? '1px solid #1a1a1a' : 'none',
              }}>
                <div style={{
                  width: 26, height: 26,
                  borderRadius: '50%',
                  background: '#1a0510',
                  border: '1px solid rgba(227,27,109,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, color: '#E31B6D',
                  flexShrink: 0,
                }}>
                  {step}
                </div>
                <span style={{ fontSize: 13, color: '#aaa' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px',
          textAlign: 'center',
          fontSize: 10,
          color: '#333',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          borderTop: '1px solid #1a1a1a',
        }}>
          TRUST NO ONE · PLAY FAIR · WIN BIG
        </div>
      </div>
    </div>
  )
}
