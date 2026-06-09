import PlayerPageClient from './PlayerPageClient'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { qrId: string } }) {
  return {
    title: `${params.qrId.toUpperCase()} — Squid Game Paradox26`,
    description: 'Your live Squid Game scoreboard',
  }
}

export default function PlayerPage({ params }: { params: { qrId: string } }) {
  // No auth check here — fully public page
  return <PlayerPageClient qrId={params.qrId.toUpperCase()} />
}
