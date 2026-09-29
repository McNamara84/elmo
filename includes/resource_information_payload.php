<?php

/**
 * Converts the Resource Information payload into the legacy save function's
 * scalar and parallel title fields. The payload is authoritative when present.
 * Older clients may continue to submit the original fields without it.
 *
 * @param array<string, mixed> $postData
 * @return array<string, mixed>
 */
function normalizeResourceInformationPostData(array $postData): array
{
    if (!array_key_exists('resourceInformationPayload', $postData)) {
        return $postData;
    }

    try {
        $payload = json_decode((string) $postData['resourceInformationPayload'], true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        throw new InvalidArgumentException('Invalid Resource Information payload.', 0, $error);
    }

    if (!is_array($payload) || array_is_list($payload) || !isset($payload['titles']) || !is_array($payload['titles'])) {
        throw new InvalidArgumentException('Resource Information payload must contain a titles array.');
    }

    foreach ([
        'doi' => 'doi',
        'year' => 'year',
        'resourceTypeId' => 'resourcetype',
        'version' => 'version',
        'languageId' => 'language',
    ] as $payloadKey => $postKey) {
        $value = $payload[$payloadKey] ?? '';
        if (!is_scalar($value) && $value !== null) {
            throw new InvalidArgumentException("Invalid Resource Information field: {$payloadKey}.");
        }
        $postData[$postKey] = trim((string) $value);
    }

    $postData['title'] = [];
    $postData['titleType'] = [];
    foreach ($payload['titles'] as $index => $title) {
        if (!is_array($title) || array_is_list($title)) {
            throw new InvalidArgumentException("Invalid Resource Information title at position {$index}.");
        }
        $text = $title['text'] ?? '';
        $typeId = $title['typeId'] ?? '';
        if ((!is_scalar($text) && $text !== null) || (!is_scalar($typeId) && $typeId !== null)) {
            throw new InvalidArgumentException("Invalid Resource Information title at position {$index}.");
        }
        $postData['title'][] = trim((string) $text);
        $postData['titleType'][] = trim((string) $typeId);
    }

    return $postData;
}

/** Keep a visible minor component for values saved by older numeric callers. */
function normalizeResourceVersion(string $version): string
{
    $version = trim($version);
    return preg_match('/^\d+$/D', $version) ? $version . '.0' : $version;
}
