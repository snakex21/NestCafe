const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const i18n = require('../js/core/i18n.js');

const uiRoot = path.join(__dirname, '..');
const repoRoot = path.join(uiRoot, '..');
const localesDir = path.join(uiRoot, 'locales');
const readCatalog = code => JSON.parse(fs.readFileSync(path.join(localesDir, `${code}.json`), 'utf8'));
const codes = i18n.supported.map(item => item.code);
const source = readCatalog(i18n.sourceLang);
const sourceKeys = Object.keys(source).sort();

function params(message) {
  return [...new Set([...message.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map(m => m[1]))].sort();
}

function integerCategories(lang) {
  const rules = new Intl.PluralRules(lang);
  const categories = new Set();
  for (let n = 0; n <= 1000; n++) categories.add(rules.select(n));
  return categories;
}

function walk(dir, filter, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, filter, out);
    else if (filter(full)) out.push(full);
  }
  return out;
}

const uiScripts = [
  ...walk(path.join(uiRoot, 'js'), file => file.endsWith('.js')),
  path.join(repoRoot, 'modules', 'ocr-viewer', 'native.js'),
].filter(file => fs.existsSync(file));

test('the 27 SuperCli languages are supported and each has a catalog', () => {
  assert.equal(codes.length, 27);
  assert.ok(codes.includes('pl') && codes.includes('en'));
  const files = fs.readdirSync(localesDir).filter(name => name.endsWith('.json')).map(name => name.slice(0, -5)).sort();
  assert.deepEqual(files, [...codes].sort());
});

test('the Polish source catalog is non-trivial and has no empty messages', () => {
  assert.ok(sourceKeys.length > 300, `only ${sourceKeys.length} keys`);
  for (const key of sourceKeys) assert.ok(typeof source[key] === 'string' && source[key].trim(), `empty pl message: ${key}`);
});

for (const code of codes) {
  test(`catalog ${code}: same keys as pl, matching placeholders and plural forms`, () => {
    const catalog = readCatalog(code);
    const keys = Object.keys(catalog).sort();
    const missing = sourceKeys.filter(key => !(key in catalog));
    const extra = keys.filter(key => !(key in source));
    assert.deepEqual(missing, [], `${code}: missing keys`);
    assert.deepEqual(extra, [], `${code}: unknown keys`);
    const needed = integerCategories(code);
    for (const key of sourceKeys) {
      const message = catalog[key];
      assert.ok(typeof message === 'string' && message.trim(), `${code}.${key} is empty`);
      assert.deepEqual(params(message), params(source[key]), `${code}.${key}: placeholders differ from pl`);
      const plural = i18n.isPluralMessage(source[key]);
      assert.equal(i18n.isPluralMessage(message), plural, `${code}.${key}: plural format differs from pl`);
      if (plural) {
        const forms = i18n.pluralForms(message);
        for (const category of needed) {
          assert.ok(category in forms, `${code}.${key}: missing plural form "${category}"`);
        }
      }
    }
  });
}

test('Polish plurals follow CLDR one/few/many', () => {
  const tr = i18n.createTranslator({ pl: { f: 'one {# plik} few {# pliki} many {# plików} other {# pliku}' }, en: {} }, 'pl');
  assert.equal(tr.tn('f', 1), '1 plik');
  assert.equal(tr.tn('f', 2), '2 pliki');
  assert.equal(tr.tn('f', 5), '5 plików');
  assert.equal(tr.tn('f', 12), '12 plików');
  assert.equal(tr.tn('f', 22), '22 pliki');
  assert.equal(tr.tn('f', 0), '0 plików');
});

test('English plurals and fallback to the form "other"', () => {
  const tr = i18n.createTranslator({ en: { f: 'one {# file in {dir}} other {# files in {dir}}' } }, 'en');
  assert.equal(tr.tn('f', 1, { dir: 'A' }), '1 file in A');
  assert.equal(tr.tn('f', 3, { dir: 'A' }), '3 files in A');
  const ru = i18n.createTranslator({ ru: { f: 'other {# файла}' } }, 'ru');
  assert.equal(ru.tn('f', 5), '5 файла');
});

test('plural forms may contain named params and missing forms never crash', () => {
  assert.deepEqual({ ...i18n.pluralForms('one {# file in {dir}} few {# pliki w {dir}} other {# files in {dir}}') },
    { one: '# file in {dir}', few: '# pliki w {dir}', other: '# files in {dir}' });
  assert.equal(i18n.isPluralMessage('{name} other things'), false);
  assert.equal(i18n.isPluralMessage('one {# a} other {# b}'), true);
  const pl = i18n.createTranslator({ pl: { f: 'one {# plik w {dir}} few {# pliki w {dir}} many {# plików w {dir}} other {# pliku w {dir}}' } }, 'pl');
  assert.equal(pl.tn('f', 3, { dir: 'C:' }), '3 pliki w C:');
  assert.equal(pl.t('f', { count: 5, dir: 'C:' }), '5 plików w C:');
  const plain = i18n.createTranslator({ en: { g: 'Found {count} items' } }, 'en');
  assert.equal(plain.tn('g', 4), 'Found 4 items');
});

