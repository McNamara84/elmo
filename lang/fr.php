<?php
///////////////////////////////////////////////////////////////////
// Description: French language file for the metadata editor     //
// Authors: Matan Israel, Holger Ehrmann                         //
// Version: 1.9                                                  //
// License: CC BY 4.0                                            //
///////////////////////////////////////////////////////////////////

$translations = [
    // Général
    'logotitle' => 'ELMO - EPOS Laboratory Metadata Optimizer 1.9',
    'choose' => 'Choisissez...',
    'valid' => 'Valide',
    'PleaseChoose_invalid' => 'Veuillez choisir',
    'lastname' => 'Nom',
    'firstname' => 'Prénom',
    'affiliation' => 'Affiliation(s)',
    'role_label' => 'Rôle(s)',
    'add' => '+',
    'no_javascript_alert' => 'JavaScript est désactivé. Veuillez activer JavaScript pour utiliser ce formulaire.',

    // Groupe de formulaire Informations sur la ressource
    'resourceInformation' => 'Informations sur la ressource',
    'doi' => 'DOI',
    'doi_valid'=> 'Un nouveau DOI sera enregistré',
    'doi_invalid' => 'Utilisez le format 10.ORGANISATION/ID (ex.: 10.57757/IUGG23-3081) ou laissez vide',
    'publicationYear' => 'Année de publication',
    'publicationYear_invalid' => 'Veuillez fournir une année valide 1901-2155(4 chiffres).',
    'resourceType' => 'Type de ressource',
    'version' => 'Version',
    'version_invalid' => 'Si incertain, laissez vide',
    'languageofdataset' => 'Langue du jeu de données',
    'title' => 'Titre',
    'title_invalid' => 'Veuillez fournir un titre',
    'titleType' => 'Type de titre',

    // Groupe de formulaire Droits
    'rights' => 'Licences et droits',
    'rightsTitle' => 'Licence',

    // Groupe de formulaire Auteurs
    'authors' => 'Auteur(s)',
    'lastname_invalid' => 'Veuillez fournir un nom de famille. Seules les lettres sont autorisées.',
    'firstname_invalid' => 'Veuillez fournir un prénom. Seules les lettres sont autorisées.',
    'authorORCID' => 'ORCID',
    'ORCID_invalid' => 'Veuillez entrer un ORCID valide (XXXX-XXXX-XXXX-XXX(X))',
    'affiliation_invalid' => 'Veuillez fournir une affiliation.',

    // Groupe de formulaire Personnes de contact
    'contactpersons' => 'Personne(s) de contact',
    'email' => 'Adresse e-mail',
    'email_invalid' => 'Veuillez fournir une adresse e-mail valide au format xxx.xxx@xxx.xxx.',
    'position' => 'Poste',
    'position_invalid' => 'Veuillez fournir un poste.',
    'website' => 'Site web',
    'website_invalid' => 'Veuillez fournir une URL valide.',

    // Groupe de formulaire Contributeurs
    'originatingLaboratoryLabel' => 'Laboratoire d\'origine',
    'originatingLaboratoryName' => 'Nom du laboratoire d\'origine',
    'originatingLaboratoryAffiliation' => 'Affiliation du laboratoire d\'origine',

    'contributors' => "Contributeurs",
    'Organisation' => 'Nom de l\'organisation',
    'Organisation_invalid' => 'Veuillez entrer un nom d\'organisation valide.',
    'contributors_ORCID' => 'ORCID', 
    'contributorsPersonZeile' => 'Personne(s) contributrice(s)',
    'contributorsInstitutionZeile' => 'Institution(s) contributrice(s)',

    // Groupe de formulaire Descriptions
    'descriptions' => 'Descriptions',
    'd_abstract' => 'Résumé',
    'd_abstract_tooltip' => 'Veuillez entrer un résumé...',
    'd_methods' => 'Méthodes',
    'd_methods_tooltip' => 'Veuillez décrire les méthodes...',
    'd_technical_infos' => 'Informations techniques',
    'd_technical_infos_tooltip' => 'Veuillez entrer des informations techniques...',
    'd_other' => 'Autre',
    'd_other_tooltip' => 'Veuillez entrer d\'autres informations...',

    // Form Group MSL-Keywords
    'mslKeywords' => 'EPOS Multi-Scale Laboratories Keywords',

    // Groupe de formulaire Dates
    'dates' => 'Dates',
    'dateCreated' => 'Date de création',
    'dateCreated_invalid' => 'Veuillez entrer une date valide !',
    'embargoUntil' => 'Embargo jusqu\'au',
    'embargo_invalid' => 'Veuillez entrer une date valide !',

    // Groupe de formulaire Mots-clés du thésaurus
    'thesaurusKeywords' => 'GCMD Science Keywords',
    'thesaurus' => 'Thésaurus',
    'scienceKeywords' => 'Mots-clés scientifiques NASA GCMD',
    'instruments' => 'Instruments NASA GCMD',
    'platforms' => 'Plateformes NASA GCMD',
    'chrono' => 'Charte chronostratigraphique internationale',
    'cgi' => 'Lithologie simple CGI',
    'Gemet' => 'Thésaurus GEMET',
    'thesaurusLabel' => 'Ouvrez le thésaurus pour choisir des mots-clés ou commencez à taper...',

    // Mots-clés libres
    'freekeywords' => 'Mots-clés libres',
    'freekeywords_input' => 'Veuillez entrer des mots-clés et les séparer par une virgule.',

    // Groupe de formulaire Couvertures spatiales et temporelles
    'tsc_spatialTemporalCoverages' => 'Couvertures spatiales et temporelles',
    'tsc_map' => 'Carte',
    'tsc_latitude' => 'Latitude',
    'tsc_longitude' => 'Longitude',
    'tsc_description' => 'Description',
    'tsc_description_placeholder' => 'Veuillez entrer la description de la couverture temporelle et spatiale...',
    'tsc_start' => 'Début',
    'tsc_end' => 'Fin',
    'tsc_timezone' => 'Fuseau horaire',
    'tsc_map_info' => '(Veuillez choisir les coordonnées avec un rectangle ou un marqueur)',
    'tsc_cancel' => 'Annuler',
    'tsc_accept' => 'Accepter',

    // Groupe de formulaire Travaux connexes
    'relatedwork' => 'Travaux connexes',
    'relation' => 'Relation',
    'r_identifier_type' => 'Type d\'identifiant',
    'r_Identifier' => 'Identifiant',
    'r_Identifier_invalid' => 'Veuillez entrer un identifiant valide.',

    // Groupe de formulaire Référence de financement
    'funding_reference' => 'Référence de financement',
    'funder' => 'Bailleur de fonds',
    'funder_invalid' => 'Veuillez entrer le nom du financeur.',
    'grant_Number' => 'Numéro de subvention',
    'grant_Name' => 'Nom de la subvention',

    // Boutons
    'clear' => 'Effacer',
    'clear_tooltip' => 'Supprimer toutes les entrées ou le contenu.',
    'load' => 'Charger',
    'load_tooltip' => 'Charger les données ou le contenu sauvegardé.',
    'saveAs' => 'Enregistrer',
    'saveAs_tooltip' => 'Enregistrer les données ou le contenu actuel sous un nouveau nom de fichier.',
    'submit' => 'Soumettre',
    'submit_tooltip' => 'Transmettre les données ou le contenu saisi.',
    'helpButtonon' => 'Activé',
    'helpButtonoff' => 'Désactivé',

    // Test
    'feedbackButton' => 'Commentaires',
    'feedbackLabel' => 'Commentaires de l\'utilisateur',
    'feedbackQuestion1' => 'Quelles sont les fonctions du nouvel éditeur de métadonnées que vous trouvez particulièrement utiles ?',
    'feedbackQuestion2' => 'Y a-t-il une modification particulière du design ou de l\'interface utilisateur qui vous plaît ?',
    'feedbackQuestion3' => 'Qu\'est-ce que vous trouvez positif dans la facilité d\'utilisation du nouvel éditeur ?',
    'feedbackQuestion4' => 'Quelles sont les fonctions du nouvel éditeur que vous trouvez difficiles à utiliser ?',
    'feedbackQuestion5' => 'Y a-t-il des aspects de l\'interface utilisateur que vous trouvez peu clairs ou gênants ?',
    'feedbackQuestion6' => 'Certaines fonctions vous semblent-elles manquer dans le nouvel éditeur de métadonnées ?',
    'feedbackQuestion7' => 'Y a-t-il une amélioration spécifique que vous souhaiteriez ?',
    'feedbackSendButton' => 'Envoyer les commentaires',
    'thankYouMessage' => 'Merci pour vos commentaires!',

    // Divers
    'saveModalTitle' => 'Sauvegarder en tant que fichier XML',
    'filenameLabel' => 'Nom de fichier',
];