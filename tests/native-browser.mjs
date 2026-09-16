import {chromium} from '@playwright/test';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {unzipSync,zipSync,strToU8} from 'fflate';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('tmp',{recursive:true});
const makePdf=async(label,width)=>{const p=await PDFDocument.create(),font=await p.embedFont(StandardFonts.Helvetica);p.addPage([width,400]).drawText(label,{x:20,y:350,font,size:12});return Buffer.from(await p.save())};
const errorPdf=await makePdf('Fehlerliste ORIGINAL',220),wordPdf=await makePdf('Word ORIGINAL - Vollstaendiger Kommentar',330),commentPdf=await makePdf('Gutachten ORIGINAL',440);
const browser=await chromium.launch({channel:'chrome'}),page=await browser.newPage();await page.goto('http://127.0.0.1:5186/');
assert.equal(await page.locator('#native-layout').isChecked(),true);await page.locator('#auto-zip').uncheck();await page.locator('#cover').uncheck();
let requests=0;
await page.route('**/api/word/convert',route=>{requests++;return route.fulfill({status:200,contentType:'application/pdf',body:requests===1?wordPdf:commentPdf})});
const docx=Buffer.from(zipSync({'word/document.xml':strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Word text</w:t></w:r></w:p></w:body></w:document>')}));
await page.locator('#files').setInputFiles([{name:'S4d_AnnaMeier_Fehlerliste.pdf',mimeType:'application/pdf',buffer:errorPdf},{name:'S4d_AnnaMeier_mit_Randbemerkungen.docx',mimeType:'application/octet-stream',buffer:docx},{name:'S4d_AnnaMeier_mit_Randbemerkungen-korrektur.docx',mimeType:'application/octet-stream',buffer:docx}]);
await page.waitForFunction(()=>!document.querySelector('#pdf').disabled);
const done=page.waitForEvent('download');await page.locator('#pdf').click();await(await done).saveAs('tmp/native-merged.pdf');const merged=await PDFDocument.load(await readFile('tmp/native-merged.pdf'));
assert.equal(merged.getPageCount(),3);assert.deepEqual(merged.getPages().map(p=>p.getWidth()),[220,330,440]);
// CopyPages must preserve the page content streams verbatim, without added labels or footers.
function streams(doc){return doc.getPages().map(p=>{const c=p.node.Contents();const refs=c.asArray?c.asArray():[c];return refs.map(r=>Buffer.from(doc.context.lookup(r).getContents()).toString('base64'))})}
assert.deepEqual(streams(merged),[...(streams(await PDFDocument.load(errorPdf))),...(streams(await PDFDocument.load(wordPdf))),...(streams(await PDFDocument.load(commentPdf)))]);
// Comments omitted by Word must be retained in the additional comment area/appendix.
await page.unroute('**/api/word/convert');await page.route('**/api/word/convert',r=>r.fulfill({status:200,contentType:'application/pdf',body:commentPdf}));
const annotated=Buffer.from(zipSync({'word/document.xml':strToU8('<w:document xmlns:w="urn:w"><w:p><w:r><w:t>Body</w:t></w:r></w:p></w:document>'),'word/comments.xml':strToU8('<w:comments xmlns:w="urn:w"><w:comment w:id="0"><w:p><w:r><w:t>Dieser wichtige Kommentar darf niemals fehlen.</w:t></w:r></w:p></w:comment></w:comments>')}));
await page.locator('#files').setInputFiles({name:'S4d_BenMeier_mit_Randbemerkungen.docx',mimeType:'application/octet-stream',buffer:annotated});await page.waitForFunction(()=>document.querySelector('#import-progress').textContent.includes('1 von 1 Dateien verarbeitet'));
assert.doesNotMatch(await page.locator('#import-progress').textContent(),/nicht alle Randkommentare/);
assert.match(await page.locator('body').textContent(),/zusätzlichen Seitenrand/);
const saved=page.waitForEvent('download');await page.getByRole('button',{name:'Projekt sichern'}).click();const savedProject=JSON.parse(await readFile(await(await saved).path()));const added=savedProject.dossiers.flatMap(d=>d.sources).find(s=>s.name.includes('BenMeier'));
const withComments=await PDFDocument.load(Buffer.from(added.original,'base64'));assert.equal(withComments.getPageCount(),2);assert.equal(withComments.getPage(1).getWidth(),595);
await page.close();await browser.close();
// The actual local server rejects conversion requests without its page-scoped token.
const denied=await fetch('http://127.0.0.1:5186/api/word/convert',{method:'POST',headers:{Origin:'http://127.0.0.1:5186'},body:'test'});assert.equal(denied.status,403);
const zip=unzipSync(await readFile('dist/Dossier-Word-Mac.zip'));assert.ok(zip['Dossier-Word/local/Dossier-starten.command']);assert.ok(zip['Dossier-Word/dist/index.html']);
console.log(JSON.stringify({nativeMergePageOrder:true,originalPageSizes:true,unalteredContentStreams:true,commentFallbackImported:true,unauthorizedRequestRejected:true,macPackage:true,wordEngine:'mocked; real Word validation separate'}));
