import {readFile,readdir,writeFile} from 'node:fs/promises';
import {zipSync,strToU8} from 'fflate';
const entries={};
async function add(dir,prefix){for(const entry of await readdir(dir,{withFileTypes:true})){if(entry.name==='Dossier-Word-Mac.zip')continue;const path=`${dir}/${entry.name}`,key=`${prefix}/${entry.name}`;if(entry.isDirectory())await add(path,key);else entries[key]=new Uint8Array(await readFile(path))}}
await add('dist','Dossier-Word/dist');
entries['Dossier-Word/local/server.mjs']=strToU8((await readFile('local/server.mjs','utf8')).replace("from 'fflate'","from './fflate.mjs'"));
entries['Dossier-Word/local/fflate.mjs']=new Uint8Array(await readFile('node_modules/fflate/esm/index.mjs'));
entries['Dossier-Word/local/fflate-LICENSE.txt']=new Uint8Array(await readFile('node_modules/fflate/LICENSE'));
entries['Dossier-Word/local/convert.applescript']=new Uint8Array(await readFile('local/convert.applescript'));
entries['Dossier-Word/local/Dossier-starten.command']=[new Uint8Array(await readFile('local/Dossier-starten.command')),{os:3,attrs:0o100755<<16}];
entries['Dossier-Word/START.txt']=strToU8('Dossier mit Original-Word-Layout\n\nVoraussetzungen: macOS, Microsoft Word und Node.js 24 (https://nodejs.org).\n\n1. ZIP entpacken.\n2. local/Dossier-starten.command doppelklicken.\n3. Im geöffneten Browser Dateien auswählen.\n4. macOS fragt eventuell nach der Erlaubnis, dass Terminal Microsoft Word steuern darf. Diese ist für den Export erforderlich.\n5. Word und das Terminalfenster während der Verarbeitung offen lassen. Währenddessen nicht in Word arbeiten.\n\nDie Anwendung läuft nur auf 127.0.0.1:5186. Dokumente bleiben auf diesem Mac. Temporäre Kopien werden nach jedem Export gelöscht. Zum Beenden im Terminal Ctrl+C drücken.\n');
await writeFile('dist/Dossier-Word-Mac.zip',zipSync(entries,{level:6}));
console.log('Lokales Word-Paket erstellt: dist/Dossier-Word-Mac.zip');
