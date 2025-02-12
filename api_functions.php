<?php
require 'vendor/autoload.php';

use EasyRdf\Graph;
use EasyRdf\RdfNamespace;

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
