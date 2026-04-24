# Implementierungsplan: Save as XML und Save as JSON-LD

## Festgelegte Rahmenbedingungen

- Der bestehende Footer-Button Save as wird in Save as XML umbenannt.
- Es wird ein zweiter Footer-Button Save as JSON-LD ergänzt.
- Der JSON-LD-Export nutzt denselben Save-and-Download-Flow wie der bestehende XML-Export.
- Der bestehende Upload-Flow muss neben XML auch JSON-LD-Dateien akzeptieren und die enthaltenen Daten in die Eingabefelder zurückladen.
- Die Download-Datei wird als `.jsonld` mit dem Content-Type `application/ld+json` ausgeliefert.
- Exportiert werden nur standardisierte DataCite- und gegebenenfalls schema.org-Felder; nicht sauber abbildbare ELMO-Spezialfelder werden weggelassen.
- Es gibt keine Online-Validierung gegen die Stage-URLs im Laufzeitpfad. Die Schema-Prüfung erfolgt nur in Tests mit lokalen Fixtures oder Snapshots.

## Aktueller technischer Ausgangspunkt

- Der Footer-Button für den lokalen Export sitzt in [footer.html](footer.html).
- Das Save-As-Modal sitzt in [modals.html](modals.html) und ist derzeit auf XML fest verdrahtet.
- Das Upload-Modal sitzt ebenfalls in [modals.html](modals.html) und akzeptiert derzeit nur `.xml`.
- Die Client-Logik für den lokalen Download sitzt in [js/saveHandler.js](js/saveHandler.js) und postet aktuell immer mit `action=save_and_download` an [save/save_data.php](save/save_data.php).
- Die Client-Logik für den Datei-Upload sitzt in [js/upload.js](js/upload.js) und validiert aktuell ausschließlich XML-Dateien.
- Die eigentliche Befüllung der Eingabefelder erfolgt in [js/mappingXmlToInputFields.js](js/mappingXmlToInputFields.js) und erwartet aktuell ein DataCite-XML-Dokument mit `resource`-Root.
- Die Serverlogik in [save/save_data.php](save/save_data.php) speichert die Formdaten und liefert danach ausschließlich XML zurück.
- Die API in [api/v2/controllers/DatasetController.php](api/v2/controllers/DatasetController.php) unterstützt derzeit nur `datacite` und `iso` als Export-Schemes, beide XML-basiert.
- Die vorhandene DataCite-XML-Transformation in [schemas/XSLT/MappingMapToDataCiteSchema47.xslt](schemas/XSLT/MappingMapToDataCiteSchema47.xslt) ist die beste kanonische Zwischenrepräsentation für den neuen JSON-LD-Export.

## Zielbild

Nach dem Klick auf Save as XML oder Save as JSON-LD wird derselbe Speichervorgang wie heute ausgeführt. Anschließend lädt ELMO abhängig vom gewählten Button entweder eine XML-Datei oder eine JSON-LD-Datei herunter. Für JSON-LD wird die bereits existierende DataCite-XML-Ausgabe als fachlich führende Quelle verwendet und in eine DataCite-4.7-Linked-Data-Repräsentation übersetzt.

Der Load-Dialog akzeptiert zusätzlich zu XML auch JSON-LD-Dateien. JSON-LD wird vor dem Laden in eine gemeinsame interne Import-Repräsentation überführt, sodass die bestehende feldbezogene Lade-Logik möglichst weitgehend wiederverwendet werden kann.

## Umsetzungsschritte

### 1. UI und Übersetzungen formatfähig machen

- In [footer.html](footer.html) den bestehenden Buttontext auf Save as XML umstellen und einen zweiten Submit-Button für Save as JSON-LD ergänzen.
- Die Buttons sollten unterschiedliche `data-action`-Werte tragen, zum Beispiel `save-xml` und `save-jsonld`, damit der Client den gewünschten Downloadtyp explizit kennt.
- In [js/validation.js](js/validation.js) die bisherige Verzweigung `save` versus `submit` auf ein kleines Export-Dispatching erweitern.
- In [modals.html](modals.html) das Save-As-Modal formatneutral machen:
  - Modal-Titel dynamisch zwischen Save as XML und Save as JSON-LD setzen.
  - Dateiendung dynamisch zwischen `.xml` und `.jsonld` umschalten.
  - Wenn möglich das bestehende Modal wiederverwenden statt ein zweites Modal einzuführen.
