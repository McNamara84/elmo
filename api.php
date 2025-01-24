<?php
////////////////////////////////////////////////////////////////////////////////////////
// This script is for the APIv1 endpoints and will be deprecated in the future
// Please use APIv2 for new API calls: http://localhost/mde-msl/api/v2/docs/index.html
////////////////////////////////////////////////////////////////////////////////////////
ini_set("max_execution_time", 300);
require 'vendor/autoload.php';

use EasyRdf\Graph;
use EasyRdf\RdfNamespace;

include 'settings.php';
include 'api_functions.php';

/* Deprecated. Use APIv2 instead. */
// API-Hook für den Abruf des kontrollierten Vokabulars GCMD Science Keywords von der NASA als JSON-String für externe Anwendungen
// Beispielaufruf: api.php?action=getGcmdScienceKeywords
if ($_GET['action'] == 'getGcmdScienceKeywords') {
    // json/gcmdScienceKeywords.json einlesen
    $json = file_get_contents('json/gcmdScienceKeywords.json');
    // JSON-String zurückgeben
    echo $json;
    // Skriptausführung beenden
    exit();
}

/* Deprecated. Use APIv2 instead. */
// API-Hook für den Abruf aller kontrollierten Vocabulare von GitHub und Speicherung in getrennten JSON-Dateien
// Beispielaufruf: api.php?action=getMslVocab&type=all oder api.php?action=getMslVocab&type=geologicalage
if (isset($_GET['action']) && $_GET['action'] == 'getMslVocab') {
    $type = $_GET['type'] ?? 'all';
    $baseUrl = 'https://raw.githubusercontent.com/UtrechtUniversity/msl_vocabularies/main/vocabularies/';
    $types = ['analogue', 'geochemistry', 'geologicalage', 'geologicalsetting', 'materials', 'microscopy', 'paleomagnetism', 'porefluids', 'rockphysics'];
    $jsonDir = __DIR__ . '/json/';

    if (!file_exists($jsonDir)) {
        mkdir($jsonDir, 0755, true);
    }

    $results = [];

    if ($type == 'all') {
        foreach ($types as $t) {
            $latestVersion = getLatestVersion($baseUrl, $t);
            if ($latestVersion) {
                $url = "{$baseUrl}{$t}/{$latestVersion}/{$t}_" . str_replace('.', '-', $latestVersion) . ".json";
                $savePath = $jsonDir . "{$t}.json";
                $success = downloadAndSave($url, $savePath);
                $results[$t] = $success ? "Updated to version {$latestVersion}" : "Failed to update";
            } else {
                $results[$t] = "No version found";
            }
        }
    } elseif (in_array($type, $types)) {
        $latestVersion = getLatestVersion($baseUrl, $type);
        if ($latestVersion) {
            $url = "{$baseUrl}{$type}/{$latestVersion}/{$type}_" . str_replace('.', '-', $latestVersion) . ".json";
            $savePath = $jsonDir . "{$type}.json";
            $success = downloadAndSave($url, $savePath);
            $results[$type] = $success ? "Updated to version {$latestVersion}" : "Failed to update";
        } else {
            $results[$type] = "No version found";
        }
    } else {
        $results['error'] = "Invalid type specified";
    }

    header('Content-Type: application/json');
    echo json_encode($results);
    exit();
}

