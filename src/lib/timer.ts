// Timer and banked minutes logic

export type Session = { id: string; start: number; end?: number }

export function minutesBetween(start: number, end: number) {
  return Math.max(0, Math.floor((end - start) / 60000))
}

export function totalMinutes(sessions: Session[]) {
  return sessions.reduce((acc, s) => acc + minutesBetween(s.start, s.end ?? Date.now()), 0)
}

// Given recorded sessions and previously credited minutes, compute new banked minutes
export function computeBankedMinutes(sessions: Session[], alreadyCreditedMinutes: number) {
  const mins = totalMinutes(sessions)
  const creditsEarned = Math.floor(mins / 25) * 5 // every 25 minutes -> 5 leisure minutes
  const delta = Math.max(0, creditsEarned - alreadyCreditedMinutes)
  return { creditsEarned, delta }
}
