# DB Tools – Installation und automatische Updates

Stand: 16. November 2026 · Version 1.0.0

## 1. Die App installieren

1. `DB-Tools-1.0.0-universal.dmg` öffnen.
2. **DB Tools** auf den Ordner **Programme** ziehen.
3. DMG auswerfen und **DB Tools** aus **Programme** starten.
4. Im Willkommensbildschirm **Planung starten** oder **Mit einem Beispiel entdecken** wählen.

Die DMG enthält eine universelle App für Apple Silicon und Intel. Der lokale Build wurde ohne Apple Developer ID erstellt und ist nicht notarisiert. Falls macOS den Start deshalb blockiert: einmal öffnen versuchen, dann **Systemeinstellungen → Datenschutz & Sicherheit → Dennoch öffnen** verwenden, sofern macOS diese Möglichkeit anbietet. Apples Erklärung: https://support.apple.com/de-ch/102445

Für die Weitergabe und für automatische App-Updates muss zuerst eine signierte und notarisierte Version gebaut werden. Diese erste signierte Version muss einmalig über die DMG installiert werden; danach sind weitere Neuinstallationen normalerweise nicht nötig. Dieser lokale Build umgeht keine Signaturprüfung.

Eingaben bleiben unter `~/Library/Application Support/DB Tools/` auf diesem Mac gespeichert. Updates verwenden denselben Speicherort. Die bisherigen Eingaben aus der HTML-Version im Browser werden nicht automatisch übernommen. CSV, SVG und PDF sind Ausgaben des Plans, keine wieder einlesbaren Projektdateien.

## 2. Apple-Zertifikat erstellen

Benötigt wird **Developer ID Application** für die Verteilung ausserhalb des Mac App Store.

1. Mit deinem Apple Account beim Apple Developer Program anmelden: https://developer.apple.com/programs/enroll/ . Die Mitgliedschaft kostet laut Apple 99 USD jährlich beziehungsweise den lokalen Preis. Der kostenlose Entwicklerzugang genügt für dieses Verteilungszertifikat nicht.
2. Nach Aktivierung auf deinem Mac die **Schlüsselbundverwaltung** öffnen.
3. Im Menü **Schlüsselbundverwaltung → Zertifikatsassistent → Zertifikat von einer Zertifizierungsinstanz anfordern** wählen.
4. Deine E-Mail und deinen Namen eintragen. Die E-Mail der Zertifizierungsstelle leer lassen. **Auf Festplatte speichern** wählen. Die Datei endet auf `.certSigningRequest`.
5. https://developer.apple.com/account/resources/certificates/list öffnen und bei **Certificates** auf **+** klicken.
6. **Developer ID Application** auswählen und die eben gespeicherte Anfrage hochladen. Falls Apple eine Auswahl der Zertifizierungsstelle anbietet, die aktuelle empfohlene Variante verwenden.
7. Die `.cer`-Datei herunterladen und per Doppelklick in den Schlüsselbund importieren.
8. Unter **Meine Zertifikate** sollte **Developer ID Application: Dein Name (TEAMID)** erscheinen. Aufklappen: darunter muss der private Schlüssel sichtbar sein. Die Anfrage und das Importieren auf demselben Mac durchführen.

Apple-Anleitungen:
- https://developer.apple.com/de/help/account/certificates/create-developer-id-certificates
- https://developer.apple.com/help/account/certificates/create-a-certificate-signing-request
- https://developer.apple.com/help/account/membership/program-enrollment/

## 3. GitHub einmalig einrichten

Repository: https://github.com/UniverseMan12/DB_Tools

Es ist öffentlich. Dadurch können installierte Apps Updates ohne GitHub-Anmeldung laden. Es darf kein persönlicher GitHub-Zugriffsschlüssel in die App eingebaut werden.

### Zertifikat für GitHub Actions exportieren

