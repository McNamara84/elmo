# Implementierungsplan für Issue #357

## Bezug und getroffene Entscheidungen

Dieser Plan konkretisiert das Epic [#357 – Review and improve project file structure for modularity and clarity](https://github.com/McNamara84/elmo/issues/357) und dessen Sub-Issues [#429 – Styleguide für Dateinamen entwickeln](https://github.com/McNamara84/elmo/issues/429) und [#722 – Chore: pack files in root into a folder](https://github.com/McNamara84/elmo/issues/722).

Grundlage sind folgende abgestimmte Entscheidungen:

1. Die Umstrukturierung erfolgt begrenzt und rollenbasiert in `scripts/`, `endpoints/` und `assets/icons/`. Strukturell gleichartige Root-Dateien werden einbezogen, auch wenn #722 sie nicht ausdrücklich nennt.
2. Bestehende HTTP-URLs bleiben über interne Rewrite-Regeln kompatibel. Der bereits stillgelegte API-v1-Endpunkt liefert noch für einen Release HTTP 410 und wird danach in einem separaten Schritt entfernt.
3. Installation und XML-Massengenerierung werden ausschließlich als CLI-Werkzeuge angeboten und über HTTP gesperrt.
4. Der Dateinamen-Styleguide gilt für neue, verschobene, umbenannte und künftig bearbeitete Dateien. Eine flächendeckende Umbenennung aller Altdateien ist nicht Teil dieses Vorhabens.

## Zielsetzung

- Der Repository-Root enthält keine fachlichen Wartungsskripte und keine Implementierungen von AJAX-/HTTP-Aktionen mehr.
- Öffentliche Endpunkte behalten während der Migration ihr bisheriges Verhalten und ihre bisherigen URLs.
- Administrative Skripte sind klar als CLI-Werkzeuge erkennbar und nicht über den Webserver ausführbar.
- Browser-Icons werden von Markenlogos getrennt abgelegt.
- Neue Dateinamen folgen nachvollziehbaren, automatisiert prüfbaren Regeln.
- Die aktuelle Struktur, erkannte Schwachstellen und bewusst vertagte Verbesserungen werden für das Team dokumentiert.

## Nicht-Ziele

- Kein vollständiger Umbau auf einen separaten `public/`-Document-Root.
- Keine flächendeckende Umbenennung bestehender Formgruppen, Tests oder JavaScript-Dateien.
- Kein funktionaler Umbau der Speicher-, Submit-, Feedback- oder Logging-Workflows.
- Keine Änderung der bestehenden API-v2-Routen.
- Keine Einführung eines neuen Frameworks oder Dependency-Injection-Containers.
- Keine Bereinigung aller Root-Konfigurationsdateien in demselben Pull Request.

## Analyse des Ist-Zustands

### Vermischte Zuständigkeiten im Root

Der Root enthält derzeit gleichzeitig:

- öffentliche Seiteneinstiege und Templates wie `index.php`, `header.php`, `footer.html` und `modals.html`,
- aktive HTTP-Endpunkte wie `send_xml_file.php`, `send_feedback_mail.php` und `log_page_event.php`,
- administrative Werkzeuge wie `install.php` und `generate_xml_files.php`,
- den stillgelegten API-v1-Endpunkt `api.php`,
- Browser- und PWA-Icons,
- Build-, Test-, Deployment- und Anwendungskonfiguration.

Dadurch ist weder an Dateiname noch Ablageort zuverlässig erkennbar, ob eine PHP-Datei per Browser, per CLI oder nur als Include verwendet werden darf.

### Veraltete Angaben in #722

- `api_functions.php` ist nicht mehr vorhanden. Der veraltete Eintrag in `phpunit.coverage.xml` ist zu entfernen.
- `helper_functions.php` ist nicht vorhanden und soll nicht vorsorglich als generisches Sammelmodul angelegt werden. Neue Hilfslogik soll nach ihrem fachlichen Zweck benannt und im zuständigen Modul abgelegt werden.
- `api.php` enthält keine API-v1-Implementierung mehr, sondern antwortet bereits mit HTTP 410.
- Die GFZ-Markenlogos liegen bereits in `logos/`. Im Root verblieben sind Favicons und PWA-Icons, die nicht inhaltlich zu den Markenlogos gehören.
- `log_page_event.php` ist ebenso ein aktiver HTTP-Endpunkt wie die beiden `send_*`-Dateien und muss für eine konsistente Struktur mit umgezogen werden.

### Aktive Kopplungen

- `send_xml_file.php` wird aus `js/submitHandler.js` aufgerufen und direkt von PHPUnit- sowie Playwright-Tests referenziert.
- `send_feedback_mail.php` wird aus `modals.html` und `js/eventhandlers/formgroups/feedback.js` aufgerufen und durch mehrere Sicherheits- und End-to-End-Tests abgedeckt.
- `log_page_event.php` wird aus `js/logging.js` aufgerufen und durch PHPUnit-, Jest- und Playwright-Tests referenziert.
- `install.php` wird vom Docker-Entrypoint, aus PHPUnit und in der README verwendet. Der in der README genannte Browser-Installer `install.html` ist nicht versioniert.
- `generate_xml_files.php` hat keine ermittelte aktive Anwendungskopplung und ist als administratives Batch-Werkzeug zu behandeln.
- Favicons werden aus `header.php`, den statischen Hilfeseiten und der API-v2-Dokumentation referenziert. Das Webmanifest referenziert zusätzlich zwei PWA-Icons.

### Sicherheitsgrenze

Das gesamte Repository ist aktuell Apache-Document-Root. Ein Verschieben nach `scripts/` allein verhindert daher keinen HTTP-Zugriff. Die neue Ablage muss sowohl in Apache als auch im Router des PHP-Entwicklungsservers explizit gesperrt werden.

## Zielstruktur

```text
/
├── api/
│   ├── deprecated_v1.php          # temporäre 410-Antwort für /api.php
│   └── v2/                        # unverändert
├── assets/
│   └── icons/
│       ├── apple-touch-icon.png
│       ├── favicon-96x96.png
│       ├── favicon.ico
│       ├── favicon.svg
│       ├── web-app-manifest-192x192.png
│       └── web-app-manifest-512x512.png
├── endpoints/
│   ├── log_page_event.php
│   ├── send_feedback_mail.php
│   └── send_xml_file.php
├── scripts/
│   ├── check_file_names.php
│   ├── generate_xml_files.php
│   └── install.php
├── docs/
│   ├── file-naming-conventions.md
│   ├── issue-357-implementation-plan.md
│   └── project-structure.md
├── index.php                      # bleibt als öffentlicher Seiteneinstieg
├── header.php                     # bleibt zunächst als Root-Template
├── footer.html                    # außerhalb dieses Umbaus
├── modals.html                    # außerhalb dieses Umbaus
└── site.webmanifest              # URL bleibt stabil; Icon-Pfade werden angepasst
```

`logos/` bleibt Markenlogos und Identifier-Logos vorbehalten. Eine spätere Zusammenführung von `header.php`, `footer.html` und `modals.html` in ein Template-Verzeichnis wird dokumentiert, aber nicht in diesem Vorhaben durchgeführt.

## Zuordnung der zu verschiebenden Dateien

| Bisher | Ziel | Hauptanpassungen | Kompatibilität |
| --- | --- | --- | --- |
| `api.php` | `api/deprecated_v1.php` | Rewrite- und Router-Regeln, PHPStan | `/api.php` liefert weiterhin HTTP 410 |
| `install.php` | `scripts/install.php` | relative Includes, Docker-Entrypoint, PHPUnit, README | kein HTTP-Zugriff; neuer CLI-Pfad |
| `generate_xml_files.php` | `scripts/generate_xml_files.php` | relative Includes, CLI-Ein-/Ausgabe, PHPStan | kein HTTP-Zugriff |
| `send_feedback_mail.php` | `endpoints/send_feedback_mail.php` | Includes, Formular/JS, Tests, PHPStan | alter Pfad wird intern umgeschrieben |
| `send_xml_file.php` | `endpoints/send_xml_file.php` | Includes, JS, Tests, PHPUnit/PHPStan | alter Pfad wird intern umgeschrieben |
| `log_page_event.php` | `endpoints/log_page_event.php` | Includes, JS, Tests, PHPUnit | alter Pfad wird intern umgeschrieben |
| Root-Favicons/PWA-Icons | `assets/icons/` | HTML-Links, Webmanifest, Dokumentationstests | alte Asset-URLs werden intern umgeschrieben |

Für `api_functions.php` und `helper_functions.php` findet kein Umzug statt, da beide Dateien im aktuellen Stand nicht existieren.

## Dateinamen-Styleguide aus #429

### Regeln

- PHP-Klassen, Interfaces, Traits, Enums und zugehörige Tests: `PascalCase.php`; der Dateiname entspricht dem primären Symbol.
- Prozedurale PHP-Einstiege, Includes und CLI-Skripte: `snake_case.php`.
- JavaScript-Module: `camelCase.js`.
- HTML-Dateien und statische Assets: `kebab-case`.
- Playwright-/TypeScript-Spezifikationen: `kebab-case.spec.ts`.
- Verzeichnisse: kleingeschrieben; zusammengesetzte neue Namen verwenden `kebab-case`.
- Von Werkzeugen vorgegebene Namen wie `composer.json`, `Dockerfile.web`, `.htaccess` oder GitHub-Workflow-Dateien sind ausgenommen.
- Drittanbieter-, generierte und Laufzeitdateien werden nicht geprüft.

### Einführung ohne Massenumbenennung

1. `docs/file-naming-conventions.md` mit Regeln, Beispielen, Ausnahmen und Vorgehen für reine Groß-/Kleinschreibungsänderungen unter Windows anlegen.
2. Die Konvention aus `.github/CONTRIBUTING.md` und dem Entwicklerabschnitt der README verlinken.
3. `scripts/check_file_names.php` als plattformunabhängige Prüfung ergänzen.
4. Die Prüfung auf neue, umbenannte und im Pull Request bearbeitete Dateien beschränken. Bestehende unberührte Abweichungen werden zunächst als Bestand akzeptiert.
5. Die Prüfung als Composer-Skript und in einem GitHub-Actions-Job ausführen.
6. Bei notwendigen Case-only-Renames ein zweistufiges `git mv` dokumentieren, damit die Änderung auch auf Windows und in Linux-Containern korrekt erkannt wird.

Die in diesem Vorhaben verschobenen Dateien müssen bereits der neuen Konvention entsprechen. Allgemeine Namen wie `helper_functions.php` sollen vermieden werden, weil sie die Modulgrenzen erneut verwischen würden.

## Umsetzungsschritte

### Phase 1: Sicherheits- und Kompatibilitätsnetz vorbereiten

1. Für jeden bisherigen aktiven Root-Endpunkt einen Integrationstest anlegen oder vorhandene Tests erweitern, der Statuscode, Content-Type und wesentliche Antwortstruktur festhält.
2. Einen expliziten Test für `/api.php` ergänzen: HTTP 410 und Hinweis auf API v2.
3. In `.htaccess` interne Rewrite-Regeln für die drei aktiven Endpunkte, `/api.php` und die bisherigen Icon-URLs vorbereiten.
4. In `ci-router.php` dieselben Zuordnungen abbilden, da der PHP-Entwicklungsserver `.htaccess` nicht auswertet.
5. Zugriffe auf `/scripts` und `/scripts/*` in Apache und `ci-router.php` mit 404 ablehnen. Die Sperrregel muss vor der Behandlung existierender Dateien greifen.
6. Die Regeln unter einem Deployment-Präfix wie `/elmo/` testen; es dürfen keine absoluten Pfade eingeführt werden, die nur am Domain-Root funktionieren.

### Phase 2: CLI-Skripte isolieren

1. `install.php` nach `scripts/install.php` verschieben und alle Root-relativen Includes mit `dirname(__DIR__)` auflösen.
2. Den `$_POST['action']`-Zweig entfernen. Der Installer akzeptiert nur noch validierte CLI-Argumente wie `basic` und `complete` und liefert eindeutige Exit-Codes.
3. Die Installationsfunktionen so kapseln, dass PHPUnit sie weiterhin laden kann, ohne den CLI-Hauptablauf auszuführen.
4. `docker-entrypoint.sh` auf `/var/www/html/scripts/install.php` umstellen.
5. `tests/DatabaseTestCase.php`, `tests/SettingsIncludePathTest.php` und weitere direkte Includes aktualisieren.
6. Die README-Schritte für `install.html` und das anschließende manuelle Löschen des Installers entfernen. Stattdessen Docker- und CLI-Kommandos dokumentieren.
7. `generate_xml_files.php` nach `scripts/generate_xml_files.php` verschieben, die Include-Pfade korrigieren und den Ablauf auf CLI beschränken.
8. Für die XML-Generierung verständliche STDOUT-/STDERR-Ausgaben und Exit-Code 0 bei Erfolg beziehungsweise ungleich 0 bei Fehlern definieren. Datenbanktests dürfen nur gegen eine disposable Testdatenbank laufen.

### Phase 3: Aktive HTTP-Endpunkte verschieben

1. `send_feedback_mail.php`, `send_xml_file.php` und `log_page_event.php` nach `endpoints/` verschieben.
2. Alle `__DIR__`-basierten Includes auf den neuen Verzeichniskontext anpassen. Sicherheits-, Session-, CSRF-, Rate-Limit- und Mailverhalten dürfen dabei nicht verändert werden.
3. Die kanonischen relativen Frontend-URLs auf `endpoints/...` umstellen:
   - `modals.html`,
   - `js/eventhandlers/formgroups/feedback.js`,
   - `js/submitHandler.js`,
   - `js/logging.js`.
4. PHPUnit-Konfiguration, Coverage-Konfiguration, PHPStan-Ausschlüsse und direkte Test-Includes auf die neuen Pfade aktualisieren.
5. Jest- und Playwright-Erwartungen auf die kanonischen Pfade umstellen.
6. Zusätzlich je einen kleinen Kompatibilitätstest für die alten Root-URLs behalten. Dadurch werden Rewrite-Regeln unabhängig von den neuen Frontend-Aufrufen geprüft.

### Phase 4: API-v1-Tombstone verschieben

1. Den Inhalt von `api.php` unverändert nach `api/deprecated_v1.php` verschieben.
2. `/api.php` intern auf diesen Handler umschreiben; Status 410, JSON-Struktur und Verweis auf API v2 bleiben erhalten.
3. In `docs/project-structure.md` und der API-Dokumentation festhalten, dass dies eine zeitlich begrenzte Kompatibilitätsroute ist.
4. Ein Folge-Issue für die Entfernung nach einem veröffentlichten Release anlegen. Die Entfernung umfasst Handler, Rewrite-/Router-Regel und Kompatibilitätstest.
5. `api_functions.php` aus `phpunit.coverage.xml` entfernen, da die Datei bereits gelöscht ist.

### Phase 5: Browser-Icons verschieben

1. Favicons, Apple-Touch-Icon und die beiden PWA-Icons nach `assets/icons/` verschieben.
2. Referenzen in `header.php`, `doc/help.html`, `doc/privacy-policy.html` und `api/v2/docs/index.html` auf die neuen relativen Pfade umstellen.
3. `site.webmanifest` im Root belassen und dessen Icon-Quellen auf relative Pfade unter `assets/icons/` ändern. Führende `/` sind zu vermeiden, damit Deployments unter `/elmo/` funktionieren.
4. Für die bisherigen Root-Icon-URLs temporäre interne Rewrites ergänzen.
5. Prüfen, dass Content-Type, Cache-Header, Manifest-Laden und Browser-Favicon weiterhin funktionieren.
6. In der Strukturdokumentation erklären, dass `logos/` Marken-/Identifier-Logos und `assets/icons/` Browser-/Anwendungsicons enthält.

### Phase 6: Dokumentation der Projektstruktur

1. `docs/project-structure.md` mit Verantwortlichkeiten der zentralen Verzeichnisse und dem neuen Zielbaum anlegen.
2. Darin die im Review erkannten, aber vertagten Themen aufführen:
   - ein späterer separater `public/`-Document-Root,
   - engere Composer-Autoload-Grenzen statt `classmap` über `.` und langfristige PSR-4-Struktur,
   - Zusammenführung beziehungsweise klare Trennung von `doc/` und `docs/`,
   - ein eigenes Template-/View-Verzeichnis für `header.php`, `footer.html` und `modals.html`,
   - schrittweise Vereinheitlichung der bestehenden Formgruppen-Dateinamen,
   - Prüfung weiterer Root-Konfigurationen und Settings-Dateien.
3. Für größere vertagte Arbeiten getrennte Folge-Issues vorschlagen, damit #357 nicht zu einer unkontrollierten Komplettmigration anwächst.
4. README und `.github/CONTRIBUTING.md` auf Struktur- und Namensdokumentation verlinken.

### Phase 7: Abschlussbereinigung

1. Mit `rg` sicherstellen, dass keine unbeabsichtigten Referenzen auf alte physische Dateipfade verbleiben.
2. Die Root-Dateien `api.php`, `install.php`, `generate_xml_files.php`, `send_feedback_mail.php`, `send_xml_file.php` und `log_page_event.php` müssen physisch entfernt sein; ihre alten HTTP-URLs bleiben ausschließlich über Routing kompatibel.
3. PHPStan-, PHPUnit- und Coverage-Konfiguration auf nicht mehr vorhandene Einträge prüfen.
4. Den Zielbaum und die Dokumentation gegen den realen Stand abgleichen.
5. Die Akzeptanzkriterien aller drei Issues im Pull Request einzeln abhaken.

## Test- und Verifikationsstrategie

### Statische und schnelle Prüfungen

- PHP-Syntaxprüfung für alle verschobenen oder neu angelegten PHP-Dateien.
- `composer validate`.
- `vendor/bin/phpstan analyse`.
- Dateinamenprüfung für alle im Pull Request hinzugefügten, umbenannten oder bearbeiteten Dateien.
- Jest-Suite über `npm test`.
- PHPUnit-Suite über `composer test` beziehungsweise die bestehende PHPUnit-Konfiguration.

### Gezielte Regressionstests

- PHPUnit: Datenbankinstallation, Settings-Include-Pfade, XML-Dateiname, Researcher-Bestätigung und Page-Event-Logging.
- Jest: Submit-Handler, Feedback-Handler und Logging.
- Playwright: Feedback-Modal, Feedback-Sicherheit, Submit-Sicherheit, minimale Datenübermittlung und Page-Event-Logging.
- API-Smoke-Test: API-v2-Routen bleiben unverändert; `/api.php` liefert weiterhin HTTP 410.
- Asset-Smoke-Test: neue und temporär alte Icon-URLs liefern das erwartete Asset.

### Container- und Routingtests

1. Produktionsnahes Docker-Image bauen und mit einer disposable Datenbank starten.
2. Prüfen, dass der Entrypoint den Installer am neuen CLI-Pfad erfolgreich ausführt.
3. Anwendung über Apache und zusätzlich über den PHP-CI-Router starten.
4. Alte und neue URLs der drei aktiven Endpunkte hinsichtlich Methode, Statuscode, Content-Type und Antwortstruktur vergleichen.
5. Prüfen, dass `/scripts/install.php` und `/scripts/generate_xml_files.php` über HTTP mit 404 abgewiesen werden.
6. Anwendung unter einem URL-Präfix testen, damit relative Endpoint-, Manifest- und Icon-Pfade abgesichert sind.
7. Die für den Pull Request vorgesehene vollständige Playwright-Suite ausführen.

## Risiken und Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
| --- | --- |
| Relative Includes zeigen nach dem Verschieben auf falsche Dateien | konsequent `dirname(__DIR__)` verwenden und direkte Include-Tests ausführen |
| Apache und PHP-CI-Router verhalten sich unterschiedlich | Routing-Matrix in beiden Implementierungen pflegen und dieselben Smoke-Tests ausführen |
| CSRF-, Session- oder Rate-Limit-Verhalten ändert sich unbeabsichtigt | Endpunkte nur verschieben; vorhandene Security-Tests vollständig ausführen |
| Alte Integrationen verwenden weiterhin Root-URLs | interne Rewrites und explizite Kompatibilitätstests beibehalten |
| Skripte bleiben trotz neuem Verzeichnis öffentlich | HTTP-Sperre vor der Existenzprüfung, Apache- und Router-Test |
| Icon-Pfade brechen bei Deployment unter `/elmo/` | relative Manifest- und HTML-Pfade sowie Präfix-Smoke-Test |
| Case-only-Renames gehen unter Windows verloren | dokumentiertes zweistufiges `git mv` und Test im Linux-Container |
| Der PR wächst durch Altdatei-Umbenennungen stark an | Linter nur auf neue/geänderte Dateien anwenden; Rest als Folgearbeit dokumentieren |

## Empfohlene Commit-Reihenfolge

1. `docs: add file naming and project structure conventions`
2. `test: cover legacy routes and script access boundaries`
3. `refactor: move database and XML maintenance tools to scripts`
4. `refactor: move HTTP actions to endpoints with compatibility routes`
5. `refactor: relocate API v1 tombstone`
6. `refactor: move browser icons into assets`
7. `ci: enforce naming conventions for changed files`
8. `docs: finalize issue 357 findings and migration notes`

Jeder Commit soll für sich testbar sein. Insbesondere werden Kompatibilitätsregeln und Tests vor dem physischen Entfernen der bisherigen Root-Dateien eingeführt.

## Abnahmekriterien

- Eine nachvollziehbare Ist-Analyse und alle erkannten Strukturprobleme sind dokumentiert.
- Zielstruktur, Verzeichnisverantwortlichkeiten und vertagte Empfehlungen sind dokumentiert.
- Die genannten administrativen Skripte befinden sich in `scripts/` und sind nur per CLI ausführbar.
- Die drei aktiven HTTP-Aktionen befinden sich in `endpoints/`; alte URLs funktionieren weiterhin.
- `/api.php` liefert für einen Release weiterhin dieselbe HTTP-410-Antwort.
- Favicons und PWA-Icons befinden sich in `assets/icons/`; GFZ-Logos verbleiben in `logos/`.
- Der Dateinamen-Styleguide ist dokumentiert, verlinkt und für geänderte Dateien automatisiert geprüft.
- Es gibt keine veralteten Konfigurationsreferenzen auf `api_functions.php` oder alte physische Pfade.
- PHPUnit, PHPStan, Jest, die relevanten Playwright-Tests und die Docker-/Routing-Smoke-Tests sind erfolgreich.
- Anwendung, API v2, Feedback, Submit, Logging, Installation und statische Assets funktionieren nachweislich wie vor der Umstrukturierung.

## Rollout und spätere Entfernung der Kompatibilität

Die Umstrukturierung wird zunächst mit allen Kompatibilitätsrouten veröffentlicht. Nach einem vollständigen Release werden Serverzugriffe auf die alten URLs geprüft. Die Entfernung von `api/deprecated_v1.php` und der `/api.php`-Regel erfolgt anschließend über das vorgesehene Folge-Issue. Aliase der aktiven Endpunkte und Icons werden nur in einem separat angekündigten Änderungsschritt entfernt, falls keine relevanten externen Aufrufer mehr vorhanden sind.
