import {chromium} from '@playwright/test';
import {zipSync,strToU8,unzipSync} from 'fflate';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('tmp',{recursive:true});
const fixture=zipSync({'word/document.xml':strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Grüsse aus Zürich. </w:t></w:r><w:commentRangeStart w:id="0"/><w:r><w:t>Ein starker Gedanke.</w:t></w:r><w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r></w:p><w:p><w:del><w:r><w:delText>falsch</w:delText></w:r></w:del><w:ins><w:r><w:t>richtig</w:t></w:r></w:ins></w:p></w:body></w:document>'),'word/comments.xml':strToU8('<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:comment w:id="0" w:author="Lehrperson"><w:p><w:r><w:t>Beleg ergänzen.</w:t></w:r></w:p></w:comment></w:comments>')});
const original=await PDFDocument.create();const page=original.addPage();const font=await original.embedFont(StandardFonts.Helvetica);page.drawText('Originalkorrektur PDF',{x:50,y:700,font});const pdf=await original.save();
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1050},acceptDownloads:true});const ui=await context.newPage();const errors=[];ui.on('pageerror',e=>errors.push(e.message));
await ui.addInitScript(()=>{document.modelContext={registerTool:tool=>{window.registeredTool=tool}}});
await ui.goto(process.env.APP_URL||'http://127.0.0.1:5178/');
await ui.getByText('Hinweise zur Word-Ausgabe',{exact:true}).click();await ui.locator('#native-layout').uncheck();
await ui.locator('#auto-zip').uncheck();
const upload=files=>ui.locator('#files').setInputFiles(files);
const txt=(name,text='Beispiel mit Umlauten ä ö ü')=>({name,mimeType:'text/plain',buffer:Buffer.from(text)});
// Six shuffled files create two dossiers, despite identical personal names.
await upload([
 txt('S4e_AnnaMeier_Kommentar.txt'),
 {name:'S4d_AnnaMeier_Text_mit_Randbemerkungen.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:Buffer.from(fixture)},
 txt('S4d_AnnaMeier_Fehlerliste.txt'),
 {name:'S4e_AnnaMeier_Text_mit_Randbemerkungen.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf)},
 txt('S4e_AnnaMeier_Fehlerliste.txt'),
 txt('S4d_AnnaMeier_Kommentar.txt'),
]);
await ui.waitForFunction(()=>document.querySelector('.batch-summary').textContent.includes('2 vollständige Dossiers'));
assert.equal(await ui.locator('[data-select]').count(),2);
await ui.getByRole('button',{name:'S4d · Anna Meier',exact:false}).click();
assert.equal(await ui.locator('[data-field="group"]').inputValue(),'S4d');
await ui.locator('[data-tab="text"]').click();await ui.locator('[data-edit]').click();
const extracted=await ui.locator('[data-source]').inputValue();assert.match(extracted,/\[R1\].*Lehrperson: Beleg ergänzen/s);assert.match(extracted,/richtig/);assert.ok(!extracted.includes('falsch'));
await ui.screenshot({path:'tmp/desktop.png',fullPage:true});
const dl=ui.waitForEvent('download');await ui.locator('#pdf').click();await(await dl).saveAs('tmp/dossier.pdf');const output=await PDFDocument.load(await readFile('tmp/dossier.pdf'));assert.ok(output.getPageCount()>=4);
await ui.waitForFunction(()=>!document.querySelector('#all').disabled);
const zip=ui.waitForEvent('download');await ui.locator('#all').click();await(await zip).saveAs('tmp/dossiers.zip');const entries=Object.values(unzipSync(await readFile('tmp/dossiers.zip')));assert.equal(entries.length,2);assert.ok((await PDFDocument.load(entries[0])).getPageCount()>=5);
await ui.waitForFunction(()=>!document.querySelector('#all').disabled);
// Repeated role is held for review and never overwrites the first file.
await upload([txt('S4d_AnnaMeier_Fehlerliste_v2.txt','Neue Version')]);
await ui.locator('[data-resolve]').waitFor();assert.equal(await ui.locator('[data-select]').count(),2);assert.equal(await ui.locator('#all').isDisabled(),false);
await ui.locator('[data-resolve]').click();assert.match(await ui.locator('#status').textContent(),/bereits belegt/);
await ui.locator('[data-discard]').click();assert.equal(await ui.locator('#all').isDisabled(),false);
// A later batch creates an incomplete dossier and the final two files complete it.
await upload([txt('S4d_BenKeller_Fehlerliste.txt')]);await ui.waitForFunction(()=>document.querySelector('.batch-summary').textContent.includes('1 unvollständig'));
assert.equal(await ui.locator('#pdf').isDisabled(),true);
await upload([txt('S4d_BenKeller_Text.txt'),txt('S4d_BenKeller_Kommentar.txt')]);await ui.waitForFunction(()=>document.querySelector('.batch-summary').textContent.includes('3 vollständige Dossiers'));
// Unknown filenames can be assigned manually and survive project export.
await upload([txt('unbekannt.txt')]);await ui.locator('[data-resolve]').waitFor();
const save=ui.waitForEvent('download');await ui.locator('#save').click();await(await save).saveAs('tmp/project.json');const saved=JSON.parse(await readFile('tmp/project.json','utf8'));assert.equal(saved.dossiers.length,3);assert.equal(saved.pending.length,1);assert.ok(saved.dossiers.every(d=>d.matchKey));
await ui.locator('[data-pending-field="kind"]').selectOption('comments');await ui.locator('[data-pending-field="suggestedName"]').fill('S4d Clara Test');await ui.locator('[data-resolve]').click();assert.equal(await ui.locator('[data-select]').count(),4);assert.equal(await ui.locator('[data-resolve]').count(),0);
// Restore into a fresh tab and ensure an additional upload routes into the saved dossier.
const restored=await context.newPage();await restored.goto(process.env.APP_URL||'http://127.0.0.1:5178/');await restored.getByText('Hinweise zur Word-Ausgabe',{exact:true}).click();await restored.locator('#native-layout').uncheck();await restored.locator('#auto-zip').uncheck();await restored.locator('#project').setInputFiles('tmp/project.json');await restored.waitForFunction(()=>document.querySelectorAll('[data-select]').length===4);assert.equal(await restored.locator('[data-resolve]').count(),1);
await restored.locator('#files').setInputFiles(txt('S4d_AnnaMeier_Kommentar_v2.txt'));await restored.waitForFunction(()=>document.querySelectorAll('[data-resolve]').length===2);assert.equal(await restored.locator('[data-select]').count(),4);
await ui.setViewportSize({width:390,height:844});await ui.screenshot({path:'tmp/mobile.png',fullPage:true});assert.equal(await ui.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
assert.deepEqual(errors,[]);console.log(JSON.stringify({dossiers:3,shuffledFiles:true,sameNameDifferentClass:true,wordComments:true,pdfAndZip:true,incompleteBlocked:true,duplicatesProtected:true,manualResolution:true,projectRoundtrip:true,mobile:true,errors},null,2));
await browser.close();
