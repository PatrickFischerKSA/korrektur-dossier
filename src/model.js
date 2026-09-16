export const MAX_FILE=25*1024*1024;
export function normalize(text){return String(text).replace(/\r\n?/g,'\n').replace(/\u0000/g,'').replace(/\u00a0/g,' ').replace(/[^\S\n]+\n/g,'\n').replace(/\n{4,}/g,'\n\n\n').trim()}
export function decode(bytes){if(bytes[0]===255&&bytes[1]===254)return new TextDecoder('utf-16le').decode(bytes);if(bytes[0]===254&&bytes[1]===255)return new TextDecoder('utf-16be').decode(bytes);try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{return new TextDecoder('windows-1252').decode(bytes)}}
export function safeName(name){return (name||'Dossier').replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').slice(0,100).trim()||'Dossier'}
export function validateProject(value){
 if(value?.format!=='korrektur-dossier'||value.version!==1||!Array.isArray(value.dossiers)||!value.dossiers.length||value.dossiers.length>200)throw Error('Keine gültige Dossier-Projektdatei (Version 1).');
 return value.dossiers.map(d=>{
  if(!d||!Array.isArray(d.sources)||d.sources.length>500)throw Error('Ungültige Quellenliste.');
  for(const k of ['title','person','group','date'])if(typeof d[k]!=='string'||d[k].length>1000)throw Error('Ungültige Dossierangaben.');
  if(d.date&&!/^\d{4}-\d{2}-\d{2}$/.test(d.date))throw Error('Ungültiges Datum.');
  return {id:crypto.randomUUID(),title:d.title,person:d.person,group:d.group,date:d.date,cover:d.cover!==false,...(typeof d.matchKey==='string'?{matchKey:d.matchKey.slice(0,1000)}:{}),sources:d.sources.map(s=>{
   if(!s||!['errors','text','comments'].includes(s.kind)||typeof s.name!=='string'||typeof s.text!=='string'||s.text.length>10_000_000)throw Error('Ungültige Quelle.');
   if(s.original!==undefined&&(typeof s.original!=='string'||s.original.length>MAX_FILE*1.4||!/^JVBER[A-Za-z0-9+/=\s]*$/.test(s.original)))throw Error('Ungültiger PDF-Anhang.');
   return {id:crypto.randomUUID(),kind:s.kind,name:s.name.slice(0,500),text:s.text,warning:typeof s.warning==='string'?s.warning:'',...(s.original?{original:s.original}:{})};
  })};
 });
}
export function validatePending(value){
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.length>500)throw Error('Ungültige Liste offener Zuordnungen.');
 return value.map(s=>{if(!s||typeof s.reason!=='string'||typeof s.suggestedName!=='string')throw Error('Ungültige offene Zuordnung.');const kind=['errors','text','comments'].includes(s.kind)?s.kind:null;
 const checked=validateProject({format:'korrektur-dossier',version:1,dossiers:[{title:'',person:'',group:'',date:'',sources:[{...s,kind:kind||'text'}]}]})[0].sources[0];
 return {...checked,kind,reason:s.reason.slice(0,1000),suggestedName:s.suggestedName.slice(0,1000),target:''};});
}
