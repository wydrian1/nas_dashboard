import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth";
import { feeds, db } from "@/lib/db";
import { personalData } from "@/lib/personal-data";
import { DEFAULT_ARTICLE_LIMIT, MIN_ARTICLE_LIMIT, MAX_ARTICLE_LIMIT } from "@/lib/rss-settings";
import { addFeed, removeFeed, updateFeedLimit } from "../actions";
import DashboardSidebar from "../dashboard-sidebar";
import { QuickLinkSettings } from "../personal-sections";
import UserSettings from '../user-settings';
import { ownerEmail, type User } from '@/lib/users';
import { plainSqlRow } from '@/lib/sql-rows';
import MobileSettings from '../mobile/settings';
import { isOpenCodeOwner } from '@/lib/opencode-access';
import AdminHelper from './admin-helper';
import './admin-helper.css';

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Konfig · Wydrian" };

export default async function ConfigPage() {
  const session = await requireUser().catch(()=>null);
  if (!session) redirect("/");
  if (session.role!=='admin') redirect('/pokemon');
  const sources = feeds(), personal = personalData();
  const users=(db().prepare('SELECT * FROM dashboard_users ORDER BY email').all() as User[]).map(plainSqlRow);
  return <div className="dashboard-shell"><DashboardSidebar name={session.user?.name} active="config" openCode={isOpenCodeOwner(session.user?.email)}/><main className="main-content config-page">
    <header className="topbar"><a href="/">← Vissza a dashboardra</a><span className="domain"><i/>nas.wydrian.hu</span></header>
    <section className="page-heading"><div><span className="eyebrow">SAJÁT BEÁLLÍTÁSOK</span><h1>Konfig</h1><p>Gyorslinkek, RSS-források, felhasználók és telefonos push kezelése.</p></div></section>
    <div className="page-shortcuts" role="navigation" aria-label="Konfig szekciók"><a href="#quicklinks">Gyorslinkek</a><a href="#sources">RSS-források</a><a href="#users">Felhasználók</a><a href="#mobile">Telefonok / push</a>{isOpenCodeOwner(session.user?.email) && <a href="#admin-helper">Admin-segéd</a>}</div>
    <QuickLinkSettings links={personal.links}/>
    <section id="sources" className="sources-section"><div className="section-heading"><h2>RSS-források <span>{sources.length}/20</span></h2><a href="/news" className="text-link">Hírolvasó →</a></div><div className="sources-panel"><form action={addFeed} className="add-feed"><label>Forrás neve<input name="name" required maxLength={100} placeholder="Például: kedvenc híroldalam"/></label><label className="url-field">RSS-cím<input name="url" required type="url" maxLength={2048} placeholder="https://…/rss" pattern="https://.*"/></label><label className="feed-limit-field">Hírek száma<input name="article_limit" type="number" min={MIN_ARTICLE_LIMIT} max={MAX_ARTICLE_LIMIT} step={1} required defaultValue={DEFAULT_ARTICLE_LIMIT}/></label><button className="primary-button">+ Hozzáadás</button></form>
      {sources.map(source => <div className="source-item" key={source.id}><div className="source-details"><strong>{source.name}</strong><span>{source.url}</span>{source.error && <small className="error">{source.error}</small>}</div><div className="source-controls"><form action={updateFeedLimit} className="feed-limit-form"><input type="hidden" name="id" value={source.id}/><label>Legfrissebb hírek<input aria-label={`${source.name}: hírek száma`} name="article_limit" type="number" min={MIN_ARTICLE_LIMIT} max={MAX_ARTICLE_LIMIT} step={1} required defaultValue={source.article_limit} key={source.article_limit}/></label><button className="secondary-button">Mentés</button></form><form action={removeFeed}><input type="hidden" name="id" value={source.id}/><button className="secondary-button">Eltávolítás</button></form></div></div>)}
      <p className="footnote">Forrásonként {MIN_ARTICLE_LIMIT}–{MAX_ARTICLE_LIMIT} legfrissebb hír · alapértelmezés: {DEFAULT_ARTICLE_LIMIT} · 15 perces gyorsítótár · képek az enclosure mezőből</p></div></section>
    <UserSettings users={users} owner={ownerEmail()}/>
    <MobileSettings/>
    {isOpenCodeOwner(session.user?.email) && <AdminHelper enabled={process.env.ADMIN_HELPER_ENABLED==='true'}/>}
    <footer className="main-footer">WYDRIAN DASHBOARD<span>Saját tér. Saját szabályok.</span></footer>
  </main></div>;
}
