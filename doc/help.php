<?php
/**
 *
 * This script includes the settings and displays the help documentation.
 *
 */

// Include the settings.php file to access configuration variables
include_once __DIR__ . '/../settings.php';
include_once __DIR__ . '/../includes/feature_toggles.php';

$variantOverrides = applyELMOGEMFeatureOverrides([
	'showGGMsProperties' => (bool) ($showGGMsProperties ?? false),
	'showUsedInstruments' => (bool) ($showUsedInstruments ?? false),
	'thesauriHiddenKeys' => [],
]);

$showUsedInstruments = $variantOverrides['showUsedInstruments'];
$thesauriHiddenKeys = $variantOverrides['thesauriHiddenKeys'];

// Include the help.html file to display the help content
include __DIR__ . '/help.html';
