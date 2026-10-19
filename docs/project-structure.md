# Project structure

This document describes the responsibility boundaries introduced after issue #357. It complements the [file naming style guide](file-naming-conventions.md).

## Main directories

| Path | Responsibility | HTTP access |
| --- | --- | --- |
| `api/` | API front controllers, API v2 routes, and the temporary API v1 tombstone | yes |
| `endpoints/` | Small PHP actions called from the browser for feedback, submit, and event logging | yes |
| `scripts/` | Installation, bulk XML generation, and development checks | no |
| `assets/icons/` | Favicons, Apple touch icon, and PWA icons | yes |
| `assets/logos/` | Brand and identifier logos | yes |
| `includes/` | Shared PHP helpers without their own public endpoint | indirect |
| `save/` | Saving, validating, and persisting form groups | indirect |
| `formgroups/` | Server-side HTML form groups | yes |
| `js/`, `css/`, `lang/` | Browser logic, styles, and translations | yes |
| `doc/` | User-facing help and privacy page | yes |
| `docs/` | Developer, architecture, and planning documentation | not part of the production artifact |
| `tests/` | PHPUnit, Jest, and Playwright tests | not part of the production artifact |

`assets/icons/` is limited to browser and app icons: favicons, the Apple touch icon, and PWA icons. `assets/logos/` contains visible brand and identifier logos, for example GFZ, DOI, ORCID, and ROR. The old `/logos/...` URLs remain reachable internally during the compatibility phase.

## Public entry points

- `index.php` remains the page entry point.
- `header.php` remains the central root template for now.
- `api/index.php` and `api/v2/index.php` serve the API routes.
- `endpoints/send_feedback_mail.php`, `endpoints/send_xml_file.php`, and `endpoints/log_page_event.php` are the canonical action URLs.
- The former root URLs are rewritten internally during the compatibility phase.

## Non-public CLI tools

```text
php scripts/install.php basic
php scripts/install.php complete
php scripts/generate_xml_files.php
php scripts/check_file_names.php
```

Apache and the PHP CI router return 404 for `/scripts` and all subpaths. This protects the tools even though the current document root still covers the whole repository.

## Compatibility phase

The following old URLs remain reachable for now:

- `/api.php` -> `/api/deprecated_v1.php` with HTTP 410,
- `/doc/privacyPolicy.html` -> `/doc/privacy-policy.html`,
- `/send_feedback_mail.php` -> `/endpoints/send_feedback_mail.php`,
- `/send_xml_file.php` -> `/endpoints/send_xml_file.php`,
- `/log_page_event.php` -> `/endpoints/log_page_event.php`,
- former root URLs for favicons and PWA icons -> `/assets/icons/...`,
- former `/logos/...` URLs -> `/assets/logos/...`.

These rules exist in both `.htaccess` and `ci-router.php`. They are covered by unit and browser tests.

## Structure work postponed on purpose

- A separate `public/` document root that keeps application code and configuration away from the web server.
- PSR-4 autoloading with a clear `src/` namespace instead of a Composer `classmap` over the whole repository.
- Clarifying and possibly merging the different roles of `doc/` and `docs/`.
- A view or template directory for `header.php`, `footer.html`, and `modals.html`.
- Gradually standardizing the old form group file names.
- Reviewing other root-level configuration and settings files.

These topics should be planned as separate issues. This keeps the compatible and limited migration from #357 easy to review.
