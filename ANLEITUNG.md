# DB Tools Studio · Version 1.1.0

## Installieren

1. **DB-Tools-1.1.0-universal.dmg** öffnen.
2. **DB Tools** in **Programme** ziehen. Eine vorhandene Version zuvor beenden und ersetzen.
3. DMG auswerfen. DB Tools aus **Programme** starten.

Die App unterstützt Apple Silicon und Intel ab macOS 12. Sie verwendet eine kostenlose Ad-hoc-Signatur und ist nicht von Apple notarisiert. macOS kann den ersten Start deshalb blockieren. Nach einem Startversuch gegebenenfalls **Systemeinstellungen → Datenschutz & Sicherheit → Dennoch öffnen** verwenden, sofern angeboten. Verwaltete Firmen-Macs können solche Apps grundsätzlich sperren. Die Systemeinstellungen Ihres Mac müssen dafür nicht allgemein gelockert werden. Apple beschreibt die Freigabe hier: https://support.apple.com/de-ch/102445

Die neue App muss einmal über die DMG installiert werden, da die alte Version 1.0.0 noch den vorherigen Updater enthält. Ab Version 1.1.0 übernimmt Sparkle weitere Updates. Vorhandene App-Eingaben bleiben erhalten: Name, App-ID und Speicherordner sind gleich geblieben. Bisher nur im Browser gespeicherte Eingaben werden nicht automatisch übernommen.

## Das neue Studio

- **Animierter Einstieg:** dreiteilige Einführung mit Folienrolle, Lichtscan, beweglichen Zuschnitten und leichter Bewegung bei Mauszeigerbewegungen. Oben rechts jederzeit direkt zur Planung wechseln. Über **?** in der Seitenleiste lässt sich die Einführung erneut öffnen.
- **Hell, Dunkel, System:** oben rechts mit **◐** schnell wechseln. Im Zahnrad unter **Erscheinungsbild** lässt sich auch der Systemmodus wählen.
- **Drei Akzentfarben:** Limette, Mint oder Amber.
- **Bewegung reduzieren:** Animationen lassen sich in den Einstellungen ausschalten. Die macOS-Einstellung für reduzierte Bewegung wird berücksichtigt.
- **Kompakte Darstellung:** mehr Eingaben und Ergebnisse auf kleinerer Fläche.
- **Planungsstandards:** Standardbreite und -länge der Rolle, Folientyp und Zugabe einstellen. Bestehende Planungen werden dabei nicht verändert. Mit dem separaten Button kann bewusst eine neue Planung gestartet werden.
- **Projektdateien:** Eingaben und persönliche Einstellungen als JSON sichern und später wieder öffnen. Beim Öffnen wird die aktuelle Planung nach Rückfrage ersetzt und der Zuschnitt neu berechnet. CSV, SVG und PDF bleiben reine Ergebnisexporte.
- **Datenspeicherung:** das automatische Speichern der Eingaben lässt sich abschalten. Dann werden neue Änderungen nicht automatisch gesichert; eine ältere Sicherung kann weiterhin vorhanden sein. Projektdateien können jederzeit manuell gespeichert werden.
- **Schnellaktionen:** mit **⌘K** die Aktionspalette öffnen. **⌘S** sichert ein Projekt, **⌘O** öffnet eines, **⌘↵** berechnet und **⌘,** öffnet die Einstellungen.

Die MaxRects-Berechnung bleibt lokal und vergleicht 15 Anordnungen. Ein mathematisch garantiertes Optimum wird nicht zugesichert. Maximal 200 einzelne Zuschnitte, Rollenbreite bis 1.000 cm, Länge bis 100 m. Masse vor dem Schneiden kontrollieren.

## Automatische Updates ohne Apple-Abonnement

**Für diese Update-Lösung ist kein Apple-Entwicklerzertifikat erforderlich.** Die App nutzt Sparkle mit einem eigenen Ed25519-Schlüssel.

Es gibt zwei unabhängige Prüfungen:

1. Die kostenlose Ad-hoc-Signatur prüft die Integrität des macOS-App-Bundles. Sie bestätigt keine bei Apple registrierte Entwickleridentität.
2. Sparkle prüft Update-Dateien und die Update-Liste mit dem fest in der App hinterlegten öffentlichen Schlüssel. Ein manipuliertes oder mit einem anderen Schlüssel signiertes Update wird abgelehnt.

Update-Quelle: https://github.com/UniverseMan12/DB_Tools/releases

Die App prüft nach dem Start und dann ungefähr alle vier Stunden. Verfügbare Versionen werden im Hintergrund geladen und bei normalem Beenden mit **⌘Q** installiert. Die App erzwingt keinen Neustart während Ihrer Arbeit. Ein bereitliegendes Update kann über **Einstellungen → Updates → Update öffnen** im nativen Sparkle-Fenster installiert werden. Bei einer manuell gestarteten Prüfung kann Sparkle ein Bestätigungsfenster für Download und Installation anzeigen. Benötigt die Installation Schreibrechte, kann macOS nach einer Berechtigung fragen.

Die automatische Prüfung und das automatische Laden lassen sich unter **Updates** deaktivieren. Schon vorbereitete Updates können weiterhin beim Beenden installiert werden. Offline bleibt die Zuschnittplanung voll nutzbar.

Öffentlich gehostete GitHub-Releases und die hier verwendeten Standard-GitHub-Actions-Runner für öffentliche Repositories benötigen im regulären kostenlosen Angebot kein Apple-Abonnement und keine laufende eigene Servermiete. Plattformbedingungen und Limits von GitHub gelten weiterhin.

## Einmalig den Update-Schlüssel in GitHub hinterlegen

