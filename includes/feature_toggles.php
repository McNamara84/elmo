<?php
/**
 * Resolve the effective value for a feature toggle by falling back to a default
 * when the provided value is null.
 */
function resolveFeatureToggle(?bool $value, bool $default): bool
{
    return $value ?? $default;
}