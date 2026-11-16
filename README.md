# DB Tools

Folien-Zuschnittplaner als macOS-App mit eigenem Logo, Willkommensbildschirm, nativen Menüs und Auto-Updater über [GitHub Releases](https://github.com/UniverseMan12/DB_Tools/releases).

Die Anwendung berechnet lokal und funktioniert offline. Sie prüft Unifolie und Strukturfolie, zeigt Reststücke und exportiert CSV, SVG sowie Druck/PDF. Eingaben werden auf dem Mac gespeichert und bleiben bei Updates erhalten.

## Installation

DMG öffnen und **DB Tools** in **Programme** ziehen. Anschliessend aus Programme starten. Der erste lokale Build ist noch nicht mit einer Apple Developer ID signiert und nicht notarisiert. Hinweise für den ersten Start und die signierte Veröffentlichung stehen in [ANLEITUNG.md](ANLEITUNG.md).

## Entwicklung und Build

macOS und Node.js 24 verwenden:

```sh
npm ci
node node_modules/electron/install.js
npm run icons
npm start
```

`npm test` prüft Berechnung und Einstellungen; `npm run smoke` prüft die tatsächliche Electron-Oberfläche, Speicherung und Exporte in einem temporären Profil. `npm run dist` erstellt eine lokale universelle DMG und ZIP. `npm run release` erfordert Apple-Signierung und Notarisierung. Alle Build-Dateien liegen unter `dist/`.

## Updates

Update-Quelle: **UniverseMan12/DB_Tools**. Die App prüft nach dem Start und danach alle vier Stunden auf stabile Releases. Eine neue Version wird automatisch geladen und beim Beenden installiert. In den Einstellungen kann die automatische Prüfung pausiert oder ein vorbereitetes Update sofort per Neustart installiert werden.

Voraussetzungen: einmalige Installation eines mit **Developer ID Application** signierten Builds und Einrichtung der fünf Apple-Secrets in GitHub. Danach Änderungen committen, Versionsnummer erhöhen und einen passenden `v…`-Tag pushen. Der Workflow baut, signiert, notarisiert und veröffentlicht DMG, ZIP, Blockmaps und `latest-mac.yml`. Kein GitHub-Token wird in die App eingebaut. Die erste lokale, unsignierte DMG wird nicht als automatisches Update veröffentlicht.

Die vollständige Anleitung mit Apple-Zertifikat, GitHub-Einrichtung und Veröffentlichung steht in [ANLEITUNG.md](ANLEITUNG.md).

## Projektdateien

- `app/`: HTML, Gestaltung, Logo und Zuschnittberechnung.
- `electron/`: sicherer Desktop-Rahmen, macOS-Menüs und Updater.
- `build/`: macOS-Icon, Installationshintergrund und Berechtigungen.
- `.github/workflows/release.yml`: signierte Veröffentlichung über GitHub Actions.
- `scripts/`: Build, Icon-Erzeugung und Release-Prüfung.

Die ursprünglichen HTML-Dateien auf dem Desktop bleiben erhalten. Bisher im Browser gespeicherte Eingaben werden nicht automatisch in die neue App übernommen.
