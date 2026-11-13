const test = require('node:test');
const assert = require('node:assert/strict');
const { Element, harness } = require('./helpers/ui-harness.cjs');

function errorsApi() {
  const h = harness();
  h.load('chat/errors.js');
  return { ...h, errors: h.nc.errors };
}

test('missing provider error becomes Polish and offers model setup', () => {
  const { errors } = errorsApi();
  const info = errors.describe('no active AI provider');
  assert.match(info.text, /Nie wybrano modelu AI/);
  assert.equal(info.action, 'providers');
  assert.equal(info.detail, 'no active AI provider');
});

test('provider auth and rate limit errors are translated', () => {
  const { errors } = errorsApi();
  assert.match(errors.describe('openai: 401 Unauthorized: invalid_api_key').text, /klucz API/);
  assert.match(errors.describe('HTTP 429 Too Many Requests').text, /limit zapytań/);
});

test('unknown errors keep the original text without a fake detail', () => {
  const { errors } = errorsApi();
  assert.deepEqual({ ...errors.describe('Plik jest zablokowany') }, { text: 'Plik jest zablokowany', detail: '', action: '' });
});

test('decorated error row is an alert with an action button and raw detail', () => {
  const { errors } = errorsApi();
  const row = new Element();
  const span = new Element('span');
  row.querySelector = selector => (selector === 'span' ? span : null);
  errors.decorate(row, 'no active AI provider');
  assert.equal(row.getAttribute('role'), 'alert');
  assert.equal(row.classList.contains('error'), true);
  assert.match(span.textContent, /Nie wybrano modelu AI/);
  const button = row.children.find(child => child.tag === 'button');
  assert.equal(button?.textContent, 'Skonfiguruj model');
  assert.match(row.children.find(child => child.tag === 'small')?.textContent || '', /no active AI provider/);
});

async function appWithHealth(health) {
  const h = harness();
  const data = async url => {
    if (url === '/api/health') return health;
    if (url.startsWith('/api/sessions')) return [];
    if (url === '/api/tasks') return [];
    if (url === '/api/goal') return null;
    return null;
  };
  h.context.fetch = async url => ({ ok: true, status: 200, text: async () => JSON.stringify(await data(url)), json: async () => data(url) });
  h.window.SuperCliUI = {
    requestJSON: data,
    createComposerDraftStore: () => ({ scope: () => '', load() {}, clear() {}, restore() {} }),
    normalizeFileChanges: () => [], mutationKind: () => '',
    readSSE: async () => {},
  };
  h.nc.chat = { createMessage: () => new Element(), createActivity: () => new Element() };
  h.load('core/app.js');
  await h.flush();
  return h;
}

test('engine without a model is shown as setup needed, not online', async () => {
  const h = await appWithHealth({ home: '/synthetic', model: 'no model' });
  assert.equal(h.element('#model-label').textContent, 'Brak modelu AI');
  assert.equal(h.element('#status-dot').classList.contains('warning'), true);
  assert.equal(h.element('#status-dot').classList.contains('online'), false);
});

test('engine with a model is online', async () => {
  const h = await appWithHealth({ home: '/synthetic', model: 'gpt-test' });
  assert.equal(h.element('#model-label').textContent, 'gpt-test');
  assert.equal(h.element('#status-dot').classList.contains('online'), true);
});

test('empty history hides the destructive clear button', async () => {
  const h = await appWithHealth({ home: '/synthetic', model: 'gpt-test' });
  assert.equal(h.element('#clear-sessions').hidden, true);
});
