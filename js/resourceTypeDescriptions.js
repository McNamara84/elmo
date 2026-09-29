/** Local definitions used when ERNIE does not provide a description. */
const RESOURCE_TYPE_FALLBACKS = Object.freeze({
  audiovisual: 'A sequence of visual representations that creates the impression of motion; sound may be included.',
  collection: 'An aggregation of resources described as a group; its parts may also be described separately.',
  computationalnotebook: 'A virtual notebook environment used for literate programming.',
  dataset: 'Data encoded in a defined structure.',
  event: 'A time-based occurrence that is not persistent.',
  interactiveresource: 'A resource that requires user interaction to be understood, executed, or experienced.',
  other: 'Use this category when no more specific resource type applies.',
  poster: 'A display poster with text, figures, or tables presenting research results or hypotheses.',
  presentation: 'A set of slides designed to communicate ideas or research results to an audience.',
  software: 'A computer program in source or compiled form that supports scholarly research; use ComputationalNotebook for virtual notebooks.',
  text: 'A resource consisting primarily of words for reading that fits no more specific textual type.'
});

function getResourceTypeDescription(name, ernieDescription) {
  const provided = String(ernieDescription || '').trim();
  if (provided) return provided;
  const key = String(name || '').toLowerCase().replace(/[\s_-]+/g, '');
  return RESOURCE_TYPE_FALLBACKS[key] || 'No definition is currently available for this resource type.';
}

if (typeof window !== 'undefined') {
  window.resourceTypeDescriptions = { getResourceTypeDescription };
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getResourceTypeDescription, RESOURCE_TYPE_FALLBACKS };
}
