export type Unit = 'mm' | 'cm' | 'in';
export interface Measurement { label: string; value: number; unit: Unit }
export interface Revision { schemaVersion: 1; project: string; revision: string; date: string; notes: string; measurements: Measurement[] }
export interface Difference { label: string; status: 'changed' | 'unchanged' | 'added' | 'removed'; before?: Measurement; after?: Measurement; beforeMm?: number; afterMm?: number; deltaMm?: number; deltaPercent?: number }
export function unit(v: unknown): Unit { if (v !== 'mm' && v !== 'cm' && v !== 'in') throw new Error('Units must be mm, cm, or in.'); return v; }
export function toMm(value: number, from: Unit): number { return value * (from === 'cm' ? 10 : from === 'in' ? 25.4 : 1); }
export function string(v: unknown, name: string, max = 200): string { if (typeof v !== 'string' || v.length > max || v.includes('\0')) throw new Error(`${name} must be text of at most ${max} characters.`); return v; }
export function validateRevision(value: unknown): Revision {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Revision must be a JSON object.');
  const r = value as Record<string, unknown>;
  if (r.schemaVersion !== 1) throw new Error('Unsupported revision schema. Use schemaVersion 1.');
  const project = string(r.project, 'Project').trim(), revision = string(r.revision, 'Revision').trim();
  if (!project || !revision) throw new Error('Project and revision labels are required.');
  const date = string(r.date, 'Date', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Use a valid YYYY-MM-DD date.');
  if (!Array.isArray(r.measurements) || r.measurements.length === 0 || r.measurements.length > 200) throw new Error('A revision must contain 1–200 measurements.');
  const measurements = r.measurements.map(v => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Invalid measurement entry.');
    const m = v as Record<string, unknown>;
    const label = string(m.label, 'Measurement label', 100).trim();
    if (!label) throw new Error('Measurement labels cannot be empty.');
    if (typeof m.value !== 'number' || !Number.isFinite(m.value) || m.value <= 0 || m.value > 1e9 || m.value < 1e-9) throw new Error(`${label}: value must be a positive finite number between 1e-9 and 1e9.`);
    return { label, value: m.value, unit: unit(m.unit) };
  });
  if (new Set(measurements.map(m => m.label)).size !== measurements.length) throw new Error('Measurement labels must be unique within a revision. Labels are case-sensitive.');
  return { schemaVersion: 1, project, revision, date, notes: string(r.notes ?? '', 'Notes', 5000), measurements };
}
export function readRevision(markdown: string): Revision {
  if (markdown.length > 2_000_000) throw new Error('Selected note exceeds the 2 MB parser limit.');
  const matches = [...markdown.matchAll(/^```sewlore-revision\s*\r?\n([\s\S]*?)^```\s*$/gm)];
  if (matches.length !== 1) throw new Error('The note must contain exactly one sewlore-revision JSON code block.');
  return validateRevision(JSON.parse(matches[0][1]));
}
export function compare(before: Revision, after: Revision): Difference[] {
  if (before.project !== after.project) throw new Error('Choose revisions with exactly the same project label.');
  const left = new Map(before.measurements.map(m => [m.label, m]));
  const right = new Map(after.measurements.map(m => [m.label, m]));
  const labels = [...new Set([...left.keys(), ...right.keys()])];
  return labels.map(label => {
    const a = left.get(label), b = right.get(label);
    if (!a) return { label, status: 'added', after: b, afterMm: toMm(b!.value, b!.unit) };
    if (!b) return { label, status: 'removed', before: a, beforeMm: toMm(a.value, a.unit) };
    const beforeMm = toMm(a.value, a.unit), afterMm = toMm(b.value, b.unit), deltaMm = afterMm - beforeMm;
    const unchanged = Math.abs(deltaMm) <= 32 * Number.EPSILON * Math.max(beforeMm, afterMm);
    return { label, status: unchanged ? 'unchanged' : 'changed', before: a, after: b, beforeMm, afterMm, deltaMm: unchanged ? 0 : deltaMm, deltaPercent: unchanged ? 0 : deltaMm / beforeMm * 100 };
  });
}
export function format(n: number): string { return n === 0 ? '0' : Math.abs(n) < 0.0001 ? n.toExponential(4) : Number(n.toFixed(4)).toString(); }
export function md(value: unknown): string { return String(value).replaceAll('\\', '\\\\').replaceAll('|', '\\|').replaceAll('\r', '').replaceAll('\n', '<br>').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('[', '\\[').replaceAll(']', '\\]'); }
export function measurement(m?: Measurement): string { return m ? `${m.value} ${m.unit}` : '—'; }
export function report(before: Revision, after: Revision, beforePath: string, afterPath: string): string {
  const rows = compare(before, after);
  const lines = ['# Measurement revision comparison', '', `Project: ${md(before.project)}`, '', `Before: ${md(before.revision)} (${before.date}); source: ${md(beforePath)}`, '', `After: ${md(after.revision)} (${after.date}); source: ${md(afterPath)}`, '', 'Delta = after − before, normalized to mm. Percent = delta ÷ before × 100. Positive values indicate an increase. Labels are case-sensitive; match points with the same measurement method. No tolerance or fit approval is implied.', '', '| Label | Before | After | Delta (mm) | Delta (%) | Status |', '| --- | --- | --- | --- | --- | --- |'];
  for (const r of rows) lines.push(`| ${md(r.label)} | ${measurement(r.before)} | ${measurement(r.after)} | ${r.deltaMm === undefined ? '—' : format(r.deltaMm)} | ${r.deltaPercent === undefined ? '—' : format(r.deltaPercent)} | ${r.status} |`);
  lines.push('', '## Before revision notes', '', md(before.notes) || 'None', '', '## After revision notes', '', md(after.notes) || 'None');
  return lines.join('\n');
}
export function revisionNote(r: Revision): string {
  const safe = validateRevision(r);
  // Escape backticks in JSON strings so a note cannot prematurely close the data fence.
  const json = JSON.stringify(safe, null, 2).replaceAll('`', '\\u0060');
  return `# Measurement revision\n\nProject: ${md(safe.project)}\n\nRevision: ${md(safe.revision)}\n\nEdit the JSON below to record actual measurements. Labels identify the same measuring point across revisions.\n\n\`\`\`sewlore-revision\n${json}\n\`\`\`\n`;
}
export function parseMeasurementLines(input: string): Measurement[] {
  if (input.length > 30_000) throw new Error('Measurement input exceeds 30,000 characters.');
  const lines = input.split(/\r?\n/).filter(l => l.trim());
  return lines.map((line, i) => {
    const cells = line.split('\t');
    if (cells.length !== 3) throw new Error(`Line ${i + 1}: use label, value, and unit separated by tabs.`);
    const label = cells[0].trim(), number = cells[1].trim();
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(number)) throw new Error(`Line ${i + 1}: use a positive decimal number with a decimal point.`);
    return { label, value: Number(number), unit: unit(cells[2].trim()) };
  });
}
