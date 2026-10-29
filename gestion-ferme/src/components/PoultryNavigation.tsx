import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function PoultryNavigation() {
  const { pathname, search } = useLocation();
  const nav = useRef<HTMLElement>(null);
  const [defilement, setDefilement] = useState({ gauche: false, droite: false, deborde: false });
  const volailles = pathname === '/volailles' || pathname.startsWith('/volailles/');
  const sica = pathname.startsWith('/volailles/sica') || pathname.startsWith('/volailles/historique');
  const directe = pathname.startsWith('/volailles/vente-directe');
  const analyse = pathname === '/volailles/analyse' || pathname.startsWith('/volailles/analyse/');
  const economie = new URLSearchParams(search).get('onglet') === 'economie' ? '?onglet=economie' : '';
  const historique = pathname.includes('/historique');
  const liens = [
    { to: '/volailles', label: 'Résumé', actif: pathname === '/volailles' },
    { to: '/volailles/saisie-quotidienne', label: 'Saisie quotidienne', actif: pathname === '/volailles/saisie-quotidienne' },
    { to: '/volailles/alimentation', label: 'Alimentation', actif: pathname === '/volailles/alimentation' },
    { to: '/volailles/sica', label: 'Lots SICA Madras', actif: sica },
    { to: '/volailles/vente-directe', label: 'Vente directe', actif: directe },
    { to: '/volailles/analyse/sica', label: 'Analyse', actif: analyse },
    { to: '/volailles/inventaire', label: 'Inventaire', actif: pathname === '/volailles/inventaire' },
  ];
  useEffect(() => {
    const element = nav.current;
    if (!element) return;
    const actualiser = () => setDefilement({ gauche: element.scrollLeft > 2, droite: element.scrollLeft + element.clientWidth < element.scrollWidth - 2, deborde: element.scrollWidth > element.clientWidth + 2 });
    const montrerActif = () => {
      const actif = element.querySelector<HTMLElement>('[aria-current="page"]');
      if (actif) element.scrollLeft = Math.max(0, actif.offsetLeft - (element.clientWidth - actif.offsetWidth) / 2);
      actualiser();
    };
    const frame = requestAnimationFrame(montrerActif);
    element.addEventListener('scroll', actualiser, { passive: true });
    const observer = new ResizeObserver(montrerActif);
    observer.observe(element);
    return () => { cancelAnimationFrame(frame); element.removeEventListener('scroll', actualiser); observer.disconnect(); };
  }, [pathname]);
  if (!volailles) return null;
  const defiler = (sens: number) => nav.current?.scrollBy({ left: sens * 240, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  const base = sica ? '/volailles/sica' : '/volailles/vente-directe';
  return <div className="poultry-navigation">
    <div className="poultry-navigation-row">
      {defilement.deborde && <button type="button" className="poultry-nav-arrow" aria-label="Défiler le menu Volailles vers la gauche" disabled={!defilement.gauche} onClick={() => defiler(-1)}>‹</button>}
      <nav ref={nav} className="poultry-navigation-links" aria-label="Sections volailles">{liens.map(lien => <Link key={lien.to} to={lien.to} aria-current={lien.actif ? 'page' : undefined}>{lien.label}</Link>)}</nav>
      {defilement.deborde && <button type="button" className="poultry-nav-arrow" aria-label="Défiler le menu Volailles vers la droite" disabled={!defilement.droite} onClick={() => defiler(1)}>›</button>}
    </div>
    {analyse && <nav className="poultry-lot-tabs" aria-label="Sources de l’analyse">
      <span>Analyse</span>
      <Link to={`/volailles/analyse/sica${economie}`} aria-current={!pathname.includes('vente-directe') ? 'page' : undefined}>SICA Madras</Link>
      <Link to={`/volailles/analyse/vente-directe${economie}`} aria-current={pathname.includes('vente-directe') ? 'page' : undefined}>Vente directe</Link>
    </nav>}
    {(sica || directe) && <nav className="poultry-lot-tabs" aria-label={sica ? 'Vues des lots SICA' : 'Vues des lots vente directe'}>
      <span>{sica ? 'Lots SICA Madras' : 'Vente directe'}</span>
      <Link to={base} aria-current={!historique ? 'page' : undefined}>Lots actifs</Link>
      <Link to={`${base}/historique`} aria-current={historique ? 'page' : undefined}>Historique</Link>
    </nav>}
  </div>;
}
