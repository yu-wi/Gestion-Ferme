import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LinkProps } from 'react-router-dom';
export type ActionIconName = 'add' | 'edit' | 'download' | 'print' | 'filter' | 'reset' | 'money' | 'back' | 'lock' | 'menu' | 'close';
export function ActionIcon({name}:{name:ActionIconName}) {
  const paths:Record<ActionIconName,ReactNode>={
    add:<path d="M12 5v14M5 12h14"/>,edit:<><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z"/></>,
    download:<path d="M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5"/>,
    print:<><path d="M7 8V3h10v5M7 17H4V8h16v9h-3M7 14h10v7H7z"/><path d="M17 11h.01"/></>,
    filter:<path d="M3 4h18l-7 8v7l-4 2v-9z"/>,reset:<><path d="M4 10a8 8 0 1 1 1 9M4 4v6h6"/></>,
    money:<><circle cx="12" cy="12" r="9"/><path d="M16 7a5 5 0 1 0 0 10M6 10h8M6 14h8"/></>,
    back:<path d="m10 5-7 7 7 7M3 12h18"/>,lock:<><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>,
    menu:<path d="M4 6h16M4 12h16M4 18h16"/>,close:<path d="m6 6 12 12M6 18 18 6"/>,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
export function ActionButton({icon,label,compact=true,className='',...props}:ButtonHTMLAttributes<HTMLButtonElement>&{icon:ActionIconName;label:string;compact?:boolean}) {
  return <button type="button" {...props} title={props.title || label} aria-label={props['aria-label'] || label} className={`responsive-action ${compact ? 'responsive-action-compact' : ''} ${className}`}>
    <ActionIcon name={icon}/><span className="responsive-action-label">{label}</span>
  </button>;
}
export function ActionLink({icon,label,className='',...props}:LinkProps&{icon:ActionIconName;label:string}) {
  return <Link {...props} title={props.title || label} aria-label={props['aria-label'] || label} className={`responsive-action responsive-action-compact ${className}`}><ActionIcon name={icon}/><span className="responsive-action-label">{label}</span></Link>;
}
