import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Action = { label: string; icon: string; run: () => void; danger?: boolean; disabled?: boolean };
export default function LotActionsMenu({ lot, actions, disabled = false }: { lot: string; actions: Action[]; disabled?: boolean }) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!position) return;
    menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const dehors = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setPosition(null); };
    const fermer = () => setPosition(null);
    const defiler = (event: Event) => { if (!menu.current?.contains(event.target as Node)) fermer(); };
    document.addEventListener('pointerdown', dehors);
    window.addEventListener('resize', fermer);
    window.addEventListener('scroll', defiler, true);
    return () => { document.removeEventListener('pointerdown', dehors); window.removeEventListener('resize', fermer); window.removeEventListener('scroll', defiler, true); };
  }, [position]);
  return <>
    <button ref={trigger} className="lot-actions-trigger" type="button" aria-label={`Actions du lot ${lot}`} title={`Actions du lot ${lot}`} aria-haspopup="menu" aria-expanded={!!position} aria-controls={position ? id : undefined} disabled={disabled} onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); if (!position) trigger.current?.click(); } }} onClick={() => {
      if (position) { setPosition(null); return; }
      const rect = trigger.current!.getBoundingClientRect();
      const hauteur = Math.min(actions.length * 44 + 12, window.innerHeight - 16);
      setPosition({ left: Math.max(8, Math.min(rect.right - 240, window.innerWidth - 248)), top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - hauteur - 8)) });
    }}>⋯</button>
    {position && createPortal(<div id={id} ref={menu} className="lot-actions-menu" role="menu" aria-label={`Actions du lot ${lot}`} style={position} onKeyDown={event => {
      const boutons = [...menu.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      const index = boutons.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === 'Escape' || event.key === 'Tab') { setPosition(null); trigger.current?.focus(); if (event.key === 'Escape') event.preventDefault(); return; }
      const prochain = event.key === 'ArrowDown' ? (index + 1) % boutons.length : event.key === 'ArrowUp' ? (index + boutons.length - 1) % boutons.length : event.key === 'Home' ? 0 : event.key === 'End' ? boutons.length - 1 : null;
      if (prochain !== null) { event.preventDefault(); boutons[prochain]?.focus(); }
    }}>{actions.map(action => <button key={action.label} type="button" role="menuitem" className={action.danger ? 'lot-action-danger' : ''} disabled={action.disabled} onClick={() => { setPosition(null); trigger.current?.focus(); action.run(); }}><span aria-hidden="true">{action.icon}</span>{action.label}</button>)}</div>, document.body)}
  </>;
}
