<?php
// Automatically detect available language files
$langFiles = glob(__DIR__ . '/lang/*.json');
$langCodes = array_map(fn($file) => basename($file, '.json'), $langFiles);
sort($langCodes);

// Determine base href, taking reverse proxy prefixes into account
$baseHref = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/') . '/';
if (!empty($_SERVER['HTTP_X_FORWARDED_PREFIX'])) {
    $baseHref = rtrim($_SERVER['HTTP_X_FORWARDED_PREFIX'], '/') . '/';
}
?>
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="utf-8" />
  <base href="<?php echo htmlspecialchars($baseHref); ?>">
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <!-- Local Bootstrap CSS -->
  <link href="node_modules/bootstrap/dist/css/bootstrap.min.css" rel="stylesheet">
  <!-- Local jQuery UI CSS -->
  <link rel="stylesheet" href="node_modules/jquery-ui/dist/themes/base/jquery-ui.min.css" />
  <!-- Local Bootstrap Icons CSS -->
  <link rel="stylesheet" href="node_modules/bootstrap-icons/font/bootstrap-icons.min.css" />
  <!-- Local Tagify CSS -->
  <link href="node_modules/@yaireo/tagify/dist/tagify.css" rel="stylesheet" type="text/css" />
  <!-- Local jsTree CSS -->
  <link rel="stylesheet" href="node_modules/jstree/dist/themes/default/style.min.css" />
  <!-- Custom CSS -->
  <link rel="stylesheet" href="css/gfz-cd.css">
  <link rel="stylesheet" href="./css/tagify-adj.css">
  <link rel="stylesheet" href="./css/darkmode.css">
  <!-- Favicon -->
  <link rel="icon" type="image/png" href="favicon-96x96.png" sizes="96x96" />
  <link rel="icon" type="image/svg+xml" href="favicon.svg" />
  <link rel="shortcut icon" href="favicon.ico" />
  <link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png" />
  <link rel="manifest" href="site.webmanifest" />
  <title>ELMO</title>
</head>

<body>
  <!-- Fixed Header -->
  <header class="navbar navbar-primary sticky-top bg-primary flex-md-nowrap p-0 shadow" role="banner">
    <h1 class="visually-hidden" data-translate="general.logoTitle">
      ELMO - Enhanced Laboratory Metadata Organizer 2.0
    </h1>
    <a class="navbar-brand col-md-3 col-lg-2 mr-0 px-3 text-white" href="#" id="headtitle"
      data-translate="general.logoTitle">
      ELMO
    </a>
    <div class="ms-auto d-flex align-items-center me-3 p-1">

      <!-- Link to legal notice -->
      <a href="https://dataservices-cms.gfz.de/about-us/legal-notice" target="_blank"
        class="text-white me-3 settings-menu-link" data-translate="header.legalNotice">Legal Notice</a>
      <!-- Dropdown menu for help -->
      <div class="dropdown ms-auto me-3 p-1">
        <button class="btn btn-primary dropdown-toggle" id="bd-help" type="button" data-bs-toggle="dropdown"
          aria-expanded="false" data-translate="header.help">
          <i class="bi bi-question-square-fill"></i>
          Help
        </button>
        <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="bd-help">
          <li><a href="doc/privacyPolicy.html" class="dropdown-item" target="_blank" id="buttonPrivacy"><i
                class="bi bi-shield-check"></i> Privacy Policy</a></li>
          <li><a href="doc/help.html" class="dropdown-item" target="_blank" id="buttonHelp"
              data-translate="buttons.guide">
              <i class="bi bi-book"></i> Guide</a></li>
          <li><a class="dropdown-item" data-bs-theme-value="help-on" id="buttonHelpOn" data-translate="buttons.helpOn">
              <i class="bi bi-question-circle-fill"></i> <span data-translate="header.on">On</span></a></li>
          <li><a class="dropdown-item" data-bs-theme-value="help-off" id="buttonHelpOff"
              data-translate="buttons.helpOff">
              <i class="bi bi-question-circle"></i> <span data-translate="header.off">Off</span></a></li>
          <li><a class="dropdown-item" id="button-changelog-show">
              <i class="bi bi-card-checklist"></i> <span data-translate="buttons.about">About</span></a></li>
        </ul>
      </div>
      <div class="dropdown me-3 p-1">
        <!-- Dropdown menu for dark mode settings -->
        <button class="btn btn-primary dropdown-toggle" id="bd-theme" type="button" data-bs-toggle="dropdown"
          aria-expanded="false" data-translate="header.mode">
          <i class="bi bi-circle-half"></i>
          Mode
        </button>
        <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="bd-theme">
          <li><a class="dropdown-item active" data-bs-theme-value="auto" data-translate="buttons.auto">
              <i class="bi bi-circle-half"></i> Auto</a></li>
          <li><a class="dropdown-item" data-bs-theme-value="light" data-translate="buttons.light">
              <i class="bi bi-sun-fill"></i> <span data-translate="header.light">Light</span></a></li>
          <li><a class="dropdown-item" data-bs-theme-value="dark" data-translate="buttons.dark">
              <i class="bi bi-moon-stars-fill"></i> <span data-translate="header.dark">Dark</span></a></li>
        </ul>
      </div>
      <div class="dropdown me-3 p-1">
        <!-- Dropdown menu for language settings -->
        <button class="btn btn-primary dropdown-toggle" id="bd-lang" type="button" data-bs-toggle="dropdown"
          aria-expanded="false" data-translate="header.language">
          <i class="bi bi-translate"></i>
          Language
        </button>
        <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="bd-lang">
          <li><a class="dropdown-item" data-bs-language-value="auto" data-translate="buttons.langAuto">
              <i class="bi bi-gear-fill"></i> Auto</a></li>
          <?php foreach ($langCodes as $code): ?>
            <li><a class="dropdown-item" data-bs-language-value="<?php echo $code; ?>"
                data-translate="<?php echo 'buttons.lang' . strtoupper($code); ?>">
                <i class="bi bi-globe"></i> <?php echo strtoupper($code); ?></a></li>
          <?php endforeach; ?>
        </ul>
      </div>
    </div>
  </header>