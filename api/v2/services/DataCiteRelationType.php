<?php

/**
 * Canonical DataCite relation types and their human-readable labels.
 *
 * The mapping is deliberately explicit. Unknown values must not be converted
 * by heuristics such as removing whitespace because that could manufacture an
 * invalid or semantically different DataCite token.
 */
final class DataCiteRelationType
{
    /** @var array<string, string> Canonical DataCite token => display label. */
    private const LABELS = [
        'IsCitedBy' => 'Is Cited By',
        'Cites' => 'Cites',
        'IsSupplementTo' => 'Is Supplement To',
        'IsSupplementedBy' => 'Is Supplemented By',
        'IsContinuedBy' => 'Is Continued By',
        'Continues' => 'Continues',
        'IsNewVersionOf' => 'Is New Version Of',
        'IsPreviousVersionOf' => 'Is Previous Version Of',
        'IsPartOf' => 'Is Part Of',
        'HasPart' => 'Has Part',
        'IsPublishedIn' => 'Is Published In',
        'IsReferencedBy' => 'Is Referenced By',
        'References' => 'References',
        'IsDocumentedBy' => 'Is Documented By',
        'Documents' => 'Documents',
        'IsCompiledBy' => 'Is Compiled By',
        'Compiles' => 'Compiles',
        'IsVariantFormOf' => 'Is Variant Form Of',
        'IsOriginalFormOf' => 'Is Original Form Of',
        'IsIdenticalTo' => 'Is Identical To',
        'HasMetadata' => 'Has Metadata',
        'IsMetadataFor' => 'Is Metadata For',
        'Reviews' => 'Reviews',
        'IsReviewedBy' => 'Is Reviewed By',
        'IsDerivedFrom' => 'Is Derived From',
        'IsSourceOf' => 'Is Source Of',
        'Describes' => 'Describes',
        'IsDescribedBy' => 'Is Described By',
        'HasVersion' => 'Has Version',
        'IsVersionOf' => 'Is Version Of',
        'Requires' => 'Requires',
        'IsRequiredBy' => 'Is Required By',
        'Obsoletes' => 'Obsoletes',
        'IsObsoletedBy' => 'Is Obsoleted By',
        'Collects' => 'Collects',
        'IsCollectedBy' => 'Is Collected By',
        'HasTranslation' => 'Has Translation',
        'IsTranslationOf' => 'Is Translation Of',
        'Other' => 'Other',
    ];

    /**
     * Resolves a canonical token or an explicitly known display label.
     */
    public static function canonicalize(string $value): ?string
    {
        $value = trim($value);

        if (array_key_exists($value, self::LABELS)) {
            return $value;
        }

        $canonical = array_search($value, self::LABELS, true);

        return $canonical === false ? null : $canonical;
    }

    /**
     * Returns the preferred display label without changing unknown values.
     */
    public static function label(string $value): string
    {
        $value = trim($value);
        $canonical = self::canonicalize($value);

        return $canonical === null ? $value : self::LABELS[$canonical];
    }

    /**
     * Returns all canonical values in DataCite schema order.
     *
     * @return list<string>
     */
    public static function values(): array
    {
        return array_keys(self::LABELS);
    }
}
