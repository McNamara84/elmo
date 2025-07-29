const fs = require('fs');
const path = require('path');

let SaveHandler;
let $;
let modalInstances;

function loadScript() {
  const script = fs.readFileSync(path.resolve(__dirname, '../../js/saveHandler.js'), 'utf8')
    .replace('export default SaveHandler;', 'window.SaveHandler = SaveHandler;');
  window.eval(script);
  SaveHandler = window.SaveHandler;
}

describe('saveHandler.js', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form id="form-mde">
        <input id="input-date-created">
        <input id="input-date-embargo">
        <div class="embargo-invalid"></div>
        <div id="group-author">
          <input type="checkbox" name="contacts[]" value="1">
          <input type="checkbox" name="contacts[]" value="2">
        </div>
      </form>
      <div id="modal-saveas"><input id="input-saveas-filename"><button class="btn-close"></button><button class="btn-secondary"></button></div>
      <div id="modal-notification">
        <div id="modal-notification-label"></div>
        <div id="modal-notification-body"></div>
        <button class="btn-close"></button>
        <button class="btn-primary"></button>
      </div>`;

    $ = require('jquery');
    global.$ = $;
    global.jQuery = $;
    global.applyTranslations = jest.fn();

    modalInstances = [];
    global.bootstrap = {
      Modal: jest.fn(() => {
        const inst = { show: jest.fn(), hide: jest.fn() };
        modalInstances.push(inst);
        return inst;
      })
    };

    global.translations = {
      dates: { embargoDateError: 'embargoErr' },
      coverage: { endDateError: 'endErr' },
      alerts: {
        filenameErrorHeading: 'fh',
        filenameError: 'fe',
        successHeading: 'sh',
        savingSuccess: 'ss',
        errorHeading: 'eh',
        saveError: 'se',
        savingHeading: 'savH',
        savingInfo: 'savI'
      }
    };

    loadScript();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('validateEmbargoDate marks invalid when embargo before creation', () => {
    const created = document.getElementById('input-date-created');
    const embargo = document.getElementById('input-date-embargo');
    const feedback = document.querySelector('.embargo-invalid');
    created.value = '2024-06-02';
    embargo.value = '2024-06-01';
    const result = window.validateEmbargoDate();
    expect(result).toBe(false);
    expect(embargo.classList.contains('is-invalid')).toBe(true);
    expect(feedback.textContent).toBe('embargoErr');
  });

  test('validateEmbargoDate resets when empty', () => {
    const embargo = document.getElementById('input-date-embargo');
    window.validateEmbargoDate();
    expect(embargo.className).not.toContain('is-invalid');
    expect(embargo.className).not.toContain('is-valid');
  });

  test('validateTemporalCoverage sets classes based on dates', () => {
    const row = document.createElement('div');
    row.setAttribute('tsc-row', '');
    row.innerHTML = `
      <input id="input-stc-datestart0" value="2024-06-10">
      <input id="input-stc-dateend0" value="2024-06-01">
      <div class="invalid-feedback" data-translate="coverage.dateTimeInvalid"></div>`;
    document.body.appendChild(row);

    const result = window.validateTemporalCoverage(row);
    const end = row.querySelector('[id*="input-stc-dateend"]');
    expect(result).toBe(false);
    expect(end.classList.contains('is-invalid')).toBe(true);
    expect(row.querySelector('.invalid-feedback').textContent).toBe('endErr');

    end.value = '2024-06-20';
    const result2 = window.validateTemporalCoverage(row);
    expect(result2).toBe(true);
    expect(end.classList.contains('is-valid')).toBe(true);
  });

  test('validateContactPerson requires one selection', () => {
    const boxes = document.querySelectorAll('input[name="contacts[]"]');
    expect(window.validateContactPerson()).toBe(false);
    expect(document.getElementById('contact-person-error')).not.toBeNull();
    boxes.forEach(b => expect(b.required).toBe(true));

    boxes[0].checked = true;
    const res2 = window.validateContactPerson();
    expect(res2).toBe(true);
    expect(document.getElementById('contact-person-error')).toBeNull();
    boxes.forEach(b => expect(b.required).toBe(false));
  });

  test('generateFilename returns formatted timestamp', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-05-30T12:34:56Z'));
    const handler = new SaveHandler('form-mde','modal-saveas','modal-notification');
    const name = await handler.generateFilename();
    expect(name).toBe('dataset_20240530_123456');
  });

  test('handleSaveConfirm validates filename', async () => {
    const handler = new SaveHandler('form-mde','modal-saveas','modal-notification');
    jest.spyOn(handler, 'showNotification').mockImplementation(() => {});
    jest.spyOn(handler, 'saveAndDownload').mockResolvedValue();

    $('#input-saveas-filename').val('');
    await handler.handleSaveConfirm();
    expect(handler.showNotification).toHaveBeenCalledWith('danger','fh','fe');
    expect(modalInstances[0].hide).not.toHaveBeenCalled();

    handler.showNotification.mockClear();
    $('#input-saveas-filename').val('file');
    await handler.handleSaveConfirm();
    expect(modalInstances[0].hide).toHaveBeenCalled();
    expect(handler.saveAndDownload).toHaveBeenCalledWith('file');
  });

  test('showNotification updates modal and hides on actions', () => {
    const handler = new SaveHandler('form-mde','modal-saveas','modal-notification');
    handler.showNotification('success','Title','Message');
    expect($('#modal-notification-label').text()).toBe('Title');
    expect($('#modal-notification-body').html()).toContain('Message');
    expect(modalInstances[1].show).toHaveBeenCalled();

    document.querySelector('#modal-notification .btn-close').click();
    expect(modalInstances[1].hide).toHaveBeenCalled();
  });
});