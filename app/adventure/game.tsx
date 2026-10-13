'use client';

import { useRef, useState } from 'react';
import { availableActions, ITEM_NAMES, SCENES, type GameAction } from '@/lib/adventure/engine';
import type { SavedGame } from '@/lib/adventure/store';
import { playAdventure } from './actions';

function ChoiceForm({ title, actions, busy, play }: { title: string; actions: GameAction[]; busy: boolean; play: (id: string) => Promise<void> }) {
  const [selected, setSelected] = useState('');
  const value = actions.some(action => action.id === selected) ? selected : actions[0]?.id ?? '';
  if (!actions.length) return null;
  return <form className="adventure-choice" onSubmit={event => { event.preventDefault(); void play(value); }}>
    <label>{title}<select value={value} disabled={busy} onChange={event => setSelected(event.target.value)}>{actions.map(action => <option key={action.id} value={action.id}>{action.label}</option>)}</select></label>
    <button type="submit" disabled={busy}>Végrehajtom</button>
  </form>;
}
export default function AdventureGame({ initialGame }: { initialGame: SavedGame }) {
  const [game, setGame] = useState(initialGame);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const inFlight = useRef(false);
  const actions = availableActions(game.state);
  const scene = SCENES[game.state.room];
  async function play(id: string) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setNotice('');
    try {
      const result = await playAdventure(game.revision, id);
      if (result.game) setGame(result.game);
      setNotice(result.error ?? (result.conflict ? 'Egy másik böngészőfülben már továbbhaladtál. Betöltöttük a legújabb mentést; válassz újra.' : ''));
    } catch { setNotice('A kapcsolat megszakadt. Töltsd újra az oldalt a biztos mentési állapothoz; a szerveren elfogadott lépés megmarad.'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <div className="adventure-layout">
    <section className="adventure-scene" aria-label="Játéktér">
      <div className="adventure-scene-heading"><h2>{scene.title}</h2><span role="status">{busy ? 'Mentés folyamatban…' : `✓ Szerverre mentve · ${game.state.turns}. lépés`}</span></div>
      <pre className="adventure-art" role="img" aria-label={scene.description}><code>{scene.art}</code></pre>
      <div className="adventure-story" aria-live="polite" aria-atomic="true"><p>{game.state.message}</p></div>
      {notice && <p className="adventure-notice" role="alert">{notice}</p>}
      <section className="adventure-controls" aria-label="Műveletek" aria-busy={busy}>
        <h3>Mit teszel?</h3>
        <div className="adventure-buttons">{actions.filter(action => !['use', 'combine'].includes(action.kind)).map(action => <button key={action.id} type="button" disabled={busy} onClick={() => void play(action.id)}>{action.label}</button>)}</div>
        <ChoiceForm title="Tárgy használata / célpont" actions={actions.filter(action => action.kind === 'use')} busy={busy} play={play}/>
        <ChoiceForm title="Tárgyak kombinálása" actions={actions.filter(action => action.kind === 'combine')} busy={busy} play={play}/>
        <p className="adventure-hint">Vizsgálódj, beszélgess, kísérletezz. A sikertelen próbák nem fogyasztják el a tárgyaidat. Minden lépés automatikusan mentődik a fiókodhoz.</p>
      </section>
    </section>
    <aside className="adventure-notebook" aria-label="Felszerelés és feljegyzések">
      <section><h2>Felszerelés</h2>{game.state.inventory.length ? <ul>{game.state.inventory.map(item => <li key={item}>{ITEM_NAMES[item]}</li>)}</ul> : <p>A zsebeid üresek.</p>}</section>
      <section><h2>Emléktöredékek</h2><ol>{game.state.journal.map(note => <li key={note}>{note}</li>)}</ol></section>
      <p className="adventure-hint">Nyitott történet · Az ébredés<br/>Új fejezetekkel folytatható. A folyosó utáni történet még készül.</p>
    </aside>
    <section className="adventure-book" aria-label="Történetkönyv">
      <details><summary><span>Történetkönyv</span><small>{game.state.book.length} emléklap · a fontos mérföldkövek után magától íródik</small></summary>
        <div className="adventure-book-pages">{game.state.book.map((entry, index) => <article key={entry.id}><span className="eyebrow">{entry.chapter} · {index + 1}. emléklap</span><h2>{entry.title}</h2><p>{entry.text}</p></article>)}</div>
      </details>
    </section>
  </div>;
}
