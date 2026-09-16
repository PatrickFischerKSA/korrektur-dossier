import {chromium} from '@playwright/test';
import {zipSync,strToU8} from 'fflate';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {mkdir,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('tmp',{recursive:true});
const docx=Buffer.from(zipSync({'_rels/.rels':strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),'word/_rels/document.xml.rels':strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'),'word/document.xml':strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>'+('Beispieltext mit Umlauten ä ö ü. '.repeat(process.env.BROWSER_LAYOUT?4:300))+'</w:t></w:r></w:p></w:body></w:document>')}));
const pdf=await PDFDocument.create();const font=await pdf.embedFont(StandardFonts.Helvetica);pdf.addPage().drawText('Fehlerliste zum Test',{x:50,y:700,font});const pdfBytes=Buffer.from(await pdf.save());
const files=[];for(let i=0;i<33;i++){const stem=`S4d_Testperson${i}`;files.push({name:stem+'_Fehlerliste.pdf',mimeType:'application/pdf',buffer:pdfBytes},{name:stem+'_mit_Randbemerkungen.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:docx},{name:stem+'_mit_Randbemerkungen-korrektur.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:docx});}
files.push({name:'S4d_Testperson33_Kommentar.txt',mimeType:'text/plain',buffer:Buffer.from('Hundertste Datei')});
const browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.APP_URL||'http://127.0.0.1:5178/');if(!process.env.BROWSER_LAYOUT){await page.getByText('Hinweise zur Word-Ausgabe',{exact:true}).click();await page.locator('#native-layout').uncheck();}
await page.locator('#auto-zip').uncheck();
await page.evaluate(()=>{window.progressValues=[];new MutationObserver(()=>{const p=document.querySelector('#import-meter');if(p)window.progressValues.push(Number(p.value))}).observe(document.querySelector('#app'),{subtree:true,childList:true})});
await page.locator('#files').setInputFiles(files);await page.waitForFunction(()=>document.querySelector('#import-progress')?.textContent.includes('100 von 100 Dateien verarbeitet'),{},{timeout:120000});
assert.match(await page.locator('.batch-summary').textContent(),/33 vollständige Dossiers · 1 unvollständig · 0 Dateien zu klären/);assert.equal(await page.locator('[data-select]').count(),34);
assert.ok(await page.evaluate(()=>window.progressValues.some(n=>n>0&&n<100)));
const saved=page.waitForEvent('download');await page.locator('#save').click();await(await saved).saveAs('tmp/batch-project.json');const project=JSON.parse(await readFile('tmp/batch-project.json','utf8'));assert.equal(project.dossiers.reduce((n,d)=>n+d.sources.length,0),100);
// Both upload routes use the same boundary check; a rejected drop must be atomic.
await page.evaluate(()=>{const dt=new DataTransfer();for(let i=0;i<101;i++)dt.items.add(new File(['Test'],`S4d_Extra${i}_Kommentar.txt`,{type:'text/plain'}));document.querySelector('#drop').dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:dt}))});
assert.match(await page.locator('#status').textContent(),/101 Dateien ausgewählt/);assert.equal(await page.locator('[data-select]').count(),34);
await page.locator('#files').setInputFiles([{name:'S4d_Fehlerhaft_Text.docx',mimeType:'application/octet-stream',buffer:Buffer.from('broken')},{name:'S4d_Testperson33_Text.txt',mimeType:'text/plain',buffer:Buffer.from('Weiterverarbeitung funktioniert')}]);
await page.waitForFunction(()=>document.querySelector('#import-progress')?.textContent.includes('2 von 2 Dateien verarbeitet'));
assert.match(await page.locator('#import-progress').textContent(),/1 eingelesen · 1 fehlgeschlagen/);assert.match(await page.locator('#import-progress').textContent(),/S4d_Fehlerhaft_Text.docx/);assert.equal(await page.locator('#upload').isDisabled(),false);assert.deepEqual(errors,[]);
console.log(JSON.stringify({files:100,pdfs:33,docx:66,dossiers:34,complete:33,progress:true,atomicLimit101:true,continuesAfterBadFile:true,errors}));await browser.close();
