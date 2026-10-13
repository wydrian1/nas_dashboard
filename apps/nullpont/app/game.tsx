'use client';
import { useRef, useState } from 'react';
import type { GameView } from '@/lib/game/view';
import type { PlayerCommand, Target } from '@/lib/game/types';
import { play } from './actions';
const VERBS: { id: PlayerCommand['verb']; label: string }[] = [{ id: 'look', label: 'Megvizsgálom' }, { id: 'take', label: 'Felveszem' }, { id: 'use', label: 'Használom' }, { id: 'combine', label: 'Kombinálom' }, { id: 'talk', label: 'Beszélek' }, { id: 'attack', label: 'Megtámadom' }];
export default function Game({ initialGame }: { initialGame: GameView }) {
  const [game, setGame] = useState(initialGame), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const [item, setItem] = useState<string | null>(null), [target, setTarget] = useState<Target | null>(null), [verb, setVerb] = useState<PlayerCommand['verb']>('look'), [topic, setTopic] = useState('');
  const lock = useRef(false);
  const source = game.inventory.find(entry => entry.id === item);
  const destination = target?.kind === 'item' ? game.inventory.find(entry => entry.id === target.id) : target?.kind === 'environment' ? game.environment.find(entry => entry.id === target.id) : undefined;
  const topics = game.topics.filter(entry => entry.target === target?.id);
  const chosenTopic = topics.some(entry => entry.id === topic) ? topic : '';
  async function send(command: PlayerCommand) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setNotice('');
    try {
      const result = await play(game.revision, command);
      if (result.game) {
        setGame(result.game);
        if (result.conflict || result.game.scene.id !== game.scene.id) { setItem(null); setTarget(null); setTopic(''); }
        else {
          if (item && !result.game.inventory.some(entry => entry.id === item)) setItem(null);
          if (target && !(target.kind === 'item' ? result.game.inventory : result.game.environment).some(entry => entry.id === target.id)) setTarget(null);
        }
      }
      setNotice(result.error || (result.conflict ? 'Másik böngészőfülben továbbhaladtál. A friss mentést betöltöttük; válassz újra.' : ''));
    } catch { setNotice('A kapcsolat megszakadt. Újratöltéssel ellenőrizheted a szerveren elfogadott állapotot.'); }
    finally { lock.current = false; setBusy(false); }
  }
  function execute() {
    if (['take', 'use', 'combine', 'talk', 'attack'].includes(verb) && !destination) { setNotice('Válassz célpontot a környezetből vagy a felszerelésből.'); return; }
    if (['use', 'combine'].includes(verb) && !source) { setNotice('Előbb jelölj ki egy nálad lévő tárgyat.'); return; }
    const actionTarget = destination && target ? target : verb === 'look' && source ? { kind: 'item' as const, id: source.id } : undefined;
    void send({ verb, ...(actionTarget ? { target: actionTarget } : {}), ...(['use', 'combine'].includes(verb) && source ? { item: source.id } : {}), ...(verb === 'talk' && chosenTopic ? { topic: chosenTopic } : {}) });
  }
  return <div className="game-grid">
    <section className="scene panel"><div className="scene-heading"><h2>{game.scene.title}</h2><span role="status">{busy ? 'Mentés…' : `Mentve · ${game.turns}. lépés`}</span></div><pre role="img" aria-label={game.scene.description}><code>{game.scene.art}</code></pre><div className="story" aria-live="polite" aria-atomic="true"><p>{game.message}</p></div>{notice && <p className="notice" role="alert">{notice}</p>}</section>
    <section className="movement panel" aria-label="Mozgás"><h2>Mozgás</h2>{game.exits.length ? <div className="choices">{game.exits.map(exit => <button key={exit.id} disabled={busy} onClick={() => void send({ verb: 'move', target: { kind: 'exit', id: exit.id } })}>{exit.label}</button>)}</div> : <p>Még nem tájékozódtál.</p>}<button className="quiet" disabled={busy} onClick={() => void send({ verb: 'look' })}>Körülnézek</button></section>
    <section className="actions panel" aria-label="Akció"><h2>Akció</h2><div className="verbs">{VERBS.map(entry => <button key={entry.id} disabled={busy} aria-pressed={verb === entry.id} onClick={() => { setVerb(entry.id); setNotice(''); }}>{entry.label}</button>)}</div><p className="selection"><span>Tárgy: <strong>{source?.label || '—'}</strong></span><span>Célpont: <strong>{destination?.label || '—'}</strong></span></p>{verb === 'talk' && topics.length > 0 && <label>Téma<select disabled={busy} value={chosenTopic} onChange={event => setTopic(event.target.value)}><option value="">Megszólítás</option>{topics.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label>}<div className="execute"><button disabled={busy} onClick={execute}>Végrehajtás</button><button className="quiet" disabled={busy} onClick={() => { setItem(null); setTarget(null); setTopic(''); }}>Kijelölés törlése</button></div></section>
    <section className="environment panel" aria-label="Környezet"><h2>Környezet</h2><small>Amit eddig észrevettél.</small>{game.environment.length ? <div className="choices">{game.environment.map(entry => <button key={entry.id} disabled={busy} aria-pressed={target?.kind === 'environment' && target.id === entry.id} onClick={() => { setTarget({ kind: 'environment', id: entry.id }); setTopic(''); }}>{entry.label}</button>)}</div> : <p>A részletek még elvesznek a félhomályban.</p>}</section>
    <section className="inventory panel" aria-label="Inventory"><h2>Inventory</h2><small>Egy tárgy, majd környezet vagy másik tárgy.</small>{game.inventory.length ? <div className="choices">{game.inventory.map(entry => <button key={entry.id} disabled={busy} aria-pressed={item === entry.id || target?.kind === 'item' && target.id === entry.id} data-selection={item === entry.id ? 'source' : target?.kind === 'item' && target.id === entry.id ? 'target' : undefined} onClick={() => { if (!source || source.id === entry.id) { setItem(source?.id === entry.id ? null : entry.id); setTarget(null); } else setTarget({ kind: 'item', id: entry.id }); }}>{entry.label}{item === entry.id && <small>kijelölt tárgy</small>}{target?.kind === 'item' && target.id === entry.id && <small>célpont</small>}</button>)}</div> : <p>A zsebeid üresek.</p>}</section>
    <section className="notebook panel"><details><summary>Emléktöredékek <small>{game.journal.length}</small></summary><ol>{game.journal.map(entry => <li key={entry}>{entry}</li>)}</ol></details></section>
    <section className="book panel" aria-label="Történetkönyv"><details><summary>Történetkönyv <small>{game.book.length} emléklap</small></summary><div>{game.book.map((entry, index) => <article key={entry.id}><span className="eyebrow">{entry.chapter} · {index + 1}. emléklap</span><h2>{entry.title}</h2><p>{entry.text}</p></article>)}</div></details></section>
  </div>;
}