- In [modals.html](modals.html) auch das Upload-Modal formatoffen anpassen:
  - Beschriftung von XML hochladen auf eine generische Import-Bezeichnung umstellen.
  - `accept` auf `.xml,.jsonld,.json` erweitern.
  - Hinweistext im Drop-Zone-Text auf XML oder JSON-LD erweitern.
- Übersetzungen in mindestens [lang/de.json](lang/de.json), [lang/en.json](lang/en.json) und [lang/fr.json](lang/fr.json) um neue Button- und Modaltexte ergänzen.
- Bestehende Tests und Selektoren, die hart auf Save as oder Save as XML prüfen, gezielt anpassen.

### 2. SaveHandler auf mehrere Downloadformate erweitern

- In [js/saveHandler.js](js/saveHandler.js) einen kleinen Format-State einführen, etwa `xml` oder `jsonld`.
- `handleSave()` sollte einen Parameter für das gewünschte Downloadformat annehmen und damit Modal-Titel, Dateiendung und Downloadlogik steuern.
- `handleSaveConfirm()` und `saveAndDownload()` sollten zusätzlich zum Dateinamen auch das Zielformat kennen.
- Beim POST an [save/save_data.php](save/save_data.php) einen zusätzlichen Parameter wie `download_format` mitsenden.
- Der Client sollte die Dateiendung nicht mehr fest auf `.xml` verdrahten, sondern aus dem gewählten Format oder aus `Content-Disposition` ableiten.
- Die Logging-Texte in [js/saveHandler.js](js/saveHandler.js) sollten formatbewusst werden, damit XML- und JSON-LD-Downloads im Event-Log unterscheidbar bleiben.

### 3. Upload-Pfad auf XML und JSON-LD erweitern

- In [js/upload.js](js/upload.js) die Dateitypprüfung von XML-only auf XML oder JSON-LD erweitern.
- Statt `isXmlFile()` und `handleXmlFile()` sollte der Upload-Pfad generische Helfer erhalten, zum Beispiel `isSupportedMetadataFile()` und `handleMetadataFile()`.
- Die Auswahl des Parsers erfolgt über MIME-Type, Dateiendung und notfalls Heuristik auf den Dateiinhalt:
  - XML: bestehender DOMParser-Pfad bleibt erhalten.
  - JSON-LD: JSON parsen, Grundstruktur validieren und dann in die interne Import-Repräsentation überführen.
- Die Upload-Statusmeldungen in [js/upload.js](js/upload.js) müssen von XML-spezifischen Texten auf metadatenformat-neutrale Texte umgestellt werden.
- Fehlerfälle müssen klar getrennt sein:
  - ungültige Dateiendung
  - ungültiges JSON
  - gültiges JSON, aber kein unterstütztes DataCite-JSON-LD
  - formal parsebares Dokument ohne für ELMO nutzbare Resource-Daten

### 4. JSON-LD-Importadapter als eigene Client-Komponente einführen

- Eine neue Client-Komponente anlegen, sinnvollerweise unter [js](js) oder [js/services](js/services), die DataCite-JSON-LD in eine von ELMO ladbare Struktur übersetzt.
- Der Adapter sollte nicht direkt DOM-Felder beschreiben, sondern entweder:
  - ein minimales DataCite-XML-Dokument erzeugen, das an `loadXmlToForm()` übergeben wird, oder
  - eine gemeinsame interne Import-Struktur bereitstellen, die sowohl XML als auch JSON-LD bedient.
- Für den ersten Wurf ist der risikoärmste Weg die Normalisierung von JSON-LD in ein DataCite-XML-Dokument, weil [js/mappingXmlToInputFields.js](js/mappingXmlToInputFields.js) bereits auf dieser Struktur aufsetzt.
- Der Adapter sollte mindestens die bereits unterstützten DataCite-Felder abdecken:
  - identifier
  - creators
  - titles
  - publisher
  - publicationYear
  - resourceType
  - subjects
  - contributors
  - descriptions
  - dates
  - relatedIdentifiers
  - fundingReferences
  - geoLocations
  - rightsList
  - language
  - version
