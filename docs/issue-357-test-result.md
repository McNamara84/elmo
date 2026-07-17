# Abschlussvergleich der Test-Suite für Issue #357

## Referenz

Dieser Bericht vergleicht den Stand nach der Umsetzung mit der vorab erfassten [Test-Suite-Baseline](issue-357-test-baseline.md).

- Abschlussprüfung: 2026-07-15
- Referenz-Commit der Baseline: `01bbe11d4e043e373abcaa20ead0094c9ad1b8c5`
- Laufzeit: PHP 8.5.8, PHPUnit 13.2.4, Node.js 26.3.0, Playwright 1.60.0

## Ergebnisübersicht

| Bereich | Baseline | Nach Umsetzung | Bewertung |
| --- | --- | --- | --- |
| PHPStan | 0 Fehler | 0 Fehler | unverändert grün |
| PHPUnit-Gesamtlauf | lautloser Abbruch ohne entdeckte Tests; Einzeltest 14 Tests/65 Assertions | 743 Tests, 2.924 Assertions, 0 Fehler, 0 Fehlschläge, 1 Skip, Exitcode 0 | Testentdeckung repariert und Suite vollständig ausführbar |
| Jest | 71/71 Suites; 1.149 bestanden, 2 `todo` | 71/71 Suites; 1.149 bestanden, 2 `todo` | unverändert grün |
| Jest Statements/Lines | 60,13 % | 60,13 % | kein Rückgang |
| Jest Branches | 69,29 % | 69,29 % | kein Rückgang |
| Jest Functions | 76,71 % | 76,71 % | kein Rückgang |
| Playwright Generic, Discovery | 258 Tests in 61 Dateien | 265 Tests in 62 Dateien | +7 Issue-357-Tests |
| Playwright, gesamte Matrix | 1.020 Tests in 72 Dateien | 1.048 Tests in 73 Dateien | +28 projektierte Ausführungen über vier Varianten |
| Issue-357-Browser-Smoke | nicht ausgeführt | 8/8 einschließlich Variant-Setup bestanden | neue und alte URLs sowie Zugriffsschutz grün |
| Docker-Entrypoint | konnte im Bind-Mount `install.php` löschen | CLI-Installation über `scripts/install.php basic` mehrfach erfolgreich; keine Quelldatei gelöscht | destruktive Nebenwirkung entfernt |

## Neue und reaktivierte Abdeckung

Für die Umstrukturierung wurden folgende Prüfungen ergänzt:

- 17 Dateinamen-Konventionstests,
- 5 Tests für CLI-Argumente und Exitcodes,
- 18 Routing-, Zugriffsschutz- und Content-Type-Tests,
- 7 Playwright-Tests für Legacy- und kanonische URLs, API-v1-HTTP-410, CLI-HTTP-404, Datenschutzseite und Browser-Icons.

Zusätzlich wurden 31 bereits vorhandene Security-Tests auf native PHPUnit-13-Attribute migriert. Sie waren zuvor wegen entfernter `@test`-Docblock-Metadaten vollständig unentdeckt. Der volle PHP-Lauf stieg dadurch zusammen mit den neuen Routing-Fällen von zunächst real ermittelten 710 auf 743 Tests.

Die PHPUnit-Suite wurde außerdem für PHP 8.5 bereinigt:

- veraltete `ReflectionMethod::setAccessible()`-Aufrufe entfernt,
- Mock-Stubs auf PHPUnit-13-kompatible Erwartungen beziehungsweise Attribute umgestellt,
- vier Zugriffe auf nicht vorhandene historische GGM-Spalten korrigiert,
- eine `curl_close()`-Deprecation beseitigt, die eine API-JSON-Antwort verunreinigt hatte,
- den ausführbaren HTTP-Handler aus der Testentdeckung des Concurrent-Request-Tests entfernt und den Test über die eigentlichen Save-Funktionen ausführbar gemacht.

Damit enthält der Abschlusslauf keine PHPUnit-Warnings, PHP-Warnings, Notices oder Deprecations mehr. Der einzige Skip dokumentiert eine unter PHP 8.5 nicht robust simulierbare `mysqli`-Fehlersituation.

## Ausgeführte Kernprüfungen

```text
vendor/bin/phpstan analyse --no-progress --error-format=table
composer validate --strict
php vendor/bin/phpunit --configuration phpunit.xml
node node_modules/jest/bin/jest.js --runInBand --coverage --silent --json
node node_modules/playwright/cli.js test --list
node node_modules/playwright/cli.js test --config=playwright.generic.config.ts --list
node node_modules/playwright/cli.js test --project=generic tests/playwright/features/legacy-route-compatibility.spec.ts
git diff --check
```

Die drei direkt von den verschobenen Browser-Endpunkten betroffenen Jest-Dateien wurden zusätzlich ohne `--silent` ausgeführt: 69 von 69 Tests bestanden.

## Browser-Testgrenze

Die isolierte Issue-357-Spec einschließlich Generic-Setup bestand mit 8 von 8 Ausführungen. Ein anschließender kombinierter Lauf weiterer, zeitabhängiger Feedback-, Submit- und Logging-Specs überschritt das Ausführungsfenster der lokalen Orchestrierung. Dabei blieben Playwright-Einmalcontainer vom aufrufenden Prozess getrennt; sie wurden anschließend gezielt entfernt, der Compose-Stack wurde beendet und die zuvor gesicherte `settings.php` wurde mit identischem SHA-256-Hash wiederhergestellt.

Die vollständige Variantenmatrix wurde deshalb nicht fachlich ausgeführt, aber erfolgreich vollständig entdeckt. Sie bleibt eine sinnvolle CI-Prüfung vor dem Merge. Die für Issue #357 neu eingeführten HTTP-Pfade und Kompatibilitätsregeln sind durch den grünen isolierten Browserlauf sowie die PHP- und JavaScript-Tests abgedeckt.
