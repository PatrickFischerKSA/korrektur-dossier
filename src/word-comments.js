import {unzipSync,strFromU8} from 'fflate';
import {PDFDocument} from 'pdf-lib';
import pdfMake from 'pdfmake/build/pdfmake';
import fonts from 'pdfmake/build/vfs_fonts';
pdfMake.addVirtualFileSystem(fonts);
const normalize=s=>s.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const attr=(node,name)=>Array.from(node.attributes||[]).find(a=>a.localName===name)?.value||'';
export function readWordComments(bytes){
 const zip=unzipSync(bytes,{filter:f=>['word/comments.xml','word/document.xml'].includes(f.name)});
 if(!zip['word/comments.xml'])return [];
 const xml=b=>new DOMParser().parseFromString(strFromU8(b),'application/xml');
 const nodes=doc=>Array.from(doc.getElementsByTagName('*'));
 const notes=nodes(xml(zip['word/comments.xml'])).filter(n=>n.localName==='comment').map((n,i)=>({id:attr(n,'id'),number:i+1,author:attr(n,'author'),text:nodes(n).filter(t=>t.localName==='p').map(p=>nodes(p).filter(t=>t.localName==='t').map(t=>t.textContent).join('')).join('\n'),quote:''}));
 const active=new Set(),byId=new Map(notes.map(n=>[n.id,n]));
 if(zip['word/document.xml'])for(const n of nodes(xml(zip['word/document.xml']))){
  if(n.localName==='commentRangeStart')active.add(attr(n,'id'));
  if(n.localName==='commentRangeEnd')active.delete(attr(n,'id'));
  if(n.localName==='t')for(const id of active){const note=byId.get(id);if(note)note.quote+=n.textContent;}
 }
 return notes.filter(n=>n.text.trim());
}
export async function addWordComments(pdf,notes){
 if(!notes.length)return pdf;
 const {getDocument,GlobalWorkerOptions}=await import('pdfjs-dist');const {default:worker}=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');GlobalWorkerOptions.workerSrc=worker;
 const task=getDocument({data:pdf.slice(),isEvalSupported:false}),pageTexts=[];
 try{const doc=await task.promise;for(let i=1;i<=doc.numPages;i++)pageTexts.push(normalize((await(await doc.getPage(i)).getTextContent()).items.map(i=>i.str).join(' ')));}finally{await task.destroy()}
 const grouped=pageTexts.map(()=>[]),unmatched=[];
 for(const note of notes){const quote=normalize(note.quote);const candidates=quote?pageTexts.flatMap((text,i)=>text.includes(quote)?[i]:[]):[];if(candidates.length===1)grouped[candidates[0]].push(note);else unmatched.push(note);}
 const original=await PDFDocument.load(pdf),result=await PDFDocument.create(),sideWidth=250;
 const sidebar=async(list,height,title,width=sideWidth)=>PDFDocument.load(await new Promise((resolve,reject)=>{try{pdfMake.createPdf({pageSize:{width,height},pageMargins:[16,40,16,24],defaultStyle:{font:'Roboto',fontSize:10,lineHeight:1.15,color:'#203249'},header:(page)=>({text:title+(page>1?' · Fortsetzung':''),fontSize:9,bold:true,margin:[16,16,16,0]}),content:list.flatMap(n=>[{text:`R${n.number}${n.author?' · '+n.author:''}`,bold:true,color:'#087f75',margin:[0,9,0,4]},{text:n.quote?`Textstelle: «${n.quote}»`:'Ohne Textstellenverweis',italics:true,fontSize:9,margin:[0,0,0,5]},{text:n.text,margin:[0,0,0,12]}])}).getBuffer(resolve)}catch(e){reject(e)}}));
 for(let i=0;i<original.getPageCount();i++){
  const [page]=await result.copyPages(original,[i]);result.addPage(page);
  if(!grouped[i].length)continue;
  const {width,height}=page.getSize(),side=await sidebar(grouped[i],height,`Randkommentare · Originalseite ${i+1}`);
  const embedded=await result.embedPages(side.getPages());
  page.setMediaBox(0,0,width+sideWidth,height);page.setCropBox(0,0,width+sideWidth,height);page.drawPage(embedded[0],{x:width,y:0});
  for(const extra of embedded.slice(1)){const continuation=result.addPage([width+sideWidth,height]);continuation.drawPage(extra,{x:width,y:0});}
 }
 if(unmatched.length){const side=await sidebar(unmatched,842,'Kommentare · Zuordnung nicht eindeutig',595);for(const p of await result.copyPages(side,side.getPageIndices()))result.addPage(p);}
 return result.save();
}
