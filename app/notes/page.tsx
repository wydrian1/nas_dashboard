import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth";
import { personalData } from "@/lib/personal-data";
import DashboardSidebar from "../dashboard-sidebar";
import { NotesAndTasks } from "../personal-sections";
import { isOpenCodeOwner } from '@/lib/opencode-access';
import {homeForRole} from '@/lib/users';

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Jegyzetek és teendők · Wydrian" };

export default async function NotesPage() {
  const session = await requireUser().catch(()=>null);
  if (!session) redirect("/");
  if (session.role!=='admin') redirect(homeForRole(session.role));
  const personal = personalData(session.user!.email!);
  return <div className="dashboard-shell"><DashboardSidebar name={session.user?.name} active="notes" openCode={isOpenCodeOwner(session.user?.email)}/><main className="main-content notes-page">
    <header className="topbar"><a href="/">← Vissza a dashboardra</a><span className="domain"><i/>nas.wydrian.hu</span></header>
    <section className="page-heading"><div><h1>Jegyzetek és teendők</h1></div></section>
    <NotesAndTasks notes={personal.notes} todos={personal.todos}/>
    <footer className="main-footer">Wydrian Dashboard</footer>
  </main></div>;
}
