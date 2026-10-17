// Operator-only playtest policy. This is not a release/deployment gate.
export const PLAYTEST_LIMIT_MS = 15 * 60 * 1000;
export const REVIEW_CATEGORIES = ['story', 'puzzles', 'ui', 'difficulty'] as const;
export type PlaytestStatus = 'completed' | 'incomplete' | 'timed_out' | 'blocked';
export type PlayerReview = {
  status: 'completed' | 'incomplete' | 'blocked';
  stopReason: 'content_exhausted' | 'stuck' | 'technical_block' | 'time_limit' | 'uncertain';
  reached: string;
  ratings: Record<typeof REVIEW_CATEGORIES[number], { score: number | null; reason: string }>;
  difficulty: 'too_easy' | 'balanced' | 'too_hard' | 'mixed' | 'unassessed';
  findings: { category: typeof REVIEW_CATEGORIES[number]; severity: 'low' | 'medium' | 'high'; location: string; observed: string; expected: string; suggestion: string }[];
};
export function validatePlayerReview(value: unknown): PlayerReview {
  const report = value as PlayerReview;
  const text = (value: unknown, max = 4000) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
  if (!report || !['completed', 'incomplete', 'blocked'].includes(report.status) || !text(report.reached) || !['too_easy', 'balanced', 'too_hard', 'mixed', 'unassessed'].includes(report.difficulty)) throw new Error('Invalid playtest scope/status');
  if (!['content_exhausted', 'stuck', 'technical_block', 'time_limit', 'uncertain'].includes(report.stopReason) || report.status === 'completed' && report.stopReason !== 'content_exhausted') throw new Error('Current content exhaustion is not a story ending; distinguish it from getting stuck');
  if (!report.ratings || Object.keys(report.ratings).sort().join() !== [...REVIEW_CATEGORIES].sort().join()) throw new Error('All four rating categories are required');
  for (const category of REVIEW_CATEGORIES) {
    const rating = report.ratings[category];
    if (!rating || !(rating.score === null || Number.isInteger(rating.score) && rating.score >= 1 && rating.score <= 10) || !text(rating.reason)) throw new Error('Invalid player rating');
  }
  if (!Array.isArray(report.findings) || report.findings.length > 30 || report.findings.some(finding => !finding || !REVIEW_CATEGORIES.includes(finding.category) || !['low', 'medium', 'high'].includes(finding.severity) || !['location', 'observed', 'expected', 'suggestion'].every(key => text(finding[key as keyof typeof finding])))) throw new Error('Invalid developer findings');
  return report;
}
export const PLAYTEST_REPORT_GRACE_MS = 15 * 60 * 1000;
export type PlaytestSessionStatus = 'none' | 'starting' | 'running' | PlaytestStatus;
export type PlaytestSession = {
  live: boolean;
  status: PlaytestSessionStatus;
  remainingSeconds: number;
  endedAt: number | null;
  lateReportAllowed: boolean;
  message: string;
};
const NO_SESSION = 'Nincs aktív játékpróba. Új játékhoz indítsd el a start műveletet; korábbi futás eredménye nem használható fel újra.';
const LATE_SESSION = (status: string) => `A legutóbbi játékpróba már lezárult (${status}). Új játékhoz indítsd el a start műveletet; korábbi eredmény nem használható fel újra.`;

// The playtest may only be driven while its own fixture is live, and a report is
// accepted only for the session that just ended. A previous run's recorded status,
// summary or screenshot is never served as if it were the current game, so an
// expired session cannot be mistaken for live play by a fresh blind reviewer.
export function playtestSession(active: unknown, now = Date.now()): PlaytestSession {
  const run = (active ?? {}) as { id?: unknown; status?: unknown; startedAt?: unknown; deadline?: unknown; endedAt?: unknown };
  const closed = (status: string, endedAt: number | null, message: string): PlaytestSession => ({
    live: false, status: status as PlaytestSessionStatus, remainingSeconds: 0, endedAt, message,
    lateReportAllowed: endedAt !== null && Number.isFinite(endedAt) && now - endedAt >= -60000 && now - endedAt <= PLAYTEST_REPORT_GRACE_MS,
  });
  if (run.status === 'starting') return { live: false, status: 'starting', remainingSeconds: PLAYTEST_LIMIT_MS / 1000, endedAt: null, lateReportAllowed: false, message: 'Az elkülönített játékpróba-fixture még indul; néhány másodperc múlva próbáld újra.' };
  if (!active || typeof run.status !== 'string' || !Number.isFinite(run.startedAt) || run.deadline !== (run.startedAt as number) + PLAYTEST_LIMIT_MS) return { live: false, status: 'none', remainingSeconds: 0, endedAt: null, lateReportAllowed: false, message: NO_SESSION };
  const deadline = run.deadline as number;
  if (run.status === 'running') {
    if (now < deadline) return { live: true, status: 'running', remainingSeconds: Math.max(0, Math.ceil((deadline - now) / 1000)), endedAt: null, lateReportAllowed: false, message: 'A játékpróba fut.' };
    return closed('timed_out', deadline, 'A 15 perces keret lejárt; további játék nem lehetséges, csak a megfigyelt anyagról szóló jelentés.');
  }
  return closed(run.status, Number.isFinite(run.endedAt) ? run.endedAt as number : deadline, LATE_SESSION(run.status));
}
export function playtestResult(run: { startedAt: number; deadline: number; release: string; status: PlaytestStatus }, review?: PlayerReview, now = Date.now()) {
  if (run.deadline !== run.startedAt + PLAYTEST_LIMIT_MS) throw new Error('Fifteen-minute deadline required');
  const status: PlaytestStatus = run.status === 'timed_out' || now >= run.deadline ? 'timed_out' : run.status;
  // Do not copy arbitrary reviewer prose/locations into the user-facing summary.
  return {
    release: run.release, status, nonBlocking: true, limitSeconds: PLAYTEST_LIMIT_MS / 1000,
    elapsedSeconds: Math.max(0, Math.min(PLAYTEST_LIMIT_MS, now - run.startedAt)) / 1000,
    storyFinished: false,
    stopReason: status === 'timed_out' ? 'time_limit' : review?.stopReason ?? (status === 'blocked' ? 'technical_block' : 'uncertain'),
    coverage: review?.status === 'completed' && status === 'completed' && review.stopReason === 'content_exhausted' ? 'current_content_exhausted' : 'partial_or_unverified',
    ratings: Object.fromEntries(REVIEW_CATEGORIES.map(category => [category, review?.ratings[category].score ?? null])),
    assessment: Object.fromEntries(REVIEW_CATEGORIES.map(category => {
      const score = review?.ratings[category].score;
      return [category, score == null ? 'Nem értékelhető.' : score <= 3 ? 'A megfigyelt rész gyenge; javításra szorul.' : score <= 6 ? 'A megfigyelt rész vegyes minőségű.' : score <= 8 ? 'A megfigyelt rész jó minőségű.' : 'A megfigyelt rész kiváló minőségű.'];
    })),
    difficulty: review?.difficulty ?? 'unassessed', findings: review?.findings.length ?? 0,
    message: status === 'timed_out' ? 'A 15 perces keret lejárt; a játékpróba időkorlát miatt lezárult.' : status === 'completed' ? 'A jelenleg elérhető tartalom határán nincs további előrehaladás; ez nem a történet vége.' : 'A játékpróba elakadás vagy bizonytalan továbbhaladás miatt lezárult; ez nem jelenti a történet végét.',
  };
}
