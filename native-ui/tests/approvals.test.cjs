const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { descendants, harness } = require('./helpers/ui-harness.cjs');

// Shape of a SuperCli 1.0.23 host approval question (webgui questionWire with
// confirmation + approval card), Polish gate language.
function approvalQuestion(overrides = {}) {
  const summary = 'Przenieść 1 element do Kosza systemu Windows?';
  return {
    id: 'q-approval-1',
    header: 'Wymagana zgoda',
    question: `${summary}\n\nNarzędzie: trash / trash_outside_workspace\nObiekt: C:\\Temp\\gate-test.txt\nOdwracalne: tak`,
    options: [{ label: 'Odrzuć' }, { label: 'Zatwierdź' }, { label: 'Zatwierdź podobne w tej sesji' }],
    multi_select: false,
    allow_custom: false,
    confirmation: true,
    approval: {
      tool: 'trash', operation: 'trash_outside_workspace', risk: 'write_reversible', reversible: true,
      target: 'C:\\Temp\\gate-test.txt', summary, count: -1,
      approve_label: 'Zatwierdź', deny_label: 'Odrzuć', similar_label: 'Zatwierdź podobne w tej sesji', grant_minutes: 30,
    },
    ...overrides,
  };
}

function chatApp() {
  const h = harness(), posts = [], pending = [];
  h.context.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
  h.window.dispatchEvent = event => { if (event.type === 'nestcafe:question-pending') pending.push(event.detail.pending); };
  h.context.fetch = async (url, options = {}) => {
    posts.push({ url, body: JSON.parse(options.body || '{}') });
    return { ok: true, status: 200, text: async () => '' };
  };
  h.load('chat/execution.js');
  const conversation = h.element('#conversation');
  const overlays = () => conversation.children.filter(node => node.className.includes('question-overlay'));
  const buttons = node => descendants(node).filter(child => child.tag === 'button');
  const button = (node, text) => buttons(node).find(child => child.textContent === text);
  const text = node => descendants(node).map(child => child.textContent || '').join('\n');
  return { ...h, chat: h.nc.chat, posts, pending, conversation, overlays, buttons, button, text };
}

test('approval question renders as an approval card with the server labels and full details', () => {
  const app = chatApp();
  app.chat.showQuestion(approvalQuestion());
  const [card] = app.overlays();
  assert.ok(card.className.includes('approval-overlay'));
  const content = app.text(card);
  assert.match(content, /Wymagana zgoda/);
  assert.match(content, /Przenieść 1 element do Kosza/);
  assert.match(content, /Narzędzie: trash \/ trash_outside_workspace/);
  assert.match(content, /Obiekt: C:\\Temp\\gate-test.txt/);
  assert.match(content, /Odwracalne: tak/);
  assert.match(content, /Można cofnąć/);
  assert.deepEqual(app.buttons(card).map(b => b.textContent), ['Odrzuć', 'Zatwierdź podobne w tej sesji', 'Zatwierdź']);
  // No radio list, free-text answer or generic "Odpowiedz/Anuluj" pair.
  assert.equal(descendants(card).some(node => node.tag === 'textarea' || node.tag === 'input'), false);
  assert.equal(app.pending.at(-1), true);
});

test('irreversible operations are marked as such', () => {
  const app = chatApp();
  const q = approvalQuestion();
  q.approval = { ...q.approval, reversible: false, similar_label: '' };
  app.chat.showQuestion(q);
  const [card] = app.overlays();
  assert.match(app.text(card), /Nie da się cofnąć/);
  assert.ok(descendants(card).some(node => node.className.includes('approval-panel') && node.className.includes('irreversible')));
  assert.deepEqual(app.buttons(card).map(b => b.textContent), ['Odrzuć', 'Zatwierdź']);
});

test('Odrzuć sends a cancellation and leaves a denial receipt', async () => {
  const app = chatApp();
  app.chat.showQuestion(approvalQuestion());
  const [card] = app.overlays();
  await app.button(card, 'Odrzuć').emit('click');
  await app.flush();
  assert.deepEqual(app.posts, [{ url: '/api/question/answer', body: { id: 'q-approval-1', selected: [], custom: '', cancelled: true } }]);
  assert.match(app.text(card), /operacja nie została wykonana/);
  // The action row is removed once answered (the DOM double only marks it).
  assert.ok(app.buttons(card).every(b => b.parent.isConnected === false));
  assert.equal(app.pending.at(-1), false);
});

test('Zatwierdź sends exactly the server approve label', async () => {
  const app = chatApp();
  app.chat.showQuestion(approvalQuestion());
  const [card] = app.overlays();
  await app.button(card, 'Zatwierdź').emit('click');
  await app.flush();
  assert.deepEqual(app.posts[0].body, { id: 'q-approval-1', selected: ['Zatwierdź'], custom: '', cancelled: false });
  assert.match(app.text(card), /✓ Zatwierdź/);
});

test('an approval arriving during an open ask_user batch neither replaces nor joins the form', () => {
  const app = chatApp();
  app.chat.prepareQuestionBatch(JSON.stringify({ questions: [
    { question: 'Pierwsze?', options: [{ label: 'A' }] },
    { question: 'Drugie?', options: [{ label: 'B' }] },
  ] }));
  app.chat.showQuestion({ id: 'ask-1', question: 'Pierwsze?', options: [{ label: 'A' }] });
  const [form] = app.overlays();
  app.chat.showQuestion(approvalQuestion());
  const overlays = app.overlays();
  assert.equal(overlays.length, 2);
  assert.equal(form.isConnected, true);
  assert.ok(overlays[1].className.includes('approval-overlay'));
  const batch = vm.runInContext('pendingQuestionBatch', app.context);
  assert.equal(batch.received, 1);
  assert.deepEqual(Array.from(batch.serverQuestions, q => q.id), ['ask-1']);
  // The batch still owns its next wire question.
  app.chat.showQuestion({ id: 'ask-2', question: 'Drugie?', options: [{ label: 'B' }] });
  assert.equal(batch.received, 2);
  assert.equal(overlays[1].isConnected, true);
});

test('an approval does not close a single open ask_user question', () => {
  const app = chatApp();
  app.chat.showQuestion({ id: 'ask-1', question: 'Kontynuować?', options: [{ label: 'Tak' }] });
  const [form] = app.overlays();
  app.chat.showQuestion(approvalQuestion());
  assert.equal(form.isConnected, true);
  assert.equal(app.overlays().length, 2);
});

test('run end clears unanswered approvals and the pending state', () => {
  const app = chatApp();
  app.chat.showQuestion(approvalQuestion());
  const [card] = app.overlays();
  app.chat.clearApprovals();
  assert.equal(card.isConnected, false);
  assert.equal(app.pending.at(-1), false);
});
