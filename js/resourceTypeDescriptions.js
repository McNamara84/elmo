/** Local definitions used when ERNIE does not provide a description. */
const RESOURCE_TYPE_FALLBACKS = Object.freeze({
  audiovisual: 'A sequence of visual representations that creates the impression of motion; sound may be included.',
  award: 'Support or recognition provided to a person or organization for research, training, or academic work.',
  book: 'A bound or digital work made up of multiple pages of writing or images.',
  bookchapter: 'A distinct section of a book.',
  collection: 'An aggregation of resources described as a group; its parts may also be described separately.',
  computationalnotebook: 'A virtual notebook environment used for literate programming.',
  conferencepaper: 'A paper written for presentation or acceptance at a conference.',
  conferenceproceeding: 'A published collection of papers from an academic conference.',
  datapaper: 'A publication focused on identifying and describing data so that others can find and reuse it.',
  dataset: 'Data encoded in a defined structure.',
  dissertation: 'An extended academic thesis or treatise submitted for a degree.',
  event: 'A time-based occurrence that is not persistent.',
  image: 'A visual representation such as a photograph, drawing, or digital image.',
  instrument: 'A physical device or tool used to obtain, measure, or analyze data.',
  interactiveresource: 'A resource that requires user interaction to be understood, executed, or experienced.',
  journal: 'A scholarly publication issued regularly as a collection of articles.',
  journalarticle: 'An individual written article published as part of a journal.',
  model: 'A conceptual, mathematical, graphical, or visual representation of a phenomenon or process.',
  other: 'Use this category when no more specific resource type applies.',
  outputmanagementplan: 'A document describing how research outputs will be handled during and after a project.',
  peerreview: 'An evaluation of scholarly or professional work by experts in the same field.',
  physicalobject: 'A material object or substance, such as a specimen or sample.',
  poster: 'A display poster with text, figures, or tables presenting research results or hypotheses.',
  preprint: 'A scholarly paper shared before formal peer review or journal publication.',
  presentation: 'A set of slides designed to communicate ideas or research results to an audience.',
  project: 'A planned activity with a defined aim and resources, often involving collaborators.',
  report: 'A document presenting organized information for a particular audience or purpose.',
  service: 'An organized system that provides a function to its users.',
  software: 'A computer program in source or compiled form that supports scholarly research; use ComputationalNotebook for virtual notebooks.',
  sound: 'A resource primarily intended to be heard, such as an audio recording.',
  standard: 'An established model, reference, or specification accepted by an authority or community.',
  studyregistration: 'A time-stamped research plan shared before the study is carried out.',
  text: 'A resource consisting primarily of words for reading that fits no more specific textual type.',
  workflow: 'A defined sequence of executable steps that produces an outcome reproducibly.'
});

/**
 * Prefer ERNIE's definition and use a local definition when it is empty.
 * @param {string} name Visible resource type name.
 * @param {string} ernieDescription Definition supplied by ERNIE.
 * @returns {string} Text for the option tooltip and help dialog.
 */
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
