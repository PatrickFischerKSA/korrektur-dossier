import {readWordComments,addWordComments} from './word-comments.js';
export const wordToken=()=>document.querySelector('meta[name="dossier-word-token"]')?.content;
export async function convertWithWord(file){
 const token=wordToken();if(!token)throw Error('Für Original-Word-Layout bitte die lokale Word-Ausgabe starten und die DOCX-Dateien dort hochladen.');
 const input=new Uint8Array(await file.arrayBuffer());
 const response=await fetch('/api/word/convert',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Dossier-Token':token},body:input,signal:AbortSignal.timeout(130000)});
 if(!response.ok){let message='Word-Konvertierung fehlgeschlagen.';try{message=(await response.json()).error||message}catch{}throw Error(message)}
 const pdf=new Uint8Array(await response.arrayBuffer());
 const notes=readWordComments(input);
 const annotated=await addWordComments(pdf,notes);
 let binary='';for(let i=0;i<annotated.length;i+=8192)binary+=String.fromCharCode(...annotated.subarray(i,i+8192));
 return {text:'',original:btoa(binary),warning:'Original-PDF aus Microsoft Word. Textlayout bleibt erhalten. Kommentare stehen mit zitierten Textstellen in einem zusätzlichen Seitenrand; uneindeutige Verweise im Kommentar-Anhang. Bearbeitungen bitte in der Word-Datei vornehmen und erneut hochladen.'};
}
