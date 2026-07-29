const fs = require('fs');
const path = require('path');

const RESOURCE_TYPE_SCHEMA_PATH = path.resolve(
  __dirname,
  '../../../schemas/DataCite/include/datacite-resourceType-v4.xsd'
);

function getDataCite47ResourceTypes() {
  const schema = fs.readFileSync(RESOURCE_TYPE_SCHEMA_PATH, 'utf8');
  return Array.from(schema.matchAll(/<xs:enumeration value="([^"]+)"\s*\/>/g), match => match[1]);
}

function toSpacedResourceTypeLabel(resourceTypeGeneral) {
  return resourceTypeGeneral.replace(/([a-z])([A-Z])/g, '$1 $2');
}

module.exports = {
  getDataCite47ResourceTypes,
  toSpacedResourceTypeLabel,
};
