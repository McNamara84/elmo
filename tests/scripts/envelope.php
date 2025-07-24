<?php
require_once __DIR__ . '/../../settings.php';
require_once __DIR__ . '/../../api/v2/controllers/DatasetController.php';

$id = intval($argv[1]);
$controller = new DatasetController();
$controller->envelopeXmlAsString($GLOBALS['connection'], $id);