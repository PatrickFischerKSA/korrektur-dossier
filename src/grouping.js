export const roles={errors:'Fehlerliste',text:'Text mit Randbemerkungen',comments:'Kommentar'};
export function nameKey(value){return String(value).toLocaleLowerCase('de').replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim()}
const rules=[
 ['text',/\b(?:(?:korrigiert(?:er|e|es|en)?[\s_-]+)?text[\s_-]+(?:mit[\s_-]+)?(?:randbemerkungen|randkommentaren?|randkommentierung|kommentaren?)|korrigiert(?:er|e|es|en)?[\s_-]+text|text[\s_-]+korrigiert|randbemerkungen|randkommentare|randkommentierung)\b/gi],
 ['errors',/\b(?:fehlerliste|fehlerlisten|fehleruebersicht|fehlerprotokoll|fehleranalyse|fehler[\s_-]+liste)\b/gi],
 ['comments',/\b(?:gesamtkommentar|schlusskommentar|kommentar|kommentare|feedback|rueckmeldung|beurteilung)\b/gi],
 ['text',/\b(?:text|aufsatz|korrigiert(?:er|e|es|en)?)\b/gi],
];
export function identifyFilename(filename){
 const stem=filename.replace(/\.[^.]+$/,'').replace(/([a-zäöüß])([A-ZÄÖÜ])/g,'$1 $2');
 // Keep offsets stable when matching umlauts by replacing them with one-character equivalents.
 let work=stem.toLowerCase().replace(/ä/g,'a').replace(/ö/g,'o').replace(/ü/g,'u').replace(/[_.,()[\]{}–—-]+/g,' ');
 // Match both transliterated and original spellings while retaining the original display name.
 const matches=[];
 for(const [kind,re]of rules){const pattern=new RegExp(re.source.replace('fehleruebersicht','fehler(?:ue|u)bersicht').replace('rueckmeldung','r(?:ue|u)ckmeldung'),re.flags);work=work.replace(pattern,(match,offset)=>{matches.push({kind,start:offset,end:offset+match.length});return ' '.repeat(match.length)})}
 const kinds=[...new Set(matches.map(m=>m.kind))];
 let name=stem.split('').map((c,i)=>matches.some(m=>i>=m.start&&i<m.end)?' ':c).join('');
 name=name.replace(/(?:^|[\s_.-])(?:v(?:ersion)?\s*\d+(?:\.\d+)*|final|entwurf|korrigiert)(?=$|[\s_.-])/gi,' ').replace(/[_.,()[\]{}–—-]+/g,' ').replace(/\s+/g,' ').trim();
 const kind=kinds.length===1?kinds[0]:null;
 const key=nameKey(name);
 const prefix=filename.split('_')[0];
 const group=filename.includes('_')&&/^(?:[\p{L}]*\d[\p{L}\d-]*|[A-Z]{2,8}|Klasse[\p{L}\d-]*)$/u.test(prefix)&&nameKey(name).startsWith(nameKey(prefix)+' ')?prefix:'';
 if(group)name=name.slice(prefix.length).trim();
 return {key,name,group,kind,reason:kinds.length>1?'Mehrere Dokumentarten im Dateinamen.':!kind?'Dokumentart im Dateinamen nicht erkannt.':!key||!name?'Gemeinsamer Name im Dateinamen fehlt.':''};
}
export function matchingDossiers(dossiers,key){return dossiers.filter(d=>d.matchKey===key||(!d.matchKey&&nameKey([d.group,d.person||d.title].filter(Boolean).join(' '))===key))}
export function completeness(d){const missing=[],duplicates=[];for(const [kind,label]of Object.entries(roles)){const n=d.sources.filter(s=>s.kind===kind).length;if(!n)missing.push(label);if(n>1)duplicates.push(label)}return {complete:!missing.length&&!duplicates.length,missing,duplicates,label:duplicates.length?'Doppelt: '+duplicates.join(', '):missing.length?'Fehlt: '+missing.join(', '):'Vollständig · 3 Dateien'};}