Der private Schlüssel wurde separat als **DB-Tools-Updates.private** mitgeliefert. Er ist weder Teil der App noch des Quellcode-ZIPs oder des öffentlichen Repositories. Der öffentliche Gegenpart steht in `electron/update-config.json` und ist fest in die App eingebaut.

**Bewahren Sie die private Datei sicher auf.** Sie erlaubt es, von Ihren installierten Apps akzeptierte Updates zu signieren. Ohne diesen Schlüssel lassen sich bestehende Installationen nicht mehr auf die gleiche Weise aktualisieren. Bei Verlust oder Kompromittierung ist gegebenenfalls eine neue manuelle Installation mit neuem Schlüssel nötig.

1. Im Repository https://github.com/UniverseMan12/DB_Tools **Settings → Secrets and variables → Actions → New repository secret** öffnen.
2. Als Name **SPARKLE_PRIVATE_KEY** eintragen.
3. Den vollständigen einzeiligen Inhalt von **DB-Tools-Updates.private** als Secret-Wert einfügen und **Add secret** wählen. Den Inhalt niemals in einen Commit, ein Issue, eine Release-Beschreibung oder eine Chatnachricht kopieren.
4. Für die erste Veröffentlichung unter **Actions → DB Tools für macOS veröffentlichen → Run workflow** den Branch `main` starten. Falls Version 1.1.0 bereits veröffentlicht ist, zunächst eine höhere Version setzen.

Die alten Apple-Secrets `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` und `APPLE_TEAM_ID` werden nicht mehr verwendet. Für die kostenlose Variante wird nur **SPARKLE_PRIVATE_KEY** benötigt. GitHubs temporärer Veröffentlichungstoken wird automatisch vom Workflow bereitgestellt; er wird nicht in die App eingebaut.

GitHub-Dokumentation zu Secrets: https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets

## Eine neue Version veröffentlichen

### Mit Git und Terminal

Einmalig das Repository holen; Node.js 24 und die macOS Command Line Tools müssen installiert sein:

```sh
git clone https://github.com/UniverseMan12/DB_Tools.git
cd DB_Tools
npm ci
node node_modules/electron/install.js
npm run icons
```

Danach die gewünschten Dateien ändern. Für Gestaltung sind `app/studio.css` und `app/studio.js` relevant, für die Oberfläche `app/index.html`, für die Berechnung `app/app.js` und `app/packing.js`.

Beispiel für Version 1.1.1:

```sh
npm test
npm run smoke
npm version patch --no-git-tag-version
git add .
git commit -m "DB Tools 1.1.1"
git push origin main
git tag v1.1.1
git push origin v1.1.1
```

Die Nummer im Git-Tag muss exakt zur Version in `package.json` passen. `npm version` aktualisiert auch die Lockdatei. Der Workflow prüft das und verweigert das Überschreiben bereits veröffentlichter Versionen.

GitHub erstellt dann die universelle App und DMG, integriert Sparkle, signiert die Update-ZIP und den Appcast und veröffentlicht die Dateien gemeinsam. Installierte Apps finden die neue Version bei der nächsten Prüfung.

### Im GitHub-Webeditor

Die Dateien im Repository bearbeiten und committen. Vor einer Veröffentlichung die Version in `package.json` und den beiden Versionsfeldern am Anfang der `package-lock.json` gleich erhöhen. Dann unter **Actions** den Veröffentlichungsworkflow manuell starten. Eine reine HTML-Änderung ohne neue Version und ohne Build ist noch kein verteilbares App-Update.

## Lokal bauen und manuell veröffentlichen

```sh
npm ci
node node_modules/electron/install.js
npm run icons
npm test
npm run dist
```

Die App und Archive liegen unter `dist-free/`. Zum Signieren im Terminal den Pfad zur privaten Datei angeben:

```sh
export SPARKLE_PRIVATE_KEY_FILE="/Pfad/zu/DB-Tools-Updates.private"
npm run appcast
```

Das Script prüft zuerst, dass der Schlüssel zur App passt. Dann erzeugt und prüft es die signierte Update-Liste. Für ein Release müssen genau diese drei zusammengehörigen Dateien hochgeladen werden:

- `DB-Tools-VERSION-universal.dmg`
- `DB-Tools-VERSION-universal.zip`
- `appcast.xml`

Als Release-Tag `vVERSION` verwenden, beispielsweise `v1.1.0`. Zuerst alle Dateien in einen Release-Entwurf hochladen, danach veröffentlichen. Dateinamen, Appcast oder ZIP nach dem Signieren nicht verändern. Die Download-Links im Appcast sind versionsgebunden; der feste Feed-Link in der App verweist auf den Appcast des neuesten stabilen Releases.

## Prüfstand dieser Lieferung

- Eine separate, ad-hoc-signierte Test-App wurde mit der echten Sparkle-Integration von 1.1.0 auf 1.1.1 aktualisiert.
- Das Update wurde im Hintergrund geladen und nach dem Beenden installiert.
- Nach erneutem Start war Version 1.1.1 aktiv; gespeicherte Zuschnittdaten und ein zusätzlicher Prüfwert waren erhalten.
- Geänderte Appcast-Daten und ein manipuliertes Update-Archiv wurden durch die offizielle Signaturprüfung abgelehnt.
- Hell-/Dunkelmodus, Akzentfarben, kompakte Darstellung, reduzierte Bewegung, Projekt-Import/Export, Berechnung sowie CSV/SVG/PDF wurden geprüft.

Sparkle-Dokumentation: https://sparkle-project.org/documentation/

Electron-Integration und Ad-hoc-Verteilung: https://github.com/biw/electron-sparkle#readme
