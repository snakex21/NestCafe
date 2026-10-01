const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// A deliberately small DOM double for event/state tests, not visual or browser QA.
class Element {
  constructor(tag = 'div') {
    Object.assign(this, { tag, children: [], events: {}, nodes: new Map(), dataset: {},
      value: '', textContent: '', hidden: false, open: false, disabled: false,
      attrs: {}, className: '', isConnected: true, style: { setProperty() {} } });
    this.classList = {
      add: (...names) => { this.className += ` ${names.join(' ')}`; },
      remove: (...names) => { this.className = this.className.split(/\s+/).filter(name => !names.includes(name)).join(' '); },
      contains: name => this.className.split(/\s+/).includes(name),
      toggle: (name, enabled) => {
        if (enabled) this.classList.add(name);
        else this.classList.remove(name);
      },
    };
  }
  addEventListener(type, handler) { (this.events[type] ||= []).push(handler); }
  async emit(type) {
    for (const handler of this.events[type] || []) {
      await handler({ target: this, currentTarget: this, preventDefault() {}, stopPropagation() {} });
    }
  }
  append(...nodes) {
    this.children.push(...nodes);
    nodes.forEach(node => { if (typeof node === 'object') node.parent = this; });
  }
  appendChild(node) { this.append(node); return node; }
  prepend(...nodes) { this.children.unshift(...nodes); }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  querySelector(selector) {
    if (!this.nodes.has(selector)) this.nodes.set(selector, new Element());
    return this.nodes.get(selector);
  }
  querySelectorAll(selector) {
    if (selector.startsWith('.')) return descendants(this).filter(node => node !== this && node.classList?.contains(selector.slice(1)));
    return [];
  }
  getAttribute(name) { return this.attrs[name] || ''; }
  setAttribute(name, value) { this.attrs[name] = value; }
  focus() {} select() {} reset() {}
  remove() { this.isConnected = false; }
  closest() { return this.parent || this; }
  close() { this.open = false; }
  showModal() { this.open = true; }
  get childElementCount() { return this.children.length; }
}

function descendants(node) {
  return [node, ...(node.children || []).flatMap(child => typeof child === 'object' ? descendants(child) : [])];
}

function harness() {
  const nodes = new Map(), timers = new Map(), intervals = new Map();
  let nextTimer = 1;
  const element = selector => {
    if (!nodes.has(selector)) nodes.set(selector, new Element());
    return nodes.get(selector);
  };
  const nc = { export(name, value) { this[name] = value; } };
  const window = { NestCafe: nc, addEventListener() {}, dispatchEvent() {} };
  const context = vm.createContext({
    window,
    document: { querySelector: element, querySelectorAll: () => [], createElement: tag => new Element(tag),
      createTextNode: text => ({ textContent: text }), body: new Element(), documentElement: new Element() },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    console, Intl, AbortController, Event: class {}, CustomEvent: class {},
    performance: { now: () => 100 }, requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    setTimeout: (fn, ms) => { const id = nextTimer++; timers.set(id, { fn, ms }); return id; },
    clearTimeout: id => timers.delete(id),
    setInterval: fn => { const id = nextTimer++; intervals.set(id, fn); return id; },
    clearInterval: id => intervals.delete(id),
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
  });
  const source = file => fs.readFileSync(path.join(__dirname, '../../js', file), 'utf8');
  const load = file => vm.runInContext(source(file), context, { filename: file });
  const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
  return { context, nc, window, element, timers, intervals, load, source, flush };
}

module.exports = { Element, descendants, harness };