- Kontrollierte Terme und IRIs aus JSON-LD müssen so aufgelöst werden, dass die bestehende Lade-Logik dieselben Werte erhält wie beim XML-Import.

### 5. Bestehende Importlogik gezielt verallgemeinern

- In [js/mappingXmlToInputFields.js](js/mappingXmlToInputFields.js) den öffentlichen Einstieg von XML-spezifisch auf formatneutral erweitern, zum Beispiel mit einem Wrapper wie `loadMetadataToForm()`.
- `loadXmlToForm()` kann intern bestehen bleiben, wenn der JSON-LD-Adapter zuerst ein XML-Dokument erzeugt.
- Alternativ sollte nur dann tiefer refaktoriert werden, wenn die XML-Zwischenrepräsentation für JSON-LD zu verlustreich oder zu kompliziert wird.
- Wichtig ist, dass die bereits vorhandenen Spezialpfade für DataCite-Fallbacks erhalten bleiben, etwa für Kontaktpersonen, Keywords und andere Felder, die heute schon explizit aus DataCite-XML gelesen werden.
- Nicht abbildbare Felder bleiben auch beim Import leer; das Verhalten muss dokumentiert und getestet werden.

### 6. Serverseitigen Save-and-Download-Pfad generalisieren

- In [save/save_data.php](save/save_data.php) die Funktion `generateAndOutputXml()` in eine formatneutrale Download-Funktion überführen, zum Beispiel `generateAndOutputDownload()`.
- Die bestehende Semantik bleibt erhalten:
  - Ohne `filename` gibt es nur den Save-Vorgang.
  - Mit `filename` und `download_format=xml` bleibt das heutige Verhalten erhalten.
  - Mit `filename` und `download_format=jsonld` wird JSON-LD ausgeliefert.
- Für Abwärtskompatibilität sollte fehlendes `download_format` als `xml` behandelt werden.
- Response-Header müssen je Format korrekt gesetzt werden:
  - XML: `application/xml`, Dateiendung `.xml`
  - JSON-LD: `application/ld+json`, Dateiendung `.jsonld`
- Fehlerbehandlung und Transaktionsverhalten bleiben identisch: erst speichern, dann Export erzeugen, und bei Exportfehlern ein klarer Fehler-Response nach erfolgreichem Commit.

### 7. JSON-LD-Serializer als eigene Serverkomponente einführen

- Eine neue PHP-Komponente für DataCite Linked Data anlegen, sinnvollerweise unter [api/v2/services](api/v2/services) oder als dedizierte Export-Hilfsklasse nahe [api/v2/controllers/DatasetController.php](api/v2/controllers/DatasetController.php).
- Diese Komponente sollte nicht direkt aus den rohen POST-Daten bauen, sondern aus der bereits existierenden DataCite-XML-Zwischenrepräsentation.
- Empfohlene Route:
  - Mit der bestehenden Logik zuerst DataCite XML 4.7 erzeugen.
  - Das DataCite XML mit DOMDocument oder SimpleXML einlesen.
  - Die relevanten XML-Elemente in eine PHP-Array-Struktur für JSON-LD abbilden.
  - Anschließend mit `json_encode(..., JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)` serialisieren.

### 8. Mapping-Regeln für DataCite 4.7 Linked Data festziehen

- Als `@context` die DataCite-Linked-Data-Contexts aus dem Manifest 4.7 verwenden, jedoch nicht zur Laufzeit nachladen oder validieren.
- Die neue Serializer-Komponente sollte mindestens die Felder abdecken, die bereits heute in der DataCite-XML-Ausgabe vorkommen:
  - Identifier und IdentifierType
  - Creator inklusive NameType, GivenName, FamilyName, ORCID, Affiliation und ROR
  - Title inklusive TitleType und Sprache
  - Publisher
  - PublicationYear
  - ResourceType und ResourceTypeGeneral
  - Subject inklusive Scheme, SchemeURI, ValueURI und Sprache
  - Contributor inklusive ContributorType, NameIdentifier und Affiliation
  - Description inklusive DescriptionType
  - FundingReference
  - RelatedIdentifier
  - Rights
  - GeoLocation, soweit in der bestehenden DataCite-XML-Ausgabe vorhanden
  - Version und Language
