const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { descendants, harness } = require('./helpers/ui-harness.cjs');

// A multi-question ask_user arrives as one tool_call (all questions) and then
// one server question per answer. Each answer POST is held until the test
// releases it, so the tool_result can be delivered before the last POST's
// response, as seen live.
function batchApp() {
  const h = harness(), posts = [];
  h.context.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
  h.context.fetch = (url, options = {}) => new Promise(resolve => {
    posts.push({ url, body: JSON.parse(options.body || '{}'), release: () => resolve({ ok: true, status: 200, text: async () => '' }) });
  });
  h.load('chat/execution.js');
  const conversation = h.element('#conversation');
  const overlays = () => conversation.children.filter(node => node.className.includes('question-overlay'));
  const text = node => descendants(node).map(child => child.textContent || '').join('\n');
  const button = (node, label) => descendants(node).find(child => child.tag === 'button' && child.textContent === label);
  return { ...h, chat: h.nc.chat, posts, overlays, text, button };
}

const questions = {
  questions: [
    { question: 'Który język?', options: [{ label: 'Go' }, { label: 'Rust' }] },
    { question: 'Jaki test?', options: [{ label: 'Jednostkowy' }, { label: 'E2E' }] },
  ],
};

// The DOM double has no :checked selector support; pick an option the way
// questionAnswerFromPanel reads it.
function pick(panel, label) {
  panel.querySelectorAll = selector => selector.includes(':checked') ? [{ value: label, dataset: {} }] : [];
}

async function answerAll(app) {
  app.chat.prepareQuestionBatch(JSON.stringify(questions));
  app.chat.showQuestion({ id: 'q-1', question: 'Który język?', options: [{ label: 'Go' }, { label: 'Rust' }] });
  const [overlay] = app.overlays();
  const panel = overlay.children[0];
  pick(panel, 'Go');
  await app.button(panel, 'Dalej').emit('click');
  pick(panel, 'E2E');
  await app.button(panel, 'Odpowiedz').emit('click');
  await app.flush();
  assert.equal(app.posts.length, 1);
  assert.deepEqual(app.posts[0].body.selected, ['Go']);
  app.posts[0].release();
  await app.flush();
  app.chat.showQuestion({ id: 'q-2', question: 'Jaki test?', options: [{ label: 'Jednostkowy' }, { label: 'E2E' }] });
  await app.flush();
  assert.equal(app.posts.length, 2);
  assert.deepEqual(app.posts[1].body, { id: 'q-2', selected: ['E2E'], custom: '', cancelled: false });
  return overlay;
}

test('multi-question confirmation survives a tool_result that arrives before the last answer response', async () => {
  const app = batchApp();
  const overlay = await answerAll(app);
  // tool_result for ask_user (app.js) while the second POST is still pending.
  app.chat.clearQuestionBatch();
  assert.equal(overlay.isConnected, true, 'the receipt must stay in the conversation');
  assert.match(app.text(overlay), /Odpowiedziano/);
  assert.match(app.text(overlay), /✓ Go/);
  assert.match(app.text(overlay), /✓ E2E/);
  app.posts[1].release();
  await app.flush();
  assert.equal(overlay.isConnected, true);
  assert.match(app.text(overlay), /Odpowiedziano/);
  assert.doesNotMatch(app.text(overlay), /Przekazuję odpowiedzi/);
  // done/error later closes only a still-active question, not the receipt.
  app.chat.closeQuestion();
  assert.equal(overlay.isConnected, true);
});

test('multi-question confirmation in the usual order (response first, then tool_result)', async () => {
  const app = batchApp();
  const overlay = await answerAll(app);
  app.posts[1].release();
  await app.flush();
  assert.match(app.text(overlay), /Odpowiedziano/);
  app.chat.clearQuestionBatch();
  app.chat.closeQuestion();
  assert.equal(overlay.isConnected, true);
  assert.match(app.text(overlay), /✓ E2E/);
});

test('an unanswered batch is still removed when the call ends', async () => {
  const app = batchApp();
  app.chat.prepareQuestionBatch(JSON.stringify(questions));
  app.chat.showQuestion({ id: 'q-1', question: 'Który język?', options: [{ label: 'Go' }] });
  const [overlay] = app.overlays();
  app.chat.clearQuestionBatch();
  assert.equal(overlay.isConnected, false);
});

// build-native.ps1 -RefreshBridge used 'dist<TAB>hunderbird-ai-bridge.xpi':
// "\t" is a tab escape in other languages, not in a PowerShell single-quoted
// string, and the literal tab ended up in the file.
test('build scripts contain no tab characters in string literals', () => {
  const scripts = path.join(__dirname, '../../scripts');
  for (const file of fs.readdirSync(scripts).filter(name => name.endsWith('.ps1'))) {
    const lines = fs.readFileSync(path.join(scripts, file), 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      assert.equal(line.includes('\t'), false, `${file}:${index + 1} contains a tab`);
    });
  }
  const build = fs.readFileSync(path.join(scripts, 'build-native.ps1'), 'utf8');
  assert.match(build, /Join-Path \(Join-Path \$bridgeRoot 'dist'\) 'thunderbird-ai-bridge\.xpi'/);
});

test('answers not yet sent when the batch is interrupted are shown as not sent', async () => {
  const app = batchApp();
  app.chat.prepareQuestionBatch(JSON.stringify(questions));
  app.chat.showQuestion({ id: 'q-1', question: 'Który język?', options: [{ label: 'Go' }, { label: 'Rust' }] });
  const [overlay] = app.overlays();
  const panel = overlay.children[0];
  pick(panel, 'Go');
  await app.button(panel, 'Dalej').emit('click');
  pick(panel, 'E2E');
  await app.button(panel, 'Odpowiedz').emit('click');
  await app.flush();
  app.posts[0].release();
  await app.flush();
  // Interrupted before the second server question arrived: only one answer was sent.
  app.chat.clearQuestionBatch();
  assert.equal(overlay.isConnected, true);
  assert.match(app.text(overlay), /✓ Go/);
  assert.doesNotMatch(app.text(overlay), /✓ E2E/);
  assert.match(app.text(overlay), /E2E — niewysłane \(przerwano\)/);
});

test('an expired single question stays in place, marked expired', async () => {
  const app = batchApp();
  app.context.fetch = async () => ({ ok: false, status: 410, text: async () => '' });
  app.chat.showQuestion({ id: 'q-x', question: 'Kontynuować?', options: [{ label: 'Tak' }] });
  const [overlay] = app.overlays();
  const panel = overlay.children[0];
  pick(panel, 'Tak');
  await panel.emit('submit');
  await app.flush();
  assert.equal(overlay.isConnected, true);
  assert.ok(overlay.classList.contains('expired'));
  assert.match(app.text(overlay), /Wygasło — bez odpowiedzi/);
});
