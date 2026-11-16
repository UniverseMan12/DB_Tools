'use strict';
(() => {
const desktop = window.desktop;
const welcome = document.getElementById('welcome');
const preferences = document.getElementById('preferences');
let appInfo;
function showWelcome() { if (!welcome.open) welcome.showModal(); }
function enter(example) {
  localStorage.setItem('db-tools-welcome-v1', 'done');
  welcome.close();
  if (example) { document.getElementById('example').click(); document.getElementById('calculate').click(); }
  else document.querySelector('#rows input')?.focus();
}
document.getElementById('start-planning').onclick = () => enter(false);
document.getElementById('start-example').onclick = () => enter(true);
document.getElementById('welcome-again').onclick = showWelcome;
document.getElementById('close-preferences').onclick = () => preferences.close();
function updateStatus(s) {
  document.getElementById('update-message').textContent = s.message;
  document.getElementById('update-indicator').textContent = s.kind === 'ready' ? 'Update bereit' : 'Updates';
  document.getElementById('install-update').hidden = s.kind !== 'ready';
  document.getElementById('check-updates').disabled = ['checking', 'downloading'].includes(s.kind);
  const progress = document.getElementById('update-progress');
  progress.hidden = s.kind !== 'downloading';
  progress.value = s.percent || 0;
}
async function showPreferences() {
  if (!desktop) return;
  const s = await desktop.settings();
  document.getElementById('automatic-updates').checked = s.automatic;
  updateStatus(s.state);
  document.getElementById('save-feedback').textContent = '';
  if (!preferences.open) preferences.showModal();
}
document.getElementById('settings-button').onclick = showPreferences;
document.getElementById('save-settings').onclick = async () => {
  try { await desktop.saveSettings({ automatic: document.getElementById('automatic-updates').checked }); document.getElementById('save-feedback').textContent = 'Einstellungen gespeichert.'; }
  catch (e) { document.getElementById('save-feedback').textContent = e.message.replace(/^Error invoking remote method '[^']+': Error: /, ''); }
};
document.getElementById('check-updates').onclick = async () => updateStatus(await desktop.checkUpdates());
document.getElementById('install-update').onclick = () => desktop.installUpdate();
if (desktop) {
  desktop.onUpdate(updateStatus);
  desktop.onMenu(action => { if (action === 'welcome') showWelcome(); if (action === 'settings') showPreferences(); });
  desktop.info().then(info => {
    appInfo = info;
    document.querySelectorAll('.app-version').forEach(el => el.textContent = 'Version ' + info.version);
    document.getElementById('signing-note').textContent = info.signed ? 'Mit Apple Developer ID signiert. Updates werden vor der Installation geprüft.' : 'Lokaler Build ohne Apple Developer ID. Für automatische Updates muss einmalig die signierte Version installiert werden.';
  });
} else document.getElementById('settings-button').hidden = true;
if (!localStorage.getItem('db-tools-welcome-v1')) showWelcome();
})();
