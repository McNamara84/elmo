<?php

declare(strict_types=1);

require_once __DIR__ . '/../services/IdentifierDetectionService.php';

/** Exposes registry-confirmed DOI subtypes without caching HTTP error responses. */
class IdentifierDetectionController
{
    /** @param IdentifierDetectionService|null $service Optional service for isolated tests. */
    public function __construct(private ?IdentifierDetectionService $service = null)
    {
        $this->service ??= new IdentifierDetectionService();
    }

    /**
     * Writes a confirmed type, an unknown result, or a structured lookup error.
     *
     * @param array<mixed> $vars Router variables; the DOI comes from the query string.
     */
    public function detect(array $vars = []): void
    {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        try {
            $doi = $_GET['doi'] ?? '';
            if (!is_string($doi)) throw new InvalidArgumentException('Invalid DOI format');
            $result = $this->service->detect($doi);
            http_response_code(200);
        } catch (InvalidArgumentException $error) {
            http_response_code(400);
            $result = ['identifierType' => null, 'status' => 'invalid', 'source' => null];
        } catch (RuntimeException $error) {
            http_response_code($error->getCode() === 504 ? 504 : 502);
            $result = ['identifierType' => null, 'status' => 'unavailable', 'source' => null];
        }
        echo json_encode($result);
    }
}
