export type NomIconeEau = 'goutte'|'releve'|'calendrier'|'temperature'|'produit'|'ec'|'bassin'|'plus'|'modifier'|'supprimer'|'export'|'chevron';
const traces:Record<NomIconeEau,string>={
  goutte:'M12 3C10 7 5 12 5 16a7 7 0 0 0 14 0c0-4-5-9-7-13Z',
  releve:'M9 5H5v16h14V5h-4M9 3h6v5H9ZM8 12h8M8 16h8',
  calendrier:'M4 5h16v16H4ZM4 10h16M8 3v4M16 3v4M8 13v2M12 13v2M16 13v2',
  temperature:'M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0ZM12 7v11',
  produit:'M9 3h6M10 3v7L4 20q0 1 2 1h12q2 0 2-1l-6-10V3M7 16h10',
  ec:'M13 2 5 14h7l-1 8 8-13h-7Z',
  bassin:'M3 4h18v16H3ZM3 12h18M11 4v16M6 8h2M15 8h3M6 16h2M15 16h3',
  plus:'M12 8v8M8 12h8M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  modifier:'m4 15 11-11 5 5L9 20H4ZM13 6l5 5',
  supprimer:'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',
  export:'M12 3v12M7 10l5 5 5-5M5 16v5h14v-5',
  chevron:'m8 4 8 8-8 8',
};
export default function IconeEau({nom,className=''}:{nom:NomIconeEau;className?:string}){return <svg className={`water-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={traces[nom]}/></svg>;}
