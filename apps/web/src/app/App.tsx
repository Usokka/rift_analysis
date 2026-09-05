import { useEffect, useState } from 'react';

type Connection = 'loading' | 'ready' | 'unavailable';

export function App() {
  const [connection, setConnection] = useState<Connection>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6000);
    let active = true;
    fetch('/api/v1/ready', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unavailable');
        const body: unknown = await response.json();
        if (typeof body !== 'object' || body === null || !('status' in body) || body.status !== 'ready') {
          throw new Error('Invalid readiness response');
        }
        if (active) setConnection('ready');
      })
      .catch(() => { if (active) setConnection('unavailable'); })
      .finally(() => window.clearTimeout(timeout));
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [attempt]);

  return (
    <div className="workspace">
      <a className="skip" href="#main">Aller au contenu</a>
      <aside className="sidebar" aria-label="Rift Analyst">
        <div className="brand"><span className="brand-mark" aria-hidden="true">◇</span><span>RIFT<br />ANALYST</span></div>
        <p className="eyebrow">Data fuels greater teams</p>
        <nav aria-label="Navigation principale"><a className="current" href="#main" aria-current="page">Vue d’ensemble</a></nav>
        <div className="sidebar-foot">ANALYZE<br />ADAPT<br />ACHIEVE</div>
      </aside>
      <main id="main">
        <header className="topbar"><div><p className="eyebrow">LEAGUE OF LEGENDS · ESPORTS</p><h1>Performance Review</h1></div><span className="edition">V1 / Fondations</span></header>
        <section className="intro panel" aria-labelledby="intro-title">
          <p className="eyebrow">Le carnet de l’analyste</p>
          <h2 id="intro-title">Comprendre la partie.<br /><em>Préparer la suivante.</em></h2>
          <p>Performances d’équipe, joueurs et drafts réunis dans un même espace d’analyse.</p>
        </section>
        <section className="panel report" aria-labelledby="report-title">
          <div className="section-heading"><h2 id="report-title">Rapport d’équipe</h2><span>Aucune période sélectionnée</span></div>
          <div className="empty"><span className="empty-mark" aria-hidden="true">◇</span><h3>Le premier rapport reste à écrire.</h3><p>Aucun match n’a encore été importé. Les indicateurs et les comparaisons apparaîtront lorsque les données seront disponibles.</p></div>
        </section>
        <section className="connection panel" aria-labelledby="connection-title">
          <div><p className="eyebrow">État du service</p><h2 id="connection-title">Connexion à la plateforme</h2><p role="status">{connection === 'loading' ? 'Vérification en cours…' : connection === 'ready' ? 'La plateforme est disponible.' : 'La plateforme est momentanément indisponible.'}</p></div>
          <button type="button" disabled={connection === 'loading'} onClick={() => { setConnection('loading'); setAttempt((value) => value + 1); }}>Vérifier à nouveau</button>
        </section>
        <footer>Same Rift. Smarter Decisions.</footer>
      </main>
    </div>
  );
}
