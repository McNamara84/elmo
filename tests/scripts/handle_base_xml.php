<?php
require_once __DIR__ . '/../../settings.php';
require_once __DIR__ . '/../../api/v2/controllers/DatasetController.php';

$controller = new DatasetController();
$id = intval($argv[1]);
$controller->handleExportBaseXml(['id' => $id]);