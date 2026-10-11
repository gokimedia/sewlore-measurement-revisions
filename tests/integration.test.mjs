import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const c = createRequire(import.meta.url)('../qa/compiled/core.cjs');
const source = await readFile(new URL('../main.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
async function harness(seed = []) {
  const commands = new Map(), files = new Map(), notices = [], modals = [], settings = [];
  let openedFile, activeFile;
  class Element {
    constructor(tag = 'div', options = {}) { this.tag = tag; this.text = options.text ?? ''; this.children = []; this.classes = []; }
    createEl(tag, options) { const e = new Element(tag, options); this.children.push(e); return e; }
    createDiv(options) { return this.createEl('div', options); }
    addClass(c) { this.classes.push(c); }
    setText(t) { this.text = t; }
    empty() { this.children = []; }
  }
  class TFile { constructor(path, body = '') { this.path = path; this.body = body; } }
  class TFolder { constructor(path) { this.path = path; } }
  const app = { vault: {
    getMarkdownFiles: () => [...files.values()].filter(v => v instanceof TFile),
    async read(file) { return files.get(file.path).body; },
    getAbstractFileByPath: path => files.get(path),
    async createFolder(path) { if (files.has(path)) throw new Error('Exists'); files.set(path, new TFolder(path)); },
    async create(path, body) { if (files.has(path)) throw new Error('Would overwrite'); const f = new TFile(path, body); files.set(path, f); return f; },
  }, workspace: { getActiveFile: () => activeFile, getLeaf: () => ({ async openFile(file) { openedFile = file; } }) } };
  class Modal { constructor(app) { this.app = app; this.contentEl = new Element(); } open() { modals.push(this); this.onOpen?.(); } close() { this.closed = true; this.onClose?.(); } }
  class SuggestModal extends Modal { setPlaceholder(p) { this.placeholder = p; } }
  class Plugin { constructor(app) { this.app = app; } addCommand(c) { commands.set(c.id, c); } }
  class Notice { constructor(v) { notices.push(v); } }
  class Setting {
    constructor(el) { this.element = el; settings.push(this); }
    setName(n) { this.name = n; return this; } setDesc(d) { this.description = d; return this; }
    addText(cb) { return this.addInput(cb); } addTextArea(cb) { return this.addInput(cb); }
    addInput(cb) { const input = { setPlaceholder() { return this; }, setValue(v) { this.value = v; return this; }, onChange(fn) { this.change = fn; return this; } }; this.input = input; cb(input); return this; }
    addButton(cb) { const button = { setButtonText(t) { this.text = t; return this; }, setCta() { return this; }, setDisabled(v) { this.disabled = v; return this; }, onClick(fn) { this.click = fn; return this; } }; this.button = button; cb(button); return this; }
  }
  for (const [path, body] of seed) files.set(path, new TFile(path, body));
  const exported = { exports: {} };
  vm.runInNewContext(source, { module: exported, exports: exported.exports, require: name => { if (name !== 'obsidian') throw new Error(`Unexpected dependency ${name}`); return { Modal, SuggestModal, Plugin, Notice, Setting, TFile, normalizePath: p => p.replaceAll('\\', '/').replaceAll('//', '/') }; }, console }, { timeout: 2000 });
  const plugin = new exported.exports.default(app);
  await plugin.onload();
  return { app, files, commands, settings, modals, notices, plugin, active: path => { activeFile = files.get(path); }, opened: () => openedFile, run: id => commands.get(id).callback() };
}
const revision = (revision, measurements) => c.validateRevision({ schemaVersion: 1, project: 'Synthetic QA project', revision, date: '2026-10-11', notes: 'Synthetic fixture', measurements });
test('compiled Obsidian bundle creates a validated vault revision without a branding backlink', async () => {
  const h = await harness();
  assert.equal(h.commands.size, 3);
  h.run('create-revision');
  const input = name => h.settings.find(s => s.name === name).input;
  input('Project').change('Actual entered project');
  input('Revision').change('A/one');
  input('Measurements').change('bust\t92\tcm\nsleeve\t25.4\tin');
  input('Method and notes').change('User-entered notes');
  await h.settings.find(s => s.button?.text === 'Create revision note').button.click();
  assert.equal(h.files.size, 2);
  const file = h.opened();
  assert.ok(file.path.startsWith('Sewlore measurements/Revision A-one '));
  const r = c.readRevision(file.body);
  assert.equal(r.project, 'Actual entered project');
  assert.equal(r.measurements.length, 2);
  assert.ok(!file.body.includes('sewlore.com'));
  h.active(file.path);
  h.run('validate-revision');
  await tick();
  assert.match(h.notices.at(-1), /^Valid:/);
});
test('invalid measurement input leaves the vault untouched and keeps the create modal open', async () => {
  const h = await harness();
  h.run('create-revision');
  for (const [name, v] of [['Project', 'Project'], ['Revision', 'A'], ['Measurements', 'bust\t0\tcm']]) h.settings.find(s => s.name === name).input.change(v);
  const b = h.settings.find(s => s.button).button;
  await b.click();
  assert.equal(h.files.size, 0);
  assert.equal(h.modals[0].closed, undefined);
  assert.equal(b.disabled, false);
  assert.ok(h.modals[0].contentEl.children.some(e => e.text.includes('positive')));
});
test('compiled bundle displays independent differences and saves a new report without mutating sources', async () => {
  const a = c.revisionNote(revision('A', [{ label: 'bust', value: 100, unit: 'cm' }, { label: 'sleeve', value: 10, unit: 'in' }]));
  const b = c.revisionNote(revision('B', [{ label: 'bust', value: 1020, unit: 'mm' }, { label: 'sleeve', value: 9, unit: 'in' }]));
  const h = await harness([['A.md', a], ['B.md', b]]);
  h.run('compare-revisions');
  h.modals.at(-1).onChooseSuggestion(h.files.get('A.md'));
  h.modals.at(-1).onChooseSuggestion(h.files.get('B.md'));
  await tick();
  const modal = h.modals.at(-1);
  assert.equal(modal.rows[0].deltaMm, 20);
  assert.ok(Math.abs(modal.rows[1].deltaMm + 25.4) < 1e-10);
  await h.settings.at(-1).button.click();
  const file = h.opened();
  assert.ok(file.path.startsWith('Sewlore comparisons/'));
  assert.ok(file.body.includes('| bust | 100 cm | 1020 mm | 20 | 2 | changed |'));
  assert.equal(h.files.get('A.md').body, a);
  assert.equal(h.files.get('B.md').body, b);
  assert.ok(!file.body.includes('sewlore.com'));
});
test('same file, differing projects and malformed data produce notices without a write', async () => {
  const a = c.revisionNote(revision('A', [{ label: 'bust', value: 100, unit: 'cm' }]));
  const h = await harness([['A.md', a], ['bad.md', 'ordinary note']]);
  h.run('compare-revisions');
  h.modals.at(-1).onChooseSuggestion(h.files.get('A.md'));
  h.modals.at(-1).onChooseSuggestion(h.files.get('A.md'));
  await tick();
  assert.match(h.notices.at(-1), /different revision/);
  h.run('compare-revisions');
  h.modals.at(-1).onChooseSuggestion(h.files.get('A.md'));
  h.modals.at(-1).onChooseSuggestion(h.files.get('bad.md'));
  await tick();
  assert.match(h.notices.at(-1), /exactly one/);
  assert.equal(h.files.size, 2);
});
