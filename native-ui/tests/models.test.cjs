const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./helpers/ui-harness.cjs');

async function modelsApp() {
  const h = harness(), requests = [];
  h.nc.refreshHealth = async () => {};
  h.context.fetch = (url, options = {}) => new Promise((resolve, reject) => requests.push({
    url, options, reject,
    resolve: data => resolve({ ok: true, json: async () => data }),
  }));
  h.load('models/models.js');
  const catalog = active => ({ models: [{ id: 'A', provider: 'p' }, { id: 'B', provider: 'p' }], active, provider: 'p' });
  requests[0].resolve(catalog('A'));
  await h.flush();
  return { ...h, requests, catalog, rows: () => h.element('#model-list').children };
}

test('model selection permits only one in-flight mutation and disables choices', async () => {
  const h = await modelsApp();
  const rows = h.rows();
  const first = rows[0].emit('click');
  const second = rows[1].emit('click');
  const mutationCount = h.requests.filter(request => request.options.method === 'POST').length;
  const disabled = rows.every(row => row.disabled);
  for (const request of h.requests.slice(1)) request.resolve({ model: 'A' });
  await Promise.all([first, second]);
  assert.equal(mutationCount, 1);
  assert.equal(disabled, true);
  assert.equal(h.element('#model-button').disabled, false);
  assert.equal(h.element('#model-search').disabled, false);
});

test('model selection displays the model confirmed by the server', async () => {
  const h = await modelsApp();
  const selection = h.rows()[1].emit('click');
  h.requests[1].resolve({ model: 'B-canonical' });
  await selection;
  assert.equal(h.element('#model-button').textContent, 'B-canonical');
});

test('selection failure retains the active model and enables another choice', async () => {
  const h = await modelsApp();
  const selection = h.rows()[1].emit('click');
  h.requests[1].reject(new Error('synthetic save failure'));
  await selection;
  assert.equal(h.element('#model-button').textContent, 'A');
  assert.equal(h.rows().every(row => !row.disabled), true);
  assert.equal(h.element('#model-button').disabled, false);
  assert.match(h.element('#toast').textContent, /synthetic save failure/);
});

test('an older catalog response cannot replace a newly selected model', async () => {
  const h = await modelsApp();
  const oldRefresh = h.nc.models.refresh();
  const currentRefresh = h.nc.models.refresh();
  h.requests[2].resolve(h.catalog('A'));
  await currentRefresh;
  const selection = h.rows()[1].emit('click');
  h.requests[3].resolve({ model: 'B' });
  await selection;
  h.requests[1].resolve(h.catalog('A'));
  await oldRefresh;
  assert.equal(h.element('#model-button').textContent, 'B');
  assert.equal(h.nc.models.getActive().id, 'B');
});

test('an obsolete catalog failure cannot replace or reject the latest refresh', async () => {
  const h = await modelsApp();
  const oldRefresh = h.nc.models.refresh();
  const currentRefresh = h.nc.models.refresh();
  h.requests[2].resolve(h.catalog('B'));
  await currentRefresh;
  h.requests[1].reject(new Error('obsolete catalog error'));
  await assert.doesNotReject(oldRefresh);
  assert.equal(h.element('#model-button').textContent, 'B');
});

test('a catalog refresh during selection cannot send a pre-selection read', async () => {
  const h = await modelsApp();
  const selection = h.rows()[1].emit('click');
  const refresh = h.nc.models.refresh();
  const requestCount = h.requests.length;
  // Resolve any unexpected extra request so the baseline also terminates.
  h.requests[2]?.resolve(h.catalog('A'));
  await refresh;
  h.requests[1].resolve({ model: 'B' });
  await selection;
  assert.equal(requestCount, 2);
});
