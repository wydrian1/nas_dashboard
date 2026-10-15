// Operator-only, isolated, blind UI playtest. Never a release gate.
import { mkdirSync, readFileSync, writeFileSync, existsSync, lstatSync, cpSync, mkdtempSync, symlinkSync, unlinkSync, rmSync, renameSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { DatabaseSync } from 'node:sqlite';
import { chromium } from 'playwright';
import { initializeDatabase } from '../apps/nullpont/lib/schema.ts';
import { sessionToken } from '../apps/nullpont/lib/session.ts';
import { PLAYTEST_LIMIT_MS, playtestResult, validatePlayerReview } from '../lib/nullpont-player-review.ts';

const root = process.cwd(), folder = join(root, '.runtime/nullpont-player-review');
const command = process.argv[2];
if (process.argv.length !== 3 || !['start', 'observe', 'act', 'finish', 'smoke'].includes(command)) throw Error('Use start|observe|act|finish|smoke without extra arguments');
mkdirSync(folder, { recursive: true });
function safe(path) {
  for (let cursor = resolve(path); cursor !== resolve(root, '..'); cursor = resolve(cursor, '..')) {
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) throw Error('Linked review path rejected');
    if (cursor === resolve(root)) break;
  }
  if (existsSync(path) && !lstatSync(path).isDirectory() && lstatSync(path).nlink !== 1) throw Error('Hardlinked review file rejected');
}
const file = name => join(folder, name);
function read(name) { const path = file(name); safe(path); if (lstatSync(path).size > 128 * 1024) throw Error('Oversized review input'); return JSON.parse(readFileSync(path, 'utf8')); }
function write(name, value) { const path = file(name); safe(path); const temp = path + '.' + randomUUID() + '.tmp'; writeFileSync(temp, JSON.stringify(value, null, 2), { flag: 'wx' }); renameSync(temp, path); }
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

async function request(kind, action) {
  const id = randomUUID(); write('request.json', { id, kind, action });
  const end = performance.now() + 20000;
  while (performance.now() < end) {
    if (existsSync(file('response.json'))) { const response = read('response.json'); if (response.id === id) { if (response.error) throw Error(response.error); return response.value; } }
    if (existsSync(file('active.json')) && read('active.json').status !== 'running') return { ...read('active.json'), ...(existsSync(file('public.json')) ? { summary: read('public.json') } : {}) };
    await delay(100);
  }
  throw Error('Review fixture unavailable (20-second control timeout)');
}

