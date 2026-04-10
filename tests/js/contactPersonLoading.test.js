/**
 * @jest-environment jsdom
 *
 * Unit tests for Contact Person loading from XML (Issue #1046).
 * Tests processContactPersons (ISO) and processContactPersonsFromDataCite (fallback).
 */

describe('processContactPersons (ISO)', () => {
  let mappingModule;
  let $;

  beforeEach(() => {
    $ = require('jquery');
    global.$ = $;
    global.jQuery = $;
    window.$ = $;
    window.jQuery = $;

    document.body.innerHTML = `
      <div id="group-author">
        <div class="row" data-creator-row>
          <input type="checkbox" id="checkbox-author-contactperson" name="contacts[]" />
          <input type="text" name="familynames[]" value="Doe" />
          <input type="text" name="givennames[]" value="Jane" />
          <input type="text" name="orcids[]" value="0000-0002-1825-0097" />
          <div class="contact-person-input" style="display: none;">
            <input type="email" name="cpEmail[]" value="" />
          </div>
          <div class="contact-person-input" style="display: none;">
            <input type="text" name="cpOnlineResource[]" value="" />
          </div>
        </div>
        <div class="row" data-creator-row>
          <input type="checkbox" id="checkbox-author-contactperson-1" name="contacts[]" />
          <input type="text" name="familynames[]" value="Smith" />
          <input type="text" name="givennames[]" value="John" />
          <input type="text" name="orcids[]" value="" />
          <div class="contact-person-input" style="display: none;">
            <input type="email" name="cpEmail[]" value="" />
          </div>
          <div class="contact-person-input" style="display: none;">
            <input type="text" name="cpOnlineResource[]" value="" />
          </div>
        </div>
        <button type="button" id="button-author-add"></button>
      </div>
    `;

    // Wire up click handler to simulate adding a new author row
    $('#button-author-add').on('click', function () {
      const $newRow = $(`
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
      $('#group-author').append($newRow);
    });

    global.Tagify = jest.fn().mockImplementation(() => ({
      addTags: jest.fn(),
      settings: { whitelist: [] },
    }));
    global.translations = {};
    window.updateMapOverlay = jest.fn();

    jest.resetModules();
    mappingModule = require('../../js/mappingXmlToInputFields.js');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
    delete global.$;
    delete global.jQuery;
    delete window.$;
    delete window.jQuery;
    delete global.Tagify;
    delete global.translations;
    delete window.updateMapOverlay;
  });

  function makeIsoXml({ familyName, givenName, email, website }) {
    const websitePart = website
      ? `<gmd:onlineResource>
           <gmd:CI_OnlineResource>
             <gmd:linkage><gmd:URL>${website}</gmd:URL></gmd:linkage>
           </gmd:CI_OnlineResource>
         </gmd:onlineResource>`
      : '';

    return new DOMParser().parseFromString(
      `<?xml version="1.0" encoding="UTF-8"?>
       <envelope>
         <gmd:MD_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd"
                          xmlns:gco="http://www.isotc211.org/2005/gco">
           <gmd:identificationInfo>
             <gmd:MD_DataIdentification>
               <gmd:pointOfContact>
                 <gmd:CI_ResponsibleParty>
                   <gmd:individualName>
                     <gco:CharacterString>${familyName}, ${givenName}</gco:CharacterString>
                   </gmd:individualName>
                   <gmd:contactInfo>
                     <gmd:CI_Contact>
                       <gmd:address>
                         <gmd:CI_Address>
                           <gmd:electronicMailAddress>
                             <gco:CharacterString>${email}</gco:CharacterString>
                           </gmd:electronicMailAddress>
                         </gmd:CI_Address>
                       </gmd:address>
                       ${websitePart}
                     </gmd:CI_Contact>
                   </gmd:contactInfo>
                   <gmd:role>
                     <gmd:CI_RoleCode codeListValue="pointOfContact">pointOfContact</gmd:CI_RoleCode>
                   </gmd:role>
                 </gmd:CI_ResponsibleParty>
               </gmd:pointOfContact>
             </gmd:MD_DataIdentification>
           </gmd:identificationInfo>
         </gmd:MD_Metadata>
       </envelope>`,
      'application/xml'
    );
  }

  test('marks matching author as contact person with email and website', () => {
    const xmlDoc = makeIsoXml({
      familyName: 'Doe',
      givenName: 'Jane',
      email: 'jane@example.com',
      website: 'https://example.com/jane',
    });

    mappingModule.processContactPersons(xmlDoc);

    const $firstRow = $('div[data-creator-row]').eq(0);
    expect($firstRow.find('input[name="contacts[]"]').prop('checked')).toBe(true);
    expect($firstRow.find('input[name="cpEmail[]"]').val()).toBe('jane@example.com');
    expect($firstRow.find('input[name="cpOnlineResource[]"]').val()).toBe('https://example.com/jane');

    // Second author should NOT be marked as CP
    const $secondRow = $('div[data-creator-row]').eq(1);
    expect($secondRow.find('input[name="contacts[]"]').prop('checked')).toBe(false);
    expect($secondRow.find('input[name="cpEmail[]"]').val()).toBe('');
  });

  test('matches names case-insensitively', () => {
    const xmlDoc = makeIsoXml({
      familyName: 'doe',
      givenName: 'JANE',
      email: 'jane@example.com',
    });

    mappingModule.processContactPersons(xmlDoc);

    const $firstRow = $('div[data-creator-row]').eq(0);
    expect($firstRow.find('input[name="contacts[]"]').prop('checked')).toBe(true);
    expect($firstRow.find('input[name="cpEmail[]"]').val()).toBe('jane@example.com');
  });

  test('matches names with extra whitespace', () => {
    const xmlDoc = makeIsoXml({
      familyName: ' Doe ',
      givenName: ' Jane ',
      email: 'jane@example.com',
    });

    mappingModule.processContactPersons(xmlDoc);

    const $firstRow = $('div[data-creator-row]').eq(0);
    expect($firstRow.find('input[name="contacts[]"]').prop('checked')).toBe(true);
  });

  test('matches names with combined case + whitespace differences', () => {
    const xmlDoc = makeIsoXml({
      familyName: '  DOE  ',
      givenName: 'jane ',
      email: 'jane@example.com',
    });

    mappingModule.processContactPersons(xmlDoc);

    const $firstRow = $('div[data-creator-row]').eq(0);
    expect($firstRow.find('input[name="contacts[]"]').prop('checked')).toBe(true);
  });

  test('creates new author row when names differ completely', () => {
    const xmlDoc = makeIsoXml({
      familyName: 'Unknown',
      givenName: 'Person',
      email: 'unknown@example.com',
    });

    mappingModule.processContactPersons(xmlDoc);

    // A third author row should have been created
    const $rows = $('div[data-creator-row]');
    expect($rows.length).toBe(3);

    // Original rows should not be marked as CP
    expect($rows.eq(0).find('input[name="contacts[]"]').prop('checked')).toBe(false);
    expect($rows.eq(1).find('input[name="contacts[]"]').prop('checked')).toBe(false);

    // New row should be marked as CP with correct data
    const $newRow = $rows.eq(2);
    expect($newRow.find('input[name="contacts[]"]').prop('checked')).toBe(true);
    expect($newRow.find('input[name="familynames[]"]').val()).toBe('Unknown');
    expect($newRow.find('input[name="givennames[]"]').val()).toBe('Person');
    expect($newRow.find('input[name="cpEmail[]"]').val()).toBe('unknown@example.com');
  });

  test('handles XML with no pointOfContact gracefully', () => {
    const xmlDoc = new DOMParser().parseFromString(
      `<?xml version="1.0" encoding="UTF-8"?>
       <envelope>
         <gmd:MD_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd"
                          xmlns:gco="http://www.isotc211.org/2005/gco">
           <gmd:identificationInfo>
             <gmd:MD_DataIdentification></gmd:MD_DataIdentification>
           </gmd:identificationInfo>
         </gmd:MD_Metadata>
       </envelope>`,
      'application/xml'
    );

    // Should not throw
    expect(() => mappingModule.processContactPersons(xmlDoc)).not.toThrow();

    // No row should be marked as CP
    $('div[data-creator-row]').each(function () {
      expect($(this).find('input[name="contacts[]"]').prop('checked')).toBe(false);
    });
  });

  test('skips contact persons with missing given name in fullName', () => {
    const xmlDoc = new DOMParser().parseFromString(
      `<?xml version="1.0" encoding="UTF-8"?>
       <envelope>
         <gmd:MD_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd"
                          xmlns:gco="http://www.isotc211.org/2005/gco">
           <gmd:identificationInfo>
             <gmd:MD_DataIdentification>
               <gmd:pointOfContact>
                 <gmd:CI_ResponsibleParty>
                   <gmd:individualName>
                     <gco:CharacterString>OnlyFamilyName</gco:CharacterString>
                   </gmd:individualName>
                   <gmd:contactInfo>
                     <gmd:CI_Contact>
                       <gmd:address>
                         <gmd:CI_Address>
                           <gmd:electronicMailAddress>
                             <gco:CharacterString>test@example.com</gco:CharacterString>
                           </gmd:electronicMailAddress>
                         </gmd:CI_Address>
                       </gmd:address>
                     </gmd:CI_Contact>
                   </gmd:contactInfo>
                 </gmd:CI_ResponsibleParty>
               </gmd:pointOfContact>
             </gmd:MD_DataIdentification>
           </gmd:identificationInfo>
         </gmd:MD_Metadata>
       </envelope>`,
      'application/xml'
    );

    expect(() => mappingModule.processContactPersons(xmlDoc)).not.toThrow();

    // No row should be marked since name parsing fails
    $('div[data-creator-row]').each(function () {
      expect($(this).find('input[name="contacts[]"]').prop('checked')).toBe(false);
    });
  });

  test('populates email without website when website is absent', () => {
    const xmlDoc = makeIsoXml({
      familyName: 'Doe',
      givenName: 'Jane',
      email: 'jane@example.com',
    });

    mappingModule.processContactPersons(xmlDoc);

    const $firstRow = $('div[data-creator-row]').eq(0);
    expect($firstRow.find('input[name="cpEmail[]"]').val()).toBe('jane@example.com');
    expect($firstRow.find('input[name="cpOnlineResource[]"]').val()).toBe('');
  });

  test('shows contact-person-input div when marking as CP', () => {
    const xmlDoc = makeIsoXml({
      familyName: 'Doe',
      givenName: 'Jane',
      email: 'jane@example.com',
    });

    mappingModule.processContactPersons(xmlDoc);

    const $firstRow = $('div[data-creator-row]').eq(0);
    // jQuery .show() sets display to '' (empty) which means browser default
    $firstRow.find('.contact-person-input').each(function () {
      expect($(this).css('display')).not.toBe('none');
    });
  });
});

describe('processContactPersonsFromDataCite (fallback)', () => {
  let mappingModule;
  let $;

  beforeEach(() => {
    $ = require('jquery');
    global.$ = $;
    global.jQuery = $;
    window.$ = $;
    window.jQuery = $;

    document.body.innerHTML = `
      <div id="group-author">
        <div class="row" data-creator-row>
          <input type="checkbox" id="checkbox-author-contactperson" name="contacts[]" />
          <input type="text" name="familynames[]" value="Müller" />
          <input type="text" name="givennames[]" value="Erika" />
          <div class="contact-person-input" style="display: none;">
            <input type="email" name="cpEmail[]" value="" />
          </div>
          <div class="contact-person-input" style="display: none;">
            <input type="text" name="cpOnlineResource[]" value="" />
          </div>
        </div>
        <button type="button" id="button-author-add"></button>
      </div>
    `;

    // Wire up click handler to simulate adding a new author row
    $('#button-author-add').on('click', function () {
      const $newRow = $(`
        <div class="row" data-creator-row>
          <input type="checkbox" name="contacts[]" />
          <input type="text" name="familynames[]" value="" />
          <input type="text" name="givennames[]" value="" />
          <div class="contact-person-input" style="display: none;">
            <input type="email" name="cpEmail[]" value="" />
          </div>
          <div class="contact-person-input" style="display: none;">
            <input type="text" name="cpOnlineResource[]" value="" />
          </div>
        </div>
      `);
      $('#group-author').append($newRow);
    });

    global.Tagify = jest.fn().mockImplementation(() => ({
      addTags: jest.fn(),
      settings: { whitelist: [] },
    }));
    global.translations = {};
    window.updateMapOverlay = jest.fn();

    jest.resetModules();
    mappingModule = require('../../js/mappingXmlToInputFields.js');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
    delete global.$;
    delete global.jQuery;
    delete window.$;
    delete window.jQuery;
    delete global.Tagify;
    delete global.translations;
    delete window.updateMapOverlay;
  });

  function makeDataCiteXml({ familyName, givenName }) {
    // JSDOM's XPath engine does not support default namespace resolution
    // (xmlns="..."), but works with explicit prefixed namespaces.
    // We use 'ns:' prefix matching the resolver in processContactPersonsFromDataCite.
    // E2E (Playwright) tests cover the real-world default-namespace path.
    return new DOMParser().parseFromString(
      `<?xml version="1.0" encoding="UTF-8"?>
       <ns:resource xmlns:ns="http://datacite.org/schema/kernel-4">
         <ns:contributors>
           <ns:contributor contributorType="ContactPerson">
             <ns:contributorName nameType="Personal">${familyName}, ${givenName}</ns:contributorName>
             <ns:givenName>${givenName}</ns:givenName>
             <ns:familyName>${familyName}</ns:familyName>
           </ns:contributor>
         </ns:contributors>
       </ns:resource>`,
      'application/xml'
    );
  }

  test('sets checkbox when matching author found via DataCite contributor', () => {
    const xmlDoc = makeDataCiteXml({
      familyName: 'Müller',
      givenName: 'Erika',
    });

    mappingModule.processContactPersonsFromDataCite(xmlDoc);

    const $firstRow = $('div[data-creator-row]').eq(0);
    expect($firstRow.find('input[name="contacts[]"]').prop('checked')).toBe(true);
  });

  test('shows contact-person-input when matched via DataCite', () => {
    const xmlDoc = makeDataCiteXml({
      familyName: 'Müller',
      givenName: 'Erika',
    });

    mappingModule.processContactPersonsFromDataCite(xmlDoc);

    const $firstRow = $('div[data-creator-row]').eq(0);
    $firstRow.find('.contact-person-input').each(function () {
      expect($(this).css('display')).not.toBe('none');
    });
  });

  test('does not set email or website (not available in DataCite)', () => {
    const xmlDoc = makeDataCiteXml({
      familyName: 'Müller',
      givenName: 'Erika',
    });

    mappingModule.processContactPersonsFromDataCite(xmlDoc);

    const $firstRow = $('div[data-creator-row]').eq(0);
    // Email/website should remain empty
    expect($firstRow.find('input[name="cpEmail[]"]').val()).toBe('');
    expect($firstRow.find('input[name="cpOnlineResource[]"]').val()).toBe('');
  });

  test('matches case-insensitively in DataCite fallback', () => {
    const xmlDoc = makeDataCiteXml({
      familyName: 'müller',
      givenName: 'ERIKA',
    });

    mappingModule.processContactPersonsFromDataCite(xmlDoc);

    const $firstRow = $('div[data-creator-row]').eq(0);
    expect($firstRow.find('input[name="contacts[]"]').prop('checked')).toBe(true);
  });

  test('creates new author row when no matching author found in DataCite fallback', () => {
    const xmlDoc = makeDataCiteXml({
      familyName: 'Unknown',
      givenName: 'Person',
    });

    expect(() => mappingModule.processContactPersonsFromDataCite(xmlDoc)).not.toThrow();

    // A second author row should have been created
    const $rows = $('div[data-creator-row]');
    expect($rows.length).toBe(2);

    // Original row should not be marked as CP
    expect($rows.eq(0).find('input[name="contacts[]"]').prop('checked')).toBe(false);

    // New row should be marked as CP with correct data
    const $newRow = $rows.eq(1);
    expect($newRow.find('input[name="contacts[]"]').prop('checked')).toBe(true);
    expect($newRow.find('input[name="familynames[]"]').val()).toBe('Unknown');
    expect($newRow.find('input[name="givennames[]"]').val()).toBe('Person');
  });

  test('does nothing when DataCite XML has no ContactPerson contributor', () => {
    const xmlDoc = new DOMParser().parseFromString(
      `<?xml version="1.0" encoding="UTF-8"?>
       <ns:resource xmlns:ns="http://datacite.org/schema/kernel-4">
         <ns:contributors>
           <ns:contributor contributorType="DataCollector">
             <ns:contributorName nameType="Personal">Müller, Erika</ns:contributorName>
             <ns:givenName>Erika</ns:givenName>
             <ns:familyName>Müller</ns:familyName>
           </ns:contributor>
         </ns:contributors>
       </ns:resource>`,
      'application/xml'
    );

    expect(() => mappingModule.processContactPersonsFromDataCite(xmlDoc)).not.toThrow();

    $('div[data-creator-row]').each(function () {
      expect($(this).find('input[name="contacts[]"]').prop('checked')).toBe(false);
    });
  });

  test('skips DataCite contributor when familyName is missing', () => {
    const xmlDoc = new DOMParser().parseFromString(
      `<?xml version="1.0" encoding="UTF-8"?>
       <ns:resource xmlns:ns="http://datacite.org/schema/kernel-4">
         <ns:contributors>
           <ns:contributor contributorType="ContactPerson">
             <ns:contributorName nameType="Personal">Erika</ns:contributorName>
             <ns:givenName>Erika</ns:givenName>
           </ns:contributor>
         </ns:contributors>
       </ns:resource>`,
      'application/xml'
    );

    expect(() => mappingModule.processContactPersonsFromDataCite(xmlDoc)).not.toThrow();

    $('div[data-creator-row]').each(function () {
      expect($(this).find('input[name="contacts[]"]').prop('checked')).toBe(false);
    });
  });
});

describe('processContactPersons ISO→DataCite fallback integration', () => {
  let mappingModule;
  let $;

  beforeEach(() => {
    $ = require('jquery');
    global.$ = $;
    global.jQuery = $;
    window.$ = $;
    window.jQuery = $;

    document.body.innerHTML = `
      <div id="group-author">
        <div class="row" data-creator-row>
          <input type="checkbox" id="checkbox-author-contactperson" name="contacts[]" />
          <input type="text" name="familynames[]" value="Müller" />
          <input type="text" name="givennames[]" value="Erika" />
          <div class="contact-person-input" style="display: none;">
            <input type="email" name="cpEmail[]" value="" />
          </div>
          <div class="contact-person-input" style="display: none;">
            <input type="text" name="cpOnlineResource[]" value="" />
          </div>
        </div>
      </div>
    `;

    global.Tagify = jest.fn().mockImplementation(() => ({
      addTags: jest.fn(),
      settings: { whitelist: [] },
    }));
    global.translations = {};
    window.updateMapOverlay = jest.fn();

    jest.resetModules();
    mappingModule = require('../../js/mappingXmlToInputFields.js');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
    delete global.$;
    delete global.jQuery;
    delete window.$;
    delete window.jQuery;
    delete global.Tagify;
    delete global.translations;
    delete window.updateMapOverlay;
  });

  test('falls back to DataCite when ISO has no pointOfContact', () => {
    // XML with DataCite ContactPerson but no ISO pointOfContact.
    // Uses explicit ns: prefix for JSDOM XPath compatibility.
    const xmlDoc = new DOMParser().parseFromString(
      `<?xml version="1.0" encoding="UTF-8"?>
       <envelope>
         <ns:resource xmlns:ns="http://datacite.org/schema/kernel-4">
           <ns:contributors>
             <ns:contributor contributorType="ContactPerson">
               <ns:familyName>Müller</ns:familyName>
               <ns:givenName>Erika</ns:givenName>
             </ns:contributor>
           </ns:contributors>
         </ns:resource>
         <gmd:MD_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd"
                          xmlns:gco="http://www.isotc211.org/2005/gco">
           <gmd:identificationInfo>
             <gmd:MD_DataIdentification></gmd:MD_DataIdentification>
           </gmd:identificationInfo>
         </gmd:MD_Metadata>
       </envelope>`,
      'application/xml'
    );

    mappingModule.processContactPersons(xmlDoc);

    const $firstRow = $('div[data-creator-row]').eq(0);
    expect($firstRow.find('input[name="contacts[]"]').prop('checked')).toBe(true);
  });

  test('does NOT trigger DataCite fallback when ISO has pointOfContact', () => {
    // XML with both ISO pointOfContact and DataCite ContactPerson
    // The ISO version should be used (has email)
    const xmlDoc = new DOMParser().parseFromString(
      `<?xml version="1.0" encoding="UTF-8"?>
       <envelope>
         <ns:resource xmlns:ns="http://datacite.org/schema/kernel-4">
           <ns:contributors>
             <ns:contributor contributorType="ContactPerson">
               <ns:familyName>Müller</ns:familyName>
               <ns:givenName>Erika</ns:givenName>
             </ns:contributor>
           </ns:contributors>
         </ns:resource>
         <gmd:MD_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd"
                          xmlns:gco="http://www.isotc211.org/2005/gco">
           <gmd:identificationInfo>
             <gmd:MD_DataIdentification>
               <gmd:pointOfContact>
                 <gmd:CI_ResponsibleParty>
                   <gmd:individualName>
                     <gco:CharacterString>Müller, Erika</gco:CharacterString>
                   </gmd:individualName>
                   <gmd:contactInfo>
                     <gmd:CI_Contact>
                       <gmd:address>
                         <gmd:CI_Address>
                           <gmd:electronicMailAddress>
                             <gco:CharacterString>erika@example.com</gco:CharacterString>
                           </gmd:electronicMailAddress>
                         </gmd:CI_Address>
                       </gmd:address>
                     </gmd:CI_Contact>
                   </gmd:contactInfo>
                 </gmd:CI_ResponsibleParty>
               </gmd:pointOfContact>
             </gmd:MD_DataIdentification>
           </gmd:identificationInfo>
         </gmd:MD_Metadata>
       </envelope>`,
      'application/xml'
    );

    mappingModule.processContactPersons(xmlDoc);

    const $firstRow = $('div[data-creator-row]').eq(0);
    expect($firstRow.find('input[name="contacts[]"]').prop('checked')).toBe(true);
    // Email should come from ISO, confirming ISO was used (not DataCite fallback)
    expect($firstRow.find('input[name="cpEmail[]"]').val()).toBe('erika@example.com');
  });
});
