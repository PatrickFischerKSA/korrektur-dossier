import './style.css';
import {importFile} from './importer.js';
import {safeName,validateProject,validatePending} from './model.js';
import {roles,identifyFilename,matchingDossiers,completeness,nameKey} from './grouping.js';
import {zipSync,strToU8} from 'fflate';
const app=document.querySelector('#app');
const labels=roles;
const uid=()=>crypto.randomUUID();
const fresh=()=>({id:uid(),title:'Neues Dossier',person:'',group:'',date:new Date().toLocaleDateString('sv-SE'),sources:[],cover:true});
let dossiers=[fresh()],active=dossiers[0].id,tab='errors',busy=false,pending=[];
const MAX_BATCH_FILES=100;
let importState=null,autoZip=true,exportState=null,zipUrl=null;
const drafts=new Map();
const current=()=>dossiers.find(d=>d.id===active);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dossierLabel=d=>[d.group,d.person||d.title].filter(Boolean).join(' · ');
const count=(d,k)=>d.sources.filter(s=>s.kind===k).length;
function render(){const d=current();app.innerHTML=`
<header class="top"><div class="brand"><span class="mark">≡</span>Dossier<span><small>Korrekturen zusammenführen</small></span></div><div class="privacy">◈ &nbsp; Verarbeitung auf deinem Gerät</div></header>
<div class="layout"><aside><p class="eyebrow">Deine Dossiers</p><div class="dossier-list">${dossiers.map(x=>`<button class="dossier-item ${x.id===active?'active':''}" data-select="${x.id}" ${busy?'disabled':''}>${esc(dossierLabel(x))}<small>${esc(completeness(x).label)}</small></button>`).join('')}</div><div class="aside-actions"><button id="new" ${busy?'disabled':''}>＋ Neues Dossier</button><button id="save" ${busy?'disabled':''}>Projekt sichern</button><button id="open" ${busy?'disabled':''}>Projekt öffnen</button><button id="all" ${busy||!canExportAll()?'disabled':''}>Alle Dossiers als ZIP erstellen</button></div><p class="aside-note">Deine Inhalte bleiben in diesem Tab. Sichere das Projekt, bevor du ihn schliesst.</p></aside>
<main class="main"><div class="heading"><div><h1>Aus Korrekturen wird ein Dossier.</h1><p>Alle Dateien gemeinsam hochladen. Je drei gehören zu einem Dossier.</p></div><span class="badge">Lokal & vertraulich</span></div><div class="workflow"><span class="current"><b>1</b>Quellen sammeln</span><span><b>2</b>Inhalte prüfen</span><span><b>3</b>PDF herunterladen</span></div>
${renderBatch()}<div class="work-grid"><div><section class="panel"><h2>Angaben zum Dossier</h2><div class="fields"><label class="full">Titel<input data-field="title" value="${esc(d.title)}" placeholder="z. B. Erörterung · Rückmeldung"></label><label>Name<input data-field="person" value="${esc(d.person)}" placeholder="Vorname Nachname"></label><label>Klasse / Kurs<input data-field="group" value="${esc(d.group)}" placeholder="z. B. FMS 2a"></label><label>Datum<input type="date" data-field="date" value="${esc(d.date)}"></label></div></section>
<section class="panel"><div class="tabs" role="tablist" aria-label="Quellenart">${Object.entries(labels).map(([k,v])=>`<button role="tab" aria-selected="${tab===k}" class="${tab===k?'active':''}" data-tab="${k}">${v}<small>${count(d,k)}</small></button>`).join('')}</div><div id="sources">${d.sources.filter(s=>s.kind===tab).map(s=>`<article class="source"><div class="source-top"><div><div class="source-name">${esc(s.name)}</div><small>${s.original?'PDF-Original wird angehängt · ':''}${s.text.length.toLocaleString('de-CH')} Zeichen</small></div><div class="source-actions"><button data-edit="${s.id}">Prüfen</button><button data-remove="${s.id}" aria-label="${esc(s.name)} entfernen">×</button></div></div>${s.warning?`<p class="notice">${esc(s.warning)}</p>`:''}<div id="edit-${s.id}" hidden><label>Inhalt / Anmerkungen<textarea data-source="${s.id}">${esc(s.text)}</textarea></label><label>Dokumentart<select data-kind="${s.id}">${Object.entries(labels).map(([k,v])=>`<option value="${k}" ${s.kind===k?'selected':''}>${v}</option>`).join('')}</select></label><label>Dossier<select data-move="${s.id}">${dossiers.map(x=>`<option value="${x.id}" ${x.id===d.id?'selected':''}>${esc(dossierLabel(x))}</option>`).join('')}</select></label></div></article>`).join('')}</div><div class="or">ODER TEXT DIREKT EINFÜGEN</div><label>Text für «${labels[tab]}»<textarea id="paste" placeholder="Auch Listen, Tabellen und kopierte Rückmeldungen sind willkommen."></textarea></label><button id="add-text" style="margin-top:10px" ${busy?'disabled':''}>Text übernehmen</button><details class="help"><summary>Was bleibt beim Import erhalten?</summary><p>Text und Tabelleninhalte werden vereinheitlicht. Word-Kommentare stehen im PDF vollständig neben dem zugehörigen Absatz; Textstellen werden hervorgehoben, ODT-Anmerkungen im Text. PDF-Seiten bleiben als Originalanhang erhalten; auslesbare Anmerkungen werden zusätzlich aufgeführt. Lange Absätze und Kommentare werden über mehrere Seiten fortgesetzt. Layouts aus Word werden neu gesetzt. Bilddateien, alte DOC-Dateien und Texterkennung (OCR) werden nicht unterstützt.</p></details></section></div>
<section class="panel export-panel"><p class="eyebrow">Deine Ausgabe</p><h2>Bereit für die Rückgabe.</h2><div class="paper"><div class="paper-rule"></div><small>Korrekturdossier</small><h3 id="preview-title">${esc(d.title)}</h3><p id="preview-person">${esc(d.person||'Name noch offen')}<br>${esc(d.group)}</p><div class="paper-sections">${Object.entries(labels).map(([k,v])=>`<div><span>${v}</span><span>${count(d,k)} Quellen</span></div>`).join('')}</div></div><label class="check"><input type="checkbox" id="cover" ${d.cover?'checked':''}>Deckblatt hinzufügen</label><p>${esc(completeness(d).label)}<br>A4 · mit Seitenzahlen</p><button class="primary" id="pdf" ${busy||!completeness(d).complete?'disabled':''}>↓ PDF herunterladen</button><button class="quiet danger" id="delete" ${busy?'disabled':''}>Dossier entfernen</button><details class="help"><summary>Hinweise zum PDF</summary><p>Ein vollständiges Dossier enthält genau eine Fehlerliste, einen Text mit Randbemerkungen und einen Kommentar. Original-PDFs folgen nach den aufbereiteten Inhalten. Prüfe den Export vor der Weitergabe.</p></details></section></div><div class="footer">Keine Anmeldung. Keine Übertragung deiner Dokumente.</div></main></div><input hidden type="file" id="files" multiple accept=".txt,.md,.markdown,.csv,.tsv,.json,.html,.htm,.docx,.odt,.pdf"><input hidden type="file" id="project" accept=".json"><div class="status" role="status" aria-live="polite" id="status"></div><dialog id="confirm"><h2>Dossier entfernen?</h2><p>Dieses Dossier mit allen eingefügten Quellen wird aus dem aktuellen Projekt entfernt.</p><div class="dialog-actions"><button id="cancel">Abbrechen</button><button class="danger" id="confirm-delete">Entfernen</button></div></dialog>`;bind();}
let noticeTimer;
function notify(message){clearTimeout(noticeTimer);document.querySelector('#status').textContent=message;if(!busy)noticeTimer=setTimeout(()=>{const el=document.querySelector('#status');if(el)el.textContent=''},14000);}
function bind(){
 if(busy)document.querySelectorAll('button,input,textarea,select').forEach(el=>el.disabled=true);
 document.querySelector('#paste').value=drafts.get(active+tab)||'';
 document.querySelector('#paste').oninput=e=>drafts.set(active+tab,e.target.value);
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render()});
 document.querySelectorAll('[data-select]').forEach(b=>b.onclick=()=>{active=b.dataset.select;render()});
 document.querySelectorAll('[data-field]').forEach(e=>e.oninput=()=>{current()[e.dataset.field]=e.value;document.querySelector('#preview-title').textContent=current().title;document.querySelector('#preview-person').textContent=[current().person,current().group].filter(Boolean).join(' · ')});
 document.querySelector('#new').onclick=()=>{const d=fresh();dossiers.push(d);active=d.id;render()};
 document.querySelector('#upload').onclick=()=>document.querySelector('#files').click();
 document.querySelector('#cover').onchange=e=>{current().cover=e.target.checked};
 document.querySelector('#add-text').onclick=()=>{const value=document.querySelector('#paste').value.trim();if(!value)return notify('Bitte zuerst einen Text einfügen.');if(count(current(),tab))return notify('Dieser Bereich enthält bereits eine Quelle. Bitte die vorhandene Quelle bearbeiten oder entfernen.');current().sources.push({id:uid(),name:`${labels[tab]} · eingefügter Text`,kind:tab,text:value});drafts.delete(active+tab);render();notify('Text übernommen. Über «Prüfen» kannst du ihn bearbeiten.')};
 document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{const el=document.getElementById(`edit-${b.dataset.edit}`);el.hidden=!el.hidden;b.textContent=el.hidden?'Prüfen':'Schliessen'});
 document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{current().sources=current().sources.filter(s=>s.id!==b.dataset.remove);render()});
 document.querySelectorAll('[data-source]').forEach(e=>e.oninput=()=>{current().sources.find(s=>s.id===e.dataset.source).text=e.value});
 document.querySelectorAll('[data-kind]').forEach(e=>e.onchange=()=>{const source=current().sources.find(s=>s.id===e.dataset.kind);if(current().sources.some(s=>s.id!==source.id&&s.kind===e.value)){e.value=source.kind;return notify('Diese Dokumentart ist bereits belegt.');}source.kind=e.value;render()});
 document.querySelectorAll('[data-move]').forEach(e=>e.onchange=()=>{const from=current(),source=from.sources.find(s=>s.id===e.dataset.move),to=dossiers.find(d=>d.id===e.value);if(to.sources.some(s=>s.kind===source.kind)){e.value=from.id;return notify('Die Dokumentart ist im Zieldossier bereits belegt.');}from.sources=from.sources.filter(s=>s.id!==source.id);to.sources.push(source);render()});
 document.querySelectorAll('[data-resolve]').forEach(b=>b.onclick=()=>resolvePending(b.dataset.resolve));
 document.querySelectorAll('[data-discard]').forEach(b=>b.onclick=()=>{pending=pending.filter(s=>s.id!==b.dataset.discard);render()});
 document.querySelectorAll('[data-pending-field]').forEach(e=>e.oninput=()=>{const item=pending.find(s=>s.id===e.dataset.pendingId);item[e.dataset.pendingField]=e.value});
 document.querySelector('#delete').onclick=()=>document.querySelector('#confirm').showModal();
 document.querySelector('#cancel').onclick=()=>document.querySelector('#confirm').close();
 document.querySelector('#confirm-delete').onclick=()=>{dossiers=dossiers.filter(d=>d.id!==active);if(!dossiers.length)dossiers=[fresh()];active=dossiers[0].id;render()};
 document.querySelector('#files').onchange=e=>addFiles(e.target.files);
 const drop=document.querySelector('#drop');drop.ondragover=e=>{e.preventDefault();drop.classList.add('drag')};drop.ondragleave=()=>drop.classList.remove('drag');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('drag');addFiles(e.dataTransfer.files)};
 document.querySelector('#pdf').onclick=()=>exportPdfs(false);
 document.querySelector('#all').onclick=()=>exportPdfs(true);
 document.querySelector('#batch-export').onclick=()=>exportPdfs(true);
 document.querySelector('#auto-zip').onchange=e=>{autoZip=e.target.checked};
 document.querySelector('#save').onclick=()=>{download(strToU8(JSON.stringify({format:'korrektur-dossier',version:1,dossiers,pending},null,2)),'Dossier-Projekt.json','application/json');notify('Projekt gesichert. Bewahre die Datei vertraulich auf.')};
 document.querySelector('#open').onclick=()=>document.querySelector('#project').click();
 document.querySelector('#project').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>150*1024*1024)throw Error('Projekt zu gross (max. 150 MB).');const value=JSON.parse(await f.text());const loaded=validateProject(value),waiting=validatePending(value.pending);dossiers.push(...loaded);pending.push(...waiting);active=loaded[0].id;render();notify(`${loaded.length} Dossiers zum Projekt hinzugefügt.`);if(autoZip&&canExportAll())await exportPdfs(true)}catch(err){notify(err.message)}};
}
function readyDossiers(){return dossiers.filter(d=>completeness(d).complete&&!pending.some(p=>p.target===d.id||(p.key&&p.key===d.matchKey)||matchingDossiers([d],nameKey(p.suggestedName||'')).length))}
function canExportAll(){return readyDossiers().length>0}
function destination(name,key,group=''){
 const empty=dossiers.find(d=>!d.sources.length&&!d.person&&d.title==='Neues Dossier'&&!['errors','text','comments'].some(k=>drafts.get(d.id+k)));
 const d=empty||fresh();d.person=name;d.group=group;d.title='Korrekturdossier';d.matchKey=key;if(!empty)dossiers.push(d);return d;
}
function renderBatch(){return `<section class="panel batch-panel"><div class="drop" id="drop"><div class="drop-icon">↥</div><strong>Bis zu 100 Dateien gemeinsam hinzufügen</strong><p>Die Dateinamen bestimmen das Dossier und die Dokumentart – unabhängig vom geöffneten Bereich.</p><button class="primary" id="upload" ${busy?'disabled':''}>${busy?'Dateien werden zugeordnet …':'Dateien auswählen'}</button></div><label class="check"><input id="auto-zip" type="checkbox" ${autoZip?'checked':''}>Nach dem Import alle fertigen Dossiers automatisch als ZIP herunterladen</label><button id="batch-export" class="primary" ${busy||!canExportAll()?'disabled':''}>Alle ${readyDossiers().length} fertigen Dossiers als ZIP erstellen</button>${renderExportProgress()}${renderImportProgress()}<p class="formats">Maximal 100 Dateien pro Auswahl, bis zu 25 MB pro Datei. Die Dateien werden nacheinander verarbeitet.<br>Zum Beispiel: S4d_AnnaMeier_Fehlerliste.pdf · S4d_AnnaMeier_mit_Randbemerkungen.docx · S4d_AnnaMeier_mit_Randbemerkungen-korrektur.docx<br>DOCX · PDF · ODT · TXT · Markdown · CSV / TSV · HTML · JSON</p><div class="batch-summary">${dossiers.filter(d=>completeness(d).complete).length} vollständige Dossiers · ${dossiers.filter(d=>d.sources.length&&!completeness(d).complete).length} unvollständig · ${pending.length} Dateien zu klären</div>${pending.length?`<div class="pending"><h2>Zuordnung klären</h2><p>Diese Dateien wurden eingelesen, aber noch keinem Dossier hinzugefügt. Bestehende Quellen werden nie überschrieben.</p>${pending.map(s=>`<article class="source"><strong>${esc(s.name)}</strong><p class="notice">${esc(s.reason)}</p><div class="fields"><label>Dossier<select id="pending-target-${s.id}" data-pending-field="target" data-pending-id="${s.id}"><option value="">Neues Dossier / Name unten</option>${dossiers.map(d=>`<option value="${d.id}" ${s.target===d.id?'selected':''}>${esc(dossierLabel(d))}</option>`).join('')}</select></label><label>Dokumentart<select id="pending-kind-${s.id}" data-pending-field="kind" data-pending-id="${s.id}"><option value="">Bitte wählen</option>${Object.entries(labels).map(([k,v])=>`<option value="${k}" ${s.kind===k?'selected':''}>${v}</option>`).join('')}</select></label><label class="full">Name für neues Dossier<input id="pending-name-${s.id}" data-pending-field="suggestedName" data-pending-id="${s.id}" value="${esc(s.suggestedName||'')}" placeholder="Gemeinsamer Name aus den Dateinamen"></label></div><div class="pending-actions"><button data-resolve="${s.id}" ${busy?'disabled':''}>Zuordnen</button><button data-discard="${s.id}" ${busy?'disabled':''}>Datei verwerfen</button></div></article>`).join('')}</div>`:''}</section>`}
function resolvePending(id){
 const s=pending.find(x=>x.id===id),kind=document.getElementById(`pending-kind-${id}`).value,target=document.getElementById(`pending-target-${id}`).value,name=document.getElementById(`pending-name-${id}`).value.trim();
 if(!Object.hasOwn(labels,kind))return notify('Bitte eine Dokumentart wählen.');
 let d=dossiers.find(x=>x.id===target);
 if(!d){if(!name)return notify('Bitte einen Dossiernamen eingeben oder ein bestehendes Dossier wählen.');const matches=matchingDossiers(dossiers,nameKey(name));if(matches.length>1)return notify('Mehrere Dossiers haben diesen Namen. Bitte das gewünschte Dossier auswählen.');d=matches[0];if(!d)d=destination(name,nameKey(name));}
 if(d.sources.some(x=>x.kind===kind))return notify('Diese Dokumentart ist bereits belegt. Entferne zuerst die nicht benötigte Quelle im Dossier.');
 const {reason,suggestedName,key,target:oldTarget,...source}=s;d.sources.push({...source,kind});pending=pending.filter(x=>x.id!==id);active=d.id;tab=kind;render();notify('Datei zugeordnet.');
}
function renderImportProgress(){if(!importState)return '<div id="import-progress"></div>';const s=importState;return `<div id="import-progress" class="import-progress"><label for="import-meter">${s.finished?'Import abgeschlossen':`Verarbeite Datei ${Math.min(s.done+1,s.total)} von ${s.total}`}</label><progress id="import-meter" max="${s.total}" value="${s.done}"></progress><p aria-live="polite">${s.done} von ${s.total} Dateien verarbeitet · ${s.success} eingelesen · ${s.failed.length} fehlgeschlagen</p>${!s.finished&&s.current?`<p class="import-current">${esc(s.current)}</p>`:''}${s.failed.length?`<details ${s.finished?'open':''}><summary>Nicht eingelesene Dateien (${s.failed.length})</summary><ul>${s.failed.map(f=>`<li><strong>${esc(f.name)}</strong>: ${esc(f.message)}</li>`).join('')}</ul></details>`:''}</div>`}
function updateImportProgress(){const target=document.querySelector('#import-progress');if(target)target.outerHTML=renderImportProgress()}
async function addFiles(list){
 if(busy){notify('Der aktuelle Vorgang läuft noch. Bitte danach weitere Dateien hinzufügen.');return;}
 const files=Array.from(list);if(!files.length)return;
 if(files.length>MAX_BATCH_FILES){document.querySelector('#files').value='';notify(`Du hast ${files.length} Dateien ausgewählt. Maximal ${MAX_BATCH_FILES} Dateien pro Auswahl; es wurde keine Datei aus dieser Auswahl eingelesen. Bitte in mehrere Pakete aufteilen.`);return;}
 busy=true;importState={total:files.length,done:0,success:0,failed:[],current:'',finished:false};render();let firstId;
 try{
  for(const f of files){
   importState.current=f.name;updateImportProgress();
   // Yield between documents so progress paints and input is not starved by a large batch.
   await new Promise(resolve=>setTimeout(resolve,0));
   try{
    const parsed=await importFile(f);if(!parsed.text?.trim()&&!parsed.original)throw Error('Kein lesbarer Text gefunden.');
    const match=identifyFilename(f.name),source={id:uid(),name:f.name,kind:match.kind,...parsed};let reason=match.reason;
    const candidates=match.key?matchingDossiers(dossiers,match.key):[];
    if(!reason&&candidates.length>1)reason='Mehrere Dossiers passen zu diesem Namen. Bitte eines auswählen.';
    if(!reason&&candidates[0]?.sources.some(s=>s.kind===match.kind))reason='Diese Dokumentart ist bereits vorhanden. Bitte die richtige Datei auswählen.';
    if(reason)pending.push({...source,reason,suggestedName:[match.group,match.name].filter(Boolean).join(' '),key:match.key,target:candidates.length===1?candidates[0].id:''});
    else{const d=candidates[0]||destination(match.name,match.key,match.group);d.sources.push(source);firstId??=d.id;}
    importState.success++;
   }catch(e){importState.failed.push({name:f.name,message:e.message||'Die Datei konnte nicht gelesen werden.'});}
   importState.done++;updateImportProgress();
  }
 }finally{
  if(firstId)active=firstId;busy=false;importState.finished=true;render();
  notify(`${importState.success} von ${importState.total} Dateien eingelesen.${pending.length?' Bitte offene Zuordnungen klären.':''}${importState.failed.length?' Nicht eingelesene Dateien stehen im Importbericht.':''}`);
 }
 if(autoZip&&importState.success&&canExportAll())await exportPdfs(true);
}
function download(bytes,name,type){const url=URL.createObjectURL(new Blob([bytes],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000)}
function renderExportProgress(){if(!exportState)return '<div id="export-progress"></div>';const s=exportState;return `<section id="export-progress" class="import-progress"><strong>${s.finished?'ZIP-Ausgabe':'Dossiers werden erstellt …'}</strong><progress max="${Math.max(1,s.total)}" value="${s.done}"></progress><p aria-live="polite">${s.done} von ${s.total} Dossiers verarbeitet · ${s.success} PDFs erstellt</p>${s.skipped.length||s.failures.length?`<details open><summary>Nicht enthalten (${s.skipped.length+s.failures.length})</summary><ul>${[...s.skipped,...s.failures].map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details>`:''}${s.finished&&zipUrl?`<p><a href="${zipUrl}" download="Korrektur-Dossiers.zip">ZIP erneut herunterladen (${s.success} PDFs)</a></p>`:''}</section>`}
function updateExportProgress(){const el=document.querySelector('#export-progress');if(el)el.outerHTML=renderExportProgress()}
async function exportPdfs(all){
 if(busy)return;
 const selection=all?readyDossiers():[current()];
 if(!selection.length||(!all&&!completeness(current()).complete))return notify('Noch kein vollständiges Dossier bereit. Bitte fehlende Dateien oder offene Zuordnungen klären.');
 busy=true;
 if(all){if(zipUrl)URL.revokeObjectURL(zipUrl);zipUrl=null;const selected=new Set(selection.map(d=>d.id));exportState={total:selection.length,done:0,success:0,finished:false,failures:[],skipped:[...dossiers.filter(d=>d.sources.length&&!selected.has(d.id)).map(d=>`${dossierLabel(d)}: ${completeness(d).complete?'Zuordnung noch offen':completeness(d).label}`),...pending.map(p=>`${p.name}: Zuordnung offen`),...(importState?.failed||[]).map(f=>`${f.name}: Import fehlgeschlagen (${f.message})`)]};}
 render();notify(all?'Alle fertigen Dossiers werden als ZIP erstellt …':'PDF wird erstellt …');
 try{
  const {createPdf}=await import('./pdf.js');
  if(all){const files={};
   for(let i=0;i<selection.length;i++){
    const d=selection[i];notify(`Dossier ${i+1} von ${selection.length}: ${dossierLabel(d)}`);
    await new Promise(resolve=>setTimeout(resolve,0));
    try{files[`${String(i+1).padStart(2,'0')}-${safeName([d.group,d.person||d.title].filter(Boolean).join('-'))}.pdf`]=await createPdf(d);exportState.success++;}
    catch(e){exportState.failures.push(`${dossierLabel(d)}: ${e.message}`);}
    exportState.done++;updateExportProgress();
   }
   if(!exportState.success)throw Error('Kein PDF konnte erstellt werden. Details stehen im Ausgabereport.');
   if(exportState.skipped.length||exportState.failures.length)files['Ausgabebericht.txt']=strToU8(`${exportState.success} PDF-Dossiers erstellt.\n\nNicht enthalten:\n${[...exportState.skipped,...exportState.failures].join('\n')}`);
   zipUrl=URL.createObjectURL(new Blob([zipSync(files,{level:0})],{type:'application/zip'}));const a=document.createElement('a');a.href=zipUrl;a.download='Korrektur-Dossiers.zip';a.click();
  }else{const d=selection[0];download(await createPdf(d),`${safeName([d.group,d.person,d.title].filter(Boolean).join(' - '))}.pdf`,'application/pdf');}
  notify(all?`ZIP mit ${exportState.success} PDF-Dossiers erstellt.${exportState.skipped.length||exportState.failures.length?' Nicht enthaltene Dateien und Dossiers stehen im Ausgabereport.':''}`:'PDF erstellt. Bitte vor der Weitergabe prüfen.');
 }catch(e){notify(`Export nicht möglich: ${e.message}`);}
 finally{busy=false;if(all)exportState.finished=true;const message=document.querySelector('#status')?.textContent;render();if(message)notify(message);}
}
window.addEventListener('beforeunload',e=>{if(pending.length||dossiers.some(d=>d.sources.length)||[...drafts.values()].some(Boolean)){e.preventDefault();e.returnValue=''}});
render();
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'read_dossier_overview',description:'Liest Namen und Quellenanzahl der geöffneten Dossiers, ohne Dokumentinhalte zu übertragen.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:input=>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw Error('Leeres Objekt erwartet.');return {dossiers:dossiers.map(d=>({id:d.id,title:d.title,person:d.person,sources:d.sources.length})),active}}})).catch(()=>{})}catch{}}
