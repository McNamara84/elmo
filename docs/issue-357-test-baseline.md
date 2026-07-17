# Test-Suite-Baseline vor Umsetzung von Issue #357

## Zweck und Referenzstand

Diese Baseline wurde vor der ersten strukturellen Codeänderung für Issue #357 erfasst. Sie dient dem Vergleich nach der Migration von Skripten, HTTP-Endpunkten und Browser-Assets.

- Erfasst am: 2026-07-15
- Branch: `chore/issue-357`
- Commit: `01bbe11d4e043e373abcaa20ead0094c9ad1b8c5`
- Commit-Betreff: `Merge pull request #1158 from McNamara84/removing-debugings-from-map`
- Bereits vorhandene, nicht zu #357 gehörende unversionierte Dateien wurden nicht verändert.

## Laufzeitumgebung

| Werkzeug | Version |
| --- | --- |
| PHP | 8.5.8, NTS, Xdebug 3.5.0 |
| PHPUnit | 13.2.4 |
| PHPStan | Projektinstallation, Konfigurationslevel 6 |
| Composer | 2.10.2 |
| Node.js | 26.3.0 |
| npm | 12.0.1 |
| Playwright | 1.60.0 laut Projektabhängigkeit/Containerdefinition |

Die lokale PHP-Laufzeit liegt außerhalb des Workspace unter Herd. Direkte PHP-Aufrufe benötigen in der isolierten Codex-Shell deshalb eine explizite Ausführungsfreigabe; dies ist kein Projektfehler.

## Inventar der vorhandenen Tests

| Bereich | Ermittelter Umfang |
| --- | --- |
| PHP-Dateien unter `tests/` | 58 PHP-Dateien einschließlich Testhilfen |
| Jest | 71 Testsuites, 1.151 Tests, davon 2 als `todo` |
| Playwright gesamt | 1.020 projektierte Testausführungen in 72 Dateien über alle Varianten |
| Playwright Generic | 258 Testausführungen in 61 Dateien einschließlich Setup |

Die Playwright-Zahl ist größer als die Anzahl physischer Spec-Dateien, weil dieselben Tests für mehrere ELMO-Varianten und Browser projektiert werden.

## Baseline-Ergebnisse

### PHPStan

Ausgeführt mit:

```text
vendor\bin\phpstan.bat analyse --no-progress --error-format=table
```

Ergebnis:

- Exit-Code: 0
- Fehler: 0
- Status: grün

### Jest einschließlich Coverage

Wegen npm 12 wurde Jest direkt über Node gestartet; `npm test -- --runInBand --coverage` wird von dieser npm-Version bereits auf npm-Ebene abgewiesen.

```text
node node_modules\jest\bin\jest.js --runInBand --coverage
```

Fachliches Testergebnis:

- Testsuites: 71 von 71 bestanden
- Tests: 1.149 bestanden, 2 `todo`, 1.151 gesamt
- Statements: 60,13 %
- Branches: 69,29 %
- Functions: 76,71 %
- Lines: 60,13 %
- Laufzeit: 120,715 Sekunden

Prozessstatus:

- Exit-Code: 1 trotz bestandener Assertions
- Ursache: Zwei bereits vorhandene, nach Testende eintreffende asynchrone Fehler-Logs aus `js/select.js` (`Cannot log after tests are done`).
- Bewertung: bekannte Baseline-Unsauberkeit; bei der Abschlussprüfung dürfen keine zusätzlichen asynchronen Meldungen entstehen. Eine Bereinigung dieser beiden Logs ist nicht fachlicher Bestandteil von #357, kann aber separat nachgezogen werden.

### PHPUnit

Ein gezielter Einzeltest wurde erfolgreich ausgeführt:

```text
php vendor\phpunit\phpunit\phpunit tests\DataUploadUrlSettingsTest.php --colors=never
```

Ergebnis:

- 14 Tests bestanden
- 65 Assertions bestanden
- Exit-Code: 0

Der vollständige lokale Verzeichnisaufruf beendet sich auf diesem Referenzstand hingegen ohne PHPUnit-Zusammenfassung und ohne entdeckte Tests. Der CI-Workflow schützt ausdrücklich gegen genau diesen Fall. Die Tests sind laut README für die Ausführung im Docker-/CI-Aufbau mit Testdatenbank und laufendem API-Server vorgesehen.

### Playwright und Docker

Die Testentdeckung funktioniert und listet alle 1.020 projektierten Ausführungen. Ein fachlicher Browserlauf wurde vor der Änderung nicht gestartet, weil keine Container liefen und der aktuelle lokale Docker-Entrypoint eine für eine Baseline ungeeignete Nebenwirkung besitzt:

```text
rm -f /var/www/html/install.{php,html}
```

Da der Compose-Entwicklungsdienst das Repository nach `/var/www/html` bind-mountet, kann dieser Befehl die versionierte Root-Datei `install.php` im Host-Working-Tree löschen. Die CLI-Migration aus #357 muss diese destruktive Bereinigung entfernen, bevor die lokale Docker-/Playwright-Suite sicher gegen den Working Tree ausgeführt wird.

## Bekannte Baseline-Probleme

1. Der vollständige PHPUnit-Verzeichnisaufruf ist lokal nicht aussagekräftig, obwohl direkte Testdateien funktionieren.
2. Jest beendet den Coverage-Lauf wegen zweier nachlaufender asynchroner Logs mit Exit-Code 1, obwohl alle ausführbaren Tests bestanden sind.
3. `npm test -- <Jest-Flags>` ist mit npm 12 nicht mehr verwendbar; direkte Jest-Ausführung funktioniert.
4. Der Docker-Entrypoint löscht im Development-Bind-Mount `install.php` aus dem Working Tree.
5. Ohne gestarteten Web-/DB-Stack können die API-, Datenbank- und Browserintegrationen lokal nicht als vollständige Baseline ausgeführt werden.

## Vergleichskriterien nach der Umsetzung

Die Abschlussprüfung muss mindestens Folgendes erreichen:

- PHPStan bleibt bei 0 Fehlern.
- Alle 71 Jest-Suites und mindestens die bisherigen 1.149 ausführbaren Tests bleiben grün.
- Die globale Jest-Abdeckung fällt nicht unter 60,13 % Statements/Lines, 69,29 % Branches und 76,71 % Functions.
- PHPUnit läuft im vorgesehenen Container-/CI-Aufbau vollständig und ohne lautlosen Null-Test-Lauf.
- Die neuen Routing-, CLI-Sperr-, Kompatibilitäts- und Dateipfadtests sind zusätzlich grün.
- Playwright entdeckt weiterhin mindestens den bisherigen Umfang; die für #357 relevanten Tests laufen in der Generic-Variante und anschließend in der vollständigen Variantenmatrix.
- Der Docker-Entrypoint verändert oder löscht keine versionierten Quelldateien im Host-Working-Tree.
- Alte öffentliche URLs und neue kanonische URLs liefern während der Kompatibilitätsphase dasselbe fachliche Verhalten.