- Kontrollierte Terme sollten, wo sinnvoll und dokumentiert, als DataCite-Vokabular-IRIs ausgegeben werden statt nur als freie Labels.
- Felder, die im aktuellen ELMO-Modell existieren, aber nicht belastbar im DataCite-Linked-Data-Modell landen, werden bewusst nicht exportiert. Dazu gehören voraussichtlich insbesondere E-Mail- und Website-Felder der Kontaktperson sowie weitere ELMO-spezifische Spezialfelder.
- Dieselben fachlichen Grenzen gelten auch für den Import: Was im JSON-LD nicht vorkommt oder nicht stabil auf ELMO-Felder zurückgeführt werden kann, wird nicht künstlich rekonstruiert.
- Für GGM- oder ICGEM-spezifische Inhalte muss explizit geprüft werden, ob sie bereits in der DataCite-XML-Ausgabe landen. Wenn nicht, bleiben sie im JSON-LD-Export zunächst außen vor.

### 9. API-Exportpfad konsistent erweitern

- Der JSON-LD-Serializer sollte nicht nur von [save/save_data.php](save/save_data.php) nutzbar sein, sondern auch vom API-Export in [api/v2/controllers/DatasetController.php](api/v2/controllers/DatasetController.php).
- Dafür `jsonld` als zusätzliches unterstütztes Scheme in `handleExport()` ergänzen.
- Für `jsonld` sollte die API denselben Serializer aufrufen und `application/ld+json` zurückgeben.
- Vorteil: Der neue Export ist nicht nur im UI verfügbar, sondern auch über die bestehende Export-API wiederverwendbar und testbar.

### 10. Lokale Referenzen für Schema und Tests ablegen

- Eine lokale Fixture oder ein Snapshot des verwendeten Manifests 4.7 im Repository ablegen, zum Beispiel unter einem neuen Unterordner in [schemas](schemas) oder unter `tests/fixtures`.
- Optional zusätzlich eine kleine interne Mapping-Konfiguration anlegen, die die relevanten Context-URLs und Vokabular-Basen kapselt.
- Ziel ist Reproduzierbarkeit in Tests ohne Netzabhängigkeit und ohne harte Kopplung an die Stage-Umgebung.

## Teststrategie

### JavaScript-Unit-Tests

- [tests/js/saveHandler.test.js](tests/js/saveHandler.test.js) erweitern für:
  - Formatwahl XML versus JSON-LD
  - dynamischen Modal-Titel und dynamische Dateiendung
  - POST mit `download_format=jsonld`
  - korrekten Dateinamen beim Download
  - formatbezogenes Logging
- Neue oder erweiterte Tests für [js/upload.js](js/upload.js) ergänzen für:
  - Akzeptanz von `.jsonld` und optional `.json`
  - Parser-Auswahl XML versus JSON-LD
  - Fehlerfall bei ungültigem JSON-LD
  - Übergabe an die gemeinsame Lade-Logik
- [tests/js/mappingXmlToInputFields.test.js](tests/js/mappingXmlToInputFields.test.js) oder eine neue dedizierte Testdatei um JSON-LD-Importfälle ergänzen.
- Falls nötig ergänzende Tests in [tests/js/validation.test.js](tests/js/validation.test.js) für die neue Action-Verzweigung.

### PHP-Unit-Tests

- Neuen Test für die JSON-LD-Serializer-Komponente anlegen, idealerweise mit einer kontrollierten DataCite-XML- oder Test-Dataset-Eingabe.
- Gezielt prüfen:
  - Grundstruktur mit `@context` und Resource-Typ
  - IRI-Mapping für kontrollierte Terme
  - korrektes Weglassen nicht unterstützter ELMO-Spezialfelder
  - korrektes Encoding und Header für `application/ld+json`
- [tests/DatasetControllerTest.php](tests/DatasetControllerTest.php) um Exportfälle erweitern oder eine neue dedizierte Testklasse für Exportausgaben anlegen.
- Falls praktikabel einen schmalen Test für [save/save_data.php](save/save_data.php) ergänzen, der `download_format=jsonld` verifiziert.

### Import- und Roundtrip-Tests

- Die vorhandenen XML-Upload-Flows, zum Beispiel rund um [js/upload.js](js/upload.js) und [js/mappingXmlToInputFields.js](js/mappingXmlToInputFields.js), um JSON-LD-Pendants erweitern.
- Mindestens einen Roundtrip absichern:
  - Datensatz als JSON-LD exportieren
  - dieselbe Datei wieder hochladen
  - Kernfelder landen wieder in den Eingabefeldern