1. In der Schlüsselbundverwaltung unter **Meine Zertifikate** dein **Developer ID Application** mitsamt privatem Schlüssel auswählen.
2. Über **Exportieren** eine kennwortgeschützte `.p12`-Datei speichern, beispielsweise `DeveloperID.p12`. Wenn `.p12` nicht auswählbar ist, fehlt meist der zugehörige private Schlüssel.
3. Zum Kopieren als Base64 im Terminal eingeben; den Pfad anpassen:

```sh
base64 -i "/Pfad/zu/DeveloperID.p12" | pbcopy
```

4. Im Repository **Settings → Secrets and variables → Actions → New repository secret** öffnen und diese fünf Secrets anlegen:

| Secret | Inhalt |
| --- | --- |
| `CSC_LINK` | Vollständiger Base64-Inhalt der `.p12`-Datei aus der Zwischenablage |
| `CSC_KEY_PASSWORD` | Das beim Export festgelegte `.p12`-Kennwort |
| `APPLE_ID` | E-Mail deines Apple-Entwicklerkontos |
| `APPLE_APP_SPECIFIC_PASSWORD` | Anwendungsspezifisches Apple-Passwort für die Notarisierung |
| `APPLE_TEAM_ID` | Zehnstellige Team ID aus deinem Apple-Entwicklerkonto |

Ein anwendungsspezifisches Passwort wird unter https://account.apple.com/ im Bereich **Anmelden und Sicherheit → Anwendungsspezifische Passwörter** erstellt. Dein normales Apple-Passwort gehört nicht in dieses Feld. Apple-Anleitung: https://support.apple.com/de-ch/102654

Zertifikat mit privatem Schlüssel, `.p12`-Datei und Kennwörter bleiben ausserhalb des öffentlichen Repositories und gehören weder in Chatnachrichten noch in Quellcode. GitHub speichert sie über die Secrets-Einstellungen. GitHub-Anleitung: https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets

### Erste signierte Version veröffentlichen

1. Projektdateien einschliesslich `.github/workflows/release.yml` in das Repository übernehmen, sofern noch nicht vorhanden. `node_modules`, `dist`, Kennwörter und Zertifikate nicht hochladen.
2. Im Repository **Actions → DB Tools für macOS veröffentlichen → Run workflow** auswählen und den Branch `main` starten.
3. Der Workflow prüft die Secrets, erstellt die universelle App, signiert sie, reicht sie zur Notarisierung bei Apple ein und prüft das Ergebnis. Erst danach veröffentlicht er das GitHub Release `v1.0.0` mit allen Update-Dateien. Der Vorgang kann mehrere Minuten dauern; die erste Notarisierung mitunter länger.
4. Unter **Releases** die neue signierte DMG laden und DB Tools im Programme-Ordner ersetzen. Vorher die App beenden. Eingaben bleiben bei gleichem App-Namen und Speicherpfad erhalten.
5. In **DB Tools → Einstellungen** beziehungsweise über **Updates** die Prüfung testen. Es sollte „auf dem neuesten Stand“ erscheinen. Für einen vollständigen Test anschliessend Version 1.0.1 veröffentlichen und von der installierten signierten Version 1.0.0 aktualisieren.

Wenn der Workflow nicht in Actions erscheint, fehlt die Workflow-Datei im Standardbranch oder Actions ist in den Repository-Einstellungen deaktiviert. Falls die GitHub-Verbindung das Schreiben nach `.github/workflows/` nicht gestattet, diese Datei über GitHub im Browser hochladen.

## 4. Spätere Änderungen automatisch ausliefern

Beispiel: Du möchtest das Layout der App ändern.

1. Gewünschte Dateien unter `app/` ändern, beispielsweise `app/index.html`, `app/style.css` oder `app/app.js`.
2. Im Projektordner mit Node.js 24 prüfen und die Versionsnummer erhöhen:

```sh
npm ci
node node_modules/electron/install.js
npm test
npm run smoke
npm version patch --no-git-tag-version
```

3. Die Version steigt beispielsweise von `1.0.0` auf `1.0.1`. `package.json` und `package-lock.json` gemeinsam übernehmen.
4. Änderungen committen und einen genau passenden Tag pushen:

