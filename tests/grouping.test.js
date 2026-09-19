import test from 'node:test';
import assert from 'node:assert/strict';
import {identifyFilename,matchingDossiers,completeness} from '../src/grouping.js';
import {validatePending,validateProject} from '../src/model.js';
test('correction workshop triplet groups text, assessment and error list together',()=>{
 const results=['S4d_AnnaMeier_mit_Randbemerkungen.docx','S4d_AnnaMeier_mit_Randbemerkungen-korrektur.docx','S4d_AnnaMeier_Fehlerliste.pdf'].map(identifyFilename);
 assert.deepEqual(results.map(x=>x.kind),['text','comments','errors']);
 assert.ok(results.every(x=>x.key==='s4d anna meier'&&x.name==='Anna Meier'&&x.group==='S4d'&&!x.reason));
 assert.equal(identifyFilename('S4d_AnnaMeier_mit_Randbemerkungen-korrektur_v2.docx').kind,'comments');
 assert.equal(identifyFilename('S4d_AnnaMeier_mit_Randbemerkungen-korrektur_v2.docx').key,'s4d anna meier');
});
test('class and CamelCase name join all three document types',()=>{
 const results=['S4d_AnnaMeier_Fehlerliste.docx','S4d_AnnaMeier_Text_mit_Randbemerkungen.pdf','S4d_AnnaMeier_Kommentar.txt'].map(identifyFilename);
 assert.deepEqual(results.map(x=>x.kind),['errors','text','comments']);assert.equal(new Set(results.map(x=>x.key)).size,1);assert.equal(results[0].group,'S4d');assert.equal(results[0].name,'Anna Meier');assert.ok(results.every(x=>!x.reason));
 assert.notEqual(identifyFilename('S4e_AnnaMeier_Kommentar.txt').key,results[0].key);
});
test('tolerates umlauts, separators, descriptors and explicit versions',()=>{
 const a=identifyFilename('FMS2a_LeaMüller_Text_mit_Randkommentaren.pdf');const b=identifyFilename('FMS2a_LeaMueller_Fehlerübersicht_v2.docx');assert.equal(a.key,b.key);assert.equal(a.kind,'text');assert.equal(b.kind,'errors');
 assert.equal(identifyFilename('S4d_AnnaMeier_Korrigierter_Text_mit_Randbemerkungen.docx').key,'s4d anna meier');
 assert.equal(identifyFilename('Kommentar_Anna_Meier.txt').key,'anna meier');
});
test('ambiguous or missing roles and names remain unresolved',()=>{for(const name of ['S4d_AnnaMeier_Abgabe.txt','Fehlerliste.docx','S4d_AnnaMeier_Text_Kommentar.txt'])assert.ok(identifyFilename(name).reason)});
test('three sources must contain exactly one of each type',()=>{assert.equal(completeness({sources:[{kind:'errors'},{kind:'text'},{kind:'comments'}]}).complete,true);assert.equal(completeness({sources:[{kind:'errors'},{kind:'errors'},{kind:'comments'}]}).complete,false)});
test('project roundtrip retains routing identity and unresolved sources',()=>{const d={title:'Dossier',person:'Anna Meier',group:'S4d',date:'',matchKey:'s4d anna meier',sources:[]};const loaded=validateProject({format:'korrektur-dossier',version:1,dossiers:[d]});assert.equal(matchingDossiers(loaded,'s4d anna meier').length,1);assert.equal(matchingDossiers([...loaded,...loaded],'s4d anna meier').length,2);assert.equal(matchingDossiers(loaded,'s4e anna meier').length,0);const pending=validatePending([{name:'unknown.txt',kind:null,text:'Text',reason:'Unklar',suggestedName:'Anna'}]);assert.equal(pending[0].kind,null);assert.throws(()=>validatePending([{}]));});
test('teacher suffixes do not split a triplet or misclassify its assessment',()=>{
 for(const suffix of ['korrFIP','korrFiP','korrAB','korr AB']){
  const names=[`KS5_LeaMüller_mit_Randbemerkungen_${suffix}.docx`,`KS5_LeaMüller_mit_Randbemerkungen_${suffix}-korrektur.docx`,'KS5_LeaMüller_Fehlerliste.docx'];
  const parsed=names.map(identifyFilename);assert.deepEqual(parsed.map(p=>p.kind),['text','comments','errors']);assert.ok(parsed.every(p=>p.key==='ks5 lea mueller'&&p.name==='Lea Müller'&&!p.reason));
 }
});
test('Mac decomposed umlauts and composed umlauts share the same identity',()=>{
 const filenames=['KS5_LeaMüller_mit_Randbemerkungen_korrFIP.docx'.normalize('NFD'),'KS5_LeaMüller_mit_Randbemerkungen_korrFiP-korrektur.docx','KS5_LeaMueller_Fehlerliste.docx'];
 assert.equal(new Set(filenames.map(f=>identifyFilename(f).key)).size,1);
});
test('different students/classes and duplicate document versions remain distinct',()=>{
 const a=identifyFilename('KS5_LeaMüller_mit_Randbemerkungen_korrFIP.docx');
 assert.notEqual(a.key,identifyFilename('KS6_LeaMüller_mit_Randbemerkungen_korrFIP.docx').key);
 assert.notEqual(a.key,identifyFilename('KS5_LenaMüller_mit_Randbemerkungen_korrFIP.docx').key);
 assert.equal(a.key,identifyFilename('KS5_LeaMüller_mit_Randbemerkungen.docx').key);
 assert.equal(completeness({sources:[{kind:'text'},{kind:'text'},{kind:'errors'},{kind:'comments'}]}).complete,false);
});
