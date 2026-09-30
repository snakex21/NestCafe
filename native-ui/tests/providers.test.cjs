const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness() {
  class Element {
    constructor() { this.value = ''; this.textContent = ''; this.hidden = false; this.open = true; this.children = []; this.events = {}; }
    addEventListener(type, fn) { (this.events[type] ||= []).push(fn); }
    emit(type) { for (const fn of this.events[type] || []) fn({currentTarget:this}); }
    append(...nodes) { this.children.push(...nodes); }
    appendChild(node) { this.children.push(node); }
    prepend(node) { this.children.unshift(node); }
    replaceChildren(...nodes) { this.children = nodes; }
    querySelectorAll() { return []; }
    setAttribute() {}
    reset() {}
    focus() {}
    close() { this.open = false; setTimeout(() => this.emit('close'), 0); }
  }
  const elements = new Map();
  const element = (id) => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const requests = [];
  const context = vm.createContext({
    document: {querySelector:element, createElement:()=>new Element()},
    window: {NestCafe:{}},
    fetch: (url) => new Promise((resolve,reject)=>requests.push({url,resolve:data=>resolve({ok:true,json:async()=>data}),reject})),
    Event: class {}, confirm:()=>false,
  });
  const source = fs.readFileSync(path.join(__dirname,'../js/models/providers.js'),'utf8');
  vm.runInContext(source + '\nthis.api={editProvider,resetProviderForm,loadProviders};', context);
  const provider = (name, disabled=false) => ({name,disabled,type:'openai',baseUrl:'http://example.invalid',model:'test',hasKey:false});
  const flush = async()=>{ for(let i=0;i<8;i++) await Promise.resolve(); };
  return {api:context.api,element,requests,provider,flush};
}

test('late diagnostics cannot replace the newly selected provider status', async()=>{
  const h=harness(); h.api.editProvider(h.provider('A')); h.api.editProvider(h.provider('B'));
  h.requests[1].resolve({server:'B',status:'offline'}); await h.flush();
  const expected=h.element('#provider-diagnostic').textContent;
  h.requests[0].resolve({server:'A',status:'offline'}); await h.flush();
  assert.equal(h.element('#provider-diagnostic').textContent,expected);
});

test('late error cannot overwrite a reset form', async()=>{
  const h=harness(); h.api.editProvider(h.provider('A')); h.api.resetProviderForm();
  const expected=h.element('#provider-diagnostic').textContent;
  h.requests[0].reject(new Error('stale failure')); await h.flush();
  assert.equal(h.element('#provider-diagnostic').textContent,expected);
});

test('closing a provider dialog invalidates diagnostics and prevents follow-up catalog fetch', async()=>{
  const h=harness(); h.api.editProvider(h.provider('A')); h.element('#provider-dialog').close();
  const expected=h.element('#provider-diagnostic').textContent;
  h.requests[0].resolve({server:'A',status:'online'}); await h.flush();
  assert.equal(h.element('#provider-diagnostic').textContent,expected);
  assert.equal(h.requests.length,1);
});

test('late catalog fetch cannot replace state after selection changes', async()=>{
  const h=harness(); h.api.editProvider(h.provider('A'));
  h.requests[0].resolve({server:'A',status:'online'}); await h.flush();
  assert.equal(h.requests.length,2);
  h.api.editProvider(h.provider('B',true));
  h.requests[1].resolve({models:[{id:'late',provider:'B'}]}); await h.flush();
  assert.equal(h.element('#provider-models').hidden,true);
});

test('reload with a removed final provider safely resets the form', async()=>{
  const h=harness(); h.api.editProvider(h.provider('A',true));
  const loading=h.api.loadProviders();
  h.requests[0].resolve({providers:[],templates:[]}); h.requests[1].resolve({models:[]});
  await loading;
  assert.equal(h.element('#provider-title').textContent,'Dodaj dostawcę');
});

test('current diagnostics still show current provider result and refresh models', async()=>{
  const h=harness(); h.api.editProvider(h.provider('A'));
  h.requests[0].resolve({server:'A',status:'online',models:['model']}); await h.flush();
  assert.match(h.element('#provider-diagnostic').textContent,/^A · 1 modeli/);
  assert.equal(h.requests.length,2);
  h.requests[1].resolve({models:[{id:'model',provider:'A'}]}); await h.flush();
  assert.equal(h.element('#provider-models').hidden,false);
});

test('Escape cancellation invalidates diagnostics', async()=>{
  const h=harness(); h.api.editProvider(h.provider('A')); h.element('#provider-dialog').emit('cancel');
  const expected=h.element('#provider-diagnostic').textContent;
  h.requests[0].reject(new Error('late after Escape')); await h.flush();
  assert.equal(h.element('#provider-diagnostic').textContent,expected);
});

test('newer diagnostic for the same provider wins over an older request', async()=>{
  const h=harness(); h.api.editProvider(h.provider('A')); h.api.editProvider(h.provider('A'));
  h.requests[1].resolve({server:'new result',status:'offline'}); await h.flush();
  h.requests[0].resolve({server:'old result',status:'offline'}); await h.flush();
  assert.match(h.element('#provider-diagnostic').textContent,/^new result/);
});

test('closed dialog rejects completion before its queued close event', async()=>{
  const h=harness(); h.api.editProvider(h.provider('A'));
  h.element('#provider-dialog').open=false; // close event is deliberately not dispatched yet
  const expected=h.element('#provider-diagnostic').textContent;
  h.requests[0].resolve({server:'A',status:'online'}); await h.flush();
  assert.equal(h.element('#provider-diagnostic').textContent,expected);
  assert.equal(h.requests.length,1);
});

test('queued old close event does not invalidate a reopened dialog', async()=>{
  const h=harness(); h.api.editProvider(h.provider('A'));
  const dialog=h.element('#provider-dialog'); dialog.open=false;
  h.api.resetProviderForm(); dialog.open=true; h.api.editProvider(h.provider('B'));
  dialog.emit('close'); // delayed event from the previous opening
  h.requests[1].resolve({server:'B',status:'offline'}); await h.flush();
  h.requests[0].resolve({server:'A',status:'offline'}); await h.flush();
  assert.match(h.element('#provider-diagnostic').textContent,/^B/);
});
