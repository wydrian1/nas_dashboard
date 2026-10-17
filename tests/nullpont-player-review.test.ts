import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PLAYTEST_LIMIT_MS, PLAYTEST_REPORT_GRACE_MS, REVIEW_CATEGORIES, validatePlayerReview, playtestResult, playtestSession, type PlayerReview } from '../lib/nullpont-player-review.ts';

function review(): PlayerReview {
  return { status: 'completed', stopReason: 'content_exhausted', reached: 'PRIVATE LOCATION', difficulty: 'balanced', ratings: Object.fromEntries(REVIEW_CATEGORIES.map(category => [category, { score: 7, reason: 'PRIVATE observation' }])) as PlayerReview['ratings'], findings: [{ category: 'puzzles', severity: 'medium', location: 'PRIVATE LOCATION', observed: 'PRIVATE observation', expected: 'PRIVATE expectation', suggestion: 'PRIVATE suggestion' }] };
}
test('player review has exactly four quality scores; unavailable observations must not fabricate ratings', () => {
  assert.equal(PLAYTEST_LIMIT_MS, 900000);
  assert.equal(validatePlayerReview(review()).ratings.difficulty.score, 7);
  const missing = review(); delete (missing.ratings as Partial<PlayerReview['ratings']>).ui;
  assert.throws(() => validatePlayerReview(missing), /four/);
  for (const score of [0, 11, 1.5, '8']) { const invalid = review(); (invalid.ratings.story as { score: unknown }).score = score; assert.throws(() => validatePlayerReview(invalid), /rating/); }
  const unknown = review(); unknown.ratings.story.score = null; assert.equal(validatePlayerReview(unknown).ratings.story.score, null);
  const invalid = review(); invalid.findings[0].location = ''; assert.throws(() => validatePlayerReview(invalid), /findings/);
});
test('fifteen-minute deadline always reports partial timeout, never gates deployment or leaks private findings', () => {
  const run = { startedAt: 1000, deadline: 901000, release: 'manifest-sha256', status: 'completed' as const };
  assert.equal(playtestResult(run, review(), 900999).coverage, 'current_content_exhausted');
  assert.notEqual(playtestResult(run, review(), 301000).status, 'timed_out');
  assert.notEqual(playtestResult(run, review(), 601000).status, 'timed_out');
  const expired = playtestResult(run, review(), 901000);
  assert.equal(expired.status, 'timed_out'); assert.equal(expired.coverage, 'partial_or_unverified'); assert.equal(expired.nonBlocking, true);
  assert.match(expired.message, /15 perces/); assert.equal(expired.limitSeconds, 900); assert.equal(expired.stopReason, 'time_limit'); assert.equal(expired.storyFinished, false); assert.doesNotMatch(JSON.stringify(expired), /PRIVATE|suggestion|reason|LOCATION/);
  assert.equal(playtestResult({ ...run, status: 'timed_out' }, review(), 2000).status, 'timed_out');
  assert.equal(playtestResult({ ...run, status: 'blocked' }, undefined, 2000).ratings.story, null);
  assert.throws(() => playtestResult({ ...run, deadline: 601000 }, review()), /Fifteen-minute/);
});
test('no-progress stops distinguish unfinished puzzles from the current content boundary, never a story ending', () => {
  const run = { startedAt: 1000, deadline: 901000, release: 'manifest-sha256', status: 'completed' as const };
  const complete = playtestResult(run, validatePlayerReview(review()), 10000);
  assert.equal(complete.storyFinished, false); assert.match(complete.message, /nem a történet vége/);
  for (const stopReason of ['stuck', 'technical_block', 'uncertain', 'time_limit'] as const) {
    const report = { ...review(), stopReason };
    assert.throws(() => validatePlayerReview(report), /distinguish/);
    report.status = stopReason === 'technical_block' ? 'blocked' : 'incomplete';
    const stopped = playtestResult({ ...run, status: report.status }, validatePlayerReview(report), 10000);
    assert.equal(stopped.coverage, 'partial_or_unverified'); assert.equal(stopped.storyFinished, false); assert.equal(stopped.stopReason, stopReason);
  }
});
test('player profile is blind, bounded and advisory; release workflow invokes it after success only', () => {
  const agent = readFileSync('.opencode/agents/nullpont-player-reviewer.md', 'utf8');
  assert.match(agent, /mode: subagent/); assert.match(agent, /action: "\*"[\s\S]*?effect: deny/);
  assert.match(agent, /^steps: 50000$/m);
  for (const input of ['action.json', 'review.json']) assert.ok(agent.includes(`resource: ".runtime/nullpont-player-review/${input}"`), 'direct relative write allowance');
  for (const word of ['900-second', 'story', 'puzzles', 'difficulty', 'non-blocking', 'private storyboard', 'never silently implement', 'NO real story ending', 'cannot make further progress', 'content_exhausted', 'stuck']) assert.ok(agent.toLowerCase().includes(word.toLowerCase()), word);
  const instructions = readFileSync('apps/nullpont/AGENTS.md', 'utf8');
  assert.match(instructions, /nullpont-player-reviewer/); assert.match(instructions, /not a deployment gate/);
  const runner = readFileSync('scripts/Nullpont-Player-Review.mjs', 'utf8');
  assert.match(runner, /setTimeout\([\s\S]*?PLAYTEST_LIMIT_MS\)/);
  assert.match(runner, /data\/nullpont.sqlite/); assert.match(runner, /player-review@example.test/);
  assert.doesNotMatch(runner, /Stop-Service|Start-Service|adventure_saves.*SELECT|lib\/game\/catalog/);
  assert.match(runner, /if \(!session\.live\) throw Error\(session\.message\)/);
  assert.match(runner, /kind === 'finish' && existsSync\(file\('public\.json'\)\)/, 'a summary is only attached to a finished report');
  assert.match(runner, /sessionId: run\.id, release: run\.release, status: 'running'/, 'observations identify their own session and release');
  assert.match(runner, /function writeClosed/, 'closure marks the observation as no longer live');
  assert.match(runner, /fullPage: false/, 'screenshots stay viewport-sized as the journal grows');
  assert.match(agent, /instead of calling\s+`observe` again/, 'successful actions already return observations');
  assert.match(runner, /const name of \['review\.json'[\s\S]*?'observation\.json', 'screen\.png'\]/, 'previous observations and screenshots are archived when a new session starts');
  assert.ok(agent.includes('no live playtest session'), 'the reviewer must report the missing live session');
  assert.ok(agent.includes('sessionId'), 'the reviewer can verify the session and release');
  const guide = readFileSync('docs/nullpont-player-review.md', 'utf8').replace(/\s+/g, ' ');
  for (const phrase of ['archives every file of the previous session', 'refuse** without a live session', 'zeroed counter', 'within fifteen minutes']) assert.ok(guide.includes(phrase), phrase);
});
test('an expired or older session is never served as live play, and only the session that just ended may be reported', () => {
  const startedAt = 1000000, deadline = startedAt + PLAYTEST_LIMIT_MS, release = 'manifest-sha256';
  const live = playtestSession({ id: 'run-a', release, status: 'running', startedAt, deadline }, startedAt + 1000);
  assert.equal(live.live, true); assert.equal(live.status, 'running'); assert.equal(live.remainingSeconds, 899); assert.equal(live.lateReportAllowed, false);
  assert.equal(playtestSession({ status: 'running', startedAt, deadline }, startedAt + 600000).remainingSeconds, 300);
  const expired = playtestSession({ id: 'run-a', release, status: 'running', startedAt, deadline }, deadline + 1000);
  assert.equal(expired.live, false); assert.equal(expired.status, 'timed_out'); assert.equal(expired.remainingSeconds, 0); assert.match(expired.message, /lejárt/);
  const justEnded = playtestSession({ id: 'run-a', release, status: 'timed_out', startedAt, deadline, endedAt: deadline }, deadline + 1000);
  assert.equal(justEnded.live, false); assert.equal(justEnded.lateReportAllowed, true);
  const older = playtestSession({ id: 'run-b', release, status: 'completed', startedAt, deadline, endedAt: deadline }, deadline + PLAYTEST_REPORT_GRACE_MS + 1);
  assert.equal(older.live, false); assert.equal(older.lateReportAllowed, false); assert.match(older.message, /nem használható fel újra/);
  for (const missing of [undefined, {}, { status: 'running' }, { status: 'running', startedAt, deadline: deadline + 1 }, { id: 'run-c', status: 'blocked', startedAt: 'x', deadline }]) {
    const session = playtestSession(missing, startedAt);
    assert.equal(session.live, false); assert.equal(session.status, 'none'); assert.equal(session.lateReportAllowed, false); assert.match(session.message, /Nincs aktív játékpróba/);
  }
  const starting = playtestSession({ status: 'starting', startedAt: 0, deadline: 0 }, startedAt);
  assert.equal(starting.live, false); assert.equal(starting.status, 'starting'); assert.match(starting.message, /még indul/);
  const blocked = playtestSession({ id: 'run-d', release, status: 'blocked', startedAt, deadline, endedAt: deadline + 5000 }, deadline + 6000);
  assert.equal(blocked.live, false); assert.equal(blocked.status, 'blocked'); assert.equal(blocked.lateReportAllowed, true);
});
