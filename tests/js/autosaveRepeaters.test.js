import $ from 'jquery';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('autosave repeatable form groups', () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = '';
    window.$ = $;
    window.jQuery = $;
    global.$ = $;
    global.jQuery = $;
    window.updateOverlayLabels = jest.fn();
    window.deleteDrawnOverlaysForRow = jest.fn();
    window.fitMapBounds = jest.fn();
    window.setUpAutocompleteFunder = jest.fn();
    window.checkMandatoryFields = jest.fn();
  });

  afterEach(() => {
    delete window.$;
    delete window.jQuery;
    delete window.updateOverlayLabels;
    delete window.deleteDrawnOverlaysForRow;
    delete window.fitMapBounds;
    delete window.setUpAutocompleteFunder;
    delete window.checkMandatoryFields;
    delete global.$;
    delete global.jQuery;
  });

  test('stc autosave expansion adds missing rows', async () => {
    document.body.innerHTML = `
      <div id="group-stc">
        <div class="row" tsc-row-id="1">
          <input id="input-stc-latmin_1" name="tscLatitudeMin[]" value="10" />
          <input id="input-stc-latmax_1" name="tscLatitudeMax[]" value="20" />
          <input id="input-stc-longmin_1" name="tscLongitudeMin[]" value="30" />
          <input id="input-stc-longmax_1" name="tscLongitudeMax[]" value="40" />
          <textarea id="input-stc-description_1" name="tscDescription[]">Example</textarea>
          <input id="input-stc-datestart_1" name="tscDateStart[]" type="date" value="2024-01-01" />
          <input id="input-stc-timestart_1" name="tscTimeStart[]" type="time" value="12:00" />
          <input id="input-stc-dateend_1" name="tscDateEnd[]" type="date" value="2024-12-31" />
          <input id="input-stc-timeend_1" name="tscTimeEnd[]" type="time" value="12:00" />
          <select id="input-stc-timezone" name="tscTimezone[]">
            <option selected>UTC</option>
          </select>
          <button type="button" id="button-stc-add">+</button>
        </div>
      </div>
    `;

    await import('../../js/eventhandlers/formgroups/stc.js');
    await flush();
    $(document).triggerHandler('ready');
    await flush();
    const event = new CustomEvent('autosave:ensure-array-field', {
      detail: { name: 'tscLatitudeMin[]', requiredCount: 2 },
      bubbles: true
    });

    document.querySelector('[name="tscLatitudeMin[]"]').dispatchEvent(event);

    const rows = document.querySelectorAll('#group-stc [tsc-row-id]');
    expect(rows).toHaveLength(2);
    const removeButtons = document.querySelectorAll('#group-stc .removeButton[aria-label="Remove entry"]');
    expect(removeButtons.length).toBeGreaterThanOrEqual(1);
    const latInputs = document.querySelectorAll('[name="tscLatitudeMin[]"]');
    expect(latInputs).toHaveLength(2);
  });

  test('related work autosave expansion adds missing rows', async () => {
    document.body.innerHTML = `
      <div id="group-relatedwork">
        <div class="row">
          <select name="relation[]"></select>
          <input name="rIdentifier[]" />
          <select name="rIdentifierType[]"></select>
          <button type="button" id="button-relatedwork-add">+</button>
        </div>
      </div>
    `;

    await import('../../js/eventhandlers/formgroups/relatedwork.js');
    await flush();
    $(document).triggerHandler('ready');
    await flush();

    const event = new CustomEvent('autosave:ensure-array-field', {
      detail: { name: 'rIdentifier[]', requiredCount: 3 },
      bubbles: true
    });

    document.querySelector('[name="rIdentifier[]"]').dispatchEvent(event);

    const rows = document.querySelectorAll('#group-relatedwork .row');
    expect(rows).toHaveLength(3);
    const removeButtons = document.querySelectorAll('#group-relatedwork .removeButton[aria-label="Remove entry"]');
    expect(removeButtons.length).toBeGreaterThanOrEqual(2);
  });

  test('funding reference autosave expansion adds missing rows', async () => {
    document.body.innerHTML = `
      <div id="group-fundingreference">
        <div class="row">
          <input class="inputFunder" name="funder[]" />
          <input type="hidden" name="funderId[]" />
          <input type="hidden" name="funderidtyp[]" />
          <input name="grantNummer[]" />
          <input name="grantName[]" />
          <input name="awardURI[]" />
          <button type="button" id="button-fundingreference-add" class="addFundingReference">+</button>
        </div>
      </div>
    `;

    await import('../../js/eventhandlers/formgroups/fundingreference.js');
    await flush();
    $(document).triggerHandler('ready');
    await flush();

    const event = new CustomEvent('autosave:ensure-array-field', {
      detail: { name: 'grantName[]', requiredCount: 2 },
      bubbles: true
    });

    document.querySelector('[name="grantName[]"]').dispatchEvent(event);

    const rows = document.querySelectorAll('#group-fundingreference .row');
    expect(rows).toHaveLength(2);
    const removeButtons = document.querySelectorAll('#group-fundingreference .removeButton[aria-label="Remove entry"]');
    expect(removeButtons.length).toBeGreaterThanOrEqual(1);
    expect(window.setUpAutocompleteFunder).toHaveBeenCalled();
  });
});