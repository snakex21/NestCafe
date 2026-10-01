const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { harness } = require('./helpers/ui-harness.cjs');

async function runningApp() {
  const h = harness(), calls = [];
  let tasks = [], stream, deferQueue = null;
  const data = async (url, options = {}) => {
    calls.push([url, options.method || 'GET']);
    if (url === '/api/health') return { home: '/synthetic', model: 'mock' };
    if (url.startsWith('/api/sessions') || url.startsWith('/api/transcript')) return [];
    if (url === '/api/goal') return null;
    if (url.startsWith('/api/tasks')) {
      if (options.method === 'POST') tasks.push({ id: 'queued-1', prompt: JSON.parse(options.body).prompt, session_id: '' });
      if (options.method === 'DELETE') tasks = [];
      if (!options.method && deferQueue) return new Promise(resolve => { deferQueue.resolve = resolve; });
      return tasks.slice();
    }
    throw new Error(`Unexpected mock URL: ${url}`);
  };
  h.context.fetch = async (url, options = {}) => {
    if (url === '/api/chat') {
      calls.push([url, 'POST']);
      return { ok: true, body: { signal: options.signal } };
    }
    const value = await data(url, options);
    return { ok: true, status: 200, text: async () => JSON.stringify(value), json: async () => value };
  };
  h.window.SuperCliUI = {
    requestJSON: data,
    createComposerDraftStore: () => ({ scope: () => '', load() {}, restore() {}, clear() {} }),
    normalizeFileChanges: () => [], mutationKind: () => '',
    readSSE: async (body, onEvent) => {
      onEvent({ type: 'tool_call', name: 'ctx_execute', args: '{"command":"synthetic"}', id: 'tool-1' });
      await new Promise((resolve, reject) => {
        stream = { onEvent, resolve, reject };
        body.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      });
    },
  };
  h.load('chat/execution.js');
  h.load('core/app.js');
  h.load('plan/plan.js');
  await h.flush();
  const run = h.nc.runPrompt('synthetic first task');
  await h.flush();
  const finish = async kind => {
    if (kind === 'done') {
      stream.onEvent({ type: 'tool_result', id: 'tool-1', output: 'synthetic output' });
      stream.onEvent({ type: 'done' });
    } else if (kind === 'error') stream.onEvent({ type: 'error', err: 'synthetic error' });
    stream.resolve();
    await run;
    await h.flush();
  };
  return { ...h, calls, run, finish, tasks: () => tasks,
    row: () => vm.runInContext('toolRows.get("tool-1")', h.context),
    deferQueue: () => { deferQueue = {}; return deferQueue; } };
}

test('Stop pauses automatic continuation and retains the queued task', async () => {
  const h = await runningApp();
  await h.nc.plan.enqueue('synthetic queued task');
  await h.element('#stop-button').emit('click');
  await h.run;
  await h.flush();
  assert.equal([...h.timers.values()].filter(timer => timer.ms === 80).length, 0);
  assert.equal(h.tasks().length, 1);
  assert.equal(h.calls.filter(([url]) => url === '/api/chat').length, 1);
  assert.equal(h.intervals.size, 0);
  assert.equal(h.row().classList.contains('running'), false);
  assert.match(h.row().querySelector('small').textContent, /niepotwierdzony/);
  assert.equal(h.element('#run-state').textContent, 'Przerwano');
});

test('successful completion still advances the queue and preserves completed tool output', async () => {
  const h = await runningApp();
  await h.nc.plan.enqueue('synthetic queued task');
  await h.finish('done');
  const continuation = [...h.timers.values()].find(timer => timer.ms === 80);
  assert.ok(continuation);
  assert.equal(h.intervals.size, 0);
  assert.equal(h.row().classList.contains('done'), true);
  assert.match(h.row().querySelector('small').textContent, /Gotowe/);
  await continuation.fn();
  await h.flush();
  assert.equal(h.calls.filter(([url]) => url === '/api/chat').length, 2);
});

for (const kind of ['error', 'eof']) {
  test(`${kind} stops automatic continuation and clears unfinished tool timers`, async () => {
    const h = await runningApp();
    await h.nc.plan.enqueue('synthetic queued task');
    await h.finish(kind);
    assert.equal([...h.timers.values()].filter(timer => timer.ms === 80).length, 0);
    assert.equal(h.tasks().length, 1);
    assert.equal(h.intervals.size, 0);
    assert.equal(h.row().classList.contains('done'), false);
    assert.match(h.row().querySelector('small').textContent, /niepotwierdzony/);
  });
}

test('explicit queued Teraz still interrupts and starts the selected task', async () => {
  const h = await runningApp();
  await h.nc.plan.enqueue('selected task');
  h.nc.interruptWithQueuedTask(h.tasks()[0]);
  await h.run;
  await h.flush();
  const immediate = [...h.timers.values()].find(timer => timer.ms === 0);
  assert.ok(immediate);
  await immediate.fn();
  await h.flush();
  assert.equal(h.calls.filter(([url]) => url === '/api/chat').length, 2);
});

test('Stop supersedes a pending explicit Teraz selection', async () => {
  const h = await runningApp();
  await h.nc.plan.enqueue('selected task');
  h.nc.interruptWithQueuedTask(h.tasks()[0]);
  await h.element('#stop-button').emit('click');
  await h.run;
  await h.flush();
  assert.equal([...h.timers.values()].filter(timer => timer.ms === 0 || timer.ms === 80).length, 0);
  assert.equal(h.tasks().length, 1);
});

test('pausing while queue refresh is pending prevents late automatic launch', async () => {
  const h = await runningApp();
  await h.nc.plan.enqueue('synthetic queued task');
  const refresh = h.deferQueue();
  await h.finish('done');
  assert.ok(refresh.resolve);
  h.nc.plan.pause();
  refresh.resolve(h.tasks());
  await h.flush();
  assert.equal([...h.timers.values()].filter(timer => timer.ms === 80).length, 0);
});
