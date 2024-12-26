<?php
$translations = [
    // Allgemeines
    'logotitle' => 'ELMO - EPOS Laboratory Metadata Optimizer 1.9',
    'choose' => 'Wählen Sie...',
    'valid' => 'Gültig',
    'PleaseChoose_invalid' => 'Bitte wählen Sie',
    'lastname' => 'Nachname',
    'firstname' => 'Vorname',
    'affiliation' => 'Zugehörigkeit(en)',
    'role_label' => 'Rolle(n)',
    'add' => '+',
    'no_javascript_alert' => 'JavaScript ist deaktiviert. Bitte aktivieren Sie JavaScript, um dieses Formular zu verwenden.',

    // Form Group Resource Information
    'resourceInformation' => 'Informationen zur Ressource',
    'doi' => 'DOI',
    'doi_valid' => 'Eine neue DOI wird registriert',
    'doi_invalid' => 'Format 10.ORGANISATION/ID nutzen (z.B.: 10.57757/IUGG23-3081) oder leer lassen',
    'publicationYear' => 'Veröffentlichungsjahr',
    'publicationYear_invalid' => 'Bitte geben Sie eine gültige Jahreszahl zwischen 1901 und 2155 (4-stellig) an.',
    'resourceType' => 'Ressourcentyp',
    'version' => 'Version',
    'version_invalid' => 'Wenn unsicher, leer lassen',
    'languageofdataset' => 'Sprache des Datensatzes',
    'title' => 'Titel',
    'title_invalid' => 'Bitte geben Sie einen Titel an.',
    'titleType' => 'Titeltyp',

    // Form Group Rights
    'rights' => 'Rechte und Lizenzen',
    'rightsTitle' => 'Lizenztitel',

    // Form Group Authors
    'authors' => 'Autoren',
    'lastname_invalid' => 'Bitte geben Sie einen Nachnamen an. Nur Buchstaben sind erlaubt.',
    'firstname_invalid' => 'Bitte geben Sie einen Vornamen an. Nur Buchstaben sind erlaubt.',
    'authorORCID' => 'ORCID',
    'ORCID_invalid' => 'Geben Sie eine gültige ORCID ein (XXXX-XXXX-XXXX-XXX(X))',
    'affiliation_invalid' => 'Bitte geben Sie eine Zugehörigkeit an.',

    // Form Group Contactpersons
    'contactpersons' => 'Kontaktperson(en)',
    'email' => 'E-Mail-Adresse',
    'email_invalid' => 'Bitte geben Sie eine gültige E-Mail-Adresse im Format xxx.xxx@xxx.xxx ein.',
    'position' => 'Position',
    'position_invalid' => 'Bitte geben Sie eine Position an.',
    'website' => 'Website',
    'website_invalid' => 'Bitte geben Sie eine gültige URL an.',

    // From Group Contributors
    'originatingLaboratoryLabel' => 'Herkunftslabor',
    'originatingLaboratoryName' => 'Name des Herkunftslabors',
    'originatingLaboratoryAffiliation' => 'Zugehörigkeit des Herkunftslabors',

    // From Group Contributors
    'contributors' => "Mitwirkende",
    'Organisation' => 'Organisationsname',
    'Organisation_invalid' => 'Bitte geben Sie einen gültigen Organisationsname an.',
    'contributors_ORCID' => 'ORCID',
    'contributorsPersonZeile' => 'Mitwirkende Person(en)',
    'contributorsInstitutionZeile' => 'Mitwirkende Institution(en)',

    // Form Group Descriptions
    'descriptions' => 'Beschreibungen',
    'd_abstract' => 'Zusammenfassung',
    'd_abstract_tooltip' => 'Bitte geben Sie eine Zusammenfassung ein...',
    'd_methods' => 'Methoden',
    'd_methods_tooltip' => 'Bitte beschreiben Sie die Methoden...',
    'd_technical_infos' => 'Technische Informationen',
    'd_technical_infos_tooltip' => 'Bitte geben Sie technische Informationen ein...',
    'd_other' => 'Sonstiges',
    'd_other_tooltip' => 'Bitte geben Sie sonstige Informationen ein...',

    // Form Group MSL-Keywords
    'mslKeywords' => 'EPOS Multi-Scale Laboratories Keywords',

    // Form Group Dates
    'dates' => 'Datumsangaben',
    'dateCreated' => 'Entstehungsdatum',
    'dateCreated_invalid' => 'Bitte geben Sie ein gültiges Datum ein!',
    'embargoUntil' => 'Embargo bis',
    'embargo_invalid' => 'Bitte geben Sie ein gültiges Datum ein!',

    //Formgroup thesaurusKeywords
    'thesaurusKeywords' => 'GCMD Science Keywords',
    'thesaurus' => 'Thesaurus',
    'scienceKeywords' => 'NASA GCMD Science Keywords',
    'instruments' => 'NASA GCMD Instruments',
    'platforms' => 'NASA GCMD Platforms',
    'chrono' => 'International Chronostratigraphic Chart',
    'cgi' => 'CGI Simple Lithology',
    'Gemet' => 'GEMET Thesaurus',
    'thesaurusLabel' => 'Thesaurus öffnen, um Schlagwörter auszuwählen oder anfangen zu tippen...',

    // Free Keywords
    'freekeywords' => 'Freie Schlagwörter',
    'freekeywords_input' => 'Bitte Schlagwörter eintragen und durch ein Komma trennen.',

    // Form Group Spatial and Temporal Coverages
    'tsc_spatialTemporalCoverages' => 'Räumliche und zeitliche Erfassungsbereiche',
    'tsc_map' => 'Karte',
    'tsc_latitude' => 'Geografische Breite',
    'tsc_longitude' => 'Geografische Länge',
    'tsc_description' => 'Beschreibung',
    'tsc_description_placeholder' => 'Bitte beschreiben Sie die zeitlichen und räumlichen Abdeckungen...',
    'tsc_start' => 'Start',
    'tsc_end' => 'Ende',
    'tsc_timezone' => 'Zeitzone',
    'tsc_map_info' => '(Bitte wählen Sie Koordinaten mit Rechteck oder Marker)',
    'tsc_cancel' => 'Abbrechen',
    'tsc_accept' => 'Übernehmen',

    // Formgroup related Work
    'relatedwork' => 'Verbundene Arbeit',
    'relation' => 'Relation',
    'r_identifier_type' => 'Identifikatortyp',
    'r_Identifier' => 'Identifikator',
    'r_Identifier_invalid' => 'Bitte geben Sie einen gültigen Identifikator ein.',

    // Formgroup Funding Reference
    'funding_reference' => 'Förderungsreferenz',
    'funder' => 'Förderer',
    'funder_invalid' => 'Bitte geben Sie den Namen des Förderers ein.',
    'grant_Number' => 'Fördernummer',
    'grant_Name' => 'Fördername',

    // Buttons
    'clear' => 'Löschen',
    'clear_tooltip' => 'Alle Einträge oder Inhalte löschen.',
    'load' => 'Laden',
    'load_tooltip' => 'Gespeicherte Daten oder Inhalte laden.',
    'saveAs' => 'Speichern',
    'saveAs_tooltip' => 'Speichern Sie die aktuellen Daten oder Inhalte unter einem neuen Dateinamen.',
    'submit' => 'Übermitteln',
    'submit_tooltip' => 'Die eingegebenen Daten oder Inhalte übermitteln.',
    'helpButtonon' => 'An',
    'helpButtonoff' => 'Aus',

    // Testing
    'feedbackButton' => 'Feedback',
    'feedbackLabel' => 'Benutzer-Feedback',
    'feedbackQuestion1' => 'Welche Funktionen des neuen Metadateneditors finden Sie besonders hilfreich?',
    'feedbackQuestion2' => 'Gibt es eine spezielle Design- oder Benutzeroberflächenänderung, die Ihnen gefällt?',
    'feedbackQuestion3' => 'Was finden Sie an der Bedienbarkeit des neuen Editors positiv?',
    'feedbackQuestion4' => 'Welche Funktionen des neuen Editors empfinden Sie als schwierig zu benutzen?',
    'feedbackQuestion5' => 'Gibt es Aspekte der Benutzeroberfläche, die Sie unübersichtlich oder störend finden?',
    'feedbackQuestion6' => 'Fehlen Ihnen bestimmte Funktionen im neuen Metadateneditor?',
    'feedbackQuestion7' => 'Gibt es eine spezifische Verbesserung, die Sie sich wünschen würden?',
    'feedbackSendButton' => 'Feedback übermitteln',
    'thankYouMessage' => 'Vielen Dank für Ihr Feedback!',

    // Sonstiges
    'saveModalTitle' => 'Datensatz als XML-Datei speichern',
    'filenameLabel' => 'Dateiname',
];