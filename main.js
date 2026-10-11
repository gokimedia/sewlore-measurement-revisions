/* Measurement Revisions — MIT © 2026 Sewlore. */
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => MeasurementRevisions
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// src/core.ts
function unit(v) {
  if (v !== "mm" && v !== "cm" && v !== "in") throw new Error("Units must be mm, cm, or in.");
  return v;
}
function toMm(value, from) {
  return value * (from === "cm" ? 10 : from === "in" ? 25.4 : 1);
}
function string(v, name, max = 200) {
  if (typeof v !== "string" || v.length > max || v.includes("\0")) throw new Error(`${name} must be text of at most ${max} characters.`);
  return v;
}
function validateRevision(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Revision must be a JSON object.");
  const r = value;
  if (r.schemaVersion !== 1) throw new Error("Unsupported revision schema. Use schemaVersion 1.");
  const project = string(r.project, "Project").trim(), revision = string(r.revision, "Revision").trim();
  if (!project || !revision) throw new Error("Project and revision labels are required.");
  const date = string(r.date, "Date", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error("Use a valid YYYY-MM-DD date.");
  if (!Array.isArray(r.measurements) || r.measurements.length === 0 || r.measurements.length > 200) throw new Error("A revision must contain 1\u2013200 measurements.");
  const measurements = r.measurements.map((v) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Invalid measurement entry.");
    const m = v;
    const label = string(m.label, "Measurement label", 100).trim();
    if (!label) throw new Error("Measurement labels cannot be empty.");
    if (typeof m.value !== "number" || !Number.isFinite(m.value) || m.value <= 0 || m.value > 1e9 || m.value < 1e-9) throw new Error(`${label}: value must be a positive finite number between 1e-9 and 1e9.`);
    return { label, value: m.value, unit: unit(m.unit) };
  });
  if (new Set(measurements.map((m) => m.label)).size !== measurements.length) throw new Error("Measurement labels must be unique within a revision. Labels are case-sensitive.");
  return { schemaVersion: 1, project, revision, date, notes: string(r.notes ?? "", "Notes", 5e3), measurements };
}
function readRevision(markdown) {
  if (markdown.length > 2e6) throw new Error("Selected note exceeds the 2 MB parser limit.");
  const matches = [...markdown.matchAll(/^```sewlore-revision\s*\r?\n([\s\S]*?)^```\s*$/gm)];
  if (matches.length !== 1) throw new Error("The note must contain exactly one sewlore-revision JSON code block.");
  return validateRevision(JSON.parse(matches[0][1]));
}
function compare(before, after) {
  if (before.project !== after.project) throw new Error("Choose revisions with exactly the same project label.");
  const left = new Map(before.measurements.map((m) => [m.label, m]));
  const right = new Map(after.measurements.map((m) => [m.label, m]));
  const labels = [.../* @__PURE__ */ new Set([...left.keys(), ...right.keys()])];
  return labels.map((label) => {
    const a = left.get(label), b = right.get(label);
    if (!a) return { label, status: "added", after: b, afterMm: toMm(b.value, b.unit) };
    if (!b) return { label, status: "removed", before: a, beforeMm: toMm(a.value, a.unit) };
    const beforeMm = toMm(a.value, a.unit), afterMm = toMm(b.value, b.unit), deltaMm = afterMm - beforeMm;
    const unchanged = Math.abs(deltaMm) <= 32 * Number.EPSILON * Math.max(beforeMm, afterMm);
    return { label, status: unchanged ? "unchanged" : "changed", before: a, after: b, beforeMm, afterMm, deltaMm: unchanged ? 0 : deltaMm, deltaPercent: unchanged ? 0 : deltaMm / beforeMm * 100 };
  });
}
function format(n) {
  return n === 0 ? "0" : Math.abs(n) < 1e-4 ? n.toExponential(4) : Number(n.toFixed(4)).toString();
}
function md(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("|", "\\|").replaceAll("\r", "").replaceAll("\n", "<br>").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("[", "\\[").replaceAll("]", "\\]");
}
function measurement(m) {
  return m ? `${m.value} ${m.unit}` : "\u2014";
}
function report(before, after, beforePath, afterPath) {
  const rows = compare(before, after);
  const lines = ["# Measurement revision comparison", "", `Project: ${md(before.project)}`, "", `Before: ${md(before.revision)} (${before.date}); source: ${md(beforePath)}`, "", `After: ${md(after.revision)} (${after.date}); source: ${md(afterPath)}`, "", "Delta = after \u2212 before, normalized to mm. Percent = delta \xF7 before \xD7 100. Positive values indicate an increase. Labels are case-sensitive; match points with the same measurement method. No tolerance or fit approval is implied.", "", "| Label | Before | After | Delta (mm) | Delta (%) | Status |", "| --- | --- | --- | --- | --- | --- |"];
  for (const r of rows) lines.push(`| ${md(r.label)} | ${measurement(r.before)} | ${measurement(r.after)} | ${r.deltaMm === void 0 ? "\u2014" : format(r.deltaMm)} | ${r.deltaPercent === void 0 ? "\u2014" : format(r.deltaPercent)} | ${r.status} |`);
  lines.push("", "## Before revision notes", "", md(before.notes) || "None", "", "## After revision notes", "", md(after.notes) || "None");
  return lines.join("\n");
}
function revisionNote(r) {
  const safe = validateRevision(r);
  const json = JSON.stringify(safe, null, 2).replaceAll("`", "\\u0060");
  return `# Measurement revision

Project: ${md(safe.project)}

Revision: ${md(safe.revision)}

Edit the JSON below to record actual measurements. Labels identify the same measuring point across revisions.

\`\`\`sewlore-revision
${json}
\`\`\`
`;
}
function parseMeasurementLines(input) {
  if (input.length > 3e4) throw new Error("Measurement input exceeds 30,000 characters.");
  const lines = input.split(/\r?\n/).filter((l) => l.trim());
  return lines.map((line, i) => {
    const cells = line.split("	");
    if (cells.length !== 3) throw new Error(`Line ${i + 1}: use label, value, and unit separated by tabs.`);
    const label = cells[0].trim(), number = cells[1].trim();
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(number)) throw new Error(`Line ${i + 1}: use a positive decimal number with a decimal point.`);
    return { label, value: Number(number), unit: unit(cells[2].trim()) };
  });
}

