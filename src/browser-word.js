import {unzipSync} from 'fflate';
import {PDFDocument} from 'pdf-lib';
import {MAX_FILE} from './model.js';
import {readWordComments,addWordComments} from './word-comments.js';

// All rendering takes place in an isolated document. No Word installation or server.
export async function convertInBrowser(file){
 if(file.size>MAX_FILE)throw Error('Datei zu gross. Maximal 25 MB pro Datei.');
 const input=new Uint8Array(await file.arrayBuffer());let expanded=0;
 const entries=unzipSync(input,{filter:f=>{expanded+=f.originalSize;if(expanded>80*1024*1024)throw Error('Entpacktes Dokument ist zu gross (max. 80 MB).');return f.name==='word/document.xml'}});
 if(!entries['word/document.xml'])throw Error('Die Datei enthält kein lesbares Word-Dokument.');
 const [{renderAsync},{default:html2canvas}]=await Promise.all([import('docx-preview'),import('html2canvas')]);
 const frame=document.createElement('iframe');frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;
 frame.style.cssText='position:fixed;left:-20000px;top:0;width:1400px;height:1200px;border:0;pointer-events:none';document.body.append(frame);
 try{
  const doc=frame.contentDocument;
  doc.open();doc.write('<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: blob:; style-src \'unsafe-inline\'; font-src data: blob:"><style>html,body{margin:0;background:white;font-family:Arial,sans-serif}*{box-sizing:border-box}</style></head><body><main></main></body></html>');doc.close();
  const root=doc.querySelector('main');
  await renderAsync(input,root,doc.head,{inWrapper:false,className:'dossier-docx',ignoreLastRenderedPageBreak:false,breakPages:true,useBase64URL:true,renderComments:false,renderAltChunks:false,renderHeaders:true,renderFooters:true,renderFootnotes:true,renderEndnotes:true});
  // Word-only fonts need a predictable browser fallback instead of Times.
  for(const sheet of doc.styleSheets)for(const rule of sheet.cssRules){if(rule.style?.fontFamily)rule.style.fontFamily+=', Arial, sans-serif';}
  for(const el of root.querySelectorAll('[style]'))if(el.style.fontFamily)el.style.fontFamily+=', Arial, sans-serif';
  await doc.fonts.ready;
  await Promise.all(Array.from(root.querySelectorAll('img')).map(img=>img.decode().catch(()=>{})));
  const sections=Array.from(root.querySelectorAll('section.dossier-docx'));if(!sections.length)throw Error('Word-Seiten konnten nicht dargestellt werden.');
  const pdf=await PDFDocument.create(),pageTexts=[];
  for(const section of sections){
   section.style.boxShadow='none';section.style.margin='0';section.style.overflow='visible';
   const bounds=section.getBoundingClientRect(),width=Math.ceil(bounds.width),height=Math.ceil(Math.max(section.scrollHeight,bounds.height));
   const computed=frame.contentWindow.getComputedStyle(section);
   const nominal=parseFloat(computed.minHeight)||1123;
   const sheetHeight=Math.max(400,Math.min(nominal,1600));
   // Use text-line boundaries when a document has no saved Word page breaks.
   const lines=[];const walker=doc.createTreeWalker(section,4);let node;
   while(node=walker.nextNode()){if(!node.textContent.trim())continue;const range=doc.createRange();range.selectNodeContents(node);for(const r of range.getClientRects())if(r.height)lines.push({top:r.top-bounds.top,bottom:r.bottom-bounds.top,text:node.textContent});}
   let top=0;
   while(top<height-1){
    let end=Math.min(top+sheetHeight,height);if(height-end<4)end=height;
    if(end<height){const crossing=lines.filter(l=>l.top<end&&l.bottom>end);if(crossing.length){const safe=Math.min(...crossing.map(l=>l.top))-1;if(safe>top+sheetHeight*.5)end=safe;}}
    const sliceHeight=Math.max(1,Math.ceil(end-top));
    const canvas=await html2canvas(section,{scale:1.7,backgroundColor:'#ffffff',width,height:sliceHeight,y:top,logging:false,windowWidth:1400,windowHeight:1200,scrollX:0,scrollY:0});
    const bytes=await new Promise(resolve=>canvas.toBlob(async blob=>resolve(new Uint8Array(await blob.arrayBuffer())),'image/jpeg',.94));
    const image=await pdf.embedJpg(bytes),page=pdf.addPage([width*.75,sheetHeight*.75]);
    page.drawImage(image,{x:0,y:(sheetHeight-sliceHeight)*.75,width:width*.75,height:sliceHeight*.75});
    pageTexts.push(lines.filter(l=>l.bottom>top&&l.top<end).map(l=>l.text).join(' '));
    canvas.width=canvas.height=1;top=end;
   }
  }
  const result=await addWordComments(await pdf.save(),readWordComments(input),pageTexts);
  let binary='';for(let i=0;i<result.length;i+=8192)binary+=String.fromCharCode(...result.subarray(i,i+8192));
  return {text:'',original:btoa(binary),warning:'Im Browser erstelltes PDF mit Formatierung, Tabellen und vollständigen Kommentaren. Schriftarten und Seitenumbrüche können von Microsoft Word abweichen. Der Dokumenttext wird als Bild ausgegeben.'};
 }finally{frame.remove();}
}
