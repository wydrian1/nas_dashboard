import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth";
import { articles } from "@/lib/db";
import { refreshFeeds } from "@/lib/rss";
import { toggleRead, refreshNews } from "../actions";
import DashboardSidebar from "../dashboard-sidebar";
import NewsImage from "../news-image";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Hírolvasó · Wydrian" };

export default async function NewsPage() {
  const session = await requireUser().catch(()=>null);
  if (!session) redirect("/");
  if (session.role!=='admin') redirect('/pokemon');
  await refreshFeeds();
  const news = articles(), unread = news.filter(article=>!article.is_read).length;
  return <div className="dashboard-shell"><DashboardSidebar name={session.user?.name} active="news" unread={unread}/><main className="main-content news-page">
    <header className="topbar"><a href="/">← Vissza a dashboardra</a><span className="domain"><i/>nas.wydrian.hu</span></header>
    <section className="page-heading"><div><span className="eyebrow">SAJÁT HÍRFOLYAM</span><h1>Hírolvasó</h1><p>A világ hírei, a saját ritmusodban.</p></div><a className="secondary-button" href="/config#sources">RSS-források · Konfig</a></section>
    <section className="news-section" id="news"><div className="section-heading"><h2>Legfrissebb hírek <span>{unread} új</span></h2><form action={refreshNews}><button className="secondary-button">↻ Frissítés</button></form></div>
      <div className="news-panel">{news.length === 0 ? <div className="empty-state"><div className="empty-icon">☷</div><h3>Még nincs megjeleníthető hír.</h3><p>Adj hozzá egy RSS-forrást a Konfig oldalon, és itt megjelennek a legfrissebb cikkek.</p><a href="/config#sources" className="text-link">Első forrás hozzáadása →</a></div> : news.map(article => <article className={`news-item ${article.is_read ? "read" : ""}`} key={article.id}>
        {article.image_url && <NewsImage key={article.image_url} src={article.image_url} href={article.url} title={article.title}/>}
        <div className="news-content"><span className="article-source">{article.feed_name}</span><a href={article.url} target="_blank" rel="noopener noreferrer">{article.title}<span>↗</span></a><time>{article.published ? new Intl.DateTimeFormat("hu-HU", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Budapest" }).format(new Date(article.published)) : ""}</time></div><form action={toggleRead}><input type="hidden" name="id" value={article.id}/><button className="read-button" aria-label={article.is_read ? "Jelölés olvasatlannak" : "Jelölés olvasottnak"}>{article.is_read ? "✓" : "○"}</button></form>
      </article>)}</div>
    </section>
    <footer className="main-footer">WYDRIAN DASHBOARD<span>Saját tér. Saját szabályok.</span></footer>
  </main></div>;
}
