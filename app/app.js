'use strict';
const $=id=>document.getElementById(id),fmt=(n,d=2)=>n.toLocaleString('de-CH',{maximumFractionDigits:d}),cm=n=>fmt(n/100),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let current=null;
function stale(){if(current){$('status').textContent='Eingaben geändert · neu berechnen';$('status').classList.add('stale');$('results').hidden=true;$('empty').hidden=false;$('empty').querySelector('h2').textContent='Eingaben geändert.';$('empty').querySelector('p').textContent='Bitte neu berechnen, um den aktuellen Plan zu sehen.';}}
function addRow(v=[]){const tr=document.createElement('tr');tr.innerHTML='<td><input aria-label="Bezeichnung" maxlength="80" placeholder="Freie Eingabe"></td><td><input aria-label="Breite in cm" type="number" min="0.01" step="0.01"></td><td><input aria-label="Länge in cm" type="number" min="0.01" step="0.01"></td><td><input aria-label="Anzahl" type="number" min="1" max="200" step="1" value="1"></td><td><button title="Position löschen" aria-label="Position löschen">×</button></td>';
tr.querySelector('button').onclick=()=>{tr.remove();stale();save();};tr.addEventListener('input',()=>{stale();save();});$('rows').append(tr);
 const f=tr.querySelectorAll('input');v.forEach((x,k)=>{if(x!==undefined)f[k].value=x;});
 tr.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(e.target===f[3]){addRow();$('rows').lastElementChild.querySelector('input').focus();}else{const k=[...f].indexOf(e.target);f[k+1]&&f[k+1].focus();}}});stale();save();}
