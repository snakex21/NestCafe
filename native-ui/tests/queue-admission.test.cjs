const test = require('node:test');
const assert = require('node:assert/strict');
const { Element, descendants, harness } = require('./helpers/ui-harness.cjs');

async function appFixture({ failChat = false, failDelete = false } = {}) {
  const h = harness(), chats = [], streams = [], calls = [], toasts = [];
  let queue = [{ id: 'q1', prompt: 'queued task', session_id: '' }];
  let deleteGate = null, sessionGate = null;
  const data = async (url, options = {}) => {
    calls.push([url, options.method || 'GET']);
    if (url === '/api/health') return { home: '/synthetic', model: 'mock' };
    if (url.startsWith('/api/sessions')) return sessionGate ? new Promise(resolve => { sessionGate.resolve = resolve; }) : [];
    if (url.startsWith('/api/transcript')) return [];
    if (url === '/api/goal') return null;
    if (url.startsWith('/api/tasks')) {
      if (options.method === 'POST') queue.push({ id: 'q2', prompt: JSON.parse(options.body).prompt, session_id: '' });
      if (options.method === 'DELETE') {
        if (failDelete) throw new Error('synthetic deletion failure');
        if (deleteGate) await new Promise((resolve, reject) => {
          deleteGate.resolve = resolve;
          options.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        });
        queue = queue.filter(task => !url.includes(task.id));
      }
      return queue.slice();
    }
    throw new Error(`Unexpected mock URL: ${url}`);
  };
  h.context.fetch = async (url, options = {}) => {
    if (url === '/api/chat') {
      chats.push(JSON.parse(options.body).prompt);
      return failChat
        ? { ok: false, status: 503, text: async () => 'synthetic chat refusal' }
        : { ok: true, body: { signal: options.signal } };
    }
    const value = await data(url, options);
    return { ok: true, status: 200, text: async () => JSON.stringify(value), json: async () => value };
  };
  h.window.SuperCliUI = {
    requestJSON: data,
    createComposerDraftStore: () => ({ scope: () => '', load() {}, restore() {}, clear() {} }),
    normalizeFileChanges: () => [], mutationKind: () => '',
    readSSE: (body, onEvent) => new Promise((resolve, reject) => {
      streams.push({ onEvent, resolve, reject, signal: body.signal });
      const abort = () => reject(Object.assign(new Error('abort'), { name: 'AbortError' }));
      if (body.signal.aborted) abort();
      else body.signal.addEventListener('abort', abort);
    }),
  };
  h.load('chat/execution.js');
  h.load('core/app.js');
  h.load('plan/plan.js');
  await h.flush();
  h.nc.toast = message => toasts.push(message);
  let loader;
  const ui = {
    json: data,
    button: text => { const node = new Element('button'); node.textContent = text; return node; },
    empty: () => new Element(), sectionHeader: () => new Element(),
  };
  h.nc.settings = { ui, registerPage: (id, title, fn) => { loader = fn; } };
  h.load('settings/settings-plan.js');
  const root = new Element();
  await loader(root);
  await descendants(root).find(node => node.textContent === 'Kolejka').emit('click');
  const run = descendants(root).find(node => node.textContent === 'Uruchom');
  return { ...h, chats, streams, calls, toasts, run, queue: () => queue,
    deferDelete: () => { deleteGate = {}; return deleteGate; },
    deferSession: () => { sessionGate = {}; return sessionGate; },
    finish: async (index = 0) => {
      streams[index].onEvent({ type: 'done' });
      streams[index].resolve();
      await h.flush();
    },
  };
}

test('settings queue retains its task while another run is active', async () => {
  const h = await appFixture();
  h.nc.runPrompt('active task');
  await h.flush();
  await h.run.emit('click');
  assert.equal(h.queue().length, 1);
  assert.deepEqual(h.chats, ['active task']);
  assert.equal(h.calls.filter(([, method]) => method === 'DELETE').length, 0);
  assert.match(h.toasts.join(' '), /bieżące zadanie/);
});

