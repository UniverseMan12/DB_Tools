(function(root){
'use strict';
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
function subtract(f,p){
 if(!overlap(f,p))return [f];
 const x=Math.max(f.x,p.x),y=Math.max(f.y,p.y),r=Math.min(f.x+f.w,p.x+p.w),b=Math.min(f.y+f.h,p.y+p.h);
 return [{x:f.x,y:f.y,w:f.w,h:y-f.y},{x:f.x,y:b,w:f.w,h:f.y+f.h-b},{x:f.x,y,w:x-f.x,h:b-y},{x:r,y,w:f.x+f.w-r,h:b-y}].filter(r=>r.w>0&&r.h>0);
}
function pack(parts,W,H,rotate,sort,mode){
 let free=[{x:0,y:0,w:W,h:H}],placed=[];
 const ordered=[...parts].sort((a,b)=>sort(b)-sort(a)||a.id-b.id);
 for(const p of ordered){
  let best=null;
  for(const f of free)for(const turn of (rotate&&p.w!==p.h?[false,true]:[false])){
   const w=turn?p.h:p.w,h=turn?p.w:p.h;
   if(w>f.w||h>f.h)continue;
   const score=mode===0?[f.y+h,f.x,Math.min(f.w-w,f.h-h)]:mode===1?[Math.min(f.w-w,f.h-h),Math.max(f.w-w,f.h-h),f.y]:[f.y,f.w*f.h-w*h,f.x];
   if(!best||score.some((n,i)=>n<best.score[i]&&score.slice(0,i).every((v,j)=>v===best.score[j])))best={...p,x:f.x,y:f.y,w,h,rotated:turn,score};
  }
  if(!best)return null;
  placed.push(best);
  const next=[];
  for(const f of free){
   if(!overlap(f,best)){next.push(f);continue;}
   if(best.x>f.x)next.push({...f,w:best.x-f.x});
   if(best.x+best.w<f.x+f.w)next.push({...f,x:best.x+best.w,w:f.x+f.w-best.x-best.w});
   if(best.y>f.y)next.push({...f,h:best.y-f.y});
   if(best.y+best.h<f.y+f.h)next.push({...f,y:best.y+best.h,h:f.y+f.h-best.y-best.h});
  }
  free=next.filter((a,i)=>!next.some((b,j)=>i!==j&&a.x>=b.x&&a.y>=b.y&&a.x+a.w<=b.x+b.w&&a.y+a.h<=b.y+b.h&&(a.x!==b.x||a.y!==b.y||a.w!==b.w||a.h!==b.h||j<i)));
 }
 return {placed,length:Math.max(...placed.map(p=>p.y+p.h))};
}
function validate(result,parts,W,H,rotate){
 if(result.placed.length!==parts.length)throw Error('Unvollständiger Plan.');
 const ids=new Set();
 for(const p of result.placed){
  const original=parts.find(a=>a.id===p.id);
  if(!original||ids.has(p.id))throw Error('Doppelte oder unbekannte Teile.');ids.add(p.id);
  if(p.x<0||p.y<0||p.x+p.w>W||p.y+p.h>H)throw Error('Teil ausserhalb der Rolle.');
  if(!((p.w===original.w&&p.h===original.h)||(rotate&&p.w===original.h&&p.h===original.w)))throw Error('Falsche Masse oder Strukturrichtung.');
 }
 for(let i=0;i<result.placed.length;i++)for(let j=i+1;j<result.placed.length;j++)if(overlap(result.placed[i],result.placed[j]))throw Error('Überlappende Teile.');
}
function optimize(parts,W,H,rotate){
 if(!parts.length||!Number.isSafeInteger(W*H)||W<=0||H<=0)throw Error('Bitte gültige Rollenmasse und mindestens ein Teil eingeben.');
 for(const p of parts)if(!Number.isInteger(p.w)||!Number.isInteger(p.h)||p.w<=0||p.h<=0)throw Error('Ungültige Teilmasse.');
 if(parts.some(p=>!(p.w<=W&&p.h<=H)&&!(rotate&&p.h<=W&&p.w<=H)))throw Error('Mindestens ein Teil passt nicht auf die Rolle. Bitte Masse und Folientyp prüfen.');
 if(parts.reduce((s,p)=>s+p.w*p.h,0)>W*H)throw Error('Die Zuschnittfläche ist grösser als die gesamte Rolle.');
 let best=null;
 for(const sort of [p=>p.w*p.h,p=>Math.max(p.w,p.h),p=>p.h,p=>p.w,p=>Math.min(p.w,p.h)])for(let mode=0;mode<3;mode++){
  const r=pack(parts,W,H,rotate,sort,mode);if(r&&(!best||r.length<best.length))best=r;
 }
 if(!best)throw Error('Für diese Rollenlänge wurde keine passende Anordnung gefunden. Bitte eine längere Rolle versuchen.');
 validate(best,parts,W,H,rotate);
 let rest=[{x:0,y:0,w:W,h:best.length}];
 for(const p of best.placed)rest=rest.flatMap(f=>subtract(f,p));
 best.rest=rest.sort((a,b)=>a.y-b.y||a.x-b.x);
 best.area=parts.reduce((s,p)=>s+p.w*p.h,0);
 if(best.area+rest.reduce((s,p)=>s+p.w*p.h,0)!==W*best.length)throw Error('Fehler in der Flächenprüfung.');
 return best;
}
const api={optimize,validate,subtract,overlap};
if(typeof module!=='undefined')module.exports=api;else root.Packing=api;
})(typeof globalThis!=='undefined'?globalThis:this);
