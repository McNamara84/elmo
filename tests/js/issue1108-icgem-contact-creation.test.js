/**
 * @jest-environment jsdom
 */

describe('Issue #1108 ICGEM contact person creation', () => {
  let $;
  let icgemModule;

  const ICGEM_NS = 'http://icgem.gfz.de/schema';
  const DATACITE_NS = 'http://datacite.org/schema/kernel-4';

  function buildAuthorDom(authors) {
    const rows = authors.map((author) => `
      <div class="row" data-creator-row>
        <input type="checkbox" name="contacts[]" />
        <input type="text" name="familynames[]" value="${author.familyname}" />
        <input type="text" name="givennames[]" value="${author.givenname}" />
        <input type="text" name="orcids[]" value="" />
        <div class="contact-person-input" style="display: none;">
          <input type="email" name="cpEmail[]" value="" />
        </div>
        <div class="contact-person-input" style="display: none;">
          <input type="text" name="cpOnlineResource[]" value="" />
        </div>
      </div>
    `).join('');

    document.body.innerHTML = `
      <div id="group-author">
        ${rows}
        <button type="button" id="button-author-add"></button>
      </div>
    `;

    $('#button-author-add').on('click', () => {
      $('#group-author').append(`
        <div class="row" data-creator-row>
          <input type="checkbox" name="contacts[]" />
          <input type="text" name="familynames[]" value="" />
          <input type="text" name="givennames[]" value="" />
          <input type="text" name="orcids[]" value="" />
          <div class="contact-person-input" style="display: none;">
            <input type="email" name="cpEmail[]" value="" />
          </div>
          <div class="contact-person-input" style="display: none;">
            <input type="text" name="cpOnlineResource[]" value="" />
          </div>
        </div>
      `);
    });
  }

  function makeIcgemXml({ familyName, givenName, email, website }) {
    return new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>
      <icgv:envelope xmlns:icgv="${ICGEM_NS}" xmlns:dc="${DATACITE_NS}">
        <dc:resource>
          <dc:contributors>
            <dc:contributor contributorType="ContactPerson">
              <dc:contributorName>${givenName} ${familyName}</dc:contributorName>
              <dc:givenName>${givenName}</dc:givenName>
              <dc:familyName>${familyName}</dc:familyName>
            </dc:contributor>
          </dc:contributors>
        </dc:resource>
        <icgv:globalGravityProduct>
          <icgv:contact>
            <icgv:address>${email}</icgv:address>
            <icgv:onlineResource>${website}</icgv:onlineResource>
          </icgv:contact>
        </icgv:globalGravityProduct>
      </icgv:envelope>`, 'application/xml');
  }

  beforeEach(() => {
    $ = require('jquery');
    global.$ = global.jQuery = $;
    window.$ = $;
    window.jQuery = $;
    jest.resetModules();
    icgemModule = require('../../js/mappingXmlToInputFields-icgem.js');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
    delete global.$;
    delete global.jQuery;
    delete window.$;
    delete window.jQuery;
    delete window.authorStack;
  });

  test('creates a new frontend contact row when no author row matches', () => {
    buildAuthorDom([{ familyname: 'Existing', givenname: 'Author' }]);
    const xmlDoc = makeIcgemXml({
      familyName: 'Contact',
      givenName: 'New',
      email: 'new.contact@gfz.de',
      website: 'https://new-contact.example.org'
    });

    icgemModule.populateIcgemContactPersons(xmlDoc);

    const rows = document.querySelectorAll('[data-creator-row]');
    expect(rows.length).toBe(2);

    const createdRow = rows[1];
    expect(createdRow.querySelector('input[name="familynames[]"]').value).toBe('Contact');
    expect(createdRow.querySelector('input[name="givennames[]"]').value).toBe('New');
    expect(createdRow.querySelector('input[name="contacts[]"]').checked).toBe(true);
    expect(createdRow.querySelector('input[name="cpEmail[]"]').value).toBe('new.contact@gfz.de');
    expect(createdRow.querySelector('input[name="cpOnlineResource[]"]').value).toBe('https://new-contact.example.org');
  });

  test('adds a missing contact person to authorStack payload when authorStack is active', () => {
    window.authorStack = {
      collectPayload: jest.fn(() => [
        {
          type: 'person',
          familyname: 'Existing',
          givenname: 'Author',
          orcid: '',
          isContact: false,
          affiliations: []
        }
      ]),
      setAuthors: jest.fn()
    };

    const xmlDoc = makeIcgemXml({
      familyName: 'Contact',
      givenName: 'New',
      email: 'new.contact@gfz.de',
      website: 'https://new-contact.example.org'
    });

    icgemModule.populateIcgemContactPersons(xmlDoc);

    expect(window.authorStack.setAuthors).toHaveBeenCalledTimes(1);
    expect(window.authorStack.setAuthors).toHaveBeenCalledWith([
      expect.objectContaining({
        familyname: 'Existing',
        givenname: 'Author',
        isContact: false
      }),
      expect.objectContaining({
        familyname: 'Contact',
        givenname: 'New',
        isContact: true,
        email: 'new.contact@gfz.de',
        website: 'https://new-contact.example.org'
      })
    ]);
  });
});
