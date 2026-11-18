'use strict';
(() => {
document.addEventListener('DOMContentLoaded', () => {
  const el=id=>document.getElementById(id), all=selector=>[...document.querySelectorAll(selector)];
  const desktop=window.desktop, api=window.DBToolsPreferencesAPI;
  let prefs=window.DBToolsPreferences;
  const welcome=el('welcome'), settings=el('preferences'), commands=el('command-palette');
  const themeQuery=matchMedia('(prefers-color-scheme: dark)'), motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
  let toastTimer, welcomeTimer, currentStep=0, updateState={kind:'idle',message:'Kostenlose Updates über GitHub.'};
  function toast(text) {window.showToast(text);}
  function applyPrefs(saveIt=true) {
    prefs=api.clean(prefs);window.DBToolsPreferences=prefs;
    const root=document.documentElement;
    root.dataset.theme=prefs.theme==='system'?(themeQuery.matches?'dark':'light'):prefs.theme;
    root.dataset.accent=prefs.accent;root.dataset.density=prefs.density;
    root.dataset.motion=prefs.motion&&!motionQuery.matches?'full':'reduced';
    el('pref-motion').checked=prefs.motion;el('pref-compact').checked=prefs.density==='compact';el('pref-welcome').checked=prefs.launchWelcome;el('pref-autosave').checked=prefs.autosave;
    el('pref-roll-w').value=prefs.defaultRollW;el('pref-roll-h').value=prefs.defaultRollH;el('pref-allowance').value=prefs.defaultAllowance;el('pref-film').value=prefs.defaultFilm;el('pref-gap').value=prefs.defaultGap;el('pref-price').value=prefs.defaultPrice;
    all('[data-theme-option]').forEach(button=>{const selected=button.dataset.themeOption===prefs.theme;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});
    all('button[data-accent]').forEach(button=>{const selected=button.dataset.accent===prefs.accent;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});
    el('save-state').textContent=prefs.autosave?'Lokal gespeichert':'Automatisches Speichern pausiert';
    if(saveIt) {try{localStorage.setItem(api.KEY,JSON.stringify(prefs));}catch{toast('Einstellungen konnten nicht gespeichert werden.');}}
    if(welcome.open) scheduleWelcome();
  }
  themeQuery.addEventListener('change',()=>applyPrefs(false));motionQuery.addEventListener('change',()=>applyPrefs(false));
  all('[data-theme-option]').forEach(button=>button.onclick=()=>{prefs.theme=button.dataset.themeOption;applyPrefs();});
  all('button[data-accent]').forEach(button=>button.onclick=()=>{prefs.accent=button.dataset.accent;applyPrefs();});
  function toggleTheme(){prefs.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';applyPrefs();toast(prefs.theme==='dark'?'Dunkelmodus aktiviert.':'Hellmodus aktiviert.');}
  el('theme-toggle').onclick=toggleTheme;
  for(const [id,key] of [['pref-motion','motion'],['pref-welcome','launchWelcome'],['pref-autosave','autosave']])el(id).onchange=()=>{prefs[key]=el(id).checked;applyPrefs();if(key==='autosave'&&prefs.autosave)save();};
  el('pref-compact').onchange=()=>{prefs.density=el('pref-compact').checked?'compact':'comfortable';applyPrefs();};
  for(const [id,key] of [['pref-roll-w','defaultRollW'],['pref-roll-h','defaultRollH'],['pref-allowance','defaultAllowance'],['pref-gap','defaultGap'],['pref-price','defaultPrice']])el(id).onchange=()=>{if(!el(id).checkValidity()||!el(id).value.trim()){el(id).reportValidity();return;}prefs[key]=Number(el(id).value);applyPrefs();};
  el('pref-film').onchange=()=>{prefs.defaultFilm=el('pref-film').value;applyPrefs();};
  function selectTab(tab) {
    all('[data-tab]').forEach(button=>{const active=button.dataset.tab===tab;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));});
    all('[data-panel]').forEach(panel=>panel.hidden=panel.dataset.panel!==tab);
    el('preferences-title').removeAttribute('id');
    document.querySelector('[data-panel="'+tab+'"] h2').id='preferences-title';
    document.querySelector('.settings-content').scrollTop=0;
  }
  all('[data-tab]').forEach(button=>button.onclick=()=>selectTab(button.dataset.tab));
  async function showSettings(tab='appearance') {
    commands.close(); if(welcome.open)welcome.close();
    selectTab(tab);applyPrefs(false);
    if(desktop){const s=await desktop.settings();el('automatic-updates').checked=s.automatic;updateStatus(s.state);}
    if(!settings.open)settings.showModal();
  }
  el('settings-button').onclick=()=>showSettings();el('rail-settings').onclick=()=>showSettings();el('close-preferences').onclick=()=>settings.close();
  function updateStatus(state) {
    updateState=state;el('update-message').textContent=state.message;
    el('update-indicator').classList.toggle('ready',state.kind==='ready');
    el('install-update').hidden=state.kind!=='ready';
    el('check-updates').disabled=['checking','downloading','installing'].includes(state.kind);
    el('update-progress').hidden=state.kind!=='downloading';
    if(state.kind==='ready')toast('Ein neues DB-Tools-Update ist bereit.');
  }
  el('automatic-updates').onchange=async()=>{
    if(!desktop)return;
    try{await desktop.saveSettings({automatic:el('automatic-updates').checked});el('save-feedback').textContent='Update-Einstellungen gespeichert.';}
    catch{toast('Update-Einstellungen konnten nicht gespeichert werden.');}
  };
  el('check-updates').onclick=async()=>{if(desktop)updateStatus(await desktop.checkUpdates());};
  el('install-update').onclick=()=>desktop?.installUpdate();
  if(desktop){
    desktop.onUpdate(updateStatus);
    desktop.onMenu(action=>{if(action==='welcome')showWelcome();else if(action==='updates')showSettings('updates');else if(action==='settings')showSettings();else if(action==='export')exportProject();else if(action==='import')chooseProject();else if(actions[action])actions[action]();});
    desktop.info().then(info=>{all('.app-version').forEach(node=>node.textContent=info.version.replace('-beta.',' · Beta '));if(info.packaged)setTimeout(()=>whatsNew(info.version),600);el('signing-note').textContent='Kostenlose Updates mit Sparkle. Appcast und Update-Dateien werden vor der Installation mit Ihrem Sicherheitsschlüssel geprüft. Kein Apple-Abonnement nötig.';});
  } else {el('check-updates').disabled=true;el('signing-note').textContent='Updates sind in der macOS-App verfügbar.';}
  const slides=[
    ['Gross denken.<br><em>Präzise</em><br>zuschneiden.','Aus Material wird Möglichkeit. Ihr Studio für durchdachte Zuschnitte – vom ersten Mass bis zum letzten Zentimeter.','Jede Rolle hat Potenzial.','Sie geben die Masse vor. DB Tools bringt Ordnung hinein.'],
    ['Weniger Rest.<br><em>Mehr</em><br>Möglichkeiten.','Teile erfassen. Anordnungen vergleichen. Reststücke sichtbar machen. Damit aus einer Rolle ein durchdachter Plan wird.','Material bewusst nutzen.','Unifolie oder Strukturfolie – mit Ihrer Laufrichtung im Blick.'],
    ['Ihr Plan.<br><em>Bereit</em><br>für die Werkstatt.','Vom Bildschirm an den Arbeitstisch. Sichern Sie Ihr Projekt, exportieren Sie den Zuschnitt oder drucken Sie Ihren Plan.','Alles für den nächsten Schritt.','Projektdatei, CSV, SVG und PDF – für Ihren Workflow.']
  ];
  function setStep(index){currentStep=index;const s=slides[index];el('welcome-title').innerHTML=s[0];el('welcome-description').textContent=s[1];el('welcome-step-title').textContent=s[2];el('welcome-step-detail').textContent=s[3];el('welcome-step-icon').textContent='0'+(index+1);el('welcome-step-number').textContent='0'+(index+1)+' / 03';all('[data-welcome-step]').forEach(b=>b.classList.toggle('active',Number(b.dataset.welcomeStep)===index));if(prefs.motion&&!motionQuery.matches)el('welcome-text').animate([{opacity:0,transform:'translateY(9px)'},{opacity:1,transform:'translateY(0)'}],{duration:450,easing:'ease-out'});}
  function scheduleWelcome(){clearInterval(welcomeTimer);if(welcome.open&&prefs.motion&&!motionQuery.matches)welcomeTimer=setInterval(()=>setStep((currentStep+1)%slides.length),9000);}
  all('[data-welcome-step]').forEach(button=>button.onclick=()=>{setStep(Number(button.dataset.welcomeStep));scheduleWelcome();});
  function showWelcome(){commands.close();settings.close();setStep(0);if(!welcome.open)welcome.showModal();scheduleWelcome();}
  function enter(example=false){localStorage.setItem('db-tools-welcome-studio-v1','done');welcome.close();if(example){el('example').click();el('calculate').click();}else document.querySelector('#rows input')?.focus();}
  welcome.addEventListener('close',()=>clearInterval(welcomeTimer));
  el('start-planning').onclick=()=>enter();el('skip-welcome').onclick=()=>enter();el('start-example').onclick=()=>enter(true);
  el('welcome-again').onclick=showWelcome;el('settings-welcome').onclick=showWelcome;el('brand-home').onclick=event=>{event.preventDefault();showWelcome();};
  welcome.addEventListener('pointermove',event=>{if(!prefs.motion||motionQuery.matches)return;const bounds=welcome.getBoundingClientRect();const x=(event.clientX-bounds.left)/bounds.width-.5;const y=(event.clientY-bounds.top)/bounds.height-.5;welcome.style.setProperty('--pointer-x',x*10+'px');welcome.style.setProperty('--pointer-y',y*8+'px');});
  function confirmAction(description,action,label='Fortfahren'){
    const dialog=el('confirm-dialog');el('confirm-description').textContent=description;el('confirm-accept').textContent=label;
    el('confirm-cancel').onclick=()=>dialog.close();el('confirm-accept').onclick=()=>{dialog.close();action();};dialog.showModal();
  }
  function snapshot(){const planner={rows:rowsData()};FIELDS.forEach(id=>planner[id]=el(id).value);return {format:'db-tools-project',version:1,createdAt:new Date().toISOString(),planner,preferences:prefs};}
  function exportProject(){const data=snapshot();download(fileBase()+'.dbtools.json',JSON.stringify(data,null,2),'application/json');toast('Projektdatei wird gespeichert.');}
  function chooseProject(){el('project-file').value='';el('project-file').click();}
  function applyPlanner(planner){FIELDS.forEach(id=>{el(id).value=planner[id]??'';});el('rows').innerHTML='';(planner.rows.length?planner.rows:[['','','','1']]).forEach(row=>addRow(row));sync();stale();save();}
  el('project-file').onchange=async()=>{
    const file=el('project-file').files[0];if(!file)return;
    try{if(file.size>1024*1024)throw Error('Die Projektdatei ist zu gross.');const data=api.project(JSON.parse(await file.text()));
      confirmAction('Die laufenden Eingaben werden durch das gewählte Projekt ersetzt. Sichern Sie Ihre aktuelle Planung bei Bedarf zuerst.',()=>{prefs=data.preferences;applyPrefs();applyPlanner(data.planner);setCurrentProject(null);settings.close();library.close();toast('Projekt geöffnet. Zuschnitt wird neu berechnet.');calculate();},'Projekt öffnen');
    }catch(error){toast(error.message.startsWith('Unexpected')?'Die Datei enthält kein gültiges JSON-Projekt.':error.message);}
  };
  el('import-project').onclick=chooseProject;el('settings-import').onclick=chooseProject;
  el('export-project').onclick=exportProject;el('settings-export').onclick=exportProject;
  el('new-project-defaults').onclick=()=>confirmAction('Die laufenden Eingaben werden durch eine leere Planung mit Ihren gespeicherten Standardwerten ersetzt.',()=>{newPlanning();settings.close();toast('Neue Planung mit Ihren Standardwerten erstellt.');},'Neue Planung');
  el('reset-preferences').onclick=()=>confirmAction('Darstellung und Planungsstandards werden auf die Ausgangswerte zurückgesetzt. Ihre eingegebenen Zuschnitte bleiben erhalten.',()=>{prefs={...api.defaults};applyPrefs();toast('Darstellung und Standards zurückgesetzt.');},'Zurücksetzen');
  function showCommands(){if(!commands.open)commands.showModal();}
  el('command-button').onclick=showCommands;
  const actions={print:()=>{if(current)window.print();else toast('Bitte zuerst einen Zuschnitt berechnen.');},new:()=>askNewPlanning(),library:()=>showLibrary(),save:()=>saveToLibrary(),pdf:()=>{if(current)el('pdf').click();else toast('Bitte zuerst einen Zuschnitt berechnen.');},calculate:()=>{settings.close();welcome.close();library.close();calculate();},export:exportProject,import:chooseProject,theme:toggleTheme,settings:()=>showSettings(),welcome:showWelcome};
  all('[data-command]').forEach(button=>button.onclick=()=>{commands.close();actions[button.dataset.command]();});
  document.addEventListener('keydown',event=>{if(!(event.metaKey||event.ctrlKey)||event.altKey)return;const key=event.key.toLowerCase(),shift=event.shiftKey;if(desktop&&['s','o','n','p'].includes(key))return;/* handled by the native menu */const action=key==='k'?showCommands:key==='s'?(shift?exportProject:actions.save):key==='o'?(shift?actions.library:chooseProject):key==='n'?actions.new:key==='p'&&shift?actions.pdf:key===','?()=>showSettings():key==='enter'?actions.calculate:null;if(action){event.preventDefault();action();}});
  document.addEventListener('dbtools:calculated',()=>{if(prefs.motion&&!motionQuery.matches)document.querySelector('.result-head').animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:350});toast('Zuschnitt geprüft. Ihr Plan ist bereit.');});
  const planView=el('plan-view'), plan=el('plan'), planHome=plan.parentNode, planNext=plan.nextSibling;
  let wasFullscreen=false, enteringPlan=false;
  function resizePlan(value){el('zoom').value=value;el('zoom').dispatchEvent(new Event('input'));el('fullscreen-zoom').value=el('zoom').value;el('fullscreen-zoom-value').textContent=el('zoom').value+' %';}
  // Chromium delivers trackpad pinch gestures as ctrl+wheel. Keep normal
  // scrolling available for panning; Cmd/Ctrl+wheel zooms only this drawing.
  let gestureZoom=Number(el('zoom').value), gestureFrame=0, gestureAnchor;
  const syncZoomControls=()=>{el('fullscreen-zoom').value=el('zoom').value;el('fullscreen-zoom-value').textContent=el('zoom').value+' %';};
  el('zoom').addEventListener('input',()=>{gestureZoom=Number(el('zoom').value);syncZoomControls();});
  plan.addEventListener('wheel',event=>{
    if(!(event.ctrlKey||event.metaKey)||!current||!plan.querySelector('svg'))return;
    event.preventDefault();
    const unit=event.deltaMode===1?16:event.deltaMode===2?plan.clientHeight:1;
    const delta=Math.max(-150,Math.min(150,event.deltaY*unit));
    gestureZoom=Math.max(25,Math.min(250,gestureZoom*Math.exp(-delta*.008)));
    gestureAnchor={x:event.clientX,y:event.clientY};
    if(gestureFrame)return;
    gestureFrame=requestAnimationFrame(()=>{
      gestureFrame=0;
      const svg=plan.querySelector('svg');if(!svg)return;
      const before=svg.getBoundingClientRect(),anchor=gestureAnchor;
      const x=(anchor.x-before.left)/before.width,y=(anchor.y-before.top)/before.height;
      const target=gestureZoom;
      resizePlan(Math.round(target));gestureZoom=target;
      const after=plan.querySelector('svg').getBoundingClientRect();
      plan.scrollLeft+=after.left+x*after.width-anchor.x;
      plan.scrollTop+=after.top+y*after.height-anchor.y;
    });
  },{passive:false});
  function fitPlan(){resizePlan(100);const svg=plan.querySelector('svg');if(svg){const scale=Math.min((plan.clientWidth-32)/Number(svg.getAttribute('width')),(plan.clientHeight-32)/Number(svg.getAttribute('height')));resizePlan(Math.max(25,Math.min(250,Math.floor(scale*100))));}}
  el('plan-fullscreen').onclick=async()=>{if(!plan.querySelector('svg')||enteringPlan)return;enteringPlan=true;try{wasFullscreen=desktop?await desktop.planFullscreen(true):false;el('fullscreen-plan-host').append(plan);el('fullscreen-summary').textContent=el('stats').querySelector('strong')?.textContent+' Folie';planView.showModal();setTimeout(fitPlan,400);}catch{toast('Vollbild konnte nicht geöffnet werden.');}finally{enteringPlan=false;}};
  el('close-plan-view').onclick=()=>planView.close();
  planView.addEventListener('close',()=>{planHome.insertBefore(plan,planNext);resizePlan(100);desktop?.planFullscreen(wasFullscreen);el('plan-fullscreen').focus();});
  desktop?.onFullscreen(value=>{if(!value&&planView.open)planView.close();});
  el('fit-plan').onclick=fitPlan;el('fullscreen-zoom').oninput=()=>resizePlan(el('fullscreen-zoom').value);

  /* ---------- Meine Projekte (local library) ---------- */
  const library=el('library'), LIB_KEY='db-tools-library-v1', CURRENT_KEY='db-tools-current-project';
  const readLibrary=()=>{try{const list=JSON.parse(localStorage.getItem(LIB_KEY));return Array.isArray(list)?list:[];}catch{return [];}};
  const writeLibrary=list=>{try{localStorage.setItem(LIB_KEY,JSON.stringify(list));return true;}catch{toast('Projekt konnte nicht gespeichert werden (Speicher voll?).');return false;}};
  let currentProject=null;try{currentProject=localStorage.getItem(CURRENT_KEY);}catch{}
  function setCurrentProject(id){currentProject=id;try{id?localStorage.setItem(CURRENT_KEY,id):localStorage.removeItem(CURRENT_KEY);}catch{}}
  function plannerState(){const planner={rows:rowsData()};FIELDS.forEach(id=>planner[id]=el(id).value);return planner;}
  const hasContent=()=>rowsData().some(r=>r.slice(0,3).some(x=>String(x).trim()));
  function isSaved(){const entry=currentProject&&readLibrary().find(p=>p.id===currentProject);return !!entry&&JSON.stringify(entry.planner)===JSON.stringify(plannerState());}
  function saveToLibrary(){
    let name=el('projectName').value.trim();
    if(!name){name='Planung vom '+new Date().toLocaleDateString('de-CH');el('projectName').value=name;save();}
    const list=readLibrary(),now=new Date().toISOString();
    let entry=currentProject&&list.find(p=>p.id===currentProject);
    if(entry&&entry.name!==name&&list.some(p=>p.id!==entry.id&&p.name===name))entry=null;
    if(!entry)entry=list.find(p=>p.name===name);
    if(entry){entry.name=name;entry.planner=plannerState();entry.savedAt=now;}
    else{entry={id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),name,createdAt:now,savedAt:now,planner:plannerState()};list.push(entry);}
    if(writeLibrary(list)){setCurrentProject(entry.id);toast('„'+name+'“ in Meine Projekte gespeichert.');renderLibrary();}
  }
  function describe(planner){let n=0;for(const r of planner.rows||[]){const k=Number(String(r[3]).replace(',','.'));if(String(r[1]).trim()&&String(r[2]).trim())n+=Number.isInteger(k)&&k>0?k:1;}return n+(n===1?' Teil':' Teile')+' · Rolle '+planner.rollW+' cm × '+planner.rollH+' m';}
  function renderLibrary(){
    const q=el('library-search').value.trim().toLowerCase();
    const list=readLibrary().sort((a,b)=>b.savedAt.localeCompare(a.savedAt)).filter(p=>!q||p.name.toLowerCase().includes(q));
    const target=el('library-list');target.innerHTML='';
    if(!list.length){target.innerHTML='<li class="library-empty">'+(q?'Kein Projekt gefunden.':'Noch keine Projekte gespeichert. Mit „Aktuelle Planung speichern“ legen Sie das erste an.')+'</li>';return;}
    for(const p of list){
      const li=document.createElement('li');if(p.id===currentProject)li.classList.add('current');
      li.innerHTML='<button class="library-open"><strong></strong><small></small></button><span class="library-date"></span><button class="library-copy" title="Duplizieren" aria-label="Duplizieren">⧉</button><button class="library-delete" title="Löschen" aria-label="Löschen">×</button>';
      li.querySelector('strong').textContent=p.name+(p.id===currentProject?' · geöffnet':'');
      li.querySelector('small').textContent=describe(p.planner);
      li.querySelector('.library-date').textContent=new Date(p.savedAt).toLocaleDateString('de-CH',{day:'2-digit',month:'2-digit',year:'numeric'});
      li.querySelector('.library-open').onclick=()=>openFromLibrary(p.id);
      li.querySelector('.library-copy').onclick=()=>{const all=readLibrary(),now=new Date().toISOString();all.push({...p,id:Date.now().toString(36)+'c',name:p.name+' (Kopie)',createdAt:now,savedAt:now});writeLibrary(all);renderLibrary();};
      li.querySelector('.library-delete').onclick=()=>{const all=readLibrary(),index=all.findIndex(x=>x.id===p.id);if(index<0)return;const [removed]=all.splice(index,1);writeLibrary(all);if(currentProject===p.id)setCurrentProject(null);renderLibrary();
        window.showToast('„'+p.name+'“ gelöscht.','Rückgängig',()=>{const again=readLibrary();again.push(removed);writeLibrary(again);renderLibrary();});};
      target.append(li);
    }
  }
  function openFromLibrary(id){
    const entry=readLibrary().find(p=>p.id===id);if(!entry)return;
    const go=()=>{applyPlanner(entry.planner);el('projectName').value=entry.name;save();setCurrentProject(entry.id);library.close();toast('„'+entry.name+'“ geöffnet.');calculate();};
    if(hasContent()&&!isSaved()&&currentProject!==id)confirmAction('Ihre aktuelle Planung ist nicht gespeichert und wird ersetzt. Speichern Sie sie zuerst mit „Aktuelle Planung speichern“, wenn Sie sie behalten möchten.',go,'Trotzdem öffnen');else go();
  }
  function showLibrary(){commands.close();settings.close();el('library-search').value='';renderLibrary();if(!library.open)library.showModal();}
  function newPlanning(){applyPlanner({rollW:String(prefs.defaultRollW),rollH:String(prefs.defaultRollH),film:prefs.defaultFilm,allowance:String(prefs.defaultAllowance),gap:prefs.defaultGap?String(prefs.defaultGap):'',price:prefs.defaultPrice?String(prefs.defaultPrice):'',projectName:'',measure:'finished',rows:[]});setCurrentProject(null);current=null;el('results').hidden=true;el('empty').hidden=false;el('empty').querySelector('h2').textContent='Ihr Zuschnittplan';el('empty').querySelector('p').textContent='Erfassen Sie links Ihre Teile und starten Sie die Berechnung.';el('status').classList.remove('stale');document.querySelector('#rows input')?.focus();}
  function askNewPlanning(){commands.close();library.close();if(!hasContent()||isSaved()){newPlanning();return;}confirmAction('Die laufenden Eingaben werden durch eine leere Planung mit Ihren Standardwerten ersetzt. Nicht gespeicherte Eingaben gehen verloren – „Rückgängig“ ist danach kurz möglich.',()=>{const before=plannerState(),id=currentProject;newPlanning();window.showToast('Neue Planung begonnen.','Rückgängig',()=>{applyPlanner(before);setCurrentProject(id);});},'Neue Planung');}
  el('rail-project').onclick=showLibrary;el('open-library').onclick=showLibrary;el('rail-new').onclick=askNewPlanning;
  el('save-library').onclick=saveToLibrary;el('library-save').onclick=saveToLibrary;el('library-new').onclick=askNewPlanning;
  el('library-import').onclick=()=>{chooseProject();};el('library-export').onclick=exportProject;el('close-library').onclick=()=>library.close();
  el('library-search').oninput=renderLibrary;
  for(const d of [library,settings,commands,el('whats-new'),el('confirm-dialog')])d.addEventListener('click',e=>{if(e.target===d)d.close();});
  /* ---------- What's new after an update ---------- */
  function whatsNew(version){let last=null;try{last=localStorage.getItem('db-tools-last-version');localStorage.setItem('db-tools-last-version',version);}catch{}if(last&&last!==version&&!welcome.open)el('whats-new').showModal();}
  el('whats-new-close').onclick=()=>el('whats-new').close();
  applyPrefs(false);
  if(!localStorage.getItem('dbs-zuschnitt-v2')){el('rollW').value=prefs.defaultRollW;el('rollH').value=prefs.defaultRollH;el('allowance').value=prefs.defaultAllowance;el('film').value=prefs.defaultFilm;el('gap').value=prefs.defaultGap||'';el('price').value=prefs.defaultPrice||'';sync();}
  if(!localStorage.getItem('db-tools-welcome-studio-v1')||prefs.launchWelcome)showWelcome();
});
})();
