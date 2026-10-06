import { ActionForm, ActionButton } from './action-form';
import { saveUserRole } from './user-actions';
import type { User } from '@/lib/users';

export default function UserSettings({users,owner}:{users:User[];owner:string}) {
  return <section id="users" className="personal-section"><div className="section-heading"><h2>Felhasználók <span>{users.length}/100</span></h2></div>
    <p>Csak előre engedélyezett, igazolt Google-fiók léphet be. A pokemon-reader kizárólag a Pokémon-oldalt éri el, saját értesítési kapcsolókkal. Az info-reader csak a Fontos infók oldalt láthatja (a legutóbbi havi pénzügyi részletekkel), szerkesztés nélkül. Mindkét olvasói szerepkör használhatja az Android appot.</p>
    <details className="personal-editor add-editor"><summary>+ Felhasználó hozzáadása</summary><ActionForm action={saveUserRole} className="personal-form">
      <label>Google-fiók e-mail-címe<input type="email" name="email" required maxLength={254}/></label>
      <label>Szerepkör<select name="role" defaultValue="pokemon-reader"><option value="pokemon-reader">pokemon-reader</option><option value="info-reader">info-reader · Fontos infók (csak olvasás)</option><option value="admin">admin</option></select></label>
      <label><input type="checkbox" name="active" defaultChecked/> Hozzáférés engedélyezve</label><ActionButton className="primary-button">Hozzáadás</ActionButton>
    </ActionForm></details>
    <div className="quick-link-grid">{users.map(user=><article className="quick-link-card" key={user.email}><h3>{user.email}</h3><p>{user.role} · {user.active ? 'Aktív' : 'Letiltva'}</p>
      {user.email===owner ? <p className="footnote">Tulajdonos · admin · nem vonható vissza</p> : <details className="personal-editor"><summary>Jogosultság módosítása</summary><ActionForm action={saveUserRole} className="personal-form" key={user.updated_at}>
        <input type="hidden" name="email" value={user.email}/><label>Szerepkör<select name="role" defaultValue={user.role}><option value="pokemon-reader">pokemon-reader</option><option value="info-reader">info-reader · Fontos infók (csak olvasás)</option><option value="admin">admin</option></select></label>
        <label><input type="checkbox" name="active" defaultChecked={!!user.active}/> Hozzáférés engedélyezve</label><ActionButton className="primary-button">Mentés</ActionButton>
        <p className="footnote">Letiltáskor a fiók összes telefonpárosítását és várakozó pushát visszavonjuk.</p>
      </ActionForm></details>}
    </article>)}</div>
  </section>;
}