async function run(smoke) {
  if (existsSync(file('active.json')) && ['starting', 'running'].includes(read('active.json').status)) throw Error('A playtest is already active; never extend or restart its timer');
  const installed = 'D:/!nullpont';
  const manifestBytes = readFileSync(join(installed, 'release-manifest.json'));
  const manifest = JSON.parse(manifestBytes);
  if (manifest.application !== 'nullpont' || !Object.values(manifest.checks).every(value => value === true)) throw Error('Verified installed NULLPONT release required');
  for (const entry of manifest.files) {
    if (!entry.path || /[\\:]|(?:^|\/)\.\.(?:\/|$)/.test(entry.path) || entry.path.startsWith('/') || /^(?:data|service|logs|node_modules|\.env\.local)(?:\/|$)/.test(entry.path)) throw Error('Unsafe installed manifest path');
    const path = join(installed, entry.path), stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size !== entry.size || hash(readFileSync(path)) !== entry.sha256) throw Error('Installed release bytes differ from manifest');
  }
  if (hash(readFileSync(join(installed, 'package-lock.json'))) !== hash(readFileSync(join(root, 'apps/nullpont/package-lock.json')))) throw Error('Playtest dependencies do not match release');
  const id = randomUUID(), release = hash(manifestBytes);
  let run = { id, release, status: 'starting', startedAt: 0, deadline: 0 };
  write('active.json', run);
  for (const name of ['review.json', 'action.json', 'request.json', 'response.json', 'public.json']) if (existsSync(file(name))) { safe(file(name)); renameSync(file(name), file(`${id}-previous-${name}`)); }
  const base = join(tmpdir(), 'opencode'); mkdirSync(base, { recursive: true });
  const fixture = mkdtempSync(join(base, 'nullpont-player-'));
  let server, browser, context, page, timer, controls = [], done = false, processed;
  const secret = randomBytes(32).toString('base64url');
  function publish(status, review) {
    run = { ...run, status }; write('active.json', run);
    const summary = playtestResult(run, review);
    write('public.json', summary); write(`${id}-public.json`, summary);
    if (review) write(`${id}-developer.json`, { run, review });
    return summary;
  }
  try {
    cpSync(join(installed, '.next'), join(fixture, '.next'), { recursive: true, filter: path => !path.includes(join('.next', 'cache')) && !lstatSync(path).isSymbolicLink() });
    symlinkSync(join(root, 'apps/nullpont/node_modules'), join(fixture, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    const config = JSON.parse(readFileSync(join(installed, '.next/required-server-files.json'))).config;
    if (config.basePath !== '/nullpont') throw Error('Unexpected installed basePath');
    writeFileSync(join(fixture, 'package.json'), '{"type":"module"}');
    writeFileSync(join(fixture, 'next.config.mjs'), 'export default {distDir:".next",basePath:"/nullpont"}');
    mkdirSync(join(fixture, 'data'));
    const db = new DatabaseSync(join(fixture, 'data/nullpont.sqlite'));
    try { initializeDatabase(db); db.prepare('INSERT INTO players VALUES(?,1)').run('player-review@example.test'); } finally { db.close(); }
    const socket = createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve)); const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
    const origin = `http://127.0.0.1:${port}`, url = origin + '/nullpont';
    const env = Object.fromEntries(['SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'PATH', 'HOME', 'USERPROFILE'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
    Object.assign(env, { AUTH_URL: url, AUTH_SECRET: secret, NULLPONT_DATA_DIR: join(fixture, 'data'), NULLPONT_ALLOWED_EMAILS: '', NULLPONT_DASHBOARD_URL: origin, NULLPONT_SSO_SECRET: randomBytes(32).toString('hex'), NEXT_TELEMETRY_DISABLED: '1' });
    server = spawn(process.execPath, [join(root, 'apps/nullpont/node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: fixture, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error('Fixture startup exceeded 30 seconds')), 30000);
      server.once('exit', () => { clearTimeout(timeout); reject(Error('Fixture failed to start')); });
      let output = ''; server.stdout.on('data', chunk => { output += chunk; if (output.includes('Ready in')) { clearTimeout(timeout); resolve(); } });
      server.stderr.resume();
    });
    browser = await chromium.launch({ headless: true }); context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
    await context.addCookies([{ name: 'nullpont.session-token', value: sessionToken('player-review@example.test', secret), url }]);
    page = await context.newPage(); page.setDefaultTimeout(4000); await page.goto(url, { timeout: 15000 }); await page.locator('.game-grid').waitFor();
    const started = performance.now(); run = { ...run, status: 'running', startedAt: Date.now(), deadline: Date.now() + PLAYTEST_LIMIT_MS }; run.deadline = run.startedAt + PLAYTEST_LIMIT_MS;
    write('active.json', run);
    timer = setTimeout(() => { if (!done) { done = true; publish('timed_out'); void context.close().catch(() => {}); console.log(JSON.stringify({ nonBlocking: true, status: 'timed_out', message: 'Az 5 perces keret lejárt; a teljes végigjátszás nem sikerült.' })); } }, PLAYTEST_LIMIT_MS);
    async function snapshot() {
      // Only visible rendered text and labels; no game catalog, state, DOM attributes
      // holding internal IDs, network payloads, hidden controls or JS evaluation.
      controls = []; const visible = [];
      for (const locator of await page.locator('button, input, summary').all()) {
        if (!await locator.isVisible() || await locator.isDisabled()) continue;
        const label = await locator.getAttribute('aria-label') || await locator.getAttribute('title') || await locator.innerText() || await locator.getAttribute('placeholder') || 'Szövegmező';
        controls.push(locator); visible.push({ control: controls.length - 1, label, input: await locator.evaluate(element => element.tagName === 'INPUT') });
      }
      safe(file('screen.png')); await page.screenshot({ path: file('screen.png'), fullPage: true, timeout: 4000 });
      return { remainingSeconds: Math.max(0, Math.ceil((PLAYTEST_LIMIT_MS - (performance.now() - started)) / 1000)), text: (await page.locator('body').innerText()).slice(0, 24000), sceneDescription: await page.locator('.ascii-canvas').getAttribute('aria-label'), controls: visible };
    }
    const first = await snapshot(); write('observation.json', first);
    console.log(JSON.stringify({ ready: true, release, deadline: run.deadline, nonBlocking: true, isolatedSyntheticAccount: true }));
    if (smoke) {
      if (!first.controls.length || !first.text.includes('NULLPONT')) throw Error('Blind fixture smoke failed');
      done = true; publish('incomplete'); console.log(JSON.stringify({ smokePassed: true, productionUntouched: true, ratingsNotFabricated: true }));
    }
    while (!done) {
      if (performance.now() - started >= PLAYTEST_LIMIT_MS) { done = true; publish('timed_out'); break; }
      if (!existsSync(file('request.json'))) { await delay(80); continue; }
      const request = read('request.json'); if (request.id === processed) { await delay(80); continue; } processed = request.id;
      try {
        let value;
        if (request.kind === 'finish') { const review = validatePlayerReview(read('review.json')); done = true; value = publish(review.status, review); }
        else if (request.kind === 'observe') value = await snapshot();
        else if (request.kind === 'act') {
          const action = request.action;
          if (!action || !['click', 'hover', 'fill'].includes(action.kind) || !Number.isSafeInteger(action.control) || !controls[action.control]) throw Error('Use a current visible control index');
          const target = controls[action.control];
          if (action.kind === 'fill') { if (typeof action.value !== 'string' || action.value.length > 80) throw Error('Input too long'); await target.fill(action.value); }
          else await target[action.kind]();
          await page.locator('.game-grid[aria-busy="false"]').waitFor(); value = await snapshot();
        } else throw Error('Unknown playtest operation');
        if (!done && performance.now() - started >= PLAYTEST_LIMIT_MS) { done = true; value = publish('timed_out'); }
        write('response.json', { id: request.id, value });
        if (!done) write('observation.json', value);
      } catch { write('response.json', { id: request.id, error: done ? 'Five-minute gameplay deadline reached' : 'Visible UI action failed; observe again and report if blocked' }); }
    }
  } catch {
    if (!run.startedAt) run = { ...run, startedAt: Date.now(), deadline: Date.now() + PLAYTEST_LIMIT_MS };
    run.deadline = run.startedAt + PLAYTEST_LIMIT_MS; publish('blocked');
    console.log(JSON.stringify({ status: 'blocked', nonBlocking: true, message: 'Az elkülönített játékpróba nem indítható vagy megszakadt; nem élesítési hiba.' }));
    process.exitCode = 1;
  } finally {
    clearTimeout(timer); if (browser) await browser.close().catch(() => {});
    if (server && server.exitCode === null) { server.kill(); await Promise.race([new Promise(resolve => server.once('exit', resolve)), delay(5000)]); }
    // Only our freshly created fixture, never the installation or its data.
    if (existsSync(join(fixture, 'node_modules'))) unlinkSync(join(fixture, 'node_modules'));
    rmSync(fixture, { recursive: true, force: true });
  }
}

if (command === 'start' || command === 'smoke') await run(command === 'smoke');
else if (command === 'finish') {
  const review = validatePlayerReview(read('review.json')), active = read('active.json');
  if (active.status === 'running') console.log(JSON.stringify(await request('finish')));
  else { const summary = playtestResult(active, review); write('public.json', summary); write(`${active.id}-public.json`, summary); write(`${active.id}-developer.json`, { run: active, review }); console.log(JSON.stringify(summary)); }
} else console.log(JSON.stringify(await request(command, command === 'act' ? read('action.json') : undefined)));
