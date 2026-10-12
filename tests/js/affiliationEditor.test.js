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
    expect(window.searchAffiliationsFromServer).toHaveBeenCalledWith('gfz', 20);
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
});
