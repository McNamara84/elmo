<?php
$translations = [
    // Allgemeines
    'logotitle' => 'ELMO - EPOS Laboratory Metadata Optimizer 1.9',
    'choose' => 'Choose...',
    'valid' => 'Valid',
    'PleaseChoose_invalid' => 'Please choose',
    'lastname' => 'Last Name',
    'firstname' => 'First Name',
    'affiliation' => 'Affiliation(s)',
    'role_label' => 'Role(s)',
    'add' => '+',
    'no_javascript_alert' => 'JavaScript is disabled. Please enable JavaScript to use this form.',

    // Form Group Resource Information
    'resourceInformation' => 'Resource Information',
    'doi' => 'DOI',
    'doi_valid'=>'A new DOI will be registered',
    'doi_invalid' => 'Please use format 10.ORGANISATION/ID (i.e.: 10.57757/IUGG23-3081) or leave empty',
    'publicationYear' => 'Publication Year',
    'publicationYear_invalid' => 'Please provide a valid year ranging from 1901-2155 (4 digits).',
    'resourceType' => 'Resource Type',
    'version' => 'Version',
    'version_invalid' => 'If unsure leave blank',
    'languageofdataset' => 'Language of dataset',
    'title' => 'Title',
    'title_invalid' => 'Please provide a title',
    'titleType' => 'Title Type',

    // Form Group Rights
    'rights' => 'Licenses and Rights',
    'rightsTitle' => 'License',

    // Form Group Authors
    'authors' => 'Author(s)',
    'lastname_invalid' => 'Please provide a lastname. Only letters are allowed.',
    'firstname_invalid' => 'Please provide a firstname. Only letters are allowed.',
    'authorORCID' => 'ORCID',
    'ORCID_invalid' => 'Please enter a valid ORCID (XXXX-XXXX-XXXX-XXX(X))',
    'affiliation_invalid' => 'Please provide an affiliation.',

    // Form Group Contactpersons
    'contactpersons' => 'Contact Person(s)',
    'email' => 'Email address',
    'email_invalid' => 'Please provide a valid email address in the format xxx.xxx@xxx.xxx.',
    'position' => 'Position',
    'position_invalid' => 'Please provide a position.',
    'website' => 'Website',
    'website_invalid' => 'Please provide a valid URL.',

    // From Group Originating Laboratory
    'originatingLaboratoryLabel' => 'Originating Laboratory',
    'originatingLaboratoryName' => 'Name of the originating laboratory',
    'originatingLaboratoryAffiliation' => 'Affiliation of the originating laboratory',

    // From Group Contributors
    'contributors' => "Contributors",
    'Organisation' => 'Organisation name',
    'Organisation_invalid' => 'Please enter a valid organization name.',
    'contributors_ORCID' => 'ORCID',
    'contributorsPersonZeile' => 'Contributing Person(s)',
    'contributorsInstitutionZeile' => 'Contributing Institution(s)',

    // Form Group Descriptions
    'descriptions' => 'Descriptions',
    'd_abstract' => 'Abstract',
    'd_abstract_tooltip' => 'Please enter an abstract...',
    'd_methods' => 'Methods',
    'd_methods_tooltip' => 'Please describe the methods...',
    'd_technical_infos' => 'Technical Information',
    'd_technical_infos_tooltip' => 'Please enter technical information...',
    'd_other' => 'Other',
    'd_other_tooltip' => 'Please enter other information..',

    // Form Group MSL-Keywords
    'mslKeywords' => 'EPOS Multi-Scale Laboratories Keywords',

    //Formgroup thesaurusKeywords
    'thesaurusKeywords' => 'GCMD Science Keywords',
    'thesaurus' => 'Thesaurus',
    'scienceKeywords' => 'NASA GCMD Science Keywords',
    'instruments' => 'NASA GCMD Instruments',
    'platforms' => 'NASA GCMD Platforms',
    'chrono' => 'International Chronostratigraphic Chart',
    'cgi' => 'CGI Simple Lithology',
    'Gemet' => 'GEMET Thesaurus',
    'thesaurusLabel' => 'Open thesaurus to choose keywords or start typing...',

    // Free Keywords
    'freekeywords' => 'Free Keywords',
    'freekeywords_input' => 'Please enter keywords and separate them by a comma.',

    // Form Group Dates
    'dates' => 'Dates',
    'dateCreated' => 'Date created',
    'dateCreated_invalid' => 'Please enter a valid date!',
    'embargoUntil' => 'Embargo until',
    'embargo_invalid' => 'Please enter a valid date!',

    // Form Group Spatial and Temooral Coverages
    'tsc_spatialTemporalCoverages' => 'Spatial and Temporal Coverages',
    'tsc_map' => 'Map',
    'tsc_latitude' => 'Latitude',
    'tsc_longitude' => 'Longitude',
    'tsc_description' => 'Description',
    'tsc_description_placeholder' => 'Please enter the description of the temporal and spatial coverage...',
    'tsc_start' => 'Start',
    'tsc_end' => 'End',
    'tsc_timezone' => 'Timezone',
    'tsc_map_info' => '(Please choose coordinates with rectangle or marker)',
    'tsc_cancel' => 'Cancel',
    'tsc_accept' => 'Accept',

    // Formgroup related Work
    'relatedwork' => 'Related work',
    'relation' => 'Relation',
    'r_identifier_type' => 'Identifier type',
    'r_Identifier' => 'Identifier',
    'r_Identifier_invalid' => 'Please enter a valid identifier.',

    // Formgroup Funding Reference
    'funding_reference' => 'Funding Reference',
    'funder' => 'Funder',
    'funder_invalid' => 'Please enter the name of the funder.',
    'grant_Number' => 'Grant Number',
    'grant_Name' => 'Grant Name',

    // Buttons
    'clear' => 'Clear',
    'clear_tooltip' => 'Delete all entries or content.',
    'load' => 'Load',
    'load_tooltip' => 'Load saved data or content.',
    'saveAs' => 'Save',
    'saveAs_tooltip' => 'Save the current data or content under a new file name.',
    'submit' => 'Submit',
    'submit_tooltip' => 'Transmit the entered data or content.',
    'helpButtonon' => 'On',
    'helpButtonoff' => 'Off',

    // Testing
    'feedbackButton' => 'Feedback',
    'feedbackLabel' => 'User Feedback',
    'feedbackQuestion1' => 'Which functions of the new metadata editor do you find particularly helpful?',
    'feedbackQuestion2' => 'Is there a particular design or user interface change that you like?',
    'feedbackQuestion3' => 'What do you find positive about the usability of the new editor?',
    'feedbackQuestion4' => 'Which functions of the new editor do you find difficult to use?',
    'feedbackQuestion5' => 'Are there any aspects of the user interface that you find confusing or annoying?',
    'feedbackQuestion6' => 'Do you miss certain functions in the new metadata editor?',
    'feedbackQuestion7' => 'Is there a specific improvement you would like to see?',
    'feedbackSendButton' => 'Send Feedback',
    'thankYouMessage' => 'Thanks for your feedback!',

    // Misc
    'saveModalTitle' => 'Save as XML file',
    'filenameLabel' => 'Filename',
];