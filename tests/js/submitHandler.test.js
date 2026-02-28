const { requireFresh } = require('./utils');

describe('submitHandler.js', () => {
  let SubmitHandler;
  let validateEmbargoDate;
  let validateTemporalCoverage;
  let validateContactPerson;
  let handler;
  let $;

  function loadScript() {
    ({ SubmitHandler, validateEmbargoDate, validateTemporalCoverage, validateContactPerson } =
      requireFresh('../../js/submitHandler.js'));
    handler = new SubmitHandler('test-form', 'modal-submit', 'modal-notification');
  }

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    document.body.innerHTML = `
      <form id="test-form"></form>
      <div id="modal-submit"></div>
      <div id="modal-notification">
        <div id="modal-notification-label"></div>
        <div id="modal-notification-body"></div>
      </div>
      <div id="modal-validation-failed">
        <h5 id="modal-validation-failed-label"></h5>
        <p id="modal-validation-failed-save-hint"></p>
      </div>
      <input id="input-date-created" />
      <input id="input-date-embargo" />
      <div class="embargo-invalid"></div>
      <div id="row" tsc-row>
        <input id="input-stc-datestart-row1" />
        <input id="input-stc-dateend-row1" />
        <div class="invalid-feedback" data-translate="coverage.dateTimeInvalid"></div>
      </div>
      <input type="checkbox" id="input-submit-privacycheck">
      <button id="button-submit-submit" disabled></button>
      <input type="file" id="input-submit-datadescription" />
      <button id="remove-file-btn"></button>
      <span id="selected-file-name"></span>
      <div id="group-stc"></div>
      <div id="group-author"></div>
    `;

    $ = require('jquery');
    global.$ = $;
    global.jQuery = $;

    global.bootstrap = {
      Modal: function() {
        this.show = jest.fn();
        this.hide = jest.fn();
      }
    };

    global.translations = {
      dates: { embargoDateError: 'Embargo Error' },
      coverage: { endDateError: 'End Date Error' },
      alerts: {
        successHeading: 'Success',
        errorHeading: 'Error',
        submitError: 'Submit Error',
        validationErrorheading: 'Validation',
        validationError: 'Invalid',
        successMessage: 'Dataset successfully transmitted.'
      }
    };
        // Mock applyTranslations function
    global.applyTranslations = jest.fn();

    // Mock scrollIntoView
    Element.prototype.scrollIntoView = jest.fn();

    loadScript();
  });

  afterEach(() => {
    jest.useRealTimers();
    console.error.mockRestore();
  });

  test('validateEmbargoDate marks invalid when embargo before creation', () => {
    $('#input-date-created').val('2024-05-10');
    $('#input-date-embargo').val('2024-05-01');
    const result = validateEmbargoDate();
    expect(result).toBe(false);
    expect($('#input-date-embargo').hasClass('is-invalid')).toBe(true);
    expect($('.embargo-invalid').text()).toBe('Embargo Error');
  });

  test('validateTemporalCoverage marks invalid when end before start', () => {
    $('#input-stc-datestart-row1').val('2024-05-10');
    $('#input-stc-dateend-row1').val('2024-05-01');
    const row = document.getElementById('row');
    const result = validateTemporalCoverage(row);
    expect(result).toBe(false);
    expect($('#input-stc-dateend-row1').hasClass('is-invalid')).toBe(true);
    expect(row.querySelector('.invalid-feedback').textContent).toBe('End Date Error');
  });

  test('toggleSubmitButton enables button when checked', () => {
    $('#input-submit-privacycheck').prop('checked', true);
    handler.toggleSubmitButton();
    expect($('#button-submit-submit').prop('disabled')).toBe(false);
  });

  test('clearFileInput resets file fields', () => {
    const input = $('#input-submit-datadescription')[0];
    Object.defineProperty(input, 'value', { writable: true, value: 'f.txt' });
    $('#selected-file-name').text('f.txt');
    $('#remove-file-btn').show();
    handler.clearFileInput();
    expect($('#input-submit-datadescription').val()).toBe('');
    expect($('#selected-file-name').text()).toBe('');
    expect($('#remove-file-btn').css('display')).toBe('none');
  });

  test('showNotification populates modal does not autohide for success messages', () => {
    jest.useFakeTimers();
    handler.showNotification('success', 'Title', 'Msg');
    expect($('#modal-notification-label').text()).toBe('Title');
    expect($('#modal-notification-body').html()).toContain('Msg');
    expect(handler.modals.notification.show).toHaveBeenCalled();
    // Check that OK button is present for success
    const body = $('#modal-notification-body').html();
    expect(body).toContain('✓');
    expect(body).toContain('alert-success');
  });

  test('showNotification populates modal and auto hides on info messages', () => {
    jest.useFakeTimers();
    handler.showNotification('info', 'Title', 'Msg');
    expect($('#modal-notification-label').text()).toBe('Title');
    expect($('#modal-notification-body').html()).toContain('Msg');
    expect(handler.modals.notification.show).toHaveBeenCalled();
    jest.advanceTimersByTime(3000);
    expect(handler.modals.notification.hide).toHaveBeenCalled();
  });

  test('handleAjaxError parses JSON response', () => {
    const spy = jest.spyOn(handler, 'showNotification');
    const xhr = {
      responseText: JSON.stringify({ message: 'server msg', debug: 'x' }),
      getResponseHeader: () => 'application/json'
    };
    handler.handleAjaxError(xhr, 'parsererror', 'err');
    expect(spy).toHaveBeenCalledWith('danger', 'Error', 'server msg');
  });

  test('handleAjaxError falls back to default on parse failure', () => {
    const spy = jest.spyOn(handler, 'showNotification');
    const xhr = {
      responseText: 'notjson',
      getResponseHeader: () => 'text/html'
    };
    handler.handleAjaxError(xhr, 'error', 'fail');
    expect(spy).toHaveBeenCalledWith('danger', 'Error', 'Submit Error');
  });

  test('provides ES module exports', async () => {
    const mod = await import('../../js/submitHandler.js');
    expect(mod.default).toBeDefined();
    expect(mod.SubmitHandler).toBeDefined();
    expect(mod.validateEmbargoDate).toBeDefined();
    expect(mod.validateTemporalCoverage).toBeDefined();
    expect(mod.validateContactPerson).toBeDefined();
  });


  test('submitViaAjax sends FormData and handles success', (done) => {
    jest.spyOn($, 'ajax').mockImplementation((config) => {
      expect(config.url).toBe('send_xml_file.php');
      expect(config.type).toBe('POST');
      expect(config.processData).toBe(false);
      expect(config.contentType).toBe(false);
      
      // Simulate successful response
      config.success({
        success: true,
        message: 'Dataset successfully transmitted.',
        resource_id: 'RES-123'
      });
    });

    const spyNotification = jest.spyOn(handler, 'showNotification');
    const formData = new FormData();
    
    handler.submitViaAjax(formData);
    
    setTimeout(() => {
      expect(spyNotification).toHaveBeenCalledWith(
        'success',
        'Success',
        'Dataset successfully transmitted.'
      );
      done();
    }, 100);
  });

  test('submitViaAjax handles error response', (done) => {
    jest.spyOn($, 'ajax').mockImplementation((config) => {
      config.success({
        success: false,
        message: 'Database connection failed'
      });
    });

    const spyNotification = jest.spyOn(handler, 'showNotification');
    const formData = new FormData();
    
    handler.submitViaAjax(formData);
    
    setTimeout(() => {
      expect(spyNotification).toHaveBeenCalledWith(
        'danger',
        'Error',
        'Database connection failed'
      );
      done();
    }, 100);
  });

  test('showNotification does NOT auto-close for success type', () => {
    jest.useFakeTimers();
    handler.showNotification('success', 'Success', 'Message');
    
    jest.advanceTimersByTime(3000);
    
    expect(handler.modals.notification.hide).not.toHaveBeenCalled();
  });

  test('showNotification does NOT auto-close for danger type', () => {
    jest.useFakeTimers();
    handler.showNotification('danger', 'Error', 'Message');
    
    jest.advanceTimersByTime(3000);
    
    expect(handler.modals.notification.hide).not.toHaveBeenCalled();
  });

  test('showNotification auto-closes for info type', () => {
    jest.useFakeTimers();
    handler.showNotification('info', 'Info', 'Message');
    
    jest.advanceTimersByTime(3000);
    
    expect(handler.modals.notification.hide).toHaveBeenCalled();
  });

  test('showNotification displays correct icon for success', () => {
    handler.showNotification('success', 'Success', 'All good');
    
    const body = $('#modal-notification-body').html();
    expect(body).toContain('✓');
    expect(body).toContain('All good');
  });

  test('showNotification displays correct icon for danger', () => {
    handler.showNotification('danger', 'Error', 'Something wrong');
    
    const body = $('#modal-notification-body').html();
    expect(body).toContain('✕');
    expect(body).toContain('Something wrong');
  });

  test('showNotification converts newlines to HTML breaks', () => {
    const message = 'Line 1\n\nLine 2\nLine 3';
    handler.showNotification('info', 'Test', message);
    
    const body = $('#modal-notification-body').html();
    expect(body).toContain('</p><p>');
    expect(body).toContain('<br>');
  });

  test('showNotification escapes HTML and strips script/img tags', () => {
    const message = '<script>alert(1)</script>Hello & <b>World</b><img src=x onerror="alert(2)">';
    handler.showNotification('info', 'Title', message);

    const body = $('#modal-notification-body').html();
    expect(body).not.toContain('<script');
    expect(body).not.toContain('<img');
    expect(body).not.toContain('alert(1)');
    expect(body).not.toContain('alert(2)');
    expect(body).toContain('Hello &amp;');
    expect(body).toContain('&lt;b&gt;World&lt;/b&gt;');
  });

  test('showNotification applies correct alert class', () => {
    handler.showNotification('success', 'Success', 'Message');
    let body = $('#modal-notification-body').html();
    expect(body).toContain('alert-success');
    
    handler.showNotification('danger', 'Error', 'Message');
    body = $('#modal-notification-body').html();
    expect(body).toContain('alert-danger');
  });

  // ── buildDataUploadHint tests ──────────────────────────────────────

  describe('buildDataUploadHint', () => {
    beforeEach(() => {
      global.translations.alerts.dataUploadTitle = 'Upload primary data';
      global.translations.alerts.dataUploadMessage = 'Only <strong>metadata</strong> submitted.';
      global.translations.alerts.dataUploadLinkText = 'Upload here';
      global.translations.alerts.dataUploadFileNameHint = 'Name your file:';
    });

    test('returns alert-warning block with correct URL and target=_blank', () => {
      const html = handler.buildDataUploadHint('https://nextcloud.example.com/share', 'My Dataset');
      expect(html).toContain('alert-warning');
      expect(html).toContain('href="https://nextcloud.example.com/share"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer"');
    });

    test('displays translated title and message', () => {
      const html = handler.buildDataUploadHint('https://example.com', 'Test');
      expect(html).toContain('Upload primary data');
      expect(html).toContain('Only <strong>metadata</strong> submitted.');
      expect(html).toContain('Upload here');
    });

    test('includes main title as filename suggestion when provided', () => {
      const html = handler.buildDataUploadHint('https://example.com', 'My Important Research Dataset');
      expect(html).toContain('My Important Research Dataset');
      expect(html).toContain('Name your file:');
      expect(html).toContain('font-monospace');
    });

    test('omits filename suggestion when main title is empty', () => {
      const html = handler.buildDataUploadHint('https://example.com', '');
      expect(html).not.toContain('Name your file:');
      expect(html).not.toContain('font-monospace');
    });

    test('escapes HTML in main title to prevent XSS', () => {
      const html = handler.buildDataUploadHint('https://example.com', '<script>alert("xss")</script>');
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    test('escapes HTML in upload URL to prevent XSS', () => {
      const html = handler.buildDataUploadHint('https://example.com/"><script>alert(1)</script>', 'Title');
      expect(html).not.toContain('"><script>');
      expect(html).toContain('&quot;&gt;&lt;script&gt;');
    });

    test('handles special characters in title correctly', () => {
      const html = handler.buildDataUploadHint('https://example.com', 'Müller & Schröder\'s Data "2025"');
      expect(html).toContain('Müller &amp; Schröder&#39;s Data &quot;2025&quot;');
    });

    test('renders the upload link as a button with btn-warning class', () => {
      const html = handler.buildDataUploadHint('https://example.com', 'Test');
      expect(html).toContain('btn btn-warning btn-sm fw-bold');
      expect(html).toContain('bi-box-arrow-up-right');
    });

    test('renders the cloud upload icon in the heading', () => {
      const html = handler.buildDataUploadHint('https://example.com', 'Test');
      expect(html).toContain('bi-cloud-arrow-up-fill');
    });
  });

  // ── submitViaAjax data upload hint integration tests ───────────────

  describe('submitViaAjax data upload hint', () => {
    beforeEach(() => {
      global.translations.alerts.dataUploadTitle = 'Upload primary data';
      global.translations.alerts.dataUploadMessage = 'Only metadata submitted.';
      global.translations.alerts.dataUploadLinkText = 'Upload here';
      global.translations.alerts.dataUploadFileNameHint = 'Name your file:';

      // Add title input and modal-dialog to DOM
      document.body.innerHTML += `
        <input id="input-resourceinformation-title" value="My Research Dataset" />
        <div id="modal-notification">
          <div class="modal-dialog">
            <div id="modal-notification-label"></div>
            <div id="modal-notification-body"></div>
          </div>
        </div>
      `;
    });

    afterEach(() => {
      delete window.ELMO_FEATURES;
    });

    test('appends upload hint when ELMO_FEATURES.dataUploadUrl is set', (done) => {
      window.ELMO_FEATURES = { dataUploadUrl: 'https://nextcloud.example.com/upload' };

      jest.spyOn($, 'ajax').mockImplementation((config) => {
        config.success({ success: true, message: 'OK' });
      });

      handler.submitViaAjax(new FormData());

      setTimeout(() => {
        const body = $('#modal-notification-body').html();
        expect(body).toContain('alert-warning');
        expect(body).toContain('https://nextcloud.example.com/upload');
        expect(body).toContain('My Research Dataset');
        expect(body).toContain('Upload primary data');
        done();
      }, 100);
    });

    test('does not append upload hint when ELMO_FEATURES.dataUploadUrl is empty', (done) => {
      window.ELMO_FEATURES = { dataUploadUrl: '' };

      jest.spyOn($, 'ajax').mockImplementation((config) => {
        config.success({ success: true, message: 'OK' });
      });

      handler.submitViaAjax(new FormData());

      setTimeout(() => {
        const body = $('#modal-notification-body').html();
        expect(body).not.toContain('alert-warning');
        done();
      }, 100);
    });

    test('does not append upload hint when ELMO_FEATURES is undefined', (done) => {
      delete window.ELMO_FEATURES;

      jest.spyOn($, 'ajax').mockImplementation((config) => {
        config.success({ success: true, message: 'OK' });
      });

      handler.submitViaAjax(new FormData());

      setTimeout(() => {
        const body = $('#modal-notification-body').html();
        expect(body).not.toContain('alert-warning');
        done();
      }, 100);
    });

    test('adds modal-lg class when upload hint is appended', (done) => {
      window.ELMO_FEATURES = { dataUploadUrl: 'https://nextcloud.example.com' };

      jest.spyOn($, 'ajax').mockImplementation((config) => {
        config.success({ success: true, message: 'OK' });
      });

      handler.submitViaAjax(new FormData());

      setTimeout(() => {
        expect($('#modal-notification .modal-dialog').hasClass('modal-lg')).toBe(true);
        done();
      }, 100);
    });

    test('does not add modal-lg class when no upload URL configured', (done) => {
      window.ELMO_FEATURES = { dataUploadUrl: '' };

      jest.spyOn($, 'ajax').mockImplementation((config) => {
        config.success({ success: true, message: 'OK' });
      });

      handler.submitViaAjax(new FormData());

      setTimeout(() => {
        expect($('#modal-notification .modal-dialog').hasClass('modal-lg')).toBe(false);
        done();
      }, 100);
    });

    test('does not append upload hint on error response', (done) => {
      window.ELMO_FEATURES = { dataUploadUrl: 'https://nextcloud.example.com' };

      jest.spyOn($, 'ajax').mockImplementation((config) => {
        config.success({ success: false, message: 'Failed' });
      });

      handler.submitViaAjax(new FormData());

      setTimeout(() => {
        const body = $('#modal-notification-body').html();
        expect(body).not.toContain('alert-warning');
        expect(body).toContain('alert-danger');
        done();
      }, 100);
    });

    test('uses empty string for title when title input is empty', (done) => {
      window.ELMO_FEATURES = { dataUploadUrl: 'https://nextcloud.example.com' };
      $('#input-resourceinformation-title').val('');

      jest.spyOn($, 'ajax').mockImplementation((config) => {
        config.success({ success: true, message: 'OK' });
      });

      handler.submitViaAjax(new FormData());

      setTimeout(() => {
        const body = $('#modal-notification-body').html();
        expect(body).toContain('alert-warning');
        // Should not contain filename hint when title is empty
        expect(body).not.toContain('Name your file:');
        done();
      }, 100);
    });
  });
});