/* Deprecated. Use APIv2 instead. */
// API-Hook für den Abruf aller MSL Labs und Speicherung als msl-labs.json
// Beispielaufruf: api.php?action=getMslLabs
if (isset($_GET['action']) && $_GET['action'] == 'getMslLabs') {
    try {
        $mslLabs = fetchAndProcessMslLabs();
        $jsonString = json_encode($mslLabs, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        if ($jsonString === false) {
            throw new Exception('Fehler beim Encodieren der Daten zu JSON: ' . json_last_error_msg());
        }

        $result = file_put_contents('json/msl-labs.json', $jsonString);

        if ($result === false) {
            throw new Exception('Fehler beim Speichern der JSON-Datei: ' . error_get_last()['message']);
        }

        echo 'MSL Labs erfolgreich aktualisiert';
    } catch (Exception $e) {
        http_response_code(500);
        echo 'Fehler: ' . $e->getMessage();

        // Zusätzliche Debug-Informationen
        echo '<br><br>Debug-Informationen:<br>';
        echo 'PHP-Version: ' . phpversion() . '<br>';
        echo 'JSON-Daten:<br><pre>' . htmlspecialchars(file_get_contents($url)) . '</pre>';
    }
    exit();
}


// API-Hook für den Abruf aller drei XML-Dateien (DataCie, ISO, DIF), Schachtelung der XML-Sturkutur in ein Element <envelope> sowie Download dieser gebündelten XML-Datei
// Beispielaufruf: api.php?action=getResourcesAsOneFile&id=1
if ($_GET['action'] == 'getResourcesAsOneFile') {
    $id = intval($_GET['id']);

    function getXmlFromApi($action, $id)
    {
        $url = "https://{$_SERVER['HTTP_HOST']}{$_SERVER['PHP_SELF']}?action={$action}&id={$id}";
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $result = curl_exec($ch);
        if (curl_errno($ch)) {
            throw new Exception(curl_error($ch));
        }
        curl_close($ch);
        return $result;
    }

    function removeXmlDeclaration($xml)
    {
        return preg_replace('/<\?xml.*?\?>/', '', $xml);
    }

    try {
        $dataciteXml = getXmlFromApi('getResourceAsDataciteXml', $id);
        $isoXml = getXmlFromApi('getResourceAsIsoXml', $id);
        $difXml = getXmlFromApi('getResourceAsDifXml', $id);

        // XML-Deklarationen aus den einzelnen XML-Strings entfernen
        $dataciteXml = removeXmlDeclaration($dataciteXml);
        $isoXml = removeXmlDeclaration($isoXml);
        $difXml = removeXmlDeclaration($difXml);

        // Envelope-Element als Wurzelelement hinzufügen
        $xmlContent = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<envelope>\n";
        $xmlContent .= $dataciteXml . "\n";
        $xmlContent .= $isoXml . "\n";
        $xmlContent .= $difXml . "\n";
        $xmlContent .= "</envelope>";

        // Download der erzeugten XML-Datei
        header('Content-Type: application/xml');
        header('Content-Disposition: attachment; filename="Dataset_' . $id . '.xml"');
        header('Content-Length: ' . strlen($xmlContent));
        echo $xmlContent;
        exit();
    } catch (Exception $e) {
        http_response_code(500);
        echo "Fehler: " . $e->getMessage();
        exit();
    }
}

// API-Hooks um einen kompletten Datensatz einer Resource als XML-Datei im DataCite-, ISO- oder DIF-Format runterzuladen
// Beispielaufruf 1: api.php?action=getResourceAsDataciteXml&id=1&download=true um den Datensatz mit der Resource-ID 1 als XML-Datei lokal speichern
// Beispielaufruf 2: api.php?action=getResourceAsIsoXml&id=2 um den Datensatz mit der Resource-ID 2 auf dem Server zu speichern (zwecks weiterer maschineller Verarbeitung)
if (isset($_GET['action']) && isset($_GET['id'])) {
    $id = intval($_GET['id']);
    $download = isset($_GET['download']) && $_GET['download'] === 'true';

    try {
        switch ($_GET['action']) {
            case 'getResourceAsDifXml':
                $result = transformAndSaveOrDownloadXml($id, 'dif', $download);
                break;
            case 'getResourceAsIsoXml':
                $result = transformAndSaveOrDownloadXml($id, 'iso', $download);
                break;
            case 'getResourceAsDataciteXml':
                $result = transformAndSaveOrDownloadXml($id, 'datacite', $download);
                break;
            default:
                throw new Exception("Ungültige Aktion.");
        }

        if (!$download) {
            // Wenn kein Download, geben Sie den XML-String zurück
            echo $result;
        }
        // Wenn Download, wurde bereits in der Funktion behandelt
    } catch (Exception $e) {
        // Fehlerbehandlung
        http_response_code(400);
        echo "Fehler: " . $e->getMessage();
    }
}

// API-Hook für den Abruf aller CGI Simple Lithology Keywords aus der CGI Simple Lithology RDF-Datei
// Beispielaufruf: api.php?action=getCGIKeywords
if ($_GET['action'] == 'getCGIKeywords') {
    $jsonFilePath = 'json/cgi.json';
    $jsonData = fetchAndProcessCGIKeywords();
    file_put_contents($jsonFilePath, json_encode($jsonData, JSON_PRETTY_PRINT));
    echo "JSON-Datei gespeichert unter: " . $jsonFilePath;
    exit();
}

// API-Hook für den Abruf aller Chronostrat Keywords aus der RDF-Datei der International Chronostratigraphic Chart
// Beispielaufruf: api.php?action=getChronostratKeywords
if ($_GET['action'] == 'getChronostratKeywords') {
    // Überprüfen der Verfügbarkeit einer URL
    function isUrlAvailable($url)
    {
        $headers = @get_headers($url);
        return $headers && strpos($headers[0], '200') !== false;
    }
    // Aktuelles Datum speichern
    $currentDate = new DateTime();
    // URL-Muster
    $urlPattern = 'https://stratigraphy.org/ICSchart/data/ChronostratChart%s-%s.ttl';
    // Suche nach der neuesten verfügbaren Datei
    $file = null;
    for ($i = 0; $i < 36; $i++) { // Suche bis zu 3 Jahre zurück
        $year = $currentDate->format('Y');
        $month = $currentDate->format('m');
        $url = sprintf($urlPattern, $year, $month);

        if (isUrlAvailable($url)) {
            $file = $url;
            break;
        }

        $currentDate->modify('-1 month');
    }

    if (!$file) {
        header('HTTP/1.1 404 Not Found');
        echo "Keine gültige TTL-Datei gefunden.";
        exit();
    }

    // RDF-Datei laden
    $graph = new Graph();
    $graph->parseFile($file, 'turtle');

    // Namespaces definieren
    RdfNamespace::set('cs', 'http://resource.geosciml.org/classifier/ics/ischart/');
    RdfNamespace::set('skos', 'http://www.w3.org/2004/02/skos/core#');
    RdfNamespace::set('time', 'http://www.w3.org/2006/time#');

    // Alle Konzepte durchgehen und relevante Informationen sammeln
    $concepts = [];
    foreach ($graph->allOfType('skos:Concept') as $concept) {
        $uri = (string) $concept->getUri();
        $label = (string) $concept->get('skos:prefLabel');
        $definition = (string) $concept->get('skos:definition');
        $broader = $concept->get('skos:broader');

        $concepts[$uri] = [
            'id' => $uri,
            'text' => $label,
            'language' => 'en',
            'scheme' => 'Chronostratigraphic Chart',
            'schemeURI' => 'https://stratigraphy.org',
            'description' => $definition,
            'children' => []
        ];

        // Broader-Beziehung speichern
        if ($broader) {
            $concepts[$uri]['broader'] = (string) $broader->getUri();
        }
    }

    // Hierarchie aufbauen
    foreach ($concepts as $uri => &$concept) {
        if (isset($concept['broader'])) {
            $broaderUri = $concept['broader'];
            if (isset($concepts[$broaderUri])) {
                $concepts[$broaderUri]['children'][] = &$concept;
            }
        }
    }

    // Nur root-Level-Konzepte für die Ausgabe vorbereiten
    $hierarchy = array_filter($concepts, function ($concept) {
        return !isset($concept['broader']);
    });

    // JSON-Datei schreiben
    $jsonFilePath = 'json/ChronostratKeywords.json';
    file_put_contents($jsonFilePath, json_encode(array_values($hierarchy), JSON_PRETTY_PRINT));

    // Bestätigungsmeldung zurückgeben
    header('Content-Type: text/plain');
    echo "International Chronostratigraphic Chart Keywords erfolgreich aktualisiert. Verwendete Datei: $file";
    exit();
}

//API-Hook für den Abruf des GEMET Thesaurus,
//Beispielaufruf: api.php?action=getGemetConcepts
if ($_GET['action'] == 'getGemetConcepts') {

    // Paths and URLs
    $rdf_url = 'https://www.eionet.europa.eu/gemet/latest/gemet.rdf.gz';
    $rdf_file = 'gemet.rdf.gz';
    $json_file = 'json/gemet.json';

    try {
        // Download RDF file
        if (file_put_contents($rdf_file, file_get_contents($rdf_url)) === false) {
            throw new Exception("Failed to download RDF file.");
        }

        // Uncompress RDF file
        $rdf_content = file_get_contents('compress.zlib://' . $rdf_file);
        if ($rdf_content === false) {
            throw new Exception("Failed to uncompress RDF file.");
        }

        // Set RDF namespaces if needed
        RdfNamespace::set('skos', 'http://www.w3.org/2004/02/skos/core#');
        RdfNamespace::set('rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#');

        // Parse RDF data
        $graph = new Graph();
        $graph->parse($rdf_content, 'rdfxml');

        // Initialize an array to store concepts
        $keywordMap = [];

        // Process SKOS concepts
        foreach ($graph->allOfType('skos:Concept') as $concept) {
            $id = $concept->getUri();
            $prefLabel = (string) $concept->getLiteral('skos:prefLabel', 'en');
            $definition = (string) $concept->getLiteral('skos:definition', 'en');

            // Store each concept in the $keywordMap array
            $keywordMap[$id] = [
                'id' => $id,
                'text' => $prefLabel,
                'language' => 'en',
                'scheme' => 'GEMET - Concepts, version 4.2.3',
                'schemeURI' => 'http://www.eionet.europa.eu/gemet/gemetThesaurus',
                'description' => $definition,
                'children' => []
            ];
        }

        // Build hierarchy based on broader relationships
        foreach ($keywordMap as $id => &$data) {
            $broaderConcepts = $graph->all($id, 'skos:broader');
            foreach ($broaderConcepts as $broaderConcept) {
                $parentId = $broaderConcept->getUri();
                if (isset($keywordMap[$parentId])) {
                    $keywordMap[$parentId]['children'][] = &$keywordMap[$id];
                    break; // Only add to one parent
                }
            }
        }

        // Identify root concepts (those without broader relationships)
        $roots = [];
        foreach ($keywordMap as $id => $data) {
            $broaderConcepts = $graph->all($id, 'skos:broader');
            if (empty($broaderConcepts)) {
                $roots[] = &$keywordMap[$id];
            }
        }

        // Insert artificial root node
        $artificialRoot = [
            'id' => 'artificial_root_id', // Replace with a suitable ID if needed
            'text' => 'GEMET Concepts', // Name of the artificial root node
            'children' => $roots // Assign the existing root concepts as children
        ];

        // Create final JSON structure with artificial root
        $json_data = json_encode([$artificialRoot], JSON_PRETTY_PRINT);

        // Save JSON to file
        if (file_put_contents($json_file, $json_data) === false) {
            throw new Exception("Failed to save JSON file.");
        }

        // Clean up downloaded RDF file
        unlink($rdf_file);

        // Success message
        echo "JSON data successfully saved to {$json_file}";
    } catch (Exception $e) {
        // Handle exceptions and clean up
        if (file_exists($rdf_file)) {
            unlink($rdf_file);
        }
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit();
}

/* Deprecated. Use APIv2 instead. */
// API-Hook für den Abruf aller Funders von der CrossRef-API
// Beispielaufruf: api.php?action=getCrossRefFunders
// JSON-Antwort: crossRefId, name
if ($_GET['action'] == 'getCrossRefFunders') {
    $allFunders = [];
    $offset = 0;
    $limit = 1000; // Maximale Anzahl von Ergebnissen pro Anfrage
    $retryDelay = 5; // Wartezeit in Sekunden vor einem erneuten Versuch
    $maxRetries = 3; // Maximale Anzahl von Wiederholungsversuchen

    do {
        $retry = 0;
        do {
            // URL der CrossRef-API für die Funders-Liste mit Paginierung
            $url = "https://api.crossref.org/funders?offset=$offset&rows=$limit";

            // Daten von der CrossRef-API abrufen
            $context = stream_context_create(['http' => ['ignore_errors' => true]]);
            $response = file_get_contents($url, false, $context);

            if ($response === FALSE) {
                $httpStatus = $http_response_header[0];
                if (strpos($httpStatus, '429') !== false) {
                    // Bei einem 429-Fehler warten und erneut versuchen
                    sleep($retryDelay);
                    $retry++;
                } else {
                    die("Fehler beim Abrufen der CrossRef-API aufgetreten: $httpStatus");
                }
            } else {
                break; // Erfolgreiche Antwort erhalten, Schleife verlassen
            }
        } while ($retry < $maxRetries);

        if ($retry >= $maxRetries) {
            die("Maximale Anzahl von Wiederholungsversuchen erreicht.");
        }

        // Antwort in ein Array dekodieren
        $data = json_decode($response, true);

        // Funders aus der Antwort extrahieren
        $funders = $data['message']['items'];

        // Funders zum Gesamtergebnis hinzufügen
        foreach ($funders as $funder) {
            $allFunders[] = [
                'crossRefId' => $funder['id'],
                'name' => $funder['name']
            ];
        }

        // Offset für die nächste Anfrage aktualisieren
        $offset += $limit;

        // Eine kurze Pause zwischen den Anfragen einlegen
        sleep(1);

        // Schleife fortsetzen, solange wir weniger Ergebnisse haben als die Gesamtanzahl
    } while (count($allFunders) < $data['message']['total-results']);

    // Alle Funders in funders.json speichern
    file_put_contents('json/funders.json', json_encode($allFunders, JSON_PRETTY_PRINT));
    echo 'CrossRef Funders erfolgreich aktualisiert';
    exit();
}

/* Deprecated. Use APIv2 instead. */
// Beispielaufruf: api.php?action=getRoles&type=all
// API-Hook für Eingabefelder mit Roles
if ($_GET['action'] == 'getRoles') {
    $type = $_GET['type'];

    // Alle Rollen abrufen
    if ($type == 'all') {
        $sql = 'SELECT * FROM Role';
    }
    // Nur Rollen für Personen abrufen
    else if ($type == 'person') {
        $sql = 'SELECT * FROM Role WHERE forInstitutions = 0';
    }
    // Nur Rollen für Institutionen abrufen
    else if ($type == 'institution') {
        $sql = 'SELECT * FROM Role WHERE forInstitutions = 1';
    }
    // Rollen für beides abrufen
    else if ($type == 'both') {
        $sql = 'SELECT * FROM Role WHERE forInstitutions = 2';
    } else {
        die('Ungültiger roles-Typ');
    }

    $result = $connection->query($sql);
    if ($result->num_rows > 0) {
        $rolesList = [];
        while ($row = $result->fetch_assoc()) {
            $rolesList[] = $row;
        }
        echo json_encode($rolesList);
    } else {
        echo 'Keine Rollen gefunden';
    }
}

/* Deprecated. Use APIv2 instead. */
// Beispielaufruf api.php?action=getNasaInstrumentsKeywords
if ($_GET['action'] == 'getNasaInstrumentsKeywords') {
    $conceptSchemes = [
        'getNasaInstrumentsKeywords' => [
            'scheme' => 'instruments',
            'name' => 'NASA/GCMD Instruments',
            'output' => 'json\\gcmdInstrumentsKeywords.json'
        ],
        'getNasaScienceKeywords' => [
            'scheme' => 'sciencekeywords',
            'name' => 'NASA/GCMD Earth Science Keywords',
            'output' => 'json\\gcmdScienceKeywords.json'
        ],
        'getNasaPlatformsKeywords' => [
            'scheme' => 'platforms',
            'name' => 'NASA/GCMD Earth Platforms Keywords',
            'output' => 'json\\gcmdPlatformsKeywords.json'
        ]
    ];
    try {
        $action = $_GET['action'] ?? '';
        if (isset($conceptSchemes[$action])) {
            $scheme = $conceptSchemes[$action];
            processKeywords($scheme['scheme'], $scheme['name'], $scheme['output']);
            exit();
        } else {
            echo "Ungültige Aktion";
            exit();
        }
    } catch (Exception $e) {
        echo $e->getMessage();
    }
}

// API-Hook getLicenses, der mit resourcetype=all alle Lizenzen oder mit resourcetype=software nur die Softwarelizenzen (DB-Attribut forSoftware=1) zurückgibt
// Beispielaufruf api.php?action=getLicenses&resourcetype=all für alle Lizenzen oder api.php?action=getLicenses&resourcetype=software für Softwarelizenzen
if ($_GET['action'] == 'getLicenses') {
    $resourcetype = $_GET['resourcetype'];

    // Alle Lizenzen abrufen
    if ($resourcetype == 'all') {
        $sql = 'SELECT * FROM Rights';
    }
    // Nur Softwarelizenzen abrufen
    else if ($resourcetype == 'software') {
        $sql = 'SELECT * FROM Rights WHERE forSoftware = 1';
    } else {
        die('Ungültiger resourcetype');
    }

    $result = $connection->query($sql);
    if ($result->num_rows > 0) {
        $licenses = [];
        while ($row = $result->fetch_assoc()) {
            $licenses[] = $row;
        }
        echo json_encode($licenses);
    } else {
        echo 'Keine Lizenzen gefunden';
        exit();
    }
}

// API-Hook getKeywords, der alle oder nur die kuratierten Keywords aus der Datenbank abruft
if ($_GET['action'] === 'getKeywords') {
    header('Content-Type: application/json');

    $curationType = $_GET['curationType'] ?? 'all';
    $sql = 'SELECT free_keyword FROM Free_Keywords';

    if ($curationType === 'isCurated') {
        $sql .= ' WHERE isCurated = 1';
    } elseif ($curationType !== 'all') {
        echo json_encode(['error' => 'Ungültiger curationType']);
        exit;
    }
    try {
        $result = $connection->query($sql);

        if ($result === false) {
            throw new Exception("Datenbankabfrage fehlgeschlagen: " . $connection->error);
        }

        $keywords = [];
        while ($row = $result->fetch_assoc()) {
            $keywords[] = ['free_keyword' => $row['free_keyword']];
        }

        echo json_encode($keywords);
    } catch (Exception $e) {
        echo json_encode(['error' => 'Ein Fehler ist aufgetreten beim Abrufen der Keywords']);
    }
    exit;
}

/* Deprecated. Use APIv2 instead. */
// Beispielaufruf api.php?action=getTimezones, aktualisiert Timezones
if ($_GET['action'] == 'getTimezones') {
    // Die URL der TimeZoneDB API, um die Zeitzonendaten abzurufen
    $apiUrl = 'http://api.timezonedb.com/v2.1/list-time-zone?key=' . $apiKeyTimezone . '&format=json';

    // Daten von der externen API abrufen
    $response = file_get_contents($apiUrl);
    if ($response === FALSE) {
        die('Fehler beim Abrufen der timezonedb-API aufgetreten.');
    }

    // Antwort in ein Array dekodieren
    $data = json_decode($response, true);
    if ($data['status'] != 'OK') {
        die('Fehler aufgetreten: ' . $data['message']);
    }

    // Zeitzonen formatieren, UTC+X (Zone)
    $formattedTimezones = [];
    foreach ($data['zones'] as $zone) {
        $offset = sprintf('%+03d:%02d', floor($zone['gmtOffset'] / 3600), abs($zone['gmtOffset'] % 3600 / 60));
        $formattedTimezones[] = sprintf('UTC%s (%s)', $offset, $zone['zoneName']);
    }

    // Daten als JSON-String auf Server zwischenspeichern
    file_put_contents('json/timezones.json', json_encode($formattedTimezones));

    echo 'Timezones erfolgreich aktualisiert';
}


// API-Hook getRelations, der alle Relationen aus der Datenbank abruft
// Beispielaufruf api.php?action=getRelations
if ($_GET['action'] == 'getRelations') {
    $sql = 'SELECT * FROM Relation';
    $result = $connection->query($sql);
    if ($result->num_rows > 0) {
        $getRelations = [];
        while ($row = $result->fetch_assoc()) {
            $Relation[] = $row;
        }
        echo json_encode($Relation);
    } else {
        echo 'Keine Relation gefunden';
    }
    // Skriptausführung beenden
    exit();
}

/* Deprecated. Use APIv2 instead. */
// API-Hook, der einen bestimmten Identifier Type aus der Datenbank zurückgibt, basieren auf dem übergebenen Identifier
// Beispielaufruf api.php?action=getIdentifierType&identifier=10.1371/journal.pbio.0020449
if ($_GET['action'] == 'getIdentifierType') {
    $identifier = $_GET['identifier'];

    $stmt = $connection->prepare('SELECT name, pattern FROM Identifier_Type');
    $stmt->execute();
    $result = $stmt->get_result();

    $matchingType = null;
    $debugInfo = [];
    while ($row = $result->fetch_assoc()) {
        $pattern = $row['pattern'];

        // Entferne Anführungszeichen am Anfang und Ende
        $pattern = trim($pattern, '"');

        // Entferne den Modifikator am Ende, falls vorhanden
        $pattern = rtrim($pattern, '/i');

        // Ersetze doppelte Backslashes durch einzelne
        $pattern = str_replace('\\\\', '\\', $pattern);

        $debugInfo[] = ['name' => $row['name'], 'pattern' => $pattern, 'match' => null];

        try {
            // Verwende eine benutzerdefinierte Delimiter-Funktion
            $delimiter = getUniqueDelimiter($pattern);
            if (@preg_match($delimiter . $pattern . $delimiter . 'i', $identifier, $matches)) {
                $matchingType = $row['name'];
                $debugInfo[count($debugInfo) - 1]['match'] = $matches[0];
                break;
            }
        } catch (Exception $e) {
            $debugInfo[count($debugInfo) - 1]['error'] = $e->getMessage();
        }
    }

    $response = [
        'debug' => $debugInfo,
        'identifier' => $identifier
    ];

    if ($matchingType) {
        $response['identifier_type'] = $matchingType;
    } else {
        $response['error'] = 'Keinen Identifier Type gefunden';
    }

    echo json_encode($response);

    $stmt->close();
    exit();
}

// Hilfsfunktion zur Bestimmung eines eindeutigen Delimiters
function getUniqueDelimiter($pattern)
{
    $characters = str_split('!@#$%^&*(){}[]<>:;,?/');
    foreach ($characters as $char) {
        if (strpos($pattern, $char) === false) {
            return $char;
        }
    }
    throw new Exception("Kein eindeutiger Delimiter gefunden");
}

/* Deprecated. Use APIv2 instead. */
// API-Hook, der ein bestimmtes Pattern aus dem pattern-Attribut der Tabelle Identifier_Type zurückgibt, basierend auf dem übergebenen Identifier
// Beispielaufruf api.php?action=getPattern&type=DOI
if ($_GET['action'] == 'getPattern') {
    $type = $_GET['type'];
    // Datenbankabfrage des konkreten pattern-Attributs in der Tabelle Identifier_Type, der zum übergebenen Identifier passt
    $stmt = $connection->prepare('SELECT pattern FROM Identifier_Type WHERE name = ?');
    $stmt->bind_param('s', $type);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($result->num_rows > 0) {
        $row = $result->fetch_assoc();
        echo json_encode($row);
    } else {
        echo json_encode(['error' => 'Kein Pattern gefunden']);
    }
    $stmt->close();
    exit();
}

/* Deprecated. Use APIv2 instead. */
// API-Hook getIdentifierTypes, der alle Identifier Types aus der Datenbank abruft
// Beispielaufruf ./api.php?action=getIdentifierTypes
if ($_GET['action'] == 'getIdentifierTypes') {
    $sql = 'SELECT * FROM Identifier_Type';

    $result = $connection->query($sql);
    if ($result->num_rows > 0) {
        $identifierTypes = [];
        while ($row = $result->fetch_assoc()) {
            $identifierTypes[] = $row;
        }
        echo json_encode($identifierTypes);
    } else {
        echo 'No identifier types found';
    }
    // Skriptausführung beenden
    exit();
}

/* Deprecated. Use APIv2 instead. */
// API-Endpunkt für die Rückgabe aller Affiliation-Einträge unter ROR, abgerufen über den Data Dump von ror.org
// Beispielhafter API-Aufruf: api.php?action=getRorAffiliations
// JSON-Antwort: id, name
if ($_GET['action'] == 'getRorAffiliations') {
    // URL des ROR-Data-Dumps auf Zenodo
    $rorDataDumpUrl = 'https://zenodo.org/api/communities/ror-data/records?q=&sort=newest';
    // Abrufen der Metadaten des neuesten ROR-Data-Dumps
    $metadataJson = file_get_contents($rorDataDumpUrl);
    // Überprüfen, ob der Abruf erfolgreich war
    if ($metadataJson !== false) {
        $metadata = json_decode($metadataJson, true);
        // URL des neuesten ROR-Data-Dumps extrahieren
        $latestDataDumpUrl = $metadata['hits']['hits'][0]['files'][0]['links']['self'];
        // Dateiname des neuesten ROR-Data-Dumps extrahieren
        $zipFileName = $metadata['hits']['hits'][0]['files'][0]['key'];
        // Herunterladen des ROR-Data-Dumps
        file_put_contents($zipFileName, file_get_contents($latestDataDumpUrl));
        // Entpacken des ROR-Data-Dumps
        $zip = new ZipArchive();
        $zip->open($zipFileName);
        $zip->extractTo('./');
        $zip->close();
        // Pfad zur extrahierten CSV-Datei, die mit dem Dateinamen "-ror-data.csv" endet
        $csvFileName = glob('*-ror-data.csv')[0];
        // RorID (gespeichert in der CSV-Datei als id) und Name (gespeichert in der CSV-Datei als name) der Affiliation-Einträge abrufen und dabei die erste zeile der CSV-Datei überspringen und Daten in einer JSON-Datei affiliations.json speichern
        $csvFile = fopen($csvFileName, 'r');
        $affiliations = [];
        $header = fgetcsv($csvFile);
        while (($row = fgetcsv($csvFile)) !== false) {
            $affiliation = [
                'id' => $row[0],
                'name' => $row[1]
            ];
            $affiliations[] = $affiliation;
        }
        fclose($csvFile);
        // Daten formatiert als JSON-Datei speichern
        file_put_contents('json/affiliations.json', json_encode($affiliations, JSON_PRETTY_PRINT));
        // Alle aus der ZIP-Datei extrahierten Dateien löschen
        // ZIP-Datei löschen
        unlink($zipFileName);
        // CSV-Datei lösche
        unlink($csvFileName);
        // Datei mit der Endung "-ror-data_schema_v2.csv" löschen
        unlink(str_replace('-ror-data.csv', '-ror-data_schema_v2.csv', $csvFileName));
        // Datei mit der Endung "-ror-data_schema_v2.json" löschen
        unlink(str_replace('-ror-data.csv', '-ror-data_schema_v2.json', $csvFileName));
        // Datei mit der Endung "-ror-data.json" löschen
        unlink(str_replace('-ror-data.csv', '-ror-data.json', $csvFileName));
        // Erfolgsmeldung anzeigen
        echo 'ROR-Daten aktualisiert und affiliations.json erstellt.';
    }
    // Skriptausführung beenden
    exit();
}
