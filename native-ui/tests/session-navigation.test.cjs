const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { Element, harness } = require('./helpers/ui-harness.cjs');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function navigationFixture() {
  const h = harness(), requests = [], chats = [], restores = [], rendered = [];
  const transcripts = new Map();
  const sessions = ['a', 'b'].map(id => ({ id, first_user_msg: `Session ${id}` }));
  let sessionGate = null;
  const stream = deferred();
  const data = async url => {
    requests.push(url);
    if (url === '/api/health') return { home: '/synthetic', model: 'mock' };
    if (url.startsWith('/api/sessions')) return sessionGate ? sessionGate.promise : sessions;
    if (url.startsWith('/api/transcript')) {
      const id = new URL(url, 'http://localhost').searchParams.get('id');
      return transcripts.get(id)?.promise || [];
    }
    if (url === '/api/tasks') return [];
    if (url.startsWith('/api/tasks?id=')) return null;
    if (url === '/api/goal') return null;
    throw new Error(`Unexpected URL: ${url}`);
  };
  h.context.fetch = async (url, options = {}) => {
    if (url === '/api/chat') {
      chats.push(JSON.parse(options.body));
      return { ok: true, body: {} };
    }
    const value = await data(url);
    return { ok: true, status: 200, text: async () => JSON.stringify(value) };
  };
  h.window.SuperCliUI = {
    requestJSON: data,
    createComposerDraftStore: () => ({ scope: () => '', load() {}, clear() {}, restore: scope => restores.push(scope) }),
    normalizeFileChanges: () => [], mutationKind: () => '',
    readSSE: async (body, onEvent) => { await stream.promise; onEvent({ type: 'done' }); },
  };
  h.nc.chat = {
    createMessage(role, text, conversation) {
      rendered.push([role, text]);
      const node = new Element();
      node.textContent = text;
      conversation.append(node);
      return node;
    },
    createActivity: () => new Element(),
  };
  h.load('core/app.js');
  h.load('plan/plan.js');
  await h.flush();
  return { ...h, requests, chats, restores, rendered,
    open: id => vm.runInContext(`openSession({ id: '${id}', first_user_msg: 'Session ${id}' })`, h.context),
    deferTranscript: id => { const gate = deferred(); transcripts.set(id, gate); return gate; },
    deferSessions: () => { sessionGate = deferred(); return sessionGate; },
    finish: () => stream.resolve(),
  };
}

test('latest session selection wins when transcript responses arrive out of order', async () => {
  const h = await navigationFixture();
  const a = h.deferTranscript('a'), b = h.deferTranscript('b');
  const old = h.open('a'), latest = h.open('b');
  b.resolve([{ role: 'user', content: 'B transcript' }]);
  await latest;
  a.resolve([{ role: 'user', content: 'A transcript' }]);
  await old;
  assert.equal(h.nc.getSession(), 'b');
  assert.equal(h.element('#conversation-title').textContent, 'Session b');
  assert.deepEqual(h.restores, ['session:b']);
  assert.deepEqual(h.rendered, [['user', 'B transcript']]);
});

test('New chat invalidates a pending transcript response', async () => {
  const h = await navigationFixture();
  const a = h.deferTranscript('a'), old = h.open('a');
  h.nc.startConversation();
  a.resolve([{ role: 'user', content: 'Old transcript' }]);
  await old;
  assert.equal(h.nc.getSession(), '');
  assert.equal(h.element('#conversation-title').textContent, 'Nowa rozmowa');
  assert.deepEqual(h.rendered, []);
});

for (const finished of [false, true]) {
  test(`starting a prompt invalidates pending navigation, even when finished=${finished}`, async () => {
    const h = await navigationFixture();
    const a = h.deferTranscript('a'), old = h.open('a');
    const run = h.nc.runPrompt('Current prompt');
    await h.flush();
    if (finished) { h.finish(); await run; }
    a.resolve([{ role: 'user', content: 'Old transcript' }]);
    await old;
    assert.equal(h.nc.getSession(), '');
    assert.deepEqual(h.rendered, [['user', 'Current prompt']]);
    if (!finished) { h.finish(); await run; }
  });
}

