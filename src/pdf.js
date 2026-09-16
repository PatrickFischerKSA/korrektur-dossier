import pdfMake from 'pdfmake/build/pdfmake';
import fonts from 'pdfmake/build/vfs_fonts';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
pdfMake.addVirtualFileSystem(fonts);
const labels={errors:'Fehlerliste',text:'Korrigierter Text',comments:'Kommentare'};
export async function createPdf(d){
 const content=[];
 if(d.cover)content.push({text:'KORREKTURDOSSIER',color:'#087f75',fontSize:12,characterSpacing:2,margin:[0,60,0,30]},{text:d.title||'Korrekturdossier',fontSize:32,bold:true,margin:[0,0,0,26]},{text:[d.person,d.group,d.date?d.date.split('-').reverse().join('.'):null].filter(Boolean).join('\n'),fontSize:15,lineHeight:1.5},{text:Object.entries(labels).filter(([k])=>d.sources.some(s=>s.kind===k)).map(([,v])=>v).join('  /  '),fontSize:10,color:'#617386',margin:[0,60,0,0]});
 let sections=0;const originals=[];
 for(const [kind,label]of Object.entries(labels)){
  const sources=d.sources.filter(s=>s.kind===kind);if(!sources.length)continue;
  content.push({text:label,fontSize:23,bold:true,color:'#1b3650',margin:[0,0,0,22],...(d.cover||sections?{pageBreak:'before'}:{})});sections++;
  for(const s of sources){content.push({text:s.name,fontSize:12,bold:true,margin:[0,12,0,8]});
   if(s.original){originals.push(s);content.push({text:`Original-PDF im Anhang ${originals.length}.`,fontSize:10,color:'#617386',margin:[0,0,0,8]})}
   if(s.text.trim())content.push({text:s.text.replace(/\t/g,'    '),fontSize:10.5,lineHeight:1.3,margin:[0,0,0,14]});
  }
 }
 if(!sections)throw Error('Bitte zuerst Quellen hinzufügen.');
 const definition={info:{title:d.title||'Korrekturdossier',author:'',creator:'Dossier'},pageSize:'A4',pageMargins:[48,52,48,52],defaultStyle:{font:'Roboto',color:'#203249'},content,header:()=>({text:d.cover?'':d.title,fontSize:8,color:'#617386',margin:[48,24,48,0]})};
 const buffer=await new Promise((resolve,reject)=>{try{pdfMake.createPdf(definition).getBuffer(resolve)}catch(e){reject(e)}});
 const merged=await PDFDocument.load(buffer);
 for(const s of originals){
  let doc;try{doc=await PDFDocument.load(Uint8Array.from(atob(s.original),c=>c.charCodeAt(0)))}catch{throw Error(`Der Anhang «${s.name}» konnte nicht in das PDF eingefügt werden.`)}
  const pages=await merged.copyPages(doc,doc.getPageIndices());for(const page of pages)merged.addPage(page);
 }
 const font=await merged.embedFont(StandardFonts.Helvetica);const pages=merged.getPages();
 for(let i=0;i<pages.length;i++){const p=pages[i],{width}=p.getSize();const text=`${i+1} / ${pages.length}`;const x=width-32-font.widthOfTextAtSize(text,8);p.drawRectangle({x:x-4,y:13,width:font.widthOfTextAtSize(text,8)+8,height:13,color:rgb(1,1,1),opacity:.95});p.drawText(text,{x,y:17,size:8,font,color:rgb(.35,.42,.48)})}
 return merged.save();
}
