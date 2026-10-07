import { logout } from "./actions";
import type { Role } from '@/lib/users';
import {WEB_VERSION} from '@/lib/mobile/release';

export default function DashboardSidebar({name,active='overview',unread,role='admin',openCode=false}:{name?:string|null;active?:'overview'|'pokemon'|'news'|'config'|'notes'|'finance'|'collections'|'opencode'|'important-info';unread?:number;role?:Role;openCode?:boolean}) {
  return <aside className="sidebar">
    <a className="brand" href="/"><img className="brand-mark small" src="/brand-w-modules.svg" alt="" width="41" height="41"/><span>wydrian<span className="brand-sub">PERSONAL SPACE</span></span></a>
    <div className="nav-label">MUNKATERÜLET</div>
    <nav>
      {role==='admin' && <><a className={active==='overview' ? 'active' : undefined} aria-current={active==='overview' ? 'page' : undefined} href="/">▦ <span>Dashboard</span></a>
      <a className={active==='news' ? 'active' : undefined} aria-current={active==='news' ? 'page' : undefined} href="/news">☷ <span>Hírolvasó</span>{unread!==undefined && <b>{unread}</b>}</a>
       <a className={active==='finance' ? 'active' : undefined} aria-current={active==='finance' ? 'page' : undefined} href="/finance">◈ <span>Pénzügy</span></a>
       <a className={active==='collections' ? 'active' : undefined} aria-current={active==='collections' ? 'page' : undefined} href="/collections">▧ <span>Gyűjtemények</span></a>
      <a className={active==='notes' ? 'active' : undefined} aria-current={active==='notes' ? 'page' : undefined} href="/notes">✓ <span>Jegyzetek / teendők</span></a></>}
      {role!=='info-reader' && <a className={active==='pokemon' ? 'active' : undefined} aria-current={active==='pokemon' ? 'page' : undefined} href="/pokemon">◉ <span>Pokémon figyelő</span></a>}
      {role!=='pokemon-reader' && <a className={active==='important-info' ? 'active' : undefined} aria-current={active==='important-info' ? 'page' : undefined} href="/important-info">ⓘ <span>Fontos infók</span></a>}
      {role==='admin' && openCode && <a className={active==='opencode' ? 'active' : undefined} aria-current={active==='opencode' ? 'page' : undefined} href="/opencode">⌘ <span>OpenCode</span></a>}
      {role==='admin' && <a className={active==='config' ? 'active' : undefined} aria-current={active==='config' ? 'page' : undefined} href="/config">⚙ <span>Konfig</span></a>}
    </nav>
    <span className="version-label" aria-label="Dashboard verzió">Web v{WEB_VERSION}</span>
    <div className="sidebar-bottom"><div className="avatar">W</div><div className="user-info"><strong>{name || 'Wydrian'}</strong><span>Privát dashboard</span></div><form action={logout}><button className="logout" title="Kijelentkezés" aria-label="Kijelentkezés">↪</button></form></div>
  </aside>;
}
