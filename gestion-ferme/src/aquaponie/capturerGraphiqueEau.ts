export async function capturerGraphiqueEau(svg: SVGSVGElement | null, legendes: {name:string;couleur:string}[]): Promise<string> {
  const canvas = document.createElement('canvas');
  const largeur = svg ? Number(svg.getAttribute('width')) || svg.clientWidth : 1000;
  const hauteur = svg ? Number(svg.getAttribute('height')) || svg.clientHeight : 350;
  const facteur = 2;
  canvas.width = largeur * facteur;
  canvas.height = (hauteur + 35 + legendes.length * 22) * facteur;
  const contexte = canvas.getContext('2d');
  if (!contexte) throw new Error('Graphique indisponible');
  contexte.scale(facteur, facteur); contexte.fillStyle = '#fff'; contexte.fillRect(0, 0, canvas.width, canvas.height);
  if (svg) {
    const copie = svg.cloneNode(true) as SVGSVGElement;
    copie.setAttribute('xmlns','http://www.w3.org/2000/svg');
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copie)], {type:'image/svg+xml;charset=utf-8'}));
    try { const img = new Image(); await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error('Capture du graphique impossible'));img.src=url;}); contexte.drawImage(img,0,0,largeur,hauteur); }
    finally { URL.revokeObjectURL(url); }
  } else { contexte.fillStyle='#425563';contexte.font='16px sans-serif';contexte.fillText('Aucun relevé avec une heure et une valeur connues.',18,50); }
  contexte.font='14px sans-serif';contexte.fillStyle='#b45309';contexte.fillText('＋ Ajouts de produits : repères orange',14,hauteur+20);
  legendes.forEach((l,i)=>{contexte.fillStyle=l.couleur;contexte.fillRect(14,hauteur+34+i*22,10,10);contexte.fillStyle='#263e51';contexte.fillText(l.name,32,hauteur+44+i*22);});
  return canvas.toDataURL('image/png');
}