// src/main.ts
var NotePicker = class extends import_obsidian.SuggestModal {
  constructor(app, title, done) {
    super(app);
    this.done = done;
    this.setPlaceholder(title);
  }
  getSuggestions(query) {
    return this.app.vault.getMarkdownFiles().filter((f) => f.path.toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0, 100);
  }
  renderSuggestion(file, el) {
    el.setText(file.path);
  }
  onChooseSuggestion(file) {
    this.done(file);
  }
};
var CreateRevisionModal = class extends import_obsidian.Modal {
  constructor(app, save) {
    super(app);
    this.save = save;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("sewlore-measurements");
    contentEl.createEl("h2", { text: "Create measurement revision" });
    contentEl.createEl("p", { text: "Record actual measurements. Each line uses three tab-separated fields: label, value, unit. You can paste three columns from a spreadsheet. Accepted units: mm, cm, in." });
    let project = "", revision = "", date = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), notes = "", readings = "";
    new import_obsidian.Setting(contentEl).setName("Project").addText((t) => t.setPlaceholder("Project label").onChange((v) => {
      project = v;
    }));
    new import_obsidian.Setting(contentEl).setName("Revision").addText((t) => t.setPlaceholder("Revision label").onChange((v) => {
      revision = v;
    }));
    new import_obsidian.Setting(contentEl).setName("Measurement date").addText((t) => t.setValue(date).onChange((v) => {
      date = v;
    }));
    new import_obsidian.Setting(contentEl).setName("Measurements").setDesc("Example format: bust [tab] 92 [tab] cm. Example values are illustrative, not specimen results.").addTextArea((t) => t.setPlaceholder("Paste tab-separated measurements").onChange((v) => {
      readings = v;
    }));
    new import_obsidian.Setting(contentEl).setName("Method and notes").addTextArea((t) => t.onChange((v) => {
      notes = v;
    }));
    const error = contentEl.createEl("p", { cls: "sewlore-error" });
    new import_obsidian.Setting(contentEl).addButton((button) => button.setButtonText("Create revision note").setCta().onClick(async () => {
      button.setDisabled(true);
      try {
        await this.save(validateRevision({ schemaVersion: 1, project, revision, date, notes, measurements: parseMeasurementLines(readings) }));
        this.close();
      } catch (e) {
        error.setText(e instanceof Error ? e.message : String(e));
        button.setDisabled(false);
      }
    }));
  }
  onClose() {
    this.contentEl.empty();
  }
};
var ComparisonModal = class extends import_obsidian.Modal {
  constructor(app, before, after, rows, save) {
    super(app);
    this.before = before;
    this.after = after;
    this.rows = rows;
    this.save = save;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("sewlore-measurements");
    contentEl.createEl("h2", { text: `${this.before.project}: ${this.before.revision} \u2192 ${this.after.revision}` });
    contentEl.createEl("p", { text: "Delta = after \u2212 before, normalized to mm. Positive means larger. Labels are case-sensitive. A result is not a fit approval or material certification." });
    const wrapper = contentEl.createDiv({ cls: "sewlore-table-wrap" });
    const table = wrapper.createEl("table");
    const header = table.createEl("thead").createEl("tr");
    for (const title of ["Label", "Before", "After", "Delta (mm)", "Delta (%)", "Status"]) header.createEl("th", { text: title });
    const body = table.createEl("tbody");
    for (const r of this.rows) {
      const row = body.createEl("tr");
      const cells = [r.label, measurement(r.before), measurement(r.after), r.deltaMm === void 0 ? "\u2014" : format(r.deltaMm), r.deltaPercent === void 0 ? "\u2014" : format(r.deltaPercent), r.status];
      for (const value of cells) row.createEl("td", { text: value });
    }
    const error = contentEl.createEl("p", { cls: "sewlore-error" });
    new import_obsidian.Setting(contentEl).addButton((b) => b.setButtonText("Save separate comparison note").setCta().onClick(async () => {
      b.setDisabled(true);
      try {
        await this.save();
        this.close();
      } catch (e) {
        error.setText(e instanceof Error ? e.message : String(e));
        b.setDisabled(false);
      }
    }));
  }
  onClose() {
    this.contentEl.empty();
  }
};
var MeasurementRevisions = class extends import_obsidian.Plugin {
  async onload() {
    this.addCommand({ id: "create-revision", name: "Create revision", callback: () => {
      new CreateRevisionModal(this.app, async (r) => {
        await this.createNote("Sewlore measurements", `Revision ${r.revision}`, revisionNote(r));
      }).open();
    } });
    this.addCommand({ id: "compare-revisions", name: "Compare two revisions", callback: () => {
      new NotePicker(this.app, "Choose the BEFORE revision note", (beforeFile) => {
        new NotePicker(this.app, "Choose the AFTER revision note", (afterFile) => {
          void this.openComparison(beforeFile, afterFile).catch((e) => new import_obsidian.Notice(e instanceof Error ? e.message : String(e)));
        }).open();
      }).open();
    } });
    this.addCommand({ id: "validate-revision", name: "Validate active revision", callback: () => {
      void this.validateActive().catch((e) => new import_obsidian.Notice(e instanceof Error ? e.message : String(e)));
    } });
  }
  async validateActive() {
    const file = this.app.workspace.getActiveFile();
    if (!file) throw new Error("Open a measurement revision note first.");
    const r = readRevision(await this.app.vault.read(file));
    new import_obsidian.Notice(`Valid: ${r.project}, ${r.revision}, ${r.measurements.length} measurements.`);
  }
  async openComparison(beforeFile, afterFile) {
    if (beforeFile.path === afterFile.path) throw new Error("Choose two different revision notes.");
    const before = readRevision(await this.app.vault.read(beforeFile));
    const after = readRevision(await this.app.vault.read(afterFile));
    const rows = compare(before, after);
    new ComparisonModal(this.app, before, after, rows, async () => {
      await this.createNote("Sewlore comparisons", `Comparison ${before.revision} to ${after.revision}`, report(before, after, beforeFile.path, afterFile.path));
    }).open();
  }
  async createNote(folder, label, body) {
    const directory = (0, import_obsidian.normalizePath)(folder);
    const existing = this.app.vault.getAbstractFileByPath(directory);
    if (existing instanceof import_obsidian.TFile) throw new Error(`A file already uses the folder path ${directory}.`);
    if (!existing) await this.app.vault.createFolder(directory);
    const safe = [...label].map((c) => c.charCodeAt(0) < 32 ? "-" : c).join("").replace(/[\\/:*?"<>|]/g, "-").slice(0, 100).trim() || "Measurement";
    const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    let path = (0, import_obsidian.normalizePath)(`${directory}/${safe} ${stamp}.md`), suffix = 1;
    while (this.app.vault.getAbstractFileByPath(path)) path = (0, import_obsidian.normalizePath)(`${directory}/${safe} ${stamp}-${suffix++}.md`);
    const note = await this.app.vault.create(path, body);
    await this.app.workspace.getLeaf(false).openFile(note);
  }
};