test('t() interpolates named params and falls back ui language -> en -> pl -> key', () => {
  const tr = i18n.createTranslator({
    de: { a: 'Hallo {name}' },
    en: { a: 'Hello {name}', b: 'Only English' },
    pl: { a: 'Cześć {name}', b: 'Tylko polski', c: 'Tylko w źródle' },
  }, 'de');
  assert.equal(tr.t('a', { name: 'Ola' }), 'Hallo Ola');
  assert.equal(tr.t('b'), 'Only English');
  assert.equal(tr.t('c'), 'Tylko w źródle');
  assert.equal(tr.t('missing.key'), 'missing.key');
  assert.equal(tr.t('a'), 'Hallo {name}');
});

test('language resolution: saved choice, then cached, then OS/browser, then English', () => {
  assert.equal(i18n.resolveLanguage({ saved: 'de', cached: 'fr', system: ['pl-PL'] }), 'de');
  assert.equal(i18n.resolveLanguage({ saved: '', cached: 'fr', system: ['pl-PL'] }), 'fr');
  assert.equal(i18n.resolveLanguage({ system: ['ja-JP', 'pl-PL'] }), 'pl');
  assert.equal(i18n.resolveLanguage({ system: ['ja-JP'] }), 'en');
  assert.equal(i18n.resolveLanguage({}), 'en');
  assert.equal(i18n.normalize('pt-PT'), 'pt-BR');
  assert.equal(i18n.normalize('no_NO'), 'nb');
  assert.equal(i18n.normalize('sr-Cyrl-RS'), 'sr-Latn');
  assert.equal(i18n.normalize('PL_pl.UTF-8'), 'pl');
});

// Strip comments so English explanations in code do not matter.
function stripJsComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[\s;{}(),])\/\/.*$/gm, '$1');
}
const POLISH_LETTERS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
// Common Polish UI words without diacritics, as whole words inside text.
const POLISH_WORDS = /(["'`>]\s*|\s)(Ustawienia|Zapisz|Anuluj|Zamknij|Dodaj|Historia|Rozmowa|Brak|Wybierz|Pliki|Folder[uy]|Otworz|Sprawdz|Odswiez|Wyczysc|Szukaj|Pomin|Dalej|Gotowy|Model[uy]|Dostawc[ay]|Integracje|Pamiec|Harmonogram|nie|jest|lub|oraz|przez|dla)\b(?=[^\n]*["'`<])/;

test('no hardcoded Polish text in the UI code', () => {
  const offenders = [];
  for (const file of uiScripts) {
    if (file.endsWith(path.join('core', 'i18n.js'))) continue;
    const lines = stripJsComments(fs.readFileSync(file, 'utf8')).split('\n');
    lines.forEach((line, index) => {
      if (POLISH_LETTERS.test(line) || POLISH_WORDS.test(line)) offenders.push(`${path.relative(repoRoot, file)}:${index + 1}: ${line.trim().slice(0, 100)}`);
    });
  }
  const html = fs.readFileSync(path.join(uiRoot, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  html.split('\n').forEach((line, index) => {
    if (POLISH_LETTERS.test(line) || POLISH_WORDS.test(line)) offenders.push(`native-ui/index.html:${index + 1}: ${line.trim().slice(0, 100)}`);
  });
  assert.deepEqual(offenders, []);
});

test('every literal key used by the UI exists in the pl catalog', () => {
  const missing = [];
  const keyPattern = /\b(?:t|tn|i18n\.t|i18n\.tn|NestCafe\.t|NestCafe\.tn)\(\s*["'`]([A-Za-z][\w.-]*)["'`]/g;
  for (const file of uiScripts) {
    const text = stripJsComments(fs.readFileSync(file, 'utf8'));
    for (const match of text.matchAll(keyPattern)) {
      if (!(match[1] in source)) missing.push(`${path.relative(repoRoot, file)}: ${match[1]}`);
    }
  }
  const html = fs.readFileSync(path.join(uiRoot, 'index.html'), 'utf8');
  for (const match of html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)) {
    if (!(match[1] in source)) missing.push(`index.html: ${match[1]}`);
  }
  assert.deepEqual([...new Set(missing)], []);
});
