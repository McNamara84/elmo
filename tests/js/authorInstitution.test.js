const fs = require('fs');
const path = require('path');

describe('authorInstitution.js', () => {
  let $;
  let suffix;

  beforeEach(() => {
    // Feste Uhrzeit setzen
    jest.useFakeTimers().setSystemTime(new Date('2024-05-30T12:34:56Z'));
    suffix = Date.now(); // 1717072496000 in diesem Beispiel

    // HTML-Grundstruktur für den Test
    document.body.innerHTML = `
      <div id="group-authorinstitution">
        <div class="row" data-authorinstitution-row>
          <div class="col-12 col-md-5 p-1">
            <div class="input-group has-validation">
              <div class="form-floating">
                <input type="text" class="form-control"
                  id="input-authorinstitution-name" name="authorinstitutionName[]" value="Test Inst">
                <label for="input-authorinstitution-name">Author Institution name</label>
              </div>
            </div>
          </div>
          <div class="col-12 col-md-6 p-1">
            <label for="input-authorinstitution-affiliation" class="visually-hidden">Affiliation</label>
            <div class="input-group has-validation">
              <input type="text" class="form-control"
                id="input-authorinstitution-affiliation" name="institutionAffiliation[]" value="Some Affil" />
              <span class="input-group-text"><i class="bi bi-question-circle-fill"
                  data-help-section-id="help-authorinstitution-affiliation"></i></span>
              <input type="hidden" id="input-author-institutionrorid" name="authorInstitutionRorIds[]" value="123" />
            </div>
          </div>
          <div class="col-2 p-1 d-flex justify-content-center align-items-center">
            <button type="button" class="btn btn-primary addauthorinstitution" id="button-authorinstitution-add">+</button>
          </div>
        </div>
      </div>
    `;

    // jQuery bereitstellen
    $ = require('jquery');
    global.$ = global.jQuery = $;
    window.$ = $;
    window.jQuery = $;

    // Mock-Funktionen setzen
    window.createRemoveButton = jest.fn(() => $('<button type="button" class="removeButton"></button>'));
    window.replaceHelpButtonInClonedRows = jest.fn();
    window.autocompleteAffiliations = jest.fn();
    window.affiliationsData = [{ id: '1', name: 'Inst' }];

    // Zu testendes Skript laden
    let script = fs.readFileSync(
      path.resolve(__dirname, '../../js/eventhandlers/formgroups/authorInstitution.js'),
      'utf8'
    );
    // ES6-Import entfernen und sofort ausführbar machen
    script = script.replace(/^import.*$/gm, '');
    script = script.replace('$(document).ready(function () {', '(function () {');
    script = script.replace(/\n\s*\}\);\s*$/, '\n})();');
    window.eval(script);

    // DOMContentLoaded-Event simulieren
    document.dispatchEvent(new Event('DOMContentLoaded'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllTimers();
  });

  test('fügt neue Author-Institution-Zeile hinzu', () => {
    $('#button-authorinstitution-add').trigger('click');

    const rows = $('#group-authorinstitution .row');
    expect(rows.length).toBe(2);

    const newRow = rows.last();

    // ID-Änderung überprüfen
    expect(newRow.find(`#input-authorinstitution-name-${suffix}`).length).toBe(1);
    expect(newRow.find(`#input-authorinstitution-affiliation-${suffix}`).length).toBe(1);
    expect(newRow.find(`#input-author-institutionrorid-${suffix}`).length).toBe(1);

    // Label korrekt verknüpft
    expect(newRow.find(`label[for='input-authorinstitution-name-${suffix}']`).length).toBe(1);

    // Felder geleert
    expect(newRow.find('input').filter(function () { return this.value; }).length).toBe(0);

    // Add-Button entfernt, Remove-Button hinzugefügt
    expect(newRow.find('#button-authorinstitution-add').length).toBe(0);
    expect(newRow.find('.removeButton').length).toBe(1);

    // Hilfsfunktionen aufgerufen
    expect(window.replaceHelpButtonInClonedRows).toHaveBeenCalledTimes(1);
    expect(window.createRemoveButton).toHaveBeenCalledTimes(1);

    // Autocomplete initialisiert
    expect(window.autocompleteAffiliations).toHaveBeenCalledWith(
      `input-authorinstitution-affiliation-${suffix}`,
      `input-author-institutionrorid-${suffix}`,
      window.affiliationsData
    );

    // Entfernen testen
    newRow.find('.removeButton').trigger('click');
    expect($('#group-authorinstitution .row').length).toBe(1);
  });
});
