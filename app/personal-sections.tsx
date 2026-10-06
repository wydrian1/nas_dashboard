import { ActionForm, ActionButton } from "./action-form";
import { saveQuickLink, deleteQuickLink, saveNote, deleteNote, saveTodo, toggleTodo, deleteTodo } from "./personal-actions";
import type { QuickLink, Note, Todo } from "@/lib/personal-types";
import { PERSONAL_LIMITS } from "@/lib/personal-types";
import {budapestClock} from '@/lib/mobile/task-reminders';

function LinkFields({ link }: { link?: QuickLink }) {
  return <><input type="hidden" name="id" value={link?.id || ""}/><label>Link neve<input name="title" required maxLength={80} defaultValue={link?.title} placeholder="Például: kedvenc oldalam"/></label><label>Webcím<input name="url" type="url" required maxLength={2048} defaultValue={link?.url} placeholder="https://…"/></label><label>Leírás <span className="subtle">opcionális</span><input name="description" maxLength={160} defaultValue={link?.description} placeholder="Rövid emlékeztető"/></label><ActionButton className="primary-button">{link ? "Mentés" : "+ Hozzáadás"}</ActionButton></>;
}
export function QuickLinks({ links }: { links: QuickLink[] }) {
  return <section id="quicklinks" className="personal-section"><div className="section-heading"><h2>Gyorslinkek <span>{links.length}/{PERSONAL_LIMITS.quickLinks}</span></h2><a className="text-link" href="/config#quicklinks">Konfig →</a></div>
    <div className="quick-link-grid">{links.map(link=><article className="quick-link-card" key={link.id}><a className="quick-link-main" href={link.url} target="_blank" rel="noopener noreferrer"><span className="quick-link-icon">{link.title[0].toLocaleUpperCase("hu-HU")}</span><div><h3>{link.title} <span>↗</span></h3><p>{link.description || new URL(link.url).host}</p></div></a></article>)}</div>
    {!links.length && <p className="footnote">Még nincs gyorslink. A Konfig oldalon adhatsz hozzá új linket.</p>}
  </section>;
}
export function QuickLinkSettings({ links }: { links: QuickLink[] }) {
  return <section id="quicklinks" className="personal-section"><div className="section-heading"><h2>Gyorslinkek <span>{links.length}/{PERSONAL_LIMITS.quickLinks}</span></h2><span className="subtle">A gyakran használt oldalaid</span></div>
    <details className="personal-editor add-editor" open={!links.length}><summary>+ Új link</summary><ActionForm action={saveQuickLink} className="personal-form"><LinkFields/></ActionForm></details>
    <div className="quick-link-grid">{links.map(link=><article className="quick-link-card" key={link.id}><a className="quick-link-main" href={link.url} target="_blank" rel="noopener noreferrer"><span className="quick-link-icon">{link.title[0].toLocaleUpperCase("hu-HU")}</span><div><h3>{link.title} <span>↗</span></h3><p>{link.description || new URL(link.url).host}</p></div></a><details className="personal-editor"><summary>Szerkesztés</summary><ActionForm action={saveQuickLink} className="personal-form" key={link.updated_at}><LinkFields link={link}/></ActionForm><ActionForm action={deleteQuickLink} className="delete-form"><input type="hidden" name="id" value={link.id}/><ActionButton className="delete-button">Link törlése</ActionButton></ActionForm></details></article>)}</div>
    {!links.length && <p className="footnote">A linkek új lapon nyílnak meg. A belépést az adott oldal kezeli.</p>}
  </section>;
}
function NoteFields({ note }: { note?: Note }) {
  return <><input type="hidden" name="id" value={note?.id || ""}/><label>Cím<input name="title" required maxLength={120} defaultValue={note?.title} placeholder="Például: karbantartási ötletek"/></label><label>Jegyzet<textarea name="content" required maxLength={5000} rows={4} defaultValue={note?.content} placeholder="Írd ide, amit szeretnél megjegyezni…"/></label><ActionButton className="primary-button">{note ? "Mentés" : "+ Jegyzet hozzáadása"}</ActionButton></>;
}
function TodoItem({ todo }: { todo: Todo }) {
  const overdue=!todo.done&&!!todo.due_date&&todo.due_date<budapestClock(Date.now()).day;
  return <li id={'task-'+todo.id} className={`todo-item ${todo.done ? "done" : ""}`}><ActionForm action={toggleTodo} className="todo-check-form"><input type="hidden" name="id" value={todo.id}/><ActionButton className="todo-check" label={todo.done ? `${todo.text}: jelölés elvégzetlennek` : `${todo.text}: jelölés késznek`}>{todo.done ? "✓" : "○"}</ActionButton></ActionForm><span className="todo-text">{todo.text}{todo.due_date&&<time dateTime={todo.due_date} className={'todo-deadline'+(overdue?' overdue':'')}>{overdue?'Lejárt · ':''}Határidő: {todo.due_date}</time>}</span><details className="todo-editor personal-editor"><summary aria-label={`${todo.text}: szerkesztés`}>⋯</summary><div><ActionForm action={saveTodo} className="personal-form"><input type="hidden" name="id" value={todo.id}/><label>Feladat<input name="text" defaultValue={todo.text} required maxLength={200}/></label><label>Határidő (opcionális)<input name="due_date" type="date" min="2000-01-01" max="2099-12-31" defaultValue={todo.due_date||''}/></label><ActionButton>Mentés</ActionButton></ActionForm><ActionForm action={deleteTodo} className="delete-form"><input type="hidden" name="id" value={todo.id}/><ActionButton className="delete-button">Feladat törlése</ActionButton></ActionForm></div></details></li>;
}
export function NotesAndTasks({ notes, todos }: { notes: Note[]; todos: Todo[] }) {
  const pending=todos.filter(todo=>!todo.done), completed=todos.filter(todo=>todo.done);
  return <section id="notes" className="personal-section"><div className="section-heading"><h2>Jegyzetek és teendők</h2><span className="subtle">{pending.length} nyitott feladat</span></div><div className="notes-tasks-grid">
    <div className="notes-panel"><div className="panel-heading"><h3>Jegyzetek</h3><span>{notes.length}/{PERSONAL_LIMITS.notes}</span></div><details className="personal-editor add-editor" open={!notes.length}><summary>+ Új jegyzet</summary><ActionForm action={saveNote} className="personal-form"><NoteFields/></ActionForm></details>
      {notes.map(note=><article className="note-card" key={note.id}><h3>{note.title}</h3><p className="note-content">{note.content}</p><details className="personal-editor"><summary>Szerkesztés</summary><ActionForm action={saveNote} className="personal-form" key={note.updated_at}><NoteFields note={note}/></ActionForm><ActionForm action={deleteNote} className="delete-form"><input type="hidden" name="id" value={note.id}/><ActionButton className="delete-button">Jegyzet törlése</ActionButton></ActionForm></details></article>)}
    </div><div className="todos-panel"><div className="panel-heading"><h3>Saját teendők</h3><span>{todos.length}/{PERSONAL_LIMITS.todos}</span></div><p className="task-reminder-help">Ellenőrzés naponta 10:00-kor (Budapest). Push a rögzítő saját telefonjaira 2 és 1 nappal előtte, majd minden lejárt napon, lezárásig.</p><ActionForm action={saveTodo} className="todo-add-form"><label className="sr-only">Új feladat</label><input name="text" required maxLength={200} placeholder="Új feladat…" aria-label="Új feladat"/><input type="date" name="due_date" aria-label="Határidő (opcionális)" min="2000-01-01" max="2099-12-31"/><ActionButton className="primary-button">+</ActionButton></ActionForm>
      {!pending.length && <div className="tasks-empty"><span>✓</span><p>Nincs nyitott feladat.</p></div>}<ul className="todo-list">{pending.map(todo=><TodoItem key={todo.id} todo={todo}/>)}</ul>
      {!!completed.length && <details className="completed-tasks"><summary>Elvégzett feladatok ({completed.length})</summary><ul className="todo-list">{completed.map(todo=><TodoItem key={todo.id} todo={todo}/>)}</ul></details>}
    </div></div>
  </section>;
}
