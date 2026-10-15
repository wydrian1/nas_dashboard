import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PLAYTEST_LIMIT_MS, REVIEW_CATEGORIES, validatePlayerReview, playtestResult, type PlayerReview } from '../lib/nullpont-player-review.ts';

function review(): PlayerReview {
  return { status: 'completed', stopReason: 'content_exhausted', reached: 'PRIVATE LOCATION', difficulty: 'balanced', ratings: Object.fromEntries(REVIEW_CATEGORIES.map(category => [category, { score: 7, reason: 'PRIVATE observation' }])) as PlayerReview['ratings'], findings: [{ category: 'puzzles', severity: 'medium', location: 'PRIVATE LOCATION', observed: 'PRIVATE observation', expected: 'PRIVATE expectation', suggestion: 'PRIVATE suggestion' }] };
}
test('player review has exactly four quality scores; unavailable observations must not fabricate ratings', () => {
  assert.equal(PLAYTEST_LIMIT_MS, 600000);
  assert.equal(validatePlayerReview(review()).ratings.difficulty.score, 7);
  const missing = review(); delete (missing.ratings as Partial<PlayerReview['ratings']>).ui;
  assert.throws(() => validatePlayerReview(missing), /four/);
  for (const score of [0, 11, 1.5, '8']) { const invalid = review(); (invalid.ratings.story as { score: unknown }).score = score; assert.throws(() => validatePlayerReview(invalid), /rating/); }
  const unknown = review(); unknown.ratings.story.score = null; assert.equal(validatePlayerReview(unknown).ratings.story.score, null);
  const invalid = review(); invalid.findings[0].location = ''; assert.throws(() => validatePlayerReview(invalid), /findings/);
});
test('ten-minute deadline always reports partial timeout, never gates deployment or leaks private findings', () => {
  const run = { startedAt: 1000, deadline: 601000, release: 'manifest-sha256', status: 'completed' as const };
  assert.equal(playtestResult(run, review(), 600999).coverage, 'current_content_exhausted');
  assert.notEqual(playtestResult(run, review(), 301000).status, 'timed_out');
  const expired = playtestResult(run, review(), 601000);
  assert.equal(expired.status, 'timed_out'); assert.equal(expired.coverage, 'partial_or_unverified'); assert.equal(expired.nonBlocking, true);
  assert.match(expired.message, /10 perces/); assert.equal(expired.limitSeconds, 600); assert.equal(expired.stopReason, 'time_limit'); assert.equal(expired.storyFinished, false); assert.doesNotMatch(JSON.stringify(expired), /PRIVATE|suggestion|reason|LOCATION/);
  assert.equal(playtestResult({ ...run, status: 'timed_out' }, review(), 2000).status, 'timed_out');
  assert.equal(playtestResult({ ...run, status: 'blocked' }, undefined, 2000).ratings.story, null);
  assert.throws(() => playtestResult({ ...run, deadline: 301000 }, review()), /Ten-minute/);
});
test('no-progress stops distinguish unfinished puzzles from the current content boundary, never a story ending', () => {
  const run = { startedAt: 1000, deadline: 601000, release: 'manifest-sha256', status: 'completed' as const };
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
  for (const input of ['action.json', 'review.json']) assert.ok(agent.includes(`resource: ".runtime/nullpont-player-review/${input}"`), 'direct relative write allowance');
  for (const word of ['600-second', 'story', 'puzzles', 'difficulty', 'non-blocking', 'private storyboard', 'never silently implement', 'NO real story ending', 'cannot make further progress', 'content_exhausted', 'stuck']) assert.ok(agent.toLowerCase().includes(word.toLowerCase()), word);
  const instructions = readFileSync('apps/nullpont/AGENTS.md', 'utf8');
  assert.match(instructions, /nullpont-player-reviewer/); assert.match(instructions, /not a deployment gate/);
  const runner = readFileSync('scripts/Nullpont-Player-Review.mjs', 'utf8');
  assert.match(runner, /setTimeout\([\s\S]*?PLAYTEST_LIMIT_MS\)/);
  assert.match(runner, /data\/nullpont.sqlite/); assert.match(runner, /player-review@example.test/);
  assert.doesNotMatch(runner, /Stop-Service|Start-Service|adventure_saves.*SELECT|lib\/game\/catalog/);
});
