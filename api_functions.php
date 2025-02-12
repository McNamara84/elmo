<?php
require 'vendor/autoload.php';

use EasyRdf\Graph;
use EasyRdf\RdfNamespace;

function getLatestVersion($baseUrl, $type)
{
    $versions = [];
    for ($i = 1; $i <= 10; $i++) {
        $url = "{$baseUrl}{$type}/1.{$i}/{$type}_1-{$i}.json";
        $headers = @get_headers($url);
        if ($headers && strpos($headers[0], '200') !== false) {
            $versions[] = "1.{$i}";
        } else {
            break;
        }
    }
    return end($versions);
}

function downloadAndSave($url, $savePath)
{
    $json = @file_get_contents($url);
    if ($json === false) {
        return false;
    }
    // Schlüssel "uri" in JSON-Datei umbenennen in "id"
    $json = str_replace('"uri":', '"id":', $json);
    // Schlüssel "vocab_uri" in JSON-Datei umbenennen in "schemeURI"
    $json = str_replace('"vocab_uri":', '"schemeURI":', $json);
    // Schlüssel "label" in JSON-Datei umbenennen in "text"
    $json = str_replace('"label":', '"text":', $json);
    return file_put_contents($savePath, $json) !== false;
}

function fetchAndProcessCGIKeywords()
{
    $url = 'https://geosciml.org/resource/vocabulary/cgi/2016/simplelithology.rdf';

    // RDF-Namensräume registrieren
    RdfNamespace::set('skos', 'http://www.w3.org/2004/02/skos/core#');
    RdfNamespace::set('rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#');

    // RDF-Daten laden
    $graph = new Graph($url);
    $graph->load();

    $keywordMap = [];

    // Alle SKOS-Konzepte durchlaufen
    foreach ($graph->allOfType('skos:Concept') as $concept) {
        $id = $concept->getUri();
        $prefLabel = (string) $concept->get('skos:prefLabel');
        $definition = (string) $concept->get('skos:definition');

        $keywordMap[$id] = [
            'id' => $id,
            'text' => $prefLabel,
            'language' => 'en',
            'scheme' => 'CGI Simple Lithology',
            'schemeURI' => 'https://geosciml.org/resource/vocabulary/cgi/2016/simplelithology',
            'description' => $definition,
            'children' => []
        ];
    }

    // Hierarchie erstellen
    $rootId = 'http://resource.geosciml.org/classifier/cgi/lithology/compound_material';
    foreach ($graph->allOfType('skos:Concept') as $concept) {
        $id = $concept->getUri();
        if ($id === $rootId) {
            continue; // Überspringen Sie das Wurzelelement
        }
        $broaderConcepts = $concept->all('skos:broader');
        if (empty($broaderConcepts)) {
            // Wenn kein breiteres Konzept gefunden wird, fügen Sie es dem Wurzelelement hinzu
            $keywordMap[$rootId]['children'][] = &$keywordMap[$id];
        } else {
            foreach ($broaderConcepts as $broaderConcept) {
                $parentId = $broaderConcept->getUri();
                if (isset($keywordMap[$parentId])) {
                    $keywordMap[$parentId]['children'][] = &$keywordMap[$id];
                    break; // Nur einmal hinzufügen
                }
            }
        }
    }

    // Nur das Wurzelelement zurückgeben
    return [$keywordMap[$rootId]];
}

function fetchRdfData($conceptScheme, $pageNum, $pageSize)
{
    $url = "https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/{$conceptScheme}?format=rdf&page_num={$pageNum}&page_size={$pageSize}";

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        throw new Exception("Fehler beim Abrufen der Thesaurus Keywords. HTTP-Statuscode: {$httpCode}");
    }

    return $response;
}

function buildHierarchy($graph, $conceptScheme, $schemeName)
{
    $hierarchy = [];
    $concepts = $graph->allOfType('skos:Concept');
    $conceptMap = [];

    $schemeURI = "https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/{$conceptScheme}";

    foreach ($concepts as $concept) {
        $uri = $concept->getUri();
        $label = $concept->getLiteral('skos:prefLabel') ? $concept->getLiteral('skos:prefLabel')->getValue() : '';
        $lang = $concept->getLiteral('skos:prefLabel') ? $concept->getLiteral('skos:prefLabel')->getLang() : '';
        $description = $concept->getLiteral('skos:definition', 'en') ? $concept->getLiteral('skos:definition', 'en')->getValue() : '';
        $conceptMap[$uri] = [
            'id' => $uri,
            'text' => $label,
            'language' => $lang,
            'scheme' => $schemeName,
            'schemeURI' => $schemeURI,
            'description' => $description,
            'children' => []
        ];
    }

    foreach ($concepts as $concept) {
        $uri = $concept->getUri();
        $broader = $concept->getResource('skos:broader');
        if ($broader) {
            $broaderUri = $broader->getUri();
            if (isset($conceptMap[$broaderUri])) {
                $conceptMap[$broaderUri]['children'][] = &$conceptMap[$uri];
            }
        } else {
            $hierarchy[] = &$conceptMap[$uri];
        }
    }

    return $hierarchy;
}

function saveJsonToFile($data, $filePath)
{
    file_put_contents($filePath, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
}

function processKeywords($conceptScheme, $schemeName, $outputFile)
{
    $pageNum = 1;
    $pageSize = 2000;
    $graph = new Graph();
    while (true) {
        try {
            $data = fetchRdfData($conceptScheme, $pageNum, $pageSize);
            $tempGraph = new Graph();
            $tempGraph->parse($data, 'rdf');

            foreach ($tempGraph->resources() as $resource) {
                foreach ($tempGraph->properties($resource) as $property) {
                    foreach ($tempGraph->all($resource, $property) as $value) {
                        $graph->add($resource, $property, $value);
                    }
                }
            }

            if (strpos($data, '<skos:Concept') === false) {
                break;
            }
            $pageNum++;
        } catch (Exception $e) {
            if ($pageNum == 1) {
                throw $e;
            } else {
                break;
            }
        }
    }
    $hierarchicalData = buildHierarchy($graph, $conceptScheme, $schemeName);
    saveJsonToFile($hierarchicalData, $outputFile);

    echo "{$schemeName} erfolgreich aktualisiert";
}

function saveKeywordsToJson($connection, $filename, $curationType)
{
    if ($connection === null) {
        die('Datenbankverbindung ist nicht initialisiert.');
    }

    $sql = 'SELECT free_keywords_id, free_keyword, isCurated FROM Free_Keywords';
    if ($curationType === 'isCurated') {
        $sql .= ' WHERE isCurated = 1';
    } elseif ($curationType !== 'all') {
        die('Ungültiger curationType');
    }

    $result = $connection->query($sql);

    if ($result && $result->num_rows > 0) {
        $keywords = $result->fetch_all(MYSQLI_ASSOC);
        $jsonString = json_encode($keywords);

        if (file_put_contents($filename, $jsonString) !== false) {
            echo 'Keywords erfolgreich in ' . $filename . ' gespeichert.';
        } else {
            echo 'Fehler beim Speichern der Datei ' . $filename;
        }
    } else {
        echo 'Keine Keywords gefunden.';
    }
}
