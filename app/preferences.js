(function(root) {
  'use strict';
  const KEY = 'db-tools-preferences-v2';
  const defaults = { theme:'system', accent:'mono', density:'comfortable', motion:true, autosave:true, launchWelcome:false, defaultRollW:122, defaultRollH:50, defaultAllowance:2, defaultFilm:'uni', defaultGap:0, defaultPrice:0 };
  function clean(value = {}) {
    const p = { ...defaults };
    for (const [key, options] of Object.entries({theme:['system','dark','light'],accent:['mono'],density:['comfortable','compact'],defaultFilm:['uni','structure']})) if(options.includes(value[key])) p[key]=value[key];
    for(const key of ['motion','autosave','launchWelcome']) if(typeof value[key]==='boolean') p[key]=value[key];
    for(const [key,min,max] of [['defaultRollW',0.01,1000],['defaultRollH',0.01,100],['defaultAllowance',0,100],['defaultGap',0,50],['defaultPrice',0,100000]]) if(Number.isFinite(Number(value[key]))&&Number(value[key])>=min&&Number(value[key])<=max) p[key]=Math.round(Number(value[key])*100)/100;
    return p;
  }
  function read() { try { return clean(JSON.parse(root.localStorage.getItem(KEY))||{}); } catch { return {...defaults}; } }
  const num = v => Number(String(v ?? '').trim().replace(',', '.'));
  function project(value) {
    if(!value||value.format!=='db-tools-project'||value.version!==1||!value.planner) throw Error('Diese Datei ist kein unterstütztes DB-Tools-Projekt.');
    const s=value.planner;
    if(!Array.isArray(s.rows)||s.rows.length>500) throw Error('Das Projekt enthält zu viele Positionen.');
    const rows=s.rows.map(r=>{
      if(!Array.isArray(r)||r.length!==4||r.some(v=>typeof v!=='string'&&typeof v!=='number')||String(r[0]).length>80) throw Error('Eine Position im Projekt ist ungültig.');
      const row=r.map(String);
      for(const index of [1,2]) if(row[index].trim()!==''&&(!Number.isFinite(num(row[index]))||num(row[index])<=0||num(row[index])>10000)) throw Error('Ungültige Masse in der Projektdatei.');
      if(!Number.isInteger(num(row[3]))||num(row[3])<1||num(row[3])>500) throw Error('Ungültige Stückzahl in der Projektdatei.');
      return row;
    });
    if(rows.reduce((n,r)=>n+num(r[3]),0)>500) throw Error('Das Projekt enthält mehr als 500 Zuschnitte.');
    const planner={rows};
    for(const [k,min,max] of [['rollW',0.01,1000],['rollH',0.01,100],['allowance',0,100]]) {const n=num(s[k]);if(!Number.isFinite(n)||n<min||n>max)throw Error('Ungültige Rollenmasse oder Zugabe.');planner[k]=String(n);}
    if(!['uni','structure'].includes(s.film)||!['finished','component'].includes(s.measure)) throw Error('Ungültiger Folien- oder Massentyp.');
    planner.film=s.film;planner.measure=s.measure;
    // Optional fields added in 1.3 – older project files simply omit them.
    for(const [k,max] of [['gap',50],['price',100000]]) {
      if(s[k]===undefined||s[k]===null||String(s[k]).trim()===''){planner[k]='';continue;}
      const n=num(s[k]);if(!Number.isFinite(n)||n<0||n>max)throw Error('Ungültige Schnittfuge oder ungültiger Preis.');planner[k]=String(n);
    }
    planner.projectName=typeof s.projectName==='string'?s.projectName.slice(0,80):'';
    return {planner,preferences:clean(value.preferences)};
  }
  const api={KEY,defaults,clean,read,project};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  if(typeof document!=='undefined') {
    root.DBToolsPreferencesAPI=api;root.DBToolsPreferences=read();
    const p=root.DBToolsPreferences,doc=document.documentElement;
    doc.dataset.theme=p.theme==='system'?(root.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p.theme;
    doc.dataset.accent=p.accent;doc.dataset.density=p.density;
    doc.dataset.motion=p.motion&&!root.matchMedia('(prefers-reduced-motion: reduce)').matches?'full':'reduced';
  }
})(typeof globalThis!=='undefined'?globalThis:this);