test('settings queue admits and removes its task only once despite repeated clicks', async () => {
  const h = await appFixture();
  await Promise.all([h.run.emit('click'), h.run.emit('click')]);
  await h.flush();
  assert.deepEqual(h.chats, ['queued task']);
  assert.equal(h.calls.filter(([, method]) => method === 'DELETE').length, 1);
  assert.equal(h.queue().length, 0);
});

test('HTTP refusal preserves the queued task without attempting deletion', async () => {
  const h = await appFixture({ failChat: true });
  await h.run.emit('click');
  await h.flush();
  assert.equal(h.queue().length, 1);
  assert.equal(h.calls.filter(([, method]) => method === 'DELETE').length, 0);
  assert.equal(h.nc.isRunning(), false);
});

test('deletion failure preserves the saved task and pauses automatic continuation', async () => {
  const h = await appFixture({ failDelete: true });
  await h.nc.plan.enqueue('next queued task');
  await h.run.emit('click');
  await h.flush();
  await h.finish();
  assert.deepEqual(h.chats, ['queued task']);
  assert.equal(h.queue().length, 2);
  assert.equal([...h.timers.values()].filter(timer => timer.ms === 80).length, 0);
  assert.match(h.toasts.join(' '), /Zadanie uruchomiono.*Kolejka została wstrzymana/);
});

test('a queue deletion can start only after that queued chat was admitted', async () => {
  const h = await appFixture();
  const deletion = h.deferDelete();
  await h.run.emit('click');
  await h.flush();
  assert.ok(deletion.resolve);
  assert.deepEqual(h.chats, ['queued task']);
  assert.equal(await h.nc.runPrompt('competing direct task'), false);
  deletion.resolve();
  await h.flush();
  assert.equal(h.queue().length, 0);
  assert.deepEqual(h.chats, ['queued task']);
});

test('a competing prompt during session loading leaves the queued item saved', async () => {
  const h = await appFixture();
  h.queue()[0].session_id = 'other';
  let resume;
  h.nc.resumeSession = () => new Promise(resolve => { resume = resolve; });
  const launch = h.run.emit('click');
  h.nc.runPrompt('new direct task');
  await h.flush();
  resume();
  await launch;
  await h.flush();
  assert.equal(h.queue().length, 1);
  assert.deepEqual(h.chats, ['new direct task']);
  assert.equal(h.calls.filter(([, method]) => method === 'DELETE').length, 0);
});

test('Stop remains responsive during pending admitted-queue deletion', async () => {
  const h = await appFixture();
  h.deferDelete();
  await h.run.emit('click');
  await h.flush();
  await h.element('#stop-button').emit('click');
  await h.flush();
  assert.equal(h.nc.isRunning(), false);
  assert.equal(h.queue().length, 1);
  assert.equal(h.element('#run-state').textContent, 'Przerwano');
});

test('an old finalizer cannot schedule a queue against a newer explicit run', async () => {
  const h = await appFixture();
  const first = h.nc.runPrompt('first task');
  await h.flush();
  await h.nc.plan.enqueue('queued second task');
  const sessions = h.deferSession();
  await h.finish();
  assert.equal(h.nc.isRunning(), false);
  h.nc.runPrompt('new explicit task');
  await h.flush();
  sessions.resolve([]);
  await first;
  await h.flush();
  assert.equal([...h.timers.values()].filter(timer => timer.ms === 80).length, 0);
  assert.equal(h.streams[1].signal.aborted, false);
});

test('an already scheduled automatic continuation cannot interrupt a newer explicit run', async () => {
  const h = await appFixture();
  const first = h.nc.runPrompt('first task');
  await h.flush();
  await h.nc.plan.enqueue('queued second task');
  await h.finish();
  await first;
  const timer = [...h.timers.values()].find(value => value.ms === 80);
  assert.ok(timer);
  h.nc.runPrompt('new explicit task');
  await h.flush();
  await timer.fn();
  await h.flush();
  assert.equal(h.streams[1].signal.aborted, false);
  assert.equal(h.queue().length, 2);
});