```sh
git add .
git commit -m "DB Tools 1.0.1"
git push origin main
git tag v1.0.1
git push origin v1.0.1
```

5. Der GitHub-Workflow baut, signiert, notarisiert und veröffentlicht das Release. Er verweigert das Überschreiben einer bereits veröffentlichten Version.
6. Installierte Apps finden das Release nach dem Start oder bei der nächsten Prüfung. Sie laden das Update im Hintergrund und installieren es beim Beenden. Ein vorbereitetes Update kann in den Einstellungen auch mit **Jetzt neu starten** installiert werden. Die App erzwingt während der Arbeit keinen Neustart.

Alternativ im GitHub-Webeditor die Dateien samt Versionsnummer ändern und anschliessend den Workflow manuell starten. Auch hier für jede Veröffentlichung die Versionsnummer erhöhen. Nur die HTML-Datei zu ändern reicht nicht: Der Workflow muss die Änderung in eine neue App-Version verpacken.

## 5. Was der Auto-Updater benötigt

- Stabile veröffentlichte Releases im öffentlichen Repository **UniverseMan12/DB_Tools**.
- Eine mit Apple Developer ID signierte installierte App und entsprechend signierte spätere Versionen, aus demselben Apple-Team.
- Zu jedem Release die vom Build erzeugten Dateien: universelle `.zip`, `.dmg`, Blockmaps und `latest-mac.yml`.
- Internet für die Update-Prüfung. Die Zuschnittplanung funktioniert weiterhin offline.

Die Datei `latest-mac.yml` enthält Versions- und Prüfsummeninformationen. Keine Dateinamen nachträglich ändern und die YAML-Datei nicht von Hand erfinden. Der Workflow lädt zuerst sämtliche Dateien in einen Entwurf und macht das Release erst anschliessend öffentlich. Entwürfe und Vorabversionen werden vom stabilen Updater nicht als reguläre Updates angeboten.

Die Update-Prüfung läuft beim Start nach etwa 12 Sekunden und danach alle vier Stunden, solange die App läuft. Die automatische Prüfung lässt sich deaktivieren. Eine manuell gestartete Prüfung lädt ein gefundenes Update ebenfalls herunter. Ein bereits geladenes Update wird beim Beenden installiert.

Dokumentation zum macOS-Updater und zur Signaturpflicht: https://www.electron.build/v26/docs/features/auto-update/

## 6. Lokal signiert bauen, ohne GitHub Actions

Mit installiertem Zertifikat und Xcode/Command Line Tools im Projektordner:

```sh
export CSC_NAME="Developer ID Application: Dein Name (DEINETEAMID)"
export APPLE_ID="deine-apple-id@example.com"
export APPLE_TEAM_ID="DEINETEAMID"
read -s "APPLE_APP_SPECIFIC_PASSWORD?Anwendungsspezifisches Apple-Passwort: "
export APPLE_APP_SPECIFIC_PASSWORD
npm run release
```

Das Beispiel verwendet die macOS-Standardshell zsh. Der Build bricht ab, wenn die erforderliche Signierung oder Notarisierung fehlt. Die Dateien aus `dist/` gemeinsam in ein neues GitHub Release mit passendem `v…`-Tag hochladen. Niemals den Ordner `mac-universal` als Update hochladen: Der Updater benötigt die ZIP und die erzeugten Metadaten.

## 7. Stand der mitgelieferten Version

Die lokale DMG enthält die funktionsfähige App samt Willkommensbildschirm, Logo und integriertem GitHub-Updater. Ohne dein Apple-Zertifikat konnten Apple-Signierung, Notarisierung und ein echter Update-Wechsel zwischen zwei signierten Versionen nicht ausgeführt werden. Die App zeigt diesen Einrichtungsstatus ausdrücklich an. Der Workflow und die Veröffentlichungsschritte sind für die anschliessende Aktivierung vorbereitet.
