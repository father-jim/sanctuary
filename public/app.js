import { buildLetter, mailtoUrl, responseDays } from './letter.js';

const $ = (id) => document.getElementById(id);
const els = {
  form: $('scan-form'), email: $('email'), owns: $('owns'), scanButton: $('scan-button'), error: $('form-error'),
  pickerList: $('picker-list'), pickerCount: $('picker-count'),
  results: $('results'), progressText: $('progress-text'), progressBar: $('progress-bar'),
  foundCount: $('found-count'), foundList: $('found-list'), foundEmpty: $('found-empty'),
  unknownSection: $('unknown-section'), unknownCount: $('unknown-count'), unknownList: $('unknown-list'),
  retryButton: $('retry-button'),
  clearSection: $('clear-section'), clearCount: $('clear-count'), clearList: $('clear-list'),
  dialog: $('request-dialog'), requestTitle: $('request-title'), requestLaw: $('request-law'),
  requestName: $('request-name'), requestSubject: $('request-subject'), requestBody: $('request-body'),
  requestChannel: $('request-channel'), requestCopy: $('request-copy'), requestSend: $('request-send'),
  cardTemplate: $('card-template'),
};

let services = [];
let serviceById = new Map();
/** State for the email currently shown: { results: {id: result}, progress: {id: {state, at, law}} } */
let state = { results: {}, progress: {} };
let storageKey = null;
let scanning = false;

//