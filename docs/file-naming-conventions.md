# Dateinamen-Konventionen

Diese Konvention gilt verbindlich für neue, verschobene, umbenannte und in einem Pull Request fachlich bearbeitete Dateien. Bestehende unberührte Dateien werden schrittweise migriert und müssen nicht gesammelt umbenannt werden.

## Regeln

| Dateityp | Konvention | Beispiel |
| --- | --- | --- |
| PHP-Klasse, Interface, Trait, Enum oder Testklasse | `PascalCase.php` und identisch zum primären Symbol | `DatasetController.php`, `FileNameConventionTest.php` |
| Prozedurales PHP, Endpoint, Include oder CLI-Skript | `snake_case.php` | `send_feedback_mail.php`, `check_file_names.php` |
| JavaScript-Modul | `camelCase.js` | `submitHandler.js` |
| Jest-Test | punktgetrennte `camelCase`-Segmente mit `.test.js` | `logging.test.js`, `logging.module.test.js` |
| HTML und statische Browser-Assets | `kebab-case` | `apple-touch-icon.png` |
| Playwright-/TypeScript-Spezifikation | `kebab-case.spec.ts` | `feedback-security.spec.ts` |
| Verzeichnis | kleingeschrieben, bei neuen zusammengesetzten Namen `kebab-case` | `assets/icons`, `form-groups` |

Ein einzelnes kleingeschriebenes Wort wie `index.php`, `logging.js` oder `favicon.svg` erfüllt die jeweilige Konvention ebenfalls.

## Ausnahmen

- Von Werkzeugen vorgegebene Namen, beispielsweise `composer.json`, `package-lock.json`, `.htaccess`, `Dockerfile.web` oder GitHub-Workflow-Dateien.
- Drittanbieter-, generierte, Coverage-, Cache- und Laufzeitdateien.
- `ci-router.php` bleibt während Issue #357 als bestehender Infrastruktur-Dateiname erhalten. Eine Umbenennung würde Aufrufkommandos und CI-Konfiguration ohne strukturellen Mehrwert verändern.
- Bestehende, im jeweiligen Pull Request nicht bearbeitete Altdateien.

Generische Sammelnamen wie `helper_functions.php` sollen vermieden werden. Neue Hilfslogik wird nach ihrem fachlichen Zweck benannt und im zuständigen Modul abgelegt.

## Automatisierte Prüfung

Geänderte Dateien im aktuellen Working Tree prüfen:

```text
composer check:file-names
```

Änderungen gegenüber einem Basis-Commit prüfen:

```text
composer check:file-names -- --base=<commit>
```

Alle versionierten Dateien prüfen, beispielsweise zur Ermittlung technischer Schulden:

```text
composer check:file-names -- --all
```

Der `--all`-Modus kann wegen bewusst noch nicht migrierter Altdateien fehlschlagen und ist vorerst kein verpflichtendes CI-Gate.

## Groß-/Kleinschreibung unter Windows

Eine reine Änderung der Groß-/Kleinschreibung muss zweistufig erfolgen, damit Git sie sowohl unter Windows als auch in Linux-Containern erkennt:

```text
git mv altername.php temp-name.php
git mv temp-name.php AlterName.php
```
