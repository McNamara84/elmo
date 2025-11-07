<?php
// tests/seed_session.php
if (!isset($_SESSION)) session_start();

// Setze genau die Session-Flag, die dein Template prüft
$_SESSION['modal-mslkeyword'] = 'true';

// Optional: setze weitere Test-flags falls nötig
// $_SESSION['another_flag'] = true;

// Ausgabe für Diagnose (kann später entfernt werden)
header('Content-Type: application/json');
echo json_encode([
  'ok' => true,
  'session_id' => session_id(),
  'modal-mslkeyword' => $_SESSION['modal-mslkeyword']
]);
