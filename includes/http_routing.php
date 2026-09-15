<?php

declare(strict_types=1);

/**
 * Compatibility aliases kept while callers migrate to the canonical paths.
 *
 * @return array<string, string>
 */
function elmoCompatibilityRoutes(): array
{
    return [
        '/api.php' => '/api/deprecated_v1.php',
        '/doc/privacyPolicy.html' => '/doc/privacy-policy.html',
        '/log_page_event.php' => '/endpoints/log_page_event.php',
        '/send_feedback_mail.php' => '/endpoints/send_feedback_mail.php',
        '/send_xml_file.php' => '/endpoints/send_xml_file.php',
        '/apple-touch-icon.png' => '/assets/icons/apple-touch-icon.png',
        '/favicon-96x96.png' => '/assets/icons/favicon-96x96.png',
        '/favicon.ico' => '/assets/icons/favicon.ico',
        '/favicon.svg' => '/assets/icons/favicon.svg',
        '/web-app-manifest-192x192.png' => '/assets/icons/web-app-manifest-192x192.png',
        '/web-app-manifest-512x512.png' => '/assets/icons/web-app-manifest-512x512.png',
        '/logos/doi.logo.svg' => '/assets/logos/doi-logo.svg',
        '/logos/EPOS_logo.png' => '/assets/logos/epos-logo.png',
        '/logos/GFZ_Data_Services_logo.png' => '/assets/logos/gfz-data-services-logo.svg',
        '/logos/GFZ-logo.png' => '/assets/logos/gfz-logo.svg',
        '/logos/orcid.logo.png' => '/assets/logos/orcid-logo.png',
        '/logos/ror-logo.svg' => '/assets/logos/ror-logo.svg',
    ];
}

function elmoRequestPath(string $requestUri): string
{
    $path = parse_url($requestUri, PHP_URL_PATH);
    if (!is_string($path) || $path === '') {
        return '/';
    }

    return '/' . ltrim($path, '/');
}

function elmoCompatibilityTarget(string $requestUri): ?string
{
    return elmoCompatibilityRoutes()[elmoRequestPath($requestUri)] ?? null;
}

function elmoIsHttpBlockedPath(string $requestUri): bool
{
    $path = rtrim(elmoRequestPath($requestUri), '/');
    return $path === '/scripts' || str_starts_with($path, '/scripts/');
}

function elmoStaticContentType(string $path): string
{
    return match (strtolower((string) pathinfo($path, PATHINFO_EXTENSION))) {
        'html' => 'text/html; charset=UTF-8',
        'ico' => 'image/x-icon',
        'png' => 'image/png',
        'svg' => 'image/svg+xml',
        default => 'application/octet-stream',
    };
}
