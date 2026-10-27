<?php

declare(strict_types=1);

/** A user-correctable license choice or temporarily unavailable permission source. */
final class LicenseValidationException extends RuntimeException
{
    public function __construct(string $message, public readonly int $httpStatus = 422)
    {
        parent::__construct($message);
    }
}
