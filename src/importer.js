import {unzipSync} from 'fflate';
import {MAX_FILE,decode,normalize} from './model.js';
const local=(node,name)=>Array.from(node.getElementsByTagName('*')).filter(n=>n.localName===name);
const attr=(node,name)=>Array.from(node.attributes||[]).find(a=>a.localName===name)?.value||'';
function xml(text){const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror'))throw Error('Die Dokumentstruktur konnte nicht gelesen werden.');return doc}
function base64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s)}
function office(bytes,ext){
 let total=0;const files=unzipSync(bytes,{filter:f=>{total+=f.originalSize;if(total>80*1024*1024)throw Error('Entpacktes Dokument ist zu gross (max. 80 MB).');return /^(word\/(document|comments|footnotes|endnotes)\.xml|content\.xml)$/.test(f.name)}});
 if(ext==='odt'){
  if(!files['content.xml'])throw Error('Keine gültige ODT-Datei.');
  const doc=xml(decode(files['content.xml']));
  const walk=n=>{if(n.nodeType===3)return n.textContent;if(n.localName==='annotation')return `\n[Randbemerkung: ${n.textContent.trim()}]\n`;if(n.localName==='s')return ' ';if(n.localName==='tab')return '\t';return Array.from(n.childNodes).map(walk).join('')+(['p','h','table-row'].includes(n.localName)?'\n':'')};
  return {text:normalize(walk(doc)),warning:'Text und Tabellen wurden neu gesetzt. Bilder und das ursprüngliche Seitenlayout sind nicht enthalten.'};
 }
 if(!files['word/document.xml'])throw Error('Keine gültige DOCX-Datei.');
 const doc=xml(decode(files['word/document.xml']));
 let tracked=false;const walk=n=>{
  if(n.nodeType===3)return '';
  if(n.localName==='del'){tracked=true;return ''}
  if(n.localName==='ins')tracked=true;
  if(n.localName==='t')return n.textContent;
  if(n.localName==='tab')return '\t';if(['br','cr'].includes(n.localName))return '\n';
  if(n.localName==='commentRangeStart')return ` [R${Number(attr(n,'id'))+1}: `;
  if(n.localName==='commentRangeEnd')return '] ';
  if(n.localName==='commentReference')return ` [R${Number(attr(n,'id'))+1}] `;
  if(n.localName==='footnoteReference'||n.localName==='endnoteReference')return ` [F${attr(n,'id')}] `;
  return Array.from(n.childNodes).map(walk).join('')+(['p','tr'].includes(n.localName)?'\n':n.localName==='tc'?'\t':'');
 };
 let text=walk(doc);
 if(files['word/comments.xml']){const comments=xml(decode(files['word/comments.xml']));text+='\n\nRANDBEMERKUNGEN\n'+local(comments,'comment').map(c=>`[R${Number(attr(c,'id'))+1}] ${attr(c,'author')?attr(c,'author')+': ':''}${walk(c).trim()}`).join('\n\n')}
 for(const f of ['footnotes','endnotes'])if(files[`word/${f}.xml`])text+='\n\n'+local(xml(decode(files[`word/${f}.xml`])),f.slice(0,-1)).filter(n=>Number(attr(n,'id'))>0).map(n=>`[F${attr(n,'id')}] ${walk(n).trim()}`).join('\n');
 return {text:normalize(text),warning:`Text und Tabellen wurden neu gesetzt; Bilder sind nicht enthalten.${tracked?' Änderungsverfolgung erkannt: Einfügungen übernommen, Löschungen ausgelassen.':''}`};
}
export async function importFile(file){
 if(file.size>MAX_FILE)throw Error('Datei zu gross. Maximal 25 MB pro Datei.');
 const bytes=new Uint8Array(await file.arrayBuffer());const ext=file.name.split('.').pop().toLowerCase();
 if(['docx','odt'].includes(ext))return office(bytes,ext);
 if(ext==='pdf'){
  const {getDocument,GlobalWorkerOptions}=await import('pdfjs-dist');
  const {default:worker}=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');GlobalWorkerOptions.workerSrc=worker;
  let pdf;const loadingTask=getDocument({data:bytes.slice(),isEvalSupported:false,useSystemFonts:true});
  try{pdf=await loadingTask.promise}catch{await loadingTask.destroy();throw Error('PDF nicht lesbar oder passwortgeschützt. Bitte eine ungeschützte PDF-Datei verwenden.')}
  const comments=[];let hasText=false;
  try{for(let p=1;p<=pdf.numPages;p++){
   const page=await pdf.getPage(p);const content=await page.getTextContent();hasText ||= content.items.some(i=>i.str?.trim());
   for(const a of await page.getAnnotations())if(a.contentsObj?.str?.trim())comments.push(`Seite ${p}${a.titleObj?.str?' · '+a.titleObj.str:''}: ${a.contentsObj.str}`);
  }return {text:comments.length?'ANMERKUNGEN AUS DEM PDF\n\n'+comments.join('\n\n'):'',original:base64(bytes),warning:`${pdf.numPages} Originalseiten werden angehängt und nummeriert.${!hasText?' Keine Textebene erkannt; keine automatische Texterkennung.':''}${comments.length?' Anmerkungen zusätzlich als Text übernommen.':' Sichtbare Korrekturen bleiben im Original erhalten.'}`};}finally{await loadingTask.destroy()}
 }
 let text=decode(bytes);
 if(['html','htm'].includes(ext)){const doc=new DOMParser().parseFromString(text,'text/html');doc.querySelectorAll('script,style,iframe,object,noscript').forEach(e=>e.remove());doc.querySelectorAll('br').forEach(e=>e.replaceWith('\n'));doc.querySelectorAll('p,div,li,tr,h1,h2,h3,h4').forEach(e=>e.append('\n'));doc.querySelectorAll('td,th').forEach(e=>e.append('\t'));text=doc.body.textContent}
 else if(ext==='json'){try{text=JSON.stringify(JSON.parse(text),null,2)}catch{throw Error('Die JSON-Datei enthält ungültige Daten.')}}
 else if(!['txt','md','markdown','csv','tsv'].includes(ext))throw Error('Dieses Format wird nicht unterstützt. Bitte als DOCX, ODT, PDF, TXT, Markdown, CSV/TSV, HTML oder JSON speichern.');
 if(!normalize(text))throw Error('Diese Datei enthält keinen lesbaren Text.');
 return {text:normalize(text),warning:['csv','tsv'].includes(ext)?'Tabellendaten als Text übernommen. Bitte Spalten und Zeilen unter «Prüfen» kontrollieren.':''};
}
