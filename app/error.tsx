"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="login-shell"><div className="login-card"><h1>Valami nem sikerült.</h1><p>Az oldal betöltése közben hiba történt. Próbáld újra, vagy frissítsd az oldalt.</p><button className="primary-button" onClick={reset}>Újrapróbálás</button><p><a href="/">Vissza az áttekintéshez</a></p></div></main>;
}
