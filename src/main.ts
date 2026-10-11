import { App, Modal, Notice, Plugin, Setting, SuggestModal, TFile, normalizePath } from 'obsidian';
import { compare, Difference, format, measurement, parseMeasurementLines, readRevision, report, Revision, revisionNote, validateRevision } from './core';

class NotePicker extends SuggestModal<TFile> {
  constructor(app: App, title: string, private done: (file: TFile) => void) { super(app); this.setPlaceholder(title); }
  getSuggestions(query: string): TFile[] { return this.app.vault.getMarkdownFiles().filter(f => f.path.toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0, 100); }
  renderSuggestion(file: TFile, el: HTMLElement): void { el.setText(file.path); }
  onChooseSuggestion(file: TFile): void { this.done(file); }
}
class CreateRevisionModal extends Modal {
  constructor(app: App, private save: (revision: Revision) => Promise<void>) { super(app); }
  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('sewlore-measurements');
    contentEl.createEl('h2', { text: 'Create measurement revision' });
    contentEl.createEl('p', { text: 'Record actual measurements. Each line uses three tab-separated fields: label, value, unit. You can paste three columns from a spreadsheet. Accepted units: mm, cm, in.' });
    let project = '', revision = '', date = new Date().toISOString().slice(0, 10), notes = '', readings = '';
    new Setting(contentEl).setName('Project').addText(t => t.setPlaceholder('Project label').onChange(v => { project = v; }));
    new Setting(contentEl).setName('Revision').addText(t => t.setPlaceholder('Revision label').onChange(v => { revision = v; }));
    new Setting(contentEl).setName('Measurement date').addText(t => t.setValue(date).onChange(v => { date = v; }));
    new Setting(contentEl).setName('Measurements').setDesc('Example format: bust [tab] 92 [tab] cm. Example values are illustrative, not specimen results.').addTextArea(t => t.setPlaceholder('Paste tab-separated measurements').onChange(v => { readings = v; }));
    new Setting(contentEl).setName('Method and notes').addTextArea(t => t.onChange(v => { notes = v; }));
    const error = contentEl.createEl('p', { cls: 'sewlore-error' });
    new Setting(contentEl).addButton(button => button.setButtonText('Create revision note').setCta().onClick(async () => {
      button.setDisabled(true);
      try { await this.save(validateRevision({ schemaVersion: 1, project, revision, date, notes, measurements: parseMeasurementLines(readings) })); this.close(); }
      catch (e) { error.setText(e instanceof Error ? e.message : String(e)); button.setDisabled(false); }
    }));
  }
  onClose(): void { this.contentEl.empty(); }
}
class ComparisonModal extends Modal {
  constructor(app: App, private before: Revision, private after: Revision, private rows: Difference[], private save: () => Promise<void>) { super(app); }
  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('sewlore-measurements');
    contentEl.createEl('h2', { text: `${this.before.project}: ${this.before.revision} → ${this.after.revision}` });
    contentEl.createEl('p', { text: 'Delta = after − before, normalized to mm. Positive means larger. Labels are case-sensitive. A result is not a fit approval or material certification.' });
    const wrapper = contentEl.createDiv({ cls: 'sewlore-table-wrap' });
    const table = wrapper.createEl('table');
    const header = table.createEl('thead').createEl('tr');
    for (const title of ['Label', 'Before', 'After', 'Delta (mm)', 'Delta (%)', 'Status']) header.createEl('th', { text: title });
    const body = table.createEl('tbody');
    for (const r of this.rows) {
      const row = body.createEl('tr');
      const cells = [r.label, measurement(r.before), measurement(r.after), r.deltaMm === undefined ? '—' : format(r.deltaMm), r.deltaPercent === undefined ? '—' : format(r.deltaPercent), r.status];
      for (const value of cells) row.createEl('td', { text: value });
    }
    const error = contentEl.createEl('p', { cls: 'sewlore-error' });
    new Setting(contentEl).addButton(b => b.setButtonText('Save separate comparison note').setCta().onClick(async () => { b.setDisabled(true); try { await this.save(); this.close(); } catch (e) { error.setText(e instanceof Error ? e.message : String(e)); b.setDisabled(false); } }));
  }
  onClose(): void { this.contentEl.empty(); }
}
export default class MeasurementRevisions extends Plugin {
  async onload(): Promise<void> {
    this.addCommand({ id: 'create-revision', name: 'Create revision', callback: () => {
      new CreateRevisionModal(this.app, async r => { await this.createNote('Sewlore measurements', `Revision ${r.revision}`, revisionNote(r)); }).open();
    } });
    this.addCommand({ id: 'compare-revisions', name: 'Compare two revisions', callback: () => {
      new NotePicker(this.app, 'Choose the BEFORE revision note', beforeFile => {
        new NotePicker(this.app, 'Choose the AFTER revision note', afterFile => {
          void this.openComparison(beforeFile, afterFile).catch(e => new Notice(e instanceof Error ? e.message : String(e)));
        }).open();
      }).open();
    } });
    this.addCommand({ id: 'validate-revision', name: 'Validate active revision', callback: () => {
      void this.validateActive().catch(e => new Notice(e instanceof Error ? e.message : String(e)));
    } });
  }
  private async validateActive(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file) throw new Error('Open a measurement revision note first.');
    const r = readRevision(await this.app.vault.read(file));
    new Notice(`Valid: ${r.project}, ${r.revision}, ${r.measurements.length} measurements.`);
  }
  private async openComparison(beforeFile: TFile, afterFile: TFile): Promise<void> {
    if (beforeFile.path === afterFile.path) throw new Error('Choose two different revision notes.');
    const before = readRevision(await this.app.vault.read(beforeFile));
    const after = readRevision(await this.app.vault.read(afterFile));
    const rows = compare(before, after);
    new ComparisonModal(this.app, before, after, rows, async () => { await this.createNote('Sewlore comparisons', `Comparison ${before.revision} to ${after.revision}`, report(before, after, beforeFile.path, afterFile.path)); }).open();
  }
  private async createNote(folder: string, label: string, body: string): Promise<void> {
    const directory = normalizePath(folder);
    const existing = this.app.vault.getAbstractFileByPath(directory);
    if (existing instanceof TFile) throw new Error(`A file already uses the folder path ${directory}.`);
    if (!existing) await this.app.vault.createFolder(directory);
    const safe = [...label].map(c => c.charCodeAt(0) < 32 ? '-' : c).join('').replace(/[\\/:*?"<>|]/g, '-').slice(0, 100).trim() || 'Measurement';
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    let path = normalizePath(`${directory}/${safe} ${stamp}.md`), suffix = 1;
    while (this.app.vault.getAbstractFileByPath(path)) path = normalizePath(`${directory}/${safe} ${stamp}-${suffix++}.md`);
    const note = await this.app.vault.create(path, body);
    await this.app.workspace.getLeaf(false).openFile(note);
  }
}
