import test from 'node:test';
import assert from 'node:assert/strict';
import {decode,normalize,safeName,validateProject} from '../src/model.js';
test('handles UTF-8, Windows-1252 and UTF-16 text',()=>{assert.equal(decode(new TextEncoder().encode('Grüsse – schön')),'Grüsse – schön');assert.equal(decode(Uint8Array.of(71,114,252,115,115,101)),'Grüsse');assert.equal(decode(Uint8Array.of(255,254,65,0,228,0)),'Aä')});
test('normalizes copied text while preserving line structure',()=>assert.equal(normalize(' A\u00a0B\r\nC\u0000\r\n\n\n\nD '),'A B\nC\n\n\nD'));
test('validates projects and prevents invalid attachments',()=>{const d={title:'Test',person:'',group:'',date:'2026-09-16',sources:[{name:'Text',kind:'text',text:'Grüsse'}]};const p={format:'korrektur-dossier',version:1,dossiers:[d]};assert.equal(validateProject(p)[0].sources[0].text,'Grüsse');assert.throws(()=>validateProject({...p,version:99}));assert.throws(()=>validateProject({...p,dossiers:[{...d,sources:[{...d.sources[0],original:'javascript:evil'}]}]}));assert.notEqual(validateProject(p)[0].id,validateProject(p)[0].id)});
test('safe PDF names',()=>assert.equal(safeName('A/B: C'),'A-B- C'));
