<?php
/**
 * XML File Generation Script callable via AJAX
 * This script will query all resource IDs from the database
 * and generate XML files for each using the DatasetController.
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);
$response = [
    'status' => 'success',
    'message' => 'XML generation started.',
    'progress' => 0,
    'details' => []
];

try {
    // Include settings and establish database connection
    // Ensure this path is correct relative to where generate_xml.php resides
    require_once __DIR__ . '/helper_functions.php';
    
    // Include DatasetController
    require_once __DIR__ . '/api/v2/controllers/DatasetController.php';
    
    // Get database connection
    $connection = connectDb();
    if (!$connection) {
        throw new Exception("Failed to connect to database. Check helper_functions.php and database availability.");
    }
    
    // Query all resource IDs
    $query = "SELECT resource_id FROM Resource ORDER BY resource_id";
    $result = $connection->query($query);
    
    if (!$result) {
        throw new Exception("Failed to fetch resource IDs: " . $connection->error);
    }
    
    $totalRecords = $result->num_rows;
    $response['details'][] = "Found {$totalRecords} resources to process.";
    
    if ($totalRecords === 0) {
        $response['message'] = "No resources found in database. No XML files generated.";
        $response['progress'] = 100;
        echo json_encode($response);
        exit(0);
    }
    
    // Initialize DatasetController
    $controller = new DatasetController(); 
    
    $successCount = 0;
    $errorCount = 0;
    $processedCount = 0;

    // Process each resource
    while ($row = $result->fetch_assoc()) {
        $resourceId = $row['resource_id'];
        $processedCount++;
        
        try {
            // Generate XML file
            $xmlContent = $controller->getResourceAsXml($connection ,$resourceId); 
            
            if ($xmlContent) {
                $successCount++;
                $response['details'][] = "Successfully generated XML for resource ID: {$resourceId}.";
            } else {
                $errorCount++;
                $response['details'][] = "Warning: Empty XML generated for resource ID: {$resourceId}.";
            }
            
        } catch (Exception $e) {
            $errorCount++;
            $response['details'][] = "Error processing resource ID {$resourceId}: " . $e->getMessage();
            error_log("XML Generation Error for resource {$resourceId}: " . $e->getMessage());
        }

        // Update progress for client feeconnectionack
        $response['progress'] = ($processedCount / $totalRecords) * 100;
        // Optionally, you could send incremental updates to the client
        // This would require a more complex AJAX setup (e.g., SSE or long polling)
        // For simplicity, we'll send final status at the end, but the progress is calculated.
    }
    
    // Close database connection
    $connection->close();
    
    // Final summary
    $response['message'] = "XML generation completed. Successful: {$successCount}, Errors: {$errorCount}, Total: {$totalRecords}.";
    $response['progress'] = 100;

    if ($errorCount > 0) {
        $response['status'] = 'warning'; // Use 'warning' if some succeeded but some failed
        $response['message'] .= " Some XML files failed to generate. Check server logs for details.";
    }
    
} catch (Exception $e) {
    $response['status'] = 'error';
    $response['message'] = "Fatal error during XML generation: " . $e->getMessage();
    $response['progress'] = 0;
    error_log("XML Generation Fatal Error: " . $e->getMessage());
}

echo json_encode($response);
exit;

?>
