import { useEffect } from 'react';
const verrous = new Set<symbol>();
let precedent = '';

// Le dernier panneau fermé rend le défilement, même avec des modales imbriquées.
export default function useBodyScrollLock(actif: boolean) {
  useEffect(() => {
    if (!actif) return;
    const verrou = Symbol();
    if (!verrous.size) { precedent = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    verrous.add(verrou);
    return () => {
      verrous.delete(verrou);
      if (!verrous.size) document.body.style.overflow = precedent;
    };
  }, [actif]);
}