test('obsolete transcript errors do not replace current feedback', async () => {
  const h = await navigationFixture();
  const a = h.deferTranscript('a'), old = h.open('a');
  await h.open('b');
  h.element('#toast').textContent = 'Current feedback';
  a.reject(new Error('obsolete failure'));
  await old;
  assert.equal(h.element('#toast').textContent, 'Current feedback');
});

test('resume lookup is invalidated before it can start a late transcript request', async () => {
  const h = await navigationFixture(), gate = h.deferSessions();
  const old = h.nc.resumeSession('a');
  h.nc.startConversation();
  gate.resolve([{ id: 'a', first_user_msg: 'Session a' }]);
  await old;
  assert.equal(h.nc.getSession(), '');
  assert.equal(h.requests.some(url => url.includes('/api/transcript')), false);
});

test('queue retains its item when navigation was superseded by New chat', async () => {
  const h = await navigationFixture(), gate = h.deferTranscript('a');
  const launch = h.nc.plan.runScheduled({ id: 'q', session_id: 'a', prompt: 'Queued prompt' });
  await h.flush();
  h.nc.startConversation();
  gate.resolve([]);
  await launch;
  await h.flush();
  assert.equal(h.nc.getSession(), '');
  assert.deepEqual(h.chats, []);
  assert.equal(h.requests.some(url => url.startsWith('/api/tasks?id=')), false);
});

test('queue never sends a task to the previous session after transcript loading fails', async () => {
  const h = await navigationFixture();
  await h.open('b');
  const gate = h.deferTranscript('a');
  const launch = h.nc.plan.runScheduled({ id: 'q', session_id: 'a', prompt: 'Queued prompt' });
  await h.flush();
  gate.reject(new Error('synthetic transcript failure'));
  await launch;
  await h.flush();
  assert.equal(h.nc.getSession(), 'b');
  assert.deepEqual(h.chats, []);
  assert.equal(h.requests.some(url => url.startsWith('/api/tasks?id=')), false);
});

test('current transcript failure leaves the previous conversation intact and reports its error', async () => {
  const h = await navigationFixture();
  await h.open('b');
  const gate = h.deferTranscript('a'), opening = h.open('a');
  gate.reject(new Error('current load failed'));
  assert.equal(await opening, false);
  assert.equal(h.nc.getSession(), 'b');
  assert.equal(h.element('#toast').textContent, 'current load failed');
});

test('successful resume still selects the requested session and restores its draft', async () => {
  const h = await navigationFixture();
  assert.equal(await h.nc.resumeSession('a'), true);
  assert.equal(h.nc.getSession(), 'a');
  assert.deepEqual(h.restores, ['session:a']);
});

test('a queued task resumes its intended session and sends once before deletion', async () => {
  const h = await navigationFixture();
  await h.open('b');
  assert.equal(await h.nc.plan.runScheduled({ id: 'q', session_id: 'a', prompt: 'Queued prompt' }), true);
  await h.flush();
  assert.deepEqual(h.chats, [{ prompt: 'Queued prompt', session_id: 'a', attachments: [] }]);
  assert.equal(h.requests.filter(url => url === '/api/tasks?id=q').length, 1);
  h.finish();
  await h.flush();
});

test('a superseded resume lookup failure resolves quietly', async () => {
  const h = await navigationFixture(), gate = h.deferSessions();
  const old = h.nc.resumeSession('a');
  // Use a direct transcript selection while the older catalog lookup is pending.
  const current = vm.runInContext("openSession({ id: 'b', first_user_msg: 'Session b' }, true)", h.context);
  await current;
  gate.reject(new Error('obsolete lookup failed'));
  assert.equal(await old, false);
  assert.equal(h.nc.getSession(), 'b');
});