- Zusätzlich einen kontrollierten JSON-LD-Importtest mit einer handgebauten Fixture ergänzen, damit Import nicht nur gegen die eigene Exportausgabe getestet wird.

### Playwright

- Den bestehenden XML-Flow in [tests/playwright/flows/minimal-data-save.spec.ts](tests/playwright/flows/minimal-data-save.spec.ts) auf den neuen Buttontext Save as XML anpassen.
- Einen zweiten minimalen Save-Flow für JSON-LD ergänzen:
  - Klick auf Save as JSON-LD
  - sichtbares Modal mit JSON-LD-spezifischem Titel oder Suffix
  - Download mit `.jsonld`
  - Request an [save/save_data.php](save/save_data.php) enthält `download_format=jsonld`
  - Erfolgs- und Fehlerfall analog zum XML-Flow
- Die bestehenden XML-Upload-Flows um mindestens einen JSON-LD-Upload-Flow ergänzen:
  - Upload einer `.jsonld`-Datei über das bestehende Modal
  - erfolgreiche Befüllung zentraler Felder
  - sauberer Fehlerhinweis bei ungültigem JSON-LD
  - optional ein End-to-End-Roundtrip Export JSON-LD -> Import JSON-LD

## Empfohlene Implementierungsreihenfolge

1. Upload- und Export-UI gemeinsam formatfähig machen, ohne das bestehende XML-Verhalten zu brechen.
2. In [js/upload.js](js/upload.js) Dateierkennung und Parser-Dispatch für XML versus JSON-LD einführen.
3. JSON-LD-Importadapter bauen und an die bestehende Lade-Logik anbinden.
4. In [save/save_data.php](save/save_data.php) `download_format` einführen und XML als Default beibehalten.
5. JSON-LD-Serializer gegen die existierende DataCite-XML-Ausgabe implementieren.
6. API-Scheme `jsonld` in [api/v2/controllers/DatasetController.php](api/v2/controllers/DatasetController.php) ergänzen.
7. Zuerst JS- und PHP-Unit-Tests absichern, danach gezielte Playwright-Flows für Export und Import ergänzen.

## Risiken und bewusste Nicht-Ziele

- Die Stage-Dokumentation von DataCite kann sich ändern; deshalb sollte ELMO intern auf eine feste 4.7-Referenz eingefroren werden.
- Nicht direkt abbildbare ELMO-Felder werden absichtlich nicht per Custom-JSON-LD erweitert.
- Eine generische Online-Schema-Validierung zur Laufzeit ist ausdrücklich nicht Teil dieses Features.
- Der Plan geht davon aus, dass die bestehende DataCite-XML-Transformation fachlich die führende Quelle bleibt. Wenn sich dort bereits Mapping-Lücken zeigen, sollten diese zuerst dort korrigiert und nicht doppelt im JSON-LD-Serializer kompensiert werden.
- Import und Export werden wahrscheinlich nicht vollständig informationssymmetrisch sein, weil bestimmte ELMO-Felder schon im DataCite-Modell nicht verlustfrei repräsentiert werden.

## Abnahmekriterien

- Im Footer sind zwei getrennte Export-Buttons sichtbar: Save as XML und Save as JSON-LD.
- Beide Buttons speichern den aktuellen Formularstand über die bestehende Save-Pipeline.
- Der XML-Download verhält sich unverändert gegenüber dem heutigen Stand.
- Der JSON-LD-Download liefert eine `.jsonld`-Datei mit `application/ld+json`.
- Die JSON-LD-Datei enthält nur standardisierte DataCite- beziehungsweise schema.org-nahe Felder und keine benutzerdefinierten ELMO-Erweiterungen.
- Der Load-Dialog akzeptiert XML und JSON-LD.
- Eine gültige DataCite-JSON-LD-Datei kann in die ELMO-Eingabefelder eingelesen werden.
- Ungültige oder nicht unterstützte JSON-LD-Dateien liefern einen verständlichen Fehlerhinweis.
- Die neue Export- und Importlogik ist über Tests auf Unit- und mindestens einen End-to-End-Flow abgesichert.