import { logout } from "./actions";
import type { Role } from '@/lib/users';

export default function DashboardSidebar({name,active='overview',unread,role='admin'}:{name?:string|null;active?:'overview'|'pokemon'|'news'|'config'|'notes'|'finance';unread?:number;role?:Role}) {
  return <aside className="sidebar">
    <a className="brand" href="/"><span className="brand-mark small">w.</span><span>wydrian<span className="brand-sub">PERSONAL SPACE</span></span></a>
    <div className="nav-label">MUNKATERÜLET</div>
    <nav>
      {role==='admin' && <><a className={active==='overview' ? 'active' : undefined} aria-current={active==='overview' ? 'page' : undefined} href="/">▦ <span>Dashboard</span></a>
      <a className={active==='news' ? 'active' : undefined} aria-current={active==='news' ? 'page' : undefined} href="/news">☷ <span>Hírolvasó</span>{unread!==undefined && <b>{unread}</b>}</a>
      <a className={active==='finance' ? 'active' : undefined} aria-current={active==='finance' ? 'page' : undefined} href="/finance">◈ <span>Pénzügy</span></a>
      <a className={active==='notes' ? 'active' : undefined} aria-current={active==='notes' ? 'page' : undefined} href="/notes">✓ <span>Jegyzetek / teendők</span></a></>}
      <a className={active==='pokemon' ? 'active' : undefined} aria-current={active==='pokemon' ? 'page' : undefined} href="/pokemon">◉ <span>Pokémon figyelő</span></a>
      {role==='admin' && <a className={active==='config' ? 'active' : undefined} aria-current={active==='config' ? 'page' : undefined} href="/config">⚙ <span>Konfig</span></a>}
    </nav>
    <div className="sidebar-bottom"><div className="avatar">W</div><div className="user-info"><strong>{name || 'Wydrian'}</strong><span>Privát dashboard</span></div><form action={logout}><button className="logout" title="Kijelentkezés" aria-label="Kijelentkezés">↪</button></form></div>
  </aside>;
}
