# Maintaining the ELMO changelog

`json/changelog.json` is the single source for the changelog dialog and the version shown in the footer. Keep `currentVersion` equal to the first release's `version`. The footer displays this value immediately, independently of Git release tags.

Add releases in descending order. Dates use `YYYY-MM-DD`; the dialog displays `YYYY/MM/DD`. Keep entries under their section heading. Use `parts` with `type: "text"` for prose and `type: "code"` for inline code. Do not put HTML in `parts`: the browser displays these values as text.

For entries from version 2.2.0 onward, set `editions` to one or more of `elmo`, `msl`, `gem`, and `igsn`. Use `all` alone when a change applies to every edition. The dialog displays the badges **ELMO**, **ELMO-MSL**, **ELMO-GEM**, **ELMO-IGSN**, and **All ELMOs**. Historical entries before 2.2.0 have no badges.

Add a `references` array when an issue or PR can be verified as the source of the change. Each item has `type: "issue"` or `type: "pull"` and a numeric `number`; links point to the `McNamara84/elmo` repository. Leave the array out when no reliable reference is known. Historical entries before 2.2.0 intentionally have no links.

Example:

```json
{
  "parts": [{ "type": "text", "value": "Related Work now starts empty." }],
  "editions": ["all"],
  "references": [{ "type": "pull", "number": 1229 }]
}
```

After editing, run `npm test -- --runInBand tests/js/changelogData.test.js tests/js/changelog.test.js` and the focused browser test `npx playwright test tests/playwright/features/changelog.spec.ts --config=playwright.config.ts --no-deps --workers=1`. The browser test uses the actual UI templates and local JSON data, so it does not require a running ELMO server.
