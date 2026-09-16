import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {readFile,writeFile,mkdtemp,rm,mkdir} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {unzipSync,strFromU8} from 'fflate';
const run=promisify(execFile),here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../dist'),port=5186,origin=`http://127.0.0.1:${port}`;
const token=randomBytes(32).toString('hex');let converting=false,wordUnavailable=false;
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
const server=http.createServer(async(req,res)=>{
 try{
  if(req.headers.host!==`127.0.0.1:${port}`){json(res,403,{error:'Nicht erlaubter Host.'});return;}
  const url=new URL(req.url,origin);
  if(url.pathname==='/api/word/convert'){
   if(req.method!=='POST'||req.headers.origin!==origin||req.headers['x-dossier-token']!==token){json(res,403,{error:'Die Word-Anbindung kann nur aus der lokalen Dossier-App verwendet werden.'});return;}
   if(wordUnavailable){json(res,503,{error:'Word hat zuvor nicht reagiert. Bitte Word-Dialoge schliessen und den lokalen Starter neu starten.'});return;}
   if(converting){json(res,409,{error:'Word verarbeitet bereits ein Dokument. Bitte warten.'});return;}
   converting=true;let dir;
   try{
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>25*1024*1024)throw Error('Maximal 25 MB pro Word-Datei.');chunks.push(chunk)}
    const bytes=Buffer.concat(chunks);let expanded=0;
    const zip=unzipSync(bytes,{filter:f=>{expanded+=f.originalSize;if(expanded>80*1024*1024)throw Error('Word-Datei entpackt zu gross.');if(/vbaProject|activeX/i.test(f.name))throw Error('Makros und aktive Steuerelemente sind nicht zugelassen.');return ['[Content_Types].xml','word/document.xml','word/comments.xml'].includes(f.name)}});
    if(!zip['word/document.xml']||/macroEnabled/i.test(strFromU8(zip['[Content_Types].xml']||new Uint8Array())))throw Error('Bitte eine normale DOCX-Datei ohne Makros verwenden.');
    const temporaryRoot=path.join(homedir(),'Library/Containers/com.microsoft.Word/Data/Documents/Dossier-AusgabeTemp');
    await mkdir(temporaryRoot,{recursive:true,mode:0o700});dir=await mkdtemp(path.join(temporaryRoot,'dossier-'));const name=`dossier-${randomBytes(8).toString('hex')}.docx`;
    const input=path.join(dir,name),output=path.join(dir,'output.pdf');await writeFile(input,bytes,{mode:0o600});
    try{await run('/usr/bin/osascript',[path.join(here,'convert.applescript'),input,output,name],{timeout:120000,maxBuffer:100000})}
    catch(e){if(e.killed||String(e.stderr).includes('-1712'))wordUnavailable=true;throw Error(`Word-Konvertierung fehlgeschlagen. Bitte Word öffnen, Dialoge schliessen und die macOS-Automatisierung für Terminal erlauben. ${e.stderr?.trim()||e.message}`)}
    const pdf=await readFile(output);if(!pdf.subarray(0,5).equals(Buffer.from('%PDF-')))throw Error('Word hat kein gültiges PDF erzeugt.');
    res.writeHead(200,{'Content-Type':'application/pdf','Cache-Control':'no-store'});res.end(pdf);
   }catch(e){json(res,422,{error:e.message})}finally{if(dir)await rm(dir,{recursive:true,force:true});converting=false;}
   return;
  }
  if(req.method!=='GET'){json(res,405,{error:'Nicht erlaubt.'});return;}
  const relative=decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html';const file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep)){json(res,403,{error:'Nicht erlaubt.'});return;}
  let data=await readFile(file);
  if(relative==='index.html')data=Buffer.from(data.toString().replace('</head>',`<meta name="dossier-word-token" content="${token}"></head>`));
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.zip':'application/zip'};
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"frame-ancestors 'none'"});res.end(data);
 }catch(e){json(res,404,{error:'Datei nicht gefunden.'})}
});
server.on('error',e=>{if(e.code==='EADDRINUSE')console.error('Die lokale Dossier-App läuft bereits: '+origin);else console.error(e.message);process.exitCode=1});
server.listen(port,'127.0.0.1',()=>{console.log(`Dossier mit Microsoft Word: ${origin}\nDieses Fenster während der Konvertierung offen lassen. Währenddessen bitte nicht in Word arbeiten.`);if(process.argv.includes('--open'))execFile('/usr/bin/open',[origin]);});
