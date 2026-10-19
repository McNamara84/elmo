<?php

declare(strict_types=1);

/**
 * Generate XML payloads for every resource in the configured database.
 *
 * @return array{status:string,message:string,progress:float|int,details:list<string>}
 */
function generateAllXmlFiles(): array
{
    $projectRoot = dirname(__DIR__);
    require_once $projectRoot . '/settings.php';
    require_once $projectRoot . '/api/v2/controllers/DatasetController.php';

    if (!isset($connection) || !$connection instanceof mysqli || $connection->connect_error) {
        return [
            'status' => 'error',
            'message' => 'Database connection could not be established.',
            'progress' => 0,
            'details' => [],
        ];
    }

    $response = [
        'status' => 'success',
        'message' => 'XML generation started.',
        'progress' => 0,
        'details' => [],
    ];

    try {
        $result = $connection->query('SELECT resource_id FROM Resource ORDER BY resource_id');
        if (!$result instanceof mysqli_result) {
            throw new RuntimeException('Failed to fetch resource IDs: ' . $connection->error);
        }

        $totalRecords = $result->num_rows;
        $response['details'][] = "Found {$totalRecords} resources to process.";
        if ($totalRecords === 0) {
            $response['message'] = 'No resources found in database. No XML files generated.';
            $response['progress'] = 100;
            return $response;
        }

        $controller = new DatasetController();
        $successCount = 0;
        $errorCount = 0;
        $processedCount = 0;

        while ($row = $result->fetch_assoc()) {
            $resourceId = $row['resource_id'];
            $processedCount++;

            try {
                $xmlContent = $controller->getResourceAsXml($connection, $resourceId);
                if ($xmlContent) {
                    $successCount++;
                    $response['details'][] = "Successfully generated XML for resource ID: {$resourceId}.";
                } else {
                    $errorCount++;
                    $response['details'][] = "Warning: Empty XML generated for resource ID: {$resourceId}.";
                }
            } catch (Throwable $exception) {
                $errorCount++;
                $response['details'][] = "Error processing resource ID {$resourceId}: " . $exception->getMessage();
                error_log("XML Generation Error for resource {$resourceId}: " . $exception->getMessage());
            }

            $response['progress'] = ($processedCount / $totalRecords) * 100;
        }

        $response['message'] = "XML generation completed. Successful: {$successCount}, Errors: {$errorCount}, Total: {$totalRecords}.";
        $response['progress'] = 100;
        if ($errorCount > 0) {
            $response['status'] = 'warning';
            $response['message'] .= ' Some XML files failed to generate. Check server logs for details.';
        }
    } catch (Throwable $exception) {
        $response['status'] = 'error';
        $response['message'] = 'Fatal error during XML generation: ' . $exception->getMessage();
        $response['progress'] = 0;
        error_log('XML Generation Fatal Error: ' . $exception->getMessage());
    } finally {
        $connection->close();
    }

    return $response;
}

/**
 * @param array{status:string} $response
 */
function xmlGenerationExitCode(array $response): int
{
    return $response['status'] === 'success' ? 0 : 1;
}

$isDirectXmlGenerationRequest = realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__;
if ($isDirectXmlGenerationRequest && PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit();
}

if ($isDirectXmlGenerationRequest) {
    $response = generateAllXmlFiles();
    fwrite(STDOUT, json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(xmlGenerationExitCode($response));
}
