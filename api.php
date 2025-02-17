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
