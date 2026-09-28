import LeaderboardPodium, { type LeaderboardEntry } from './LeaderboardPodium';

export interface PodiumCandidate {
  rank: 1 | 2 | 3;
  name: string;
  hallTicket: string;
  collegeName?: string;
  score: number;
  accuracy?: number;
}

interface Podium3DProps {
  first?: PodiumCandidate;
  second?: PodiumCandidate;
  third?: PodiumCandidate;
}

/**
 * Podium3D — Consolidated wrapper delegating to LeaderboardPodium
 */
export default function Podium3D({ first, second, third }: Podium3DProps) {
  const entries: LeaderboardEntry[] = [
    first ? { rank: 1, name: first.name, score: first.score, hall_ticket: first.hallTicket } : null,
    second ? { rank: 2, name: second.name, score: second.score, hall_ticket: second.hallTicket } : null,
    third ? { rank: 3, name: third.name, score: third.score, hall_ticket: third.hallTicket } : null,
  ].filter(Boolean) as LeaderboardEntry[];

  return <LeaderboardPodium entries={entries} />;
}
