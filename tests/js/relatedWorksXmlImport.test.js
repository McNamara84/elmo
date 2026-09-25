const { requireFresh } = require('./utils');

describe('Related Works XML import', () => {
  let mapping;
  let originalFetch;
  let originalXSLTProcessor;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalXSLTProcessor = global.XSLTProcessor;
    document.body.innerHTML = `
      <form id="form-mde">
        <div data-related-work-formgroup>
          <input type="hidden" name="relatedWorksPayload" value="[]">
          <div data-related-work-stack></div>
        </div>
      </form>
    `;
    window.elmo = {};
    window.ELMO_FEATURES = {};
    window.loadClearInputFields = () => Promise.resolve(() => {});
    mapping = requireFresh('../../js/mappingXmlToInputFields.js');
    mapping.resetRelatedWorksXsltCache();
  });

  afterEach(() => {
    mapping.resetRelatedWorksXsltCache();
    delete window.relatedWorkStack;
    delete window.usedInstrumentsModule;
    delete window.ELMO_FEATURES;
    delete window.elmo;
    if (originalXSLTProcessor === undefined) {
      delete global.XSLTProcessor;
    } else {
      global.XSLTProcessor = originalXSLTProcessor;
    }
    if (originalFetch === undefined) {
      delete global.fetch;
    } else {
      global.fetch = originalFetch;
    }
  });

  test('parses the namespace-free internal map into stack entries', () => {
    const transformedDocument = new DOMParser().parseFromString(`
      <RelatedWorks>
        <RelatedWork>
          <Identifier> 10.1234/one </Identifier>
          <Relation><name>IsReferencedBy</name></Relation>
          <IdentifierType><name>DOI</name></IdentifierType>
        </RelatedWork>
        <RelatedWork>
          <Identifier>https://example.org/two</Identifier>
          <Relation><name>IsDocumentedBy</name></Relation>
          <IdentifierType><name>URL</name></IdentifierType>
        </RelatedWork>
      </RelatedWorks>
    `, 'application/xml');

    expect(mapping.parseRelatedWorksMap(transformedDocument)).toEqual([
      {
        identifier: '10.1234/one',
        relation: 'IsReferencedBy',
        relationId: '',
        identifierType: 'DOI'
      },
      {
        identifier: 'https://example.org/two',
        relation: 'IsDocumentedBy',
        relationId: '',
        identifierType: 'URL'
      }
    ]);
  });

  test('loads the stylesheet once and passes the Used Instruments filter parameter', async () => {
    const stylesheetSource = `
      <xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"></xsl:stylesheet>
    `;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(stylesheetSource)
    });
    const transformedDocument = new DOMParser().parseFromString(
      '<RelatedWorks></RelatedWorks>',
      'application/xml'
    );
    const processorInstances = [];
    global.XSLTProcessor = jest.fn(function () {
      this.importStylesheet = jest.fn();
      this.setParameter = jest.fn();
      this.transformToDocument = jest.fn().mockReturnValue(transformedDocument);
      processorInstances.push(this);
    });
    const sourceDocument = new DOMParser().parseFromString(
      '<resource xmlns="http://datacite.org/schema/kernel-4"/>',
      'application/xml'
    );

    await mapping.transformRelatedWorksDocument(sourceDocument, { excludeIsCollectedBy: true });
    await mapping.transformRelatedWorksDocument(sourceDocument, { excludeIsCollectedBy: false });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'schemas/XSLT/MappingDataCiteRelatedWorksToMap.xslt',
      { credentials: 'same-origin' }
    );
    expect(processorInstances[0].setParameter)
      .toHaveBeenCalledWith(null, 'excludeIsCollectedBy', 'true');
    expect(processorInstances[1].setParameter)
      .toHaveBeenCalledWith(null, 'excludeIsCollectedBy', 'false');
  });

  test('fails clearly when the browser has no XSLT support', async () => {
    delete global.XSLTProcessor;
    const sourceDocument = new DOMParser().parseFromString('<resource/>', 'application/xml');

    await expect(mapping.transformRelatedWorksDocument(sourceDocument))
      .rejects.toThrow('does not support the Related Works XSLT import');
  });

  test('transforms before sending one ordered bulk update to the stack', async () => {
    const sourceDocument = new DOMParser().parseFromString(
      '<resource xmlns="http://datacite.org/schema/kernel-4"/>',
      'application/xml'
    );
    const transformedDocument = new DOMParser().parseFromString(`
      <RelatedWorks>
        <RelatedWork>
          <Identifier>10.1234/one</Identifier>
          <Relation><name>IsReferencedBy</name></Relation>
          <IdentifierType><name>DOI</name></IdentifierType>
        </RelatedWork>
        <RelatedWork>
          <Identifier>10.1234/two</Identifier>
          <Relation><name>IsDocumentedBy</name></Relation>
          <IdentifierType><name>DOI</name></IdentifierType>
        </RelatedWork>
      </RelatedWorks>
    `, 'application/xml');
    const transform = jest.fn().mockResolvedValue(transformedDocument);
    const onProgress = jest.fn();
    window.ELMO_FEATURES.showUsedInstruments = true;
    window.relatedWorkStack = {
      setRelatedWorks: jest.fn().mockResolvedValue([])
    };

    const entries = await mapping.processRelatedWorks(sourceDocument, jest.fn(), {
      transformRelatedWorksDocument: transform,
      onProgress,
      batchSize: 25
    });

    expect(transform).toHaveBeenCalledWith(sourceDocument, { excludeIsCollectedBy: true });
    expect(entries.map((entry) => entry.identifier)).toEqual(['10.1234/one', '10.1234/two']);
    expect(window.relatedWorkStack.setRelatedWorks).toHaveBeenCalledTimes(1);
    expect(window.relatedWorkStack.setRelatedWorks).toHaveBeenCalledWith(
      entries,
      expect.objectContaining({ bulk: true, batchSize: 25, onProgress })
    );
  });

  test('clears the Related Works stack if batched card rendering fails', async () => {
    const sourceDocument = new DOMParser().parseFromString('<resource/>', 'application/xml');
    const transformedDocument = new DOMParser().parseFromString(`
      <RelatedWorks>
        <RelatedWork>
          <Identifier>10.1234/fails</Identifier>
          <Relation><name>Cites</name></Relation>
          <IdentifierType><name>DOI</name></IdentifierType>
        </RelatedWork>
      </RelatedWorks>
    `, 'application/xml');
    window.relatedWorkStack = {
      setRelatedWorks: jest.fn()
        .mockRejectedValueOnce(new Error('Card rendering failed'))
        .mockReturnValueOnce([])
    };

    await expect(mapping.processRelatedWorks(sourceDocument, jest.fn(), {
      transformRelatedWorksDocument: jest.fn().mockResolvedValue(transformedDocument)
    })).rejects.toThrow('Could not render Related Works');

    expect(window.relatedWorkStack.setRelatedWorks).toHaveBeenLastCalledWith([]);
  });

  test('does not create partial cards when the XSLT transformation fails', async () => {
    const sourceDocument = new DOMParser().parseFromString('<resource/>', 'application/xml');
    window.relatedWorkStack = { setRelatedWorks: jest.fn() };

    await expect(mapping.processRelatedWorks(sourceDocument, jest.fn(), {
      transformRelatedWorksDocument: jest.fn().mockRejectedValue(new Error('Invalid transform'))
    })).rejects.toThrow('Invalid transform');

    expect(window.relatedWorkStack.setRelatedWorks).not.toHaveBeenCalled();
  });

  test('keeps namespace-free IsCollectedBy identifiers in the Used Instruments path', async () => {
    window.ELMO_FEATURES.showUsedInstruments = true;
    window.usedInstrumentsModule = {
      addInstrumentsByPid: jest.fn(),
      loadInstrumentsFromAPI: jest.fn().mockResolvedValue({ dataLoaded: false }),
      upgradeInstrumentTags: jest.fn()
    };
    const sourceDocument = new DOMParser().parseFromString(`
      <resource>
        <relatedIdentifiers>
          <relatedIdentifier relatedIdentifierType="Handle" relationType="IsCollectedBy">
            21.11157/instrument
          </relatedIdentifier>
        </relatedIdentifiers>
      </resource>
    `, 'application/xml');
    const resolver = (prefix) => prefix === 'ns'
      ? 'http://datacite.org/schema/kernel-4'
      : null;

    mapping.processUsedInstruments(sourceDocument, resolver);
    await Promise.resolve();

    expect(window.usedInstrumentsModule.addInstrumentsByPid).toHaveBeenCalledWith([
      { pid: '21.11157/instrument', pidType: 'Handle' }
    ]);
    expect(window.usedInstrumentsModule.upgradeInstrumentTags).not.toHaveBeenCalled();

    delete window.usedInstrumentsModule;
  });

  test('skips the transformation when the Related Works feature is disabled', async () => {
    document.body.innerHTML = '<form id="form-mde"></form>';
    const transform = jest.fn();

    await expect(mapping.processRelatedWorks(
      new DOMParser().parseFromString('<resource/>', 'application/xml'),
      jest.fn(),
      { transformRelatedWorksDocument: transform }
    )).resolves.toEqual([]);

    expect(transform).not.toHaveBeenCalled();
  });
});