function numeric(el,title,allowZero=false){const v=Number(el.value);if(!el.value.trim()||!Number.isFinite(v)||(allowZero?v<0:v<=0)||Math.abs(v*100-Math.round(v*100))>0.00001)throw Error(title+': Bitte eine gültige Zahl mit höchstens zwei Nachkommastellen eingeben.');return v;}
function calculate(){
 $('error').textContent='';$('calculate').disabled=true;
 setTimeout(()=>{try{
 const W=Math.round(numeric($('rollW'),'Rollenbreite')*100),H=Math.round(numeric($('rollH'),'Rollenlänge')*10000);
 if(W>100000||H>1000000)throw Error('DB Tools unterstützt Rollen bis 1.000 cm Breite und 100 m Länge.');
 const allowance=$('measure').value==='component'?Math.round(numeric($('allowance'),'Zugabe',true)*100):0;
 let parts=[];
 [...$('rows').children].forEach((tr,i)=>{const inputs=tr.querySelectorAll('input');if(!inputs[0].value.trim()&&!inputs[1].value&&!inputs[2].value)return;
 if(!inputs[0].value.trim())throw Error('Position '+(i+1)+': Bitte eine Bezeichnung eingeben.');
 const w=Math.round(numeric(inputs[1],'Breite, Position '+(i+1))*100)+allowance*2,h=Math.round(numeric(inputs[2],'Länge, Position '+(i+1))*100)+allowance*2,n=numeric(inputs[3],'Anzahl');
 if(!Number.isInteger(n)||parts.length+n>200)throw Error('Bitte ganze Stückzahlen verwenden; höchstens 200 Zuschnitte insgesamt.');
 for(let j=0;j<n;j++)parts.push({id:parts.length,name:inputs[0].value.trim(),w,h});
 });
 if(!parts.length)throw Error('Bitte mindestens eine vollständige Position erfassen.');
 const rotate=$('film').value==='uni';current={...Packing.optimize(parts,W,H,rotate),W,H,rotate};
 $('empty').hidden=true;$('results').hidden=false;$('status').textContent='✓ Plan geprüft';$('status').classList.remove('stale');render();document.dispatchEvent(new CustomEvent('dbtools:calculated'));
 }catch(e){$('error').textContent=e.message;$('results').hidden=true;$('empty').hidden=false;}finally{$('calculate').disabled=false;}},30);
}
function render(){
 const r=current,restArea=r.W*r.length-r.area;
 const stats=[['Benötigte Folienlänge',fmt(r.length/10000)+' m'],['Materialausnutzung',fmt(r.area/(r.W*r.length)*100,1)+' %'],['Anzahl Zuschnitte',r.placed.length],['Zuschnittfläche',fmt(r.area/1e8,4)+' m²'],['Restfläche im Zuschnitt',fmt(restArea/1e8,4)+' m²'],['Verbleibende Rollenlänge',fmt((r.H-r.length)/10000)+' m']];
 $('stats').innerHTML=stats.map(([a,b])=>'<div class="stat"><small>'+a+'</small><strong>'+b+'</strong></div>').join('');
 $('restCount').textContent='('+r.rest.length+' im Zuschnittbereich)';
 $('restRows').innerHTML=r.rest.map((p,i)=>'<tr><td class="red">R'+(i+1)+'</td><td>'+cm(p.w)+' × '+cm(p.h)+'</td><td>'+cm(p.x)+' / '+cm(p.y)+'</td><td>'+fmt(p.w*p.h/1e8,6)+'</td></tr>').join('')+(r.H>r.length?'<tr><td class="red">Restrolle</td><td>'+cm(r.W)+' × '+cm(r.H-r.length)+'</td><td>0 / '+cm(r.length)+'</td><td>'+fmt(r.W*(r.H-r.length)/1e8,6)+'</td></tr>':'');
 $('partRows').innerHTML=[...r.placed].sort((a,b)=>a.id-b.id).map(p=>'<tr><td>T'+(p.id+1)+'</td><td>'+esc(p.name)+'</td><td>'+cm(p.w)+' × '+cm(p.h)+'</td><td>'+cm(p.x)+' / '+cm(p.y)+'</td><td>'+(p.rotated?'90°':'0°')+'</td></tr>').join('');
 $('tail').textContent=r.H>r.length?'Unbenutzte Restrolle: '+cm(r.W)+' × '+cm(r.H-r.length)+' cm · '+fmt((r.H-r.length)/10000)+' m verbleibend. Ab Position '+cm(r.length)+' cm. Separat dargestellt, nicht im Planmassstab.':'Die Rollenlänge ist vollständig belegt. Kein unbenutzter Rollenteil.';
 draw();
}
function draw(){
 if(!current)return;const r=current,z=Number($('zoom').value)/100,s=Math.min(480/r.W,4000/r.length)*z,left=65,top=50,rw=r.W*s,rh=r.length*s,callouts=[];
 $('zoomValue').textContent=Math.round(z*100)+' %';
 let body='<rect x="'+left+'" y="'+top+'" width="'+rw+'" height="'+rh+'" fill="#fff" stroke="#243c33"/>';
 const colors=['#d0e4d8','#c9dcef','#e9d8b5','#daceeb','#bde1de','#edd0c2','#dfe4b7'];
 function rect(p,label,detail,color,rest){const x=left+p.x*s,y=top+p.y*s,w=p.w*s,h=p.h*s,full=label+' · '+detail;
 body+='<g><title>'+esc(full)+'; X '+cm(p.x)+' / Y '+cm(p.y)+' cm</title><rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+color+'" stroke="'+(rest?'#9e283c':'#49665a')+'" stroke-width="0.6"/>';
 if(w>Math.max(label.length*6.6,detail.length*6.3)+14&&h>52){body+='<text x="'+(x+w/2)+'" y="'+(y+h/2-5)+'" text-anchor="middle" fill="'+(rest?'white':'#203e33')+'" font-size="12"><tspan x="'+(x+w/2)+'">'+esc(label)+'</tspan><tspan x="'+(x+w/2)+'" dy="18">'+esc(detail)+'</tspan></text>';if(!r.rotate&&!rest&&h>85)body+='<text x="'+(x+w/2)+'" y="'+(y+h-12)+'" text-anchor="middle" fill="#274b3e">↓</text>';
 }else callouts.push({x:x+w/2,y:y+h/2,label,detail,rest});body+='</g>';}
 r.rest.forEach((p,i)=>rect(p,'R'+(i+1),cm(p.w)+' × '+cm(p.h)+' cm','#b8374b',true));
 r.placed.forEach(p=>rect(p,'T'+(p.id+1)+' · '+p.name,cm(p.w)+' × '+cm(p.h)+' cm'+(p.rotated?' ↻':''),'hsl('+((p.id*137.508)%360)+' 42% 83%)',false));
 callouts.sort((a,b)=>a.y-b.y);let last=top-48;const cx=left+rw+50,labelWidth=Math.max(330,...callouts.map(c=>c.label.length*9+24));
 for(const c of callouts){const yy=Math.max(c.y-18,last+48);last=yy;body+='<path d="M '+c.x+' '+c.y+' L '+(cx-14)+' '+(yy+18)+' H '+cx+'" stroke="'+(c.rest?'#b8374b':'#789187')+'" fill="none" stroke-width="0.8"/><rect x="'+cx+'" y="'+yy+'" width="'+labelWidth+'" height="40" rx="4" fill="'+(c.rest?'#b8374b':'#e4ece7')+'"/><text x="'+(cx+10)+'" y="'+(yy+15)+'" fill="'+(c.rest?'white':'#203e33')+'" font-size="11">'+esc(c.label)+'</text><text x="'+(cx+10)+'" y="'+(yy+31)+'" fill="'+(c.rest?'white':'#203e33')+'" font-size="11">'+esc(c.detail)+(!r.rotate&&!c.rest?' ↓':'')+'</text>';}
 body+='<text x="'+(left+rw/2)+'" y="26" text-anchor="middle" font-size="12" fill="#4c665b">← '+cm(r.W)+' cm →</text><text x="15" y="'+top+'" font-size="11" fill="#4c665b">0</text><text x="15" y="'+(top+rh+18)+'" font-size="11" fill="#4c665b">'+cm(r.length)+'</text><text x="15" y="'+(top+rh/2)+'" font-size="12" fill="#4c665b">↓ cm</text>';
 const width=Math.max(550,cx+(callouts.length?labelWidth+20:0)),height=Math.max(top+rh+40,last+60);
 $('plan').innerHTML='<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Massstabsgetreuer Zuschnittplan mit Reststücken" viewBox="0 0 '+width+' '+height+'" width="'+width+'" height="'+height+'" style="font-family:Segoe UI,Arial,sans-serif">'+body+'</svg>';
}
 $('add').onclick=()=>{addRow();$('rows').lastElementChild.querySelector('input').focus();};$('calculate').onclick=calculate;$('zoom').oninput=draw;
 for(const id of ['rollW','rollH','film','measure','allowance'])$(id).addEventListener('input',()=>{stale();save();});
 $('measure').onchange=()=>{$('allowanceWrap').hidden=$('measure').value!=='component';};
 $('film').onchange=()=>{$('direction').textContent=$('film').value==='uni'?'Unifolie: Teile dürfen zur Materialersparnis um 90° gedreht werden.':'Strukturfolie: Die eingegebene Länge folgt der Struktur (↓). Teile werden nicht gedreht.';};

