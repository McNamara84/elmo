<?php

/*
 * The MIT License
 *
 * Copyright 2019 Mateusz Żółtak.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

namespace zozlak;

/**
 * Just a container for RDF and XSD related constants
 *
 * @author zozlak
 */
class RdfConstants {

    const NMSP_DC                            = 'http://purl.org/dc/elements/1.1/';
    const NMSP_DCT                           = 'http://purl.org/dc/terms/';
    const NMSP_FOAF                          = 'http://xmlns.com/foaf/0.1/';
    const NMSP_OWL                           = 'http://www.w3.org/2002/07/owl#';
    const NMSP_RDF                           = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
    const NMSP_RDFS                          = 'http://www.w3.org/2000/01/rdf-schema#';
    const NMSP_SKOS                          = 'http://www.w3.org/2004/02/skos/core#';
    const NMSP_XML                           = 'http://www.w3.org/XML/1998/namespace';
    const NMSP_XSD                           = 'http://www.w3.org/2001/XMLSchema#';
    const RDF_ALT                            = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Alt';
    const RDF_BAG                            = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Bag';
    const RDF_FIRST                          = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first';
    const RDF_HTML                           = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#HTML';
    const RDF_LANG_STRING                    = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString';
    const RDF_LIST                           = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#List';
    const RDF_NIL                            = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil';
    const RDF_OBJECT                         = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#object';
    const RDF_PREDICATE                      = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#predicate';
    const RDF_PROPERTY                       = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property';
    const RDF_REST                           = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest';
    const RDF_SEQ                            = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Seq';
    const RDF_STATEMENT                      = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Statement';
    const RDF_SUBJECT                        = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#subject';
    const RDF_VALUE                          = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#value';
    const RDF_TYPE                           = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
    const RDF_XML_LITERAL                    = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#XMLLiteral';
    const RDFS_CLASS                         = 'http://www.w3.org/2000/01/rdf-schema#Class';
    const RDFS_DATATYPE                      = 'http://www.w3.org/2000/01/rdf-schema#Datatype';
    const RDFS_COMMENT                       = 'http://www.w3.org/2000/01/rdf-schema#comment';
    const RDFS_CONTAINER                     = 'http://www.w3.org/2000/01/rdf-schema#Container';
    const RDFS_CONTAINER_MEMBERSHIP_PROPERTY = 'http://www.w3.org/2000/01/rdf-schema#ContainerMembershipProperty';
    const RDFS_DOMAIN                        = 'http://www.w3.org/2000/01/rdf-schema#domain';
    const RDFS_IS_DEFINED_BY                 = 'http://www.w3.org/2000/01/rdf-schema#isDefinedBy';
    const RDFS_LABEL                         = 'http://www.w3.org/2000/01/rdf-schema#label';
    const RDFS_LITERAL                       = 'http://www.w3.org/2000/01/rdf-schema#Literal    ';
    const RDFS_MEMBER                        = 'http://www.w3.org/2000/01/rdf-schema#member';
    const RDFS_RANGE                         = 'http://www.w3.org/2000/01/rdf-schema#range';
    const RDFS_RESOURCE                      = 'http://www.w3.org/2000/01/rdf-schema#Resource';
    const RDFS_SEE_ALSO                      = 'http://www.w3.org/2000/01/rdf-schema#seeAlso';
    const RDFS_SUB_CLASS_OF                  = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';
    const RDFS_SUB_PROPERTY_OF               = 'http://www.w3.org/2000/01/rdf-schema#subPropertyOf';
    const OWL_ALL_DIFFERENT                  = 'http://www.w3.org/2002/07/owl#allDifferent';
    const OWL_ALL_DISJOINT_CLASSES           = 'http://www.w3.org/2002/07/owl#allDisjointClasses';
    const OWL_ALL_DISJOINT_PROPERTIES        = 'http://www.w3.org/2002/07/owl#allDisjointProperties';
    const OWL_ALL_VALUES_FROM                = 'http://www.w3.org/2002/07/owl#allValuesFrom';
    const OWL_ANNOTATION_PROPERTY            = 'http://www.w3.org/2002/07/owl#AnnotationProperty';
    const OWL_ASSERTION_PROPERTY             = 'http://www.w3.org/2002/07/owl#assertionProperty';
    const OWL_ASSYMETRIC_PROPERTY            = 'http://www.w3.org/2002/07/owl#AssymetricProperty';
    const OWL_CARDINALITY                    = 'http://www.w3.org/2002/07/owl#cardinality';
    const OWL_CLASS                          = 'http://www.w3.org/2002/07/owl#Class';
    const OWL_COMPLEMENT_OF                  = 'http://www.w3.org/2002/07/owl#complementOf';
    const OWL_DATATYPE_COMPLEMENT_OF         = 'http://www.w3.org/2002/07/owl#datatypeComplementOf';
    const OWL_DATATYPE_PROPERTY              = 'http://www.w3.org/2002/07/owl#DatatypeProperty';
    const OWL_DIFFERENT_FROM                 = 'http://www.w3.org/2002/07/owl#differentFrom';
    const OWL_DISJOINT_UNION_OF              = 'http://www.w3.org/2002/07/owl#disjointUnionOf';
    const OWL_DISJOINT_WITH                  = 'http://www.w3.org/2002/07/owl#disjointWith';
    const OWL_EQUIVALENT_CLASS               = 'http://www.w3.org/2002/07/owl#equivalentClass';
    const OWL_EQUIVALENT_PROPERTY            = 'http://www.w3.org/2002/07/owl#equivalentProperty';
    const OWL_FUNCTIONAL_PROPERTY            = 'http://www.w3.org/2002/07/owl#FunctionalProperty';
    const OWL_HAS_KEY                        = 'http://www.w3.org/2002/07/owl#hasKey';
    const OWL_HAS_SELF                       = 'http://www.w3.org/2002/07/owl#hasSelf';
    const OWL_HAS_VALUE                      = 'http://www.w3.org/2002/07/owl#hasValue';
    const OWL_IMPORTS                        = 'http://www.w3.org/2002/07/owl#imports';
    const OWL_INTERSECTION_OF                = 'http://www.w3.org/2002/07/owl#intersectionOf';
    const OWL_INVERSE_FUNCTIONAL_PROPERTY    = 'http://www.w3.org/2002/07/owl#InverseFunctionalProperty';
    const OWL_INVERSE_OF                     = 'http://www.w3.org/2002/07/owl#inverseOf';
    const OWL_IRREFLEXIVE_PROPERTY           = 'http://www.w3.org/2002/07/owl#IrreflexiveProperty';
    const OWL_MEMBERS                        = 'http://www.w3.org/2002/07/owl#members';
    const OWL_MIN_CARDINALITY                = 'http://www.w3.org/2002/07/owl#minCardinality';
    const OWL_MIN_QUALIFIED_CARDINALITY      = 'http://www.w3.org/2002/07/owl#minQualifiedCardinality';
    const OWL_MAX_CARDINALITY                = 'http://www.w3.org/2002/07/owl#maxCardinality';
    const OWL_MAX_QUALIFIED_CARDINALITY      = 'http://www.w3.org/2002/07/owl#maxQualifiedCardinality';
    const OWL_NAMED_INDIVIDUAL               = 'http://www.w3.org/2002/07/owl#NamedIndividual';
    const OWL_NEGATIVE_PROPERTY_ASSERTION    = 'http://www.w3.org/2002/07/owl#NegativePropertyAssertion';
    const OWL_OBJECT_PROPERTY                = 'http://www.w3.org/2002/07/owl#ObjectProperty';
    const OWL_ON_CLASS                       = 'http://www.w3.org/2002/07/owl#onClass';
    const OWL_ON_DATATYPE                    = 'http://www.w3.org/2002/07/owl#onDatatype';
    const OWL_ON_DATA_RANGE                  = 'http://www.w3.org/2002/07/owl#onDataRange';
    const OWL_ON_PROPERTY                    = 'http://www.w3.org/2002/07/owl#onProperty';
    const OWL_ONE_OF                         = 'http://www.w3.org/2002/07/owl#oneOf';
    const OWL_ONTOLOGY                       = 'http://www.w3.org/2002/07/owl#Ontology';
    const OWL_PROPERTY_CHAIN_AXIOM           = 'http://www.w3.org/2002/07/owl#propertyChainAxiom';
    const OWL_PROPERTY_DISJOINT_WITH         = 'http://www.w3.org/2002/07/owl#propertyDisjointWith';
    const OWL_QUALIFIED_CARDINALITY          = 'http://www.w3.org/2002/07/owl#qualifiedCardinality';
    const OWL_REFLEXIVE_PROPERTY             = 'http://www.w3.org/2002/07/owl#ReflexiveProperty';
    const OWL_RESTRICTION                    = 'http://www.w3.org/2002/07/owl#Restriction';
    const OWL_SAME_AS                        = 'http://www.w3.org/2002/07/owl#sameAs';
    const OWL_SOME_VALUES_FROM               = 'http://www.w3.org/2002/07/owl#someValuesFrom';
    const OWL_SOURCE_INDIVIDUAL              = 'http://www.w3.org/2002/07/owl#sourceIndividual';
    const OWL_SUB_PROPERTY_OF                = 'http://www.w3.org/2002/07/owl#subPropertyOf';
    const OWL_SYMMETRIC_PROPERTY             = 'http://www.w3.org/2002/07/owl#SymmetricProperty';
    const OWL_TARGET_INDIVIDUAL              = 'http://www.w3.org/2002/07/owl#targetIndividual';
    const OWL_THING                          = 'http://www.w3.org/2002/07/owl#Thing';
    const OWL_TRANSITIVE_PROPERTY            = 'http://www.w3.org/2002/07/owl#TransitiveProperty';
    const OWL_UNION_OF                       = 'http://www.w3.org/2002/07/owl#unionOf';
    const OWL_WITH_RESTRICTIONS              = 'http://www.w3.org/2002/07/owl#withRestrictions';
    const SKOS_ALT_LABEL                     = 'http://www.w3.org/2004/02/skos/core#altLabel';
    const SKOS_BROADER                       = 'http://www.w3.org/2004/02/skos/core#broader';
    const SKOS_COLLECTION                    = 'http://www.w3.org/2004/02/skos/core#Collection';
    const SKOS_CONCEPT                       = 'http://www.w3.org/2004/02/skos/core#Concept';
    const SKOS_CONCEPT_SCHEMA                = 'http://www.w3.org/2004/02/skos/core#ConceptScheme';
    const SKOS_BROAD_MATCH                   = 'http://www.w3.org/2004/02/skos/core#broadMatch';
    const SKOS_BROADER_TRANSITIVE            = 'http://www.w3.org/2004/02/skos/core#broaderTransitive';
    const SKOS_CHANGE_NOTE                   = 'http://www.w3.org/2004/02/skos/core#changeNote';
    const SKOS_CLOSE_MATCH                   = 'http://www.w3.org/2004/02/skos/core#closeMatch';
    const SKOS_DEFINITION                    = 'http://www.w3.org/2004/02/skos/core#definition';
    const SKOS_EDITORIAL_NOTE                = 'http://www.w3.org/2004/02/skos/core#editorialNote';
    const SKOS_EXACT_MATCH                   = 'http://www.w3.org/2004/02/skos/core#exactMatch';
    const SKOS_EXAMPLE                       = 'http://www.w3.org/2004/02/skos/core#example';
    const SKOS_HAS_TOP_CONCEPT               = 'http://www.w3.org/2004/02/skos/core#hasTopConcept';
    const SKOS_HIDDEN_LABEL                  = 'http://www.w3.org/2004/02/skos/core#hiddenLabel';
    const SKOS_HISTORY_NOTE                  = 'http://www.w3.org/2004/02/skos/core#historyNote';
    const SKOS_IN_SCHEME                     = 'http://www.w3.org/2004/02/skos/core#inScheme';
    const SKOS_MAPPING_RELATION              = 'http://www.w3.org/2004/02/skos/core#mappingRelation';
    const SKOS_MEMBER                        = 'http://www.w3.org/2004/02/skos/core#member';
    const SKOS_MEMBER_LIST                   = 'http://www.w3.org/2004/02/skos/core#memberList';
    const SKOS_NARROW_MATCH                  = 'http://www.w3.org/2004/02/skos/core#narrowMatch';
    const SKOS_NARROWER                      = 'http://www.w3.org/2004/02/skos/core#narrower';
    const SKOS_NARROWER_TRANSITIVE           = 'http://www.w3.org/2004/02/skos/core#narrowerTransitive';
    const SKOS_NOTATION                      = 'http://www.w3.org/2004/02/skos/core#notation';
    const SKOS_NOTE                          = 'http://www.w3.org/2004/02/skos/core#note';
    const SKOS_ORDERED_COLLECTION            = 'http://www.w3.org/2004/02/skos/core#OrderedCollection';
    const SKOS_PREF_LABEL                    = 'http://www.w3.org/2004/02/skos/core#prefLabel';
    const SKOS_RELATED                       = 'http://www.w3.org/2004/02/skos/core#related';
    const SKOS_RELATED_MATCH                 = 'http://www.w3.org/2004/02/skos/core#relatedMatch';
    const SKOS_SCOPE_NOTE                    = 'http://www.w3.org/2004/02/skos/core#scopeNote';
    const SKOS_SEMANTIC_RELATION             = 'http://www.w3.org/2004/02/skos/core#semanticRelation';
    const SKOS_TOP_CONCEPT_OF                = 'http://www.w3.org/2004/02/skos/core#topConceptOf';
    const XSD_ANY_URI                        = 'http://www.w3.org/2001/XMLSchema#anyURI';
    const XSD_BASE64_BINARY                  = 'http://www.w3.org/2001/XMLSchema#base64Binary';
    const XSD_BOOLEAN                        = 'http://www.w3.org/2001/XMLSchema#boolean';
    const XSD_BYTE                           = 'http://www.w3.org/2001/XMLSchema#byte';
    const XSD_DATE                           = 'http://www.w3.org/2001/XMLSchema#date';
    const XSD_DATE_TIME                      = 'http://www.w3.org/2001/XMLSchema#dateTime';
    const XSD_DECIMAL                        = 'http://www.w3.org/2001/XMLSchema#decimal';
    const XSD_DOUBLE                         = 'http://www.w3.org/2001/XMLSchema#double';
    const XSD_DURATION                       = 'http://www.w3.org/2001/XMLSchema#duration';
    const XSD_ENTITY                         = 'http://www.w3.org/2001/XMLSchema#ENTITY';
    const XSD_ENTITIES                       = 'http://www.w3.org/2001/XMLSchema#ENTITIES';
    const XSD_FLOAT                          = 'http://www.w3.org/2001/XMLSchema#float';
    const XSD_G_DAY                          = 'http://www.w3.org/2001/XMLSchema#gDay';
    const XSD_G_MONTH                        = 'http://www.w3.org/2001/XMLSchema#gMonth';
    const XSD_G_MONTH_DAY                    = 'http://www.w3.org/2001/XMLSchema#gMonthDay';
    const XSD_G_YEAR                         = 'http://www.w3.org/2001/XMLSchema#gYear';
    const XSD_G_YEAR_MONTH                   = 'http://www.w3.org/2001/XMLSchema#gYearMonth';
    const XSD_HEX_BINARY                     = 'http://www.w3.org/2001/XMLSchema#hexBinary';
    const XSD_ID                             = 'http://www.w3.org/2001/XMLSchema#ID';
    const XSD_IDREF                          = 'http://www.w3.org/2001/XMLSchema#IDREF';
    const XSD_IDREFS                         = 'http://www.w3.org/2001/XMLSchema#IDREFS';
    const XSD_INT                            = 'http://www.w3.org/2001/XMLSchema#int';
    const XSD_INTEGER                        = 'http://www.w3.org/2001/XMLSchema#integer';
    const XSD_LANGUAGE                       = 'http://www.w3.org/2001/XMLSchema#language';
    const XSD_LONG                           = 'http://www.w3.org/2001/XMLSchema#long';
    const XSD_NAME                           = 'http://www.w3.org/2001/XMLSchema#Name';
    const XSD_NC_NAME                        = 'http://www.w3.org/2001/XMLSchema#NCName';
    const XSD_NM_TOKEN                       = 'http://www.w3.org/2001/XMLSchema#NMTOKEN';
    const XSD_NM_TOKENS                      = 'http://www.w3.org/2001/XMLSchema#NMTOKENS';
    const XSD_NEGATIVE_INTEGER               = 'http://www.w3.org/2001/XMLSchema#negativeInteger';
    const XSD_NON_NEGATIVE_INTEGER           = 'http://www.w3.org/2001/XMLSchema#nonNegativeInteger';
    const XSD_NON_POSITIVE_INTEGER           = 'http://www.w3.org/2001/XMLSchema#nonPositiveInteger';
    const XSD_NORMALIZED_STRING              = 'http://www.w3.org/2001/XMLSchema#normalizedString';
    const XSD_NOTATION                       = 'http://www.w3.org/2001/XMLSchema#NOTATION';
    const XSD_POSITIVE_INTEGER               = 'http://www.w3.org/2001/XMLSchema#positiveInteger';
    const XSD_QNAME                          = 'http://www.w3.org/2001/XMLSchema#QName';
    const XSD_SHORT                          = 'http://www.w3.org/2001/XMLSchema#short';
    const XSD_STRING                         = 'http://www.w3.org/2001/XMLSchema#string';
    const XSD_TIME                           = 'http://www.w3.org/2001/XMLSchema#time';
    const XSD_TOKEN                          = 'http://www.w3.org/2001/XMLSchema#token';
    const XSD_UNSIGNED_BYTE                  = 'http://www.w3.org/2001/XMLSchema#unsignedByte';
    const XSD_UNSIGNED_INT                   = 'http://www.w3.org/2001/XMLSchema#unsignedInt';
    const XSD_UNSIGNED_LONG                  = 'http://www.w3.org/2001/XMLSchema#unsignedLong';
    const XSD_UNSIGNED_SHORT                 = 'http://www.w3.org/2001/XMLSchema#unsignedShort';
}
