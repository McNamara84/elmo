# File naming conventions

This convention is mandatory for new, moved, renamed, and meaningfully changed files in a pull request. Existing untouched files are migrated step by step and do not have to be renamed all at once.

## Rules

| File type | Convention | Example |
| --- | --- | --- |
| PHP class, interface, trait, enum, or test class | `PascalCase.php` and identical to the primary symbol | `DatasetController.php`, `FileNameConventionTest.php` |
| Procedural PHP, endpoint, include, or CLI script | `snake_case.php` | `send_feedback_mail.php`, `check_file_names.php` |
| JavaScript module | `camelCase.js` | `submitHandler.js` |
| Jest test | dot-separated `camelCase` segments with `.test.js` | `logging.test.js`, `logging.module.test.js` |
| HTML and static browser assets | `kebab-case` | `apple-touch-icon.png` |
| Playwright or TypeScript spec | `kebab-case.spec.ts` | `feedback-security.spec.ts` |
| Directory | lowercase, and `kebab-case` for new compound names | `assets/icons`, `form-groups` |

A single lowercase word such as `index.php`, `logging.js`, or `favicon.svg` also follows the matching convention.

## Exceptions and externally defined names

- Names required by tools, package managers, servers, or platforms, for example `composer.json`, `package-lock.json`, `jest.config.js`, `playwright.config.ts`, `.htaccess`, `Dockerfile.web`, or GitHub workflow files. These files are not freely named browser assets, even if they are static files in the repository or are read by the web server.
- Third-party, generated, coverage, cache, and runtime files.
- `ci-router.php` keeps its existing infrastructure file name during issue #357. Renaming it would change commands and CI configuration without adding structural value.
- Existing legacy files that are not changed in the current pull request.

Avoid generic collection names such as `helper_functions.php`. New helper logic should be named after its business purpose and placed in the responsible module.

Reusable CLI and development helpers for recurring tasks belong in `scripts/`. Browser-called PHP actions belong in `endpoints/`. Shared PHP helpers without their own HTTP entry point belong in `includes/` or in the matching business module.

## Automated check

Check changed files in the current working tree:

```text
composer check:file-names
```

Check changes against a base commit:

```text
composer check:file-names -- --base=<commit>
```

Check all versioned files, for example to find technical debt:

```text
composer check:file-names -- --all
```

The `--all` mode may fail because some old files have not been migrated on purpose. For now, it is not a required CI gate.

## Uppercase and lowercase changes on Windows

A case-only rename must be done in two steps, so Git detects it on both Windows and Linux containers:

```text
git mv oldname.php temp-name.php
git mv temp-name.php NewName.php
```
