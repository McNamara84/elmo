const fs = require('fs');
const path = require('path');

describe('relatedwork.js card stack', () => {
  let $;

  function loadRelatedWorkScript() {
    let script = fs.readFileSync(
      path.resolve(__dirname, '../../js/eventhandlers/formgroups/relatedwork.js'),
      'utf8'
    );
    script = script.replace(/^import.*$/gm, '');
    script = script.replace('$(document).ready(function () {', '(function () {');
    script = script.replace(/\n\s*\}\);\s*$/, '\n})();');
    window.eval(script);
  }

  beforeEach(() => {
    document.body.innerHTML = `
      <span data-related-work-summary-count>0 entries</span>
      <input type="hidden" name="relatedWorksPayload" value="[]">
      <div id="group-relatedwork" data-related-work-stack-shell>
        <div id="group-relatedwork-stack" data-related-work-stack>
          <div class="row" data-related-work-entry related-work-row data-related-work-entry-key="related-work-0">
            <div>
              <select id="input-relatedwork-relation" name="relation[]">
                <option value=""></option>
                <option value="1">IsCitedBy</option>
                <option value="2">References</option>
              </select>
              <label for="input-relatedwork-relation">Relation</label>
            </div>
            <div>
              <input id="input-relatedwork-identifier" name="rIdentifier[]">
              <label for="input-relatedwork-identifier">Identifier</label>
            </div>
            <div>
              <select id="input-relatedwork-identifiertype" name="rIdentifierType[]">
                <option value=""></option>
                <option value="DOI">DOI</option>
                <option value="URL">URL</option>
              </select>
              <label for="input-relatedwork-identifiertype">Identifier type</label>
            </div>
            <button type="button" class="drag-handle"></button>
            <button type="button" id="button-relatedwork-add" data-related-work-add>+</button>
          </div>
        </div>
        <div data-related-work-add-actions></div>
      </div>
    `;

    $ = require('jquery');
    global.$ = global.jQuery = $;
    window.$ = window.jQuery = $;

    $.fn.sortable = jest.fn(function () {
      return this;
    });
    window.createRemoveButton = jest.fn(() => $('<button type="button" class="btn btn-danger removeButton"></button>'));
    window.replaceHelpButtonInClonedRows = jest.fn();
    window.translateClonedRow = jest.fn();
    window.bootstrap = { Tooltip: jest.fn() };

    loadRelatedWorkScript();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete window.relatedWorkStack;
    delete window.elmo;
  });

  function payload() {
    return JSON.parse(document.querySelector('input[name="relatedWorksPayload"]').value);
  }

  function setField(row, name, value, eventName = 'change') {
    row.find(`[name="${name}"]`).val(value).trigger(eventName);
  }

  test('starts empty and keeps the add action outside the sortable stack', () => {
    expect($.fn.sortable).toHaveBeenCalledWith(expect.objectContaining({
      items: '> [data-related-work-entry]',
      handle: '.drag-handle',
      cancel: 'input, textarea, select, option, button:not(.drag-handle)',
      axis: 'y'
    }));
    expect(payload()).toEqual([]);
    expect($('[data-related-work-summary-count]').text()).toBe('0 entries');
    expect($('[data-related-work-entry]').length).toBe(0);
    expect($('[data-related-work-stack] #button-relatedwork-add').length).toBe(0);
    expect($('[data-related-work-add-actions] #button-relatedwork-add').length).toBe(1);
  });

  test('adds expanded cards with unique field ids and an incomplete summary', () => {
    $('#button-relatedwork-add').trigger('click');
    $('#button-relatedwork-add').trigger('click');

    const cards = $('[data-related-work-entry]');
    expect(cards).toHaveLength(2);
    expect(cards.eq(0).attr('data-related-work-expanded')).toBeUndefined();
    expect(cards.eq(0).find('[data-related-work-edit-panel]').hasClass('show')).toBe(true);
    expect(cards.eq(0).find('[data-related-work-summary-identifier]').text()).toBe('Incomplete related work');
    expect(cards.eq(0).find('select[name="relation[]"]').attr('id')).not.toBe(
      cards.eq(1).find('select[name="relation[]"]').attr('id')
    );
    expect(cards.eq(1).find('label').first().attr('for')).toBe(
      cards.eq(1).find('select[name="relation[]"]').attr('id')
    );
    expect(document.activeElement).toBe(cards.eq(1).find('select[name="relation[]"]')[0]);
    expect(payload()).toEqual([]);
  });

  test('serializes a card into the ordered structured payload', () => {
    $('#button-relatedwork-add').trigger('click');
    const card = $('[data-related-work-entry]').first();
    setField(card, 'relation[]', '1');
    setField(card, 'rIdentifier[]', '10.5880/example', 'input');
    setField(card, 'rIdentifierType[]', 'DOI');

    expect(payload()).toEqual([{
      entryKey: 'related-work-0',
      order: 0,
      identifier: '10.5880/example',
      relation: 'IsCitedBy',
      relationId: '1',
      identifierType: 'DOI'
    }]);
    expect(card.find('[data-related-work-summary-identifier]').text()).toBe('10.5880/example');
    expect(card.find('[data-related-work-summary-relation]').text()).toBe('IsCitedBy');
    expect(card.find('[data-related-work-summary-identifier-type]').text()).toBe('DOI');
    expect($('[data-related-work-summary-count]').text()).toBe('1 entry');
  });

  test('rebuilds the stack from a structured payload in payload order', () => {
    window.relatedWorkStack.setRelatedWorks(JSON.stringify([
      {
        entryKey: 'first',
        identifier: '10.5880/first',
        relation: 'IsCitedBy',
        relationId: '1',
        identifierType: 'DOI'
      },
      {
        entryKey: 'second',
        identifier: 'https://example.org/second',
        relation: 'References',
        relationId: '2',
        identifierType: 'URL'
      }
    ]));

    expect($('[data-related-work-entry]')).toHaveLength(2);
    expect(payload().map((entry) => entry.entryKey)).toEqual(['first', 'second']);
    expect(payload().map((entry) => entry.order)).toEqual([0, 1]);
    expect($('[data-related-work-summary-identifier]').map((_, element) => $(element).text()).get()).toEqual([
      '10.5880/first',
      'https://example.org/second'
    ]);
  });

  test('moves cards with keyboard-accessible buttons and updates focus and order', () => {
    window.relatedWorkStack.setRelatedWorks([
      { entryKey: 'first', identifier: 'first', relationId: '1', relation: 'IsCitedBy', identifierType: 'DOI' },
      { entryKey: 'second', identifier: 'second', relationId: '2', relation: 'References', identifierType: 'URL' }
    ]);

    $('[data-related-work-entry]').eq(1).find('[data-related-work-move-up]').trigger('click');

    expect(payload().map((entry) => entry.entryKey)).toEqual(['second', 'first']);
    const movedCard = $('[data-related-work-entry]').first();
    expect(movedCard.find('[data-related-work-move-up]').prop('disabled')).toBe(true);
    expect(movedCard.find('[data-related-work-move-down]')[0]).toBe(document.activeElement);
  });

  test('uses the sortable update callback as the drag-and-drop order source', () => {
    window.relatedWorkStack.setRelatedWorks([
      { entryKey: 'first', identifier: 'first', relationId: '1', relation: 'IsCitedBy', identifierType: 'DOI' },
      { entryKey: 'second', identifier: 'second', relationId: '2', relation: 'References', identifierType: 'URL' }
    ]);
    const sortableOptions = $.fn.sortable.mock.calls.find((call) => typeof call[0] === 'object')[0];
    $('[data-related-work-stack]').prepend($('[data-related-work-entry]').eq(1));

    sortableOptions.update();

    expect(payload().map((entry) => entry.entryKey)).toEqual(['second', 'first']);
    expect(payload().map((entry) => entry.order)).toEqual([0, 1]);
  });

  test('collapses, reopens, and removes cards without changing their data', () => {
    window.relatedWorkStack.setRelatedWorks([
      { entryKey: 'first', identifier: 'first', relationId: '1', relation: 'IsCitedBy', identifierType: 'DOI' },
      { entryKey: 'second', identifier: 'second', relationId: '2', relation: 'References', identifierType: 'URL' }
    ]);
    const firstCard = $('[data-related-work-entry]').first();
    const firstToggle = firstCard.find('[data-related-work-toggle-edit]');

    firstToggle.trigger('click');
    expect(firstCard.find('[data-related-work-edit-panel]').hasClass('show')).toBe(false);
    expect(firstToggle.attr('aria-expanded')).toBe('false');
    expect(payload().map((entry) => entry.entryKey)).toEqual(['first', 'second']);

    firstToggle.trigger('click');
    expect(firstCard.find('[data-related-work-edit-panel]').hasClass('show')).toBe(true);

    firstCard.find('[data-related-work-remove]').trigger('click');
    expect(payload().map((entry) => entry.entryKey)).toEqual(['second']);
    expect(document.activeElement).toBe($('[data-related-work-toggle-edit]')[0]);

    $('[data-related-work-remove]').trigger('click');
    expect(payload()).toEqual([]);
    expect(document.activeElement).toBe($('#button-relatedwork-add')[0]);
  });

  test('refreshes translated card actions, summary, and empty state', () => {
    window.elmo = {
      translate: jest.fn((key) => ({
        'relatedWork.addEntry': 'Verwandtes Werk hinzufügen',
        'relatedWork.dragHandle': 'Reihenfolge ändern',
        'relatedWork.removeEntry': 'Eintrag entfernen',
        'relatedWork.editEntry': 'Eintrag bearbeiten',
        'relatedWork.collapseEntry': 'Eintrag einklappen',
        'relatedWork.moveEntryUp': 'Nach oben',
        'relatedWork.moveEntryDown': 'Nach unten',
        'relatedWork.entrySingular': 'Eintrag',
        'relatedWork.entryPlural': 'Einträge',
        'relatedWork.entriesSummary': '{count} {label}',
        'relatedWork.incompleteEntry': 'Unvollständiges verwandtes Werk'
      })[key])
    };
    $('#button-relatedwork-add').trigger('click');

    document.dispatchEvent(new CustomEvent('translationsLoaded', { detail: { translations: {} } }));

    const card = $('[data-related-work-entry]').first();
    expect($('[data-related-work-summary-count]').text()).toBe('0 Einträge');
    expect(card.find('[data-related-work-summary-identifier]').text()).toBe('Unvollständiges verwandtes Werk');
    expect(card.find('[data-related-work-toggle-edit]').attr('aria-label')).toBe('Eintrag einklappen');
    expect(card.find('[data-related-work-remove]').attr('aria-label')).toBe('Eintrag entfernen');
    expect(card.find('[data-related-work-drag]').attr('aria-label')).toBe('Reihenfolge ändern');
    expect($('#button-relatedwork-add').attr('aria-label')).toBe('Verwandtes Werk hinzufügen');
  });
});
