import test from 'node:test';
import assert from 'node:assert/strict';
import {annotatedParagraphs,annotatedContent} from '../src/annotations.js';
test('old saved imports place full comments beside their paragraph without duplicate markers',()=>{
 const p=annotatedParagraphs('Ein [R1: Beispiel] [R1] im Text.\nNoch [R2: etwas] [R2].\n\nRANDBEMERKUNGEN\n[R1] Bitte genauer erklären.\n\n[R2] Autor: Zweiter Kommentar.');
 assert.equal(p.length,2);assert.equal(p[0].notes[0].text,'Bitte genauer erklären.');assert.equal(p[1].notes[0].text,'Autor: Zweiter Kommentar.');
 const body=p[0].runs.map(r=>r.text).join('');assert.equal((body.match(/\[1\]/g)||[]).length,1);assert.ok(!body.includes('[R1'));assert.ok(p[0].runs.some(r=>r.background&&r.text==='Beispiel'));
});
test('unanchored notes and unknown markers are never discarded',()=>{const p=annotatedParagraphs('Text [R99].\nRANDBEMERKUNGEN\n[R1] Nicht verankert');assert.match(p[0].runs.map(r=>r.text).join(''),/R99/);assert.equal(p[1].notes[0].text,'Nicht verankert')});
test('ordinary text remains unchanged and long notes stay complete',()=>{assert.equal(annotatedContent('Normaler Text [R1]'),null);const long='Langer Kommentar. '.repeat(1000);const p=annotatedParagraphs('Text [R1].\nRANDBEMERKUNGEN\n[R1] '+long);assert.equal(p[0].notes[0].text,long.trim())});
test('a selection spanning paragraphs stays highlighted and readable',()=>{const p=annotatedParagraphs('Vorher [R1: Anfang\nFortsetzung] [R1] danach.\nRANDBEMERKUNGEN\n[R1] Beide Absätze prüfen.');assert.equal(p.length,2);assert.ok(p.every(x=>x.notes[0].text==='Beide Absätze prüfen.'));assert.ok(p.every(x=>!x.runs.some(r=>r.text.includes('[R1'))));});
