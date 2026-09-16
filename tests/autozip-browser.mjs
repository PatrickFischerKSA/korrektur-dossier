import {chromium} from '@playwright/test';
import {unzipSync,strFromU8} from 'fflate';
import {readFile,mkdir} from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';
import assert from 'node:assert/strict';
await mkdir('tmp',{recursive:true});
const browser=await chromium.launch({channel:'chrome'}),page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.APP_URL||'http://127.0.0.1:5178/');
const files=[];for(let n=0;n<33;n++)for(const role of ['Fehlerliste','mit_Randbemerkungen','mit_Randbemerkungen-korrektur'])files.push({name:`S4d_Testperson${n}_${role}.txt`,mimeType:'text/plain',buffer:Buffer.from('Vollständiger Testinhalt: ä ö ü')});
files.push({name:'S4d_NochUnvollstaendig_Kommentar.txt',mimeType:'text/plain',buffer:Buffer.from('Fehlende Quellen werden sichtbar ausgewiesen')});
const automatic=page.waitForEvent('download',{timeout:120000});await page.locator('#files').setInputFiles(files);await(await automatic).saveAs('tmp/automatic.zip');
await page.waitForFunction(()=>!document.querySelector('#batch-export').disabled);
const zip=unzipSync(await readFile('tmp/automatic.zip'));assert.equal(Object.keys(zip).filter(n=>n.endsWith('.pdf')).length,33);assert.match(strFromU8(zip['Ausgabebericht.txt']),/Noch Unvollstaendig/);for(const [name,bytes]of Object.entries(zip))if(name.endsWith('.pdf'))assert.equal((await PDFDocument.load(bytes)).getPageCount(),4);
assert.match(await page.locator('#export-progress').textContent(),/33 PDFs erstellt/);assert.equal(await page.locator('#export-progress a[download]').count(),1);
// Manual re-export remains one action and offers the same complete set.
const manual=page.waitForEvent('download',{timeout:120000});await page.locator('#batch-export').click();await(await manual).saveAs('tmp/manual.zip');assert.equal(Object.keys(unzipSync(await readFile('tmp/manual.zip'))).length,34);
assert.deepEqual(errors,[]);console.log(JSON.stringify({uploaded:100,automaticZip:true,pdfDossiers:33,reportForIncomplete:true,singleClickRepeat:true,errors}));await browser.close();
