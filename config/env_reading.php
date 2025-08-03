<?php
/**
 * Environment Configuration
 * 
 * This file handles reading environment variables and setting global configuration variables.
 * All environment variable logic is centralized here.
 */

// Feature toggles - read from environment variables
$showContributorPersons = filter_var(getenv('showContributorPersons') ?: 'true', FILTER_VALIDATE_BOOLEAN);
$showContributorInstitutions = filter_var(getenv('showContributorInstitutions') ?: 'true', FILTER_VALIDATE_BOOLEAN);
$showMslLabs = filter_var(getenv('showMslLabs') ?: 'false', FILTER_VALIDATE_BOOLEAN);
$showMslVocabs = filter_var(getenv('showMslVocabs') ?: 'false', FILTER_VALIDATE_BOOLEAN);
$showGcmdThesauri = filter_var(getenv('showGcmdThesauri') ?: 'true', FILTER_VALIDATE_BOOLEAN);
$showFreeKeywords = filter_var(getenv('showFreeKeywords') ?: 'true', FILTER_VALIDATE_BOOLEAN);
$showSpatialTemporalCoverage = filter_var(getenv('showSpatialTemporalCoverage') ?: 'true', FILTER_VALIDATE_BOOLEAN);
$showRelatedWork = filter_var(getenv('showRelatedWork') ?: 'true', FILTER_VALIDATE_BOOLEAN);
$showFundingReference = filter_var(getenv('showFundingReference') ?: 'true', FILTER_VALIDATE_BOOLEAN);
$showGGMsProperties = filter_var(getenv('showGGMsProperties') ?: 'true', FILTER_VALIDATE_BOOLEAN);
$showFeedbackLink = filter_var(getenv('showFeedbackLink') ?: 'false', FILTER_VALIDATE_BOOLEAN);

// Numeric configuration
$maxTitles = (int) (getenv('maxTitles') ?: 2);

// API Keys
$apiKeyElmo = getenv('apiKeyElmo') ?: '1234-1234-1234-1234';
$apiKeyGoogleMaps = getenv('apiKeyGoogleMaps') ?: '';
$apiKeyTimezone = getenv('apiKeyTimezone') ?: '';

// URLs
$mslLabsUrl = getenv('mslLabsUrl') ?: 'https://raw.githubusercontent.com/UtrechtUniversity/msl_vocabularies/main/vocabularies/labs/laboratories.json';
$mslVocabsUrl = getenv('mslVocabsUrl') ?: 'https://raw.githubusercontent.com/UtrechtUniversity/msl_vocabularies/main/vocabularies/combined/editor/';

// SMTP Configuration
$smtpHost = getenv('smtpHost') ?: '';
$smtpPort = (int) (getenv('smtpPort') ?: 465);
$smtpUser = getenv('smtpUser') ?: '';
$smtpPassword = getenv('smtpPassword') ?: '';
$smtpSender = getenv('smtpSender') ?: '';
$feedbackAddress = getenv('feedbackAddress') ?: 'feedback@example.com';
$xmlSubmitAddress = getenv('xmlSubmitAddress') ?: 'xmlsubmit@example.com';

// Database configuration (used in some contexts)
$dbHost = getenv('DB_HOST') ?: 'localhost';
$dbUser = getenv('DB_USER') ?: '';
$dbPassword = getenv('DB_PASSWORD') ?: '';
$dbName = getenv('DB_NAME') ?: '';
$rootPassword = getenv('ROOT_PASSWORD') ?: '';