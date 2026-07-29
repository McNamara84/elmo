<?php
// Send hardening HTTP response headers as early as possible.
// These mitigate clickjacking (X-Frame-Options), MIME sniffing (X-Content-Type-Options)
// and limit referrer leakage to third parties (Referrer-Policy).
if (!headers_sent()) {
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
}

// Automatically detect available language files
$langFiles = glob(__DIR__ . '/lang/*.json');
$langCodes = array_map(fn($file) => basename($file, '.json'), $langFiles);
sort($langCodes);

// Fallback for instance title if not defined in settings
if (!isset($instanceTitle)) {
    $instanceTitle = getenv('INSTANCE_TITLE') ?: 'ELMO – GFZ Metadata Editor';
}

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
  <style>
    /* Responsive header menu layout */
    #headerMenuContent .dropdown {
      flex: 1 1 auto; /* Mobile: grow and fill equally */
    }
    @media (min-width: 992px) { /* lg breakpoint */
      #headerMenuContent .dropdown {
        flex: 0 1 auto; /* Large screens: don't grow, use auto width */
      }
    }
  </style>
</head>

<body>
  <!-- Fixed Header -->
  <header class="navbar navbar-expand-lg navbar-dark bg-primary sticky-top shadow p-0" role="banner">
    <div class="container-fluid px-0">
      
      <div class="d-flex align-items-center ms-3 my-2">
        <h1 class="visually-hidden">ELMO – GFZ Data Services' Metadata Editor 2.0</h1>
        <a href="https://www.gfz.de/" target="_blank" rel="noopener noreferrer">
          <img src="logos/GFZ-logo.svg" width="2048" height="694" alt="GFZ Logo" class="logo logo-left">
        </a>
      </div>

      <a href="https://dataservices.gfz.de/web/" target="_blank" rel="noopener noreferrer" class="logo-center-wrapper">
        <img src="logos/gfz-data-services-logo.svg" width="2048" height="413" alt="GFZ Data Services Logo" class="logo">
      </a>

      <!-- Toggle button for mobile -->
      <button class="navbar-toggler me-3 p-1" style="font-size: 0.85rem;" type="button" data-bs-toggle="collapse" data-bs-target="#headerMenuContent" aria-controls="headerMenuContent" aria-expanded="false" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>

      <!-- Collapsible content -->
      <div class="collapse navbar-collapse" id="headerMenuContent">
        <div class="d-flex flex-row align-items-center ms-lg-auto me-lg-3 px-3 pb-3 pt-2 pt-lg-0 px-lg-0 pb-lg-0 p-lg-1 gap-2 bg-primary">
     
          <!-- Guide Link -->
          <div class="dropdown">
            <a href="doc/help.php" target="_blank" class="btn btn-primary w-100  " id="buttonHelpheader" data-translate="buttons.elmoGuide">
              <i class="bi bi-book"></i> Guide
            </a>
          </div>
           
          <!-- Dropdown menu for help -->
          <div class="dropdown">
            <button class="btn btn-primary dropdown-toggle w-100  " id="bd-help" type="button" data-bs-toggle="dropdown"
              aria-expanded="false" data-translate="header.help">
              <i class="bi bi-question-square-fill"></i>
              Help
            </button>
            <ul class="dropdown-menu shadow" aria-labelledby="bd-help">
              <li><a class="dropdown-item" data-bs-theme-value="help-on" id="buttonHelpOn" data-translate="buttons.helpOn">
                  <i class="bi bi-question-circle-fill"></i> <span data-translate="header.on">On</span></a></li>
              <li><a class="dropdown-item" data-bs-theme-value="help-off" id="buttonHelpOff"
                  data-translate="buttons.helpOff">
                  <i class="bi bi-question-circle"></i> <span data-translate="header.off">Off</span></a></li>
              <li><a class="dropdown-item" id="button-changelog-show">
                  <i class="bi bi-card-checklist"></i> <span data-translate="buttons.about">About</span></a></li>
            </ul>
          </div>

          <div class="dropdown">
            <!-- Dropdown menu for dark mode settings -->
            <button class="btn btn-primary dropdown-toggle w-100  " id="bd-theme" type="button" data-bs-toggle="dropdown"
              aria-expanded="false" data-translate="header.mode">
              <i class="bi bi-circle-half"></i>
              Mode
            </button>
            <ul class="dropdown-menu shadow" aria-labelledby="bd-theme">
              <li><a class="dropdown-item active" data-bs-theme-value="auto" data-translate="buttons.auto">
                  <i class="bi bi-circle-half"></i> Auto</a></li>
              <li><a class="dropdown-item" data-bs-theme-value="light" data-translate="buttons.light">
                  <i class="bi bi-sun-fill"></i> <span data-translate="header.light">Light</span></a></li>
              <li><a class="dropdown-item" data-bs-theme-value="dark" data-translate="buttons.dark">
                  <i class="bi bi-moon-stars-fill"></i> <span data-translate="header.dark">Dark</span></a></li>
            </ul>
          </div>
          
          <div class="dropdown">
            <!-- Dropdown menu for language settings -->
            <button class="btn btn-primary dropdown-toggle w-100  " id="bd-lang" type="button" data-bs-toggle="dropdown"
              aria-expanded="false" data-translate="header.language">
              <i class="bi bi-translate"></i>
              Language
            </button>
            <ul class="dropdown-menu dropdown-menu-end shadow" aria-labelledby="bd-lang">
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
      </div>
    </div>
  </header>

  <!-- Subheader -->
  <section role="region" aria-label="Page subheader">
    <div class="bg-white border-bottom shadow-sm">
      <div class="container-fluid py-2 d-flex justify-content-between align-items-center">
        <div class="fs-5 fw-semibold text-dark"><?php echo htmlspecialchars($instanceTitle); ?></div>
        <?php if ($showMslLogo) echo $mslLogoHtml; ?>
      </div>
    </div>
  </section>
