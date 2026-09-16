// Read the editable import format too, so previously saved projects gain the new layout.
export function annotatedParagraphs(text){
 const divider=/^RANDBEMERKUNGEN\s*$/m.exec(text);if(!divider)return null;
 const body=text.slice(0,divider.index).trim(),tail=text.slice(divider.index+divider[0].length).trim();
 const markers=[...tail.matchAll(/^\[R(\d+)\]\s*/gm)];if(!markers.length)return null;
 const notes=new Map(markers.map((m,i)=>[m[1],tail.slice(m.index+m[0].length,markers[i+1]?.index??tail.length).trim()]));
 const used=new Set();
 const paragraphs=[];let current={runs:[],notes:[]},ids=new Set();
 const append=(text,style={},id)=>{
  const lines=text.split(/\n+/);
  for(let i=0;i<lines.length;i++){
   if(i){if(current.runs.some(r=>r.text.trim()))paragraphs.push(current);current={runs:[],notes:[]};ids=new Set();}
   if(lines[i])current.runs.push({text:lines[i],...style});
   if(id&&lines[i].trim()&&!ids.has(id)){current.runs.push({text:` [${id}]`,bold:true,color:'#087f75',fontSize:9});ids.add(id);used.add(id);current.notes.push({id,text:notes.get(id)});}
  }
 };
 let pos=0;
 for(const m of body.matchAll(/\[R(\d+):\s*([^]*?)\]|\[R(\d+)\]/g)){
  append(body.slice(pos,m.index));const id=m[1]||m[3];
  if(!notes.has(id))append(m[0]);
  else if(m[1])append(m[2],{background:'#e4f0ed'},id);
  else if(!ids.has(id)){current.runs.push({text:` [${id}]`,bold:true,color:'#087f75',fontSize:9});ids.add(id);used.add(id);current.notes.push({id,text:notes.get(id)});}
  pos=m.index+m[0].length;
 }
 append(body.slice(pos));if(current.runs.some(r=>r.text.trim()))paragraphs.push(current);
 const unanchored=[...notes].filter(([id])=>!used.has(id)).map(([id,text])=>({id,text}));
 if(unanchored.length)paragraphs.push({runs:[{text:'Weitere Kommentare ohne Textverweis',italics:true}],notes:unanchored});
 return paragraphs;
}

export function annotatedContent(text){
 const paragraphs=annotatedParagraphs(text);if(!paragraphs)return null;
 return {
  table:{headerRows:1,widths:['*',190],body:[
   [{text:'TEXT',bold:true,color:'#1b3650',fontSize:10},{text:'RANDKOMMENTARE',bold:true,color:'#087f75',fontSize:10}],
   ...paragraphs.map(p=>[
    {text:p.runs,fontSize:11,lineHeight:1.2,margin:[0,4,0,8]},
    {stack:p.notes.length?p.notes.map(n=>({unbreakable:n.text.split('\n').reduce((sum,line)=>sum+Math.max(1,Math.ceil(line.length/18)),0)<38,stack:[{text:`Kommentar ${n.id}`,bold:true,color:'#087f75',fontSize:10.5,margin:[0,0,0,5]},{text:n.text,fontSize:10.5,lineHeight:1.18}],margin:[0,4,0,12]})):[{text:''}],fillColor:p.notes.length?'#f2f7f6':undefined}
   ])
  ]},
  layout:{hLineWidth:i=>i===1?1:0,vLineWidth:i=>i===1?.7:0,hLineColor:()=> '#b8cec9',vLineColor:()=> '#cfddda',paddingLeft:i=>i===0?0:12,paddingRight:i=>i===0?14:8,paddingTop:()=>6,paddingBottom:()=>6},margin:[0,5,0,15]
 };
}
