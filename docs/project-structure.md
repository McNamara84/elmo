# Projektstruktur

Dieses Dokument beschreibt die nach Issue #357 eingeführten Verantwortungsgrenzen. Es ergänzt den [Dateinamen-Styleguide](file-naming-conventions.md).

## Zentrale Verzeichnisse

| Pfad | Verantwortung | HTTP-Zugriff |
| --- | --- | --- |
| `api/` | API-Frontcontroller, API-v2-Routen und temporärer API-v1-Tombstone | ja |
| `endpoints/` | schlanke browserseitig aufgerufene PHP-Aktionen für Feedback, Submit und Event-Logging | ja |
| `scripts/` | Installation, XML-Massengenerierung und Entwicklungsprüfungen | nein |
| `assets/icons/` | Favicons, Apple-Touch-Icon und PWA-Icons | ja |
| `assets/logos/` | Marken- und Identifier-Logos | ja |
| `includes/` | gemeinsam genutzte PHP-Hilfen ohne eigenen öffentlichen Endpunkt | indirekt |
| `save/` | Speichern, Validieren und Persistieren von Formgruppen | indirekt |
| `formgroups/` | serverseitig eingebundene HTML-Formulargruppen | ja |
| `js/`, `css/`, `lang/` | Browserlogik, Styles und Übersetzungen | ja |
| `doc/` | ausgelieferte Nutzerhilfe und Datenschutzseite | ja |
| `docs/` | Entwickler-, Architektur- und Planungsdokumentation | nicht Teil des Produktionsartefakts |
| `tests/` | PHPUnit-, Jest- und Playwright-Tests | nicht Teil des Produktionsartefakts |

`assets/icons/` ist auf Browser- und App-Icons begrenzt: Favicons, Apple-Touch-Icon und PWA-Icons. `assets/logos/` enthält sichtbare Marken- und Identifier-Logos, beispielsweise GFZ, DOI, ORCID und ROR. Die alten `/logos/...`-URLs bleiben während der Kompatibilitätsphase intern erreichbar.

## Öffentliche Einstiege

- `index.php` bleibt der Seiteneinstieg.
- `header.php` bleibt vorerst das zentrale Root-Template.
- `api/index.php` und `api/v2/index.php` bedienen die API-Routen.
- `endpoints/send_feedback_mail.php`, `endpoints/send_xml_file.php` und `endpoints/log_page_event.php` sind die kanonischen Aktions-URLs.
- Die früheren Root-URLs werden während der Kompatibilitätsphase intern umgeschrieben.

## Nichtöffentliche CLI-Werkzeuge

```text
php scripts/install.php basic
php scripts/install.php complete
php scripts/generate_xml_files.php
php scripts/check_file_names.php
```

Apache und der PHP-CI-Router antworten für `/scripts` und alle Unterpfade mit 404. Das schützt die Werkzeuge trotz des derzeit noch repositoryweiten Document-Roots.

## Kompatibilitätsphase

Folgende alte URLs bleiben vorübergehend erreichbar:

- `/api.php` → `/api/deprecated_v1.php` mit HTTP 410,
- `/doc/privacyPolicy.html` → `/doc/privacy-policy.html`,
- `/send_feedback_mail.php` → `/endpoints/send_feedback_mail.php`,
- `/send_xml_file.php` → `/endpoints/send_xml_file.php`,
- `/log_page_event.php` → `/endpoints/log_page_event.php`,
- ehemalige Root-URLs der Favicons/PWA-Icons → `/assets/icons/...`,
- ehemalige `/logos/...`-URLs → `/assets/logos/...`.

Die Regeln sind sowohl in `.htaccess` als auch in `ci-router.php` abgebildet und durch Unit- sowie Browsertests abgesichert.

## Bewusst vertagte Strukturarbeiten

- Ein eigener `public/`-Document-Root, der Anwendungscode und Konfiguration grundsätzlich vom Webserver trennt.
- PSR-4-Autoloading mit einem klaren `src/`-Namespace statt Composer-`classmap` über das gesamte Repository.
- Klärung und mögliche Zusammenführung der unterschiedlichen Aufgaben von `doc/` und `docs/`.
- Ein View-/Template-Verzeichnis für `header.php`, `footer.html` und `modals.html`.
- Schrittweise Vereinheitlichung der historischen Formgruppen-Dateinamen.
- Überprüfung weiterer Root-Konfigurations- und Settings-Dateien.

Diese Punkte sollen als getrennte Issues geplant werden, damit die kompatible, begrenzte Migration aus #357 reviewbar bleibt.