const KEY='dbs-zuschnitt-v2',FIELDS=['rollW','rollH','film','measure','allowance'];
function rowsData(){return [...$('rows').children].map(tr=>[...tr.querySelectorAll('input')].map(i=>i.value));}
function save(){if(window.DBToolsPreferences&&window.DBToolsPreferences.autosave===false)return;try{const s={rows:rowsData()};FIELDS.forEach(id=>s[id]=$(id).value);localStorage.setItem(KEY,JSON.stringify(s));}catch(e){}}
function sync(){$('measure').onchange();$('film').onchange();}
function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(!s||!Array.isArray(s.rows)||!s.rows.length)return false;FIELDS.forEach(id=>{if(s[id]!==undefined)$(id).value=s[id];});$('rows').innerHTML='';s.rows.forEach(r=>addRow(r));sync();return true;}catch(e){return false;}}
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
$('example').onclick=()=>{$('rollW').value=122;$('rollH').value=50;$('film').value='uni';$('measure').value='finished';$('rows').innerHTML='';[['Küchenfront oben',60,72,4],['Seitenwand',58,210,2],['Schubladenblende',90,18,3],['Tischplatte',120,80,1]].forEach(r=>addRow(r));sync();};
$('clear').onclick=()=>{$('rows').innerHTML='';addRow();};
$('csv').onclick=()=>{if(!current)return;const r=current,q=s=>'"'+String(s).replace(/"/g,'""')+'"',L=['Teil;Bezeichnung;Breite (cm);Länge (cm);X (cm);Y (cm);Drehung'];
 [...r.placed].sort((a,b)=>a.id-b.id).forEach(p=>L.push(['T'+(p.id+1),q(p.name),cm(p.w),cm(p.h),cm(p.x),cm(p.y),p.rotated?'90°':'0°'].join(';')));
 L.push('','Reststück;;Breite (cm);Länge (cm);X (cm);Y (cm);Fläche (m²)');
 r.rest.forEach((p,i)=>L.push(['R'+(i+1),'',cm(p.w),cm(p.h),cm(p.x),cm(p.y),fmt(p.w*p.h/1e8,6)].join(';')));
 L.push('','Benötigte Folienlänge (m);'+fmt(r.length/10000),'Ausnutzung (%);'+fmt(r.area/(r.W*r.length)*100,1));
 download('zuschnittplan.csv','\ufeff'+L.join('\r\n'),'text/csv;charset=utf-8');};
$('svg').onclick=()=>{const s=$('plan').innerHTML;if(s)download('zuschnittplan.svg',s,'image/svg+xml');};
$('print').onclick=()=>window.print();
if(!load()){const p=window.DBToolsPreferences;if(p){$('rollW').value=p.defaultRollW;$('rollH').value=p.defaultRollH;$('allowance').value=p.defaultAllowance;$('film').value=p.defaultFilm;sync();}addRow();}
