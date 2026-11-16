'use strict';
function createUpdates({ updater, packaged, automatic, notify, audit = () => {} }) {
  let started = false;
  let state = { kind: 'idle', message: 'Kostenlose Updates über GitHub · Signaturprüfung mit eigenem Sicherheitsschlüssel.' };
  function send(kind, message) { state = { kind, message }; notify(state); audit({ event: kind, message }); }
  updater.on('update-available', ({ update }) => send('downloading', 'Version ' + update.displayVersion + ' wird geladen und sicher geprüft …'));
  updater.on('update-downloaded', ({ update }) => send('ready', 'Version ' + update.displayVersion + ' ist bereit. Sparkle installiert sie beim Beenden oder über „Update öffnen“.'));
  updater.on('update-not-available', () => send('current', 'DB Tools ist auf dem neuesten Stand.'));
  updater.on('before-install', () => send('installing', 'Das geprüfte Update wird installiert …'));
  updater.on('before-relaunch', () => audit({ event: 'relaunching' }));
  updater.on('cycle-complete', () => { if (state.kind === 'checking') send('idle', 'Update-Prüfung abgeschlossen.'); });
  updater.on('error', ({ error }) => {
    audit({ event: 'error-detail', code: error.code || '', message: error.message });
    send('error', /signatur|signature/i.test(error.message) ? 'Die Update-Signatur ist ungültig. Das Update wurde zum Schutz Ihrer App abgelehnt.' : 'Updates sind gerade nicht erreichbar. Bitte später erneut prüfen. Ihre Arbeit bleibt gespeichert.');
  });
  return {
    getState: () => ({ ...state }),
    async start() {
      if (!packaged) { send('development', 'Entwicklungsmodus. Der kostenlose Sparkle-Updater ist in der installierten App aktiv.'); return; }
      try {
        await updater.start(); started = true;
        updater.setAutomaticallyChecksForUpdates(automatic);
        updater.setAutomaticallyDownloadsUpdates(automatic);
        send('idle', automatic ? 'Automatische Updates aktiv. Neue Versionen werden im Hintergrund geladen und beim Beenden installiert.' : 'Automatische Updates pausiert. Eine manuelle Prüfung ist jederzeit möglich.');
        audit({ event: 'sparkle-started', ...updater.getState() });
      } catch (error) { audit({ event: 'start-error', message: error.message }); send('error', 'Der Updater konnte nicht gestartet werden. Bitte DB Tools neu öffnen.'); }
    },
    setAutomatic(value) {
      automatic = value;
      if (started) { updater.setAutomaticallyChecksForUpdates(value); updater.setAutomaticallyDownloadsUpdates(value); }
      if (!['checking','downloading','ready','installing'].includes(state.kind)) send('idle', value ? 'Automatische Updates aktiviert.' : 'Automatische Updates pausiert.');
    },
    check(background = false) {
      if (!started || ['checking','downloading','installing'].includes(state.kind)) return state;
      if (state.kind !== 'ready') send('checking', 'Neue Version wird gesucht …');
      try { if (background) updater.checkForUpdatesInBackground(); else updater.checkForUpdates(); }
      catch (error) { audit({ event: 'check-error', message: error.message }); send('error', 'Die Update-Prüfung konnte nicht gestartet werden.'); }
      return state;
    },
    showInstall() { if (started && state.kind === 'ready') updater.checkForUpdates(); return started && state.kind === 'ready'; }
  };
}
module.exports = { createUpdates };
