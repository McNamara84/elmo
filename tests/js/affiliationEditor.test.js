const { createAffiliationEditor, createAffiliationBadge, normalizeAffiliations } = require('../../js/affiliationEditor.js');

describe('shared affiliation editor', () => {
  let instances;
  beforeEach(() => {
    document.body.innerHTML = '';
    global.$ = global.jQuery = window.$ = window.jQuery = require('jquery');
    instances = [];
  });
  afterEach(() => {
    instances.forEach(editor => editor.destroy());
    delete window.searchAffiliationsFromServer;
    jest.useRealTimers();
  });
  function mount(initial = [], group = 'author') {
    const card = document.createElement('div');
    document.body.append(card);
    let values = normalizeAffiliations(initial);
    const onChange = jest.fn();
    const editor = createAffiliationEditor({
      card, group, translate: (_key, fallback) => fallback,
      readAffiliations: () => values,
      writeAffiliations: next => { values = next; }, onChange
    });
    card.append(editor.element[0]);
    instances.push(editor);
    return { editor, values: () => values, onChange };
  }
  const tick = async () => { jest.advanceTimersByTime(250); await Promise.resolve(); await Promise.resolve(); };

  test('free text is explicit, works below search threshold and disables empty submissions', () => {
    const { editor, values } = mount();
    const input = editor.element.find('[data-affiliation-input]');
    const add = editor.element.find('[data-affiliation-add]');
    expect(add.prop('disabled')).toBe(true);
    expect(editor.element.find('[data-affiliation-search]')).toHaveLength(0);
    input.val('  ').trigger('input');
    input.trigger($.Event('keydown', { key: 'Enter' }));
    expect(values()).toEqual([]);
    input.val('AB').trigger('input').trigger('blur');
    expect(add.prop('disabled')).toBe(false);
    expect(values()).toEqual([]);
    const enter = $.Event('keydown', { key: 'Enter' });
    input.trigger(enter);
    expect(enter.isDefaultPrevented()).toBe(true);
    expect(values()).toEqual([{ label: 'AB', rorId: '' }]);
    expect(add.prop('disabled')).toBe(true);
  });
  test('Enter adds free text even when a matching ROR suggestion exists', async () => {
    jest.useFakeTimers();
    window.searchAffiliationsFromServer = jest.fn().mockResolvedValue([{ name: 'GFZ', id: '04z8jg394' }]);
    const { editor, values } = mount();
    const input = editor.element.find('[data-affiliation-input]');
    input.val('GFZ').trigger('input'); await tick();
    input.trigger($.Event('keydown', { key: 'Enter' }));
    expect(values()).toEqual([{ label: 'GFZ', rorId: '' }]);
  });
  test('a rejected search leaves input usable and announces the failure', async () => {
    jest.useFakeTimers();
    window.searchAffiliationsFromServer = jest.fn().mockRejectedValue(new Error('offline'));
    const { editor, values } = mount();
    editor.element.find('[data-affiliation-input]').val('Lab').trigger('input'); await tick();
    expect(editor.element.find('[data-affiliation-status]').text()).toContain('Search unavailable');
    editor.element.find('[data-affiliation-add]').trigger('click');
    expect(values()).toEqual([{ label: 'Lab', rorId: '' }]);
  });

  test('editing and reordering preserve each label/ROR pair including commas', () => {
    const { editor, values } = mount([{ label: 'GFZ', rorId: 'https://ror.org/04z8jg394' }, { label: 'Other, Department' }]);
    const input = editor.element.find('[data-affiliation-label]').first();
    input.val('GFZ, Department').trigger('input');
    expect(editor.element.find('[data-affiliation-label]').first()[0]).toBe(input[0]);
    expect(values()[0]).toEqual({ label: 'GFZ, Department', rorId: '04z8jg394' });
    editor.element.find('[data-affiliation-move-down]').first().trigger('click');
    expect(values().map(item => item.label)).toEqual(['Other, Department', 'GFZ, Department']);
    editor.element.find('[data-affiliation-remove]').first().trigger('click');
    expect(values()).toEqual([{ label: 'GFZ, Department', rorId: '04z8jg394' }]);
  });
  test('keeps empty imported labels invalid and their ROR ID recoverable', () => {
    const { editor } = mount([{ label: '', value: '04z8jg394', rorId: '04z8jg394' }]);
    expect(editor.element.find('[data-affiliation-label]').val()).toBe('');
    expect(editor.validate()).toBe(false);
    expect(editor.element.find('[data-affiliation-ror]').text()).toBe('04z8jg394');
    editor.element.find('[data-affiliation-label]').val('Recovered').trigger('input');
    expect(editor.validate()).toBe(true);
  });
  test('searches automatically and selects structured suggestions', async () => {
    jest.useFakeTimers();
    window.searchAffiliationsFromServer = jest.fn().mockResolvedValue([{ name: 'GFZ', id: '04z8jg394' }]);
    const { editor, values } = mount();
    const input = editor.element.find('[data-affiliation-input]');
    input.val('gf').trigger('input'); await tick();
    expect(window.searchAffiliationsFromServer).not.toHaveBeenCalled();
    input.val('gfz').trigger('input'); await tick();
    expect(window.searchAffiliationsFromServer).toHaveBeenCalledWith('gfz', 20, {throwOnError: true});
    editor.element.find('[data-affiliation-result]').trigger('click');
    expect(values()).toEqual([{ label: 'GFZ', rorId: '04z8jg394' }]);
    expect(input.val()).toBe('');
  });
  test('invalidates old results as soon as text changes before the next debounce', async () => {
    jest.useFakeTimers();
    let resolve;
    window.searchAffiliationsFromServer = jest.fn(() => new Promise(done => { resolve = done; }));
    const { editor } = mount();
    const input = editor.element.find('[data-affiliation-input]');
    input.val('gfz').trigger('input'); await tick();
    input.val('potsdam').trigger('input');
    resolve([{ name: 'Old result', id: '04z8jg394' }]); await Promise.resolve();
    expect(editor.element.find('[data-affiliation-result]')).toHaveLength(0);
  });
  test('destroy cancels scheduled searches and ignores already running responses', async () => {
    jest.useFakeTimers();
    let resolve;
    window.searchAffiliationsFromServer = jest.fn(() => new Promise(done => { resolve = done; }));
    const { editor } = mount();
    editor.element.find('[data-affiliation-input]').val('gfz').trigger('input'); await tick();
    editor.destroy();
    resolve([{ name: 'Late result' }]); await Promise.resolve();
    expect(editor.element.find('[data-affiliation-result]')).toHaveLength(0);
    const other = mount().editor;
    other.element.find('[data-affiliation-input]').val('new').trigger('input');
    other.destroy(); await tick();
    expect(window.searchAffiliationsFromServer).toHaveBeenCalledTimes(1);
  });
  test('uses group aliases while displaying untrusted labels as text', () => {
    const { editor } = mount([{ label: '<img src=x>', rorId: '04z8jg394' }], 'contributor');
    expect(editor.element.find('[data-contributor-affiliation-label]')).toHaveLength(1);
    const badge = createAffiliationBadge({ label: '<script>text</script>', rorId: 'https://ror.org/04z8jg394' });
    expect(badge.find('script')).toHaveLength(0);
    expect(badge.text()).toBe('<script>text</script> 04z8jg394');
  });
  test('keeps an empty edited free-text slot stable when other entries move or are removed', () => {
    const { editor, values } = mount(['First', 'Second', 'Third']);
    editor.element.find('[data-affiliation-label]').first().val(' ').trigger('input');
    expect(editor.validate()).toBe(false);
    editor.element.find('[data-affiliation-move-up]').last().trigger('click');
    expect(values().map(item => item.label)).toEqual(['', 'Third', 'Second']);
    editor.element.find('[data-affiliation-remove]').last().trigger('click');
    expect(values().map(item => item.label)).toEqual(['', 'Third']);
    editor.render();
    expect(editor.validate()).toBe(false);
    editor.element.find('[data-affiliation-remove]').first().trigger('click');
    expect(editor.validate()).toBe(true);
    expect(values()).toEqual([{label: 'Third', rorId: ''}]);
  });
  test('searches in separate cards independently and handles no matches', async () => {
    jest.useFakeTimers();
    window.searchAffiliationsFromServer = jest.fn(query => Promise.resolve(query === 'One' ? [{mappedValue: 'First result', affiliationIdentifier: 'https://ror.org/04z8jg394'}] : []));
    const first = mount().editor;
    const second = mount([], 'contributor').editor;
    first.setPendingInput('One'); first.element.find('[data-affiliation-input]').trigger('input');
    second.setPendingInput('Two'); second.element.find('[data-affiliation-input]').trigger('input');
    await tick();
    expect(first.element.find('[data-affiliation-result]').text()).toContain('First result');
    expect(second.element.find('[data-affiliation-result]')).toHaveLength(0);
    expect(second.element.find('[data-affiliation-status]').text()).toContain('No ROR matches');
    second.clearPendingInput();
    expect(first.getPendingInput()).toBe('One');
    expect(second.getPendingInput()).toBe('');
  });
  test('IME composition and other keys keep the input unconfirmed', () => {
    const { editor, values } = mount();
    const input = editor.element.find('[data-affiliation-input]');
    input.val('Lab').trigger('input');
    input.trigger($.Event('keydown', { key: 'Enter', originalEvent: {isComposing: true} }));
    input.trigger($.Event('keydown', { key: 'Escape' }));
    expect(values()).toEqual([]);
    expect(editor.getPendingInput()).toBe('Lab');
  });
  test('keeps free text usable when the search service is absent', async () => {
    jest.useFakeTimers();
    const { editor, values } = mount();
    editor.element.find('[data-affiliation-input]').val('Lab').trigger('input'); await tick();
    editor.element.find('[data-affiliation-add]').trigger('click');
    expect(values()).toEqual([{label: 'Lab', rorId: ''}]);
    expect(normalizeAffiliations(null)).toEqual([]);
    expect(normalizeAffiliations([{name: 'Name'}, {value: 'Value'}, {label: ''}])).toEqual([{label: 'Name', rorId: ''}, {label: 'Value', rorId: ''}]);
    expect(createAffiliationBadge({label: 'Free text'}).text()).toBe('Free text');
  });
});
