import { logout } from "./actions";
import type { Role } from '@/lib/users';
import {WEB_VERSION} from '@/lib/mobile/release';

export default function DashboardSidebar({name,active='overview',unread,role='admin',openCode=false}:{name?:string|null;active?:'overview'|'pokemon'|'news'|'config'|'notes'|'finance'|'collections'|'files'|'opencode'|'important-info'|'search'|'system'|'notifications'|'adventure';unread?:number;role?:Role;openCode?:boolean}) {
  return <aside className="sidebar">
    <a className="brand" href="/"><img className="brand-mark small" src="/brand-w-modules.svg" alt="" width="41" height="41"/><span>Wydrian<span className="brand-sub">DASHBOARD</span></span></a>
    <div className="nav-label">MUNKATERÜLET</div>
    <nav>
      {role==='admin' && <><a className={active==='overview' ? 'active' : undefined} aria-current={active==='overview' ? 'page' : undefined} href="/"><span className="nav-icon" aria-hidden="true">▦</span><span className="nav-text">Dashboard</span></a>
      <a className={active==='news' ? 'active' : undefined} aria-current={active==='news' ? 'page' : undefined} href="/news"><span className="nav-icon" aria-hidden="true">☷</span><span className="nav-text">Hírolvasó</span>{unread!==undefined && <b>{unread}</b>}</a>
       <a className={active==='finance' ? 'active' : undefined} aria-current={active==='finance' ? 'page' : undefined} href="/finance"><span className="nav-icon" aria-hidden="true">◈</span><span className="nav-text">Pénzügy</span></a>
       <a className={active==='collections' ? 'active' : undefined} aria-current={active==='collections' ? 'page' : undefined} href="/collections"><span className="nav-icon" aria-hidden="true">▧</span><span className="nav-text">Gyűjtemények</span></a>
       <a className={active==='files' ? 'active' : undefined} aria-current={active==='files' ? 'page' : undefined} href="/files"><span className="nav-icon" aria-hidden="true">▱</span><span className="nav-text">Fájlok</span></a>
      <a className={active==='notes' ? 'active' : undefined} aria-current={active==='notes' ? 'page' : undefined} href="/notes"><span className="nav-icon" aria-hidden="true">✓</span><span className="nav-text">Jegyzetek / teendők</span></a></>}
      {role!=='info-reader' && <a className={active==='pokemon' ? 'active' : undefined} aria-current={active==='pokemon' ? 'page' : undefined} href="/pokemon"><span className="nav-icon" aria-hidden="true">◉</span><span className="nav-text">Pokémon figyelő</span></a>}
      {role==='pokemon-reader'&&<a className={active==='notifications'?'active':undefined} aria-current={active==='notifications'?'page':undefined} href="/notifications"><span className="nav-icon" aria-hidden="true">♧</span><span className="nav-text">Értesítési központ</span></a>}
      {role!=='pokemon-reader' && <a className={active==='important-info' ? 'active' : undefined} aria-current={active==='important-info' ? 'page' : undefined} href="/important-info"><span className="nav-icon" aria-hidden="true">ⓘ</span><span className="nav-text">Fontos infók</span></a>}
      <a className={active==='adventure' ? 'active' : undefined} aria-current={active==='adventure' ? 'page' : undefined} href="/adventure"><span className="nav-icon" aria-hidden="true">◇</span><span className="nav-text">NULLPONT · Kalandjáték</span></a>
      {role==='admin' && openCode && <a className={active==='opencode' ? 'active' : undefined} aria-current={active==='opencode' ? 'page' : undefined} href="/opencode"><span className="nav-icon" aria-hidden="true">⌘</span><span className="nav-text">OpenCode</span></a>}
      {role==='admin'&&openCode&&<a className={active==='system'?'active':undefined} aria-current={active==='system'?'page':undefined} href="/system"><span className="nav-icon" aria-hidden="true">▤</span><span className="nav-text">Rendszer állapota</span></a>}
      {role==='admin' && <a className={active==='config' ? 'active' : undefined} aria-current={active==='config' ? 'page' : undefined} href="/config"><span className="nav-icon" aria-hidden="true">⚙</span><span className="nav-text">Konfig</span></a>}
    </nav>
    <span className="version-label" aria-label="Dashboard verzió">Web v{WEB_VERSION}</span>
    <div className="sidebar-bottom"><div className="avatar">W</div><div className="user-info"><strong>{name || 'Wydrian'}</strong><span>Privát dashboard</span></div><form action={logout}><button className="logout" title="Kijelentkezés" aria-label="Kijelentkezés">↪</button></form></div>
  </aside>;
}
