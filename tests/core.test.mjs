import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const c = createRequire(import.meta.url)('../qa/compiled/core.cjs');
const revision = (patch = {}) => c.validateRevision({ schemaVersion: 1, project: 'Synthetic QA', revision: 'A', date: '2026-10-11', notes: 'Digital fixture; not real garment measurements', measurements: [{ label: 'bust', value: 100, unit: 'cm' }, { label: 'sleeve', value: 10, unit: 'in' }], ...patch });
test('unit normalized revision comparison distinguishes equivalence, change, added and removed', () => {
  const a = revision();
  const b = revision({ revision: 'B', measurements: [{ label: 'bust', value: 1020, unit: 'mm' }, { label: 'hem', value: 20, unit: 'cm' }] });
  const rows = c.compare(a, b);
  assert.equal(rows[0].status, 'changed');
  assert.equal(rows[0].deltaMm, 20);
  assert.equal(rows[0].deltaPercent, 2);
  assert.equal(rows[1].status, 'removed');
  assert.equal(rows[2].status, 'added');
  assert.equal(rows[2].deltaMm, undefined);
  const eq = c.compare(a, revision({ revision: 'C', measurements: [{ label: 'bust', value: 1000, unit: 'mm' }, { label: 'sleeve', value: 25.4, unit: 'cm' }] }));
  assert.ok(eq.every(r => r.status === 'unchanged' && r.deltaMm === 0));
});
test('negative changes remain negative and label matching is case-sensitive', () => {
  const a = revision({ measurements: [{ label: 'Bust', value: 100, unit: 'mm' }] });
  const b = revision({ measurements: [{ label: 'Bust', value: 95, unit: 'mm' }, { label: 'bust', value: 92, unit: 'mm' }] });
  const rows = c.compare(a, b);
  assert.equal(rows[0].deltaMm, -5);
  assert.equal(rows[0].deltaPercent, -5);
  assert.equal(rows[1].status, 'added');
  assert.throws(() => c.compare(a, revision({ project: 'Other' })), /same project/);
});
test('schema validates units, positive numbers, duplicate labels and dates', () => {
  for (const value of [0, -1, Infinity, NaN, '100', true, 1e12]) assert.throws(() => revision({ measurements: [{ label: 'bust', value, unit: 'cm' }] }));
  assert.throws(() => revision({ measurements: [{ label: 'x', value: 1, unit: 'm' }] }));
  assert.throws(() => revision({ measurements: [{ label: 'x', value: 1, unit: 'mm' }, { label: 'x', value: 2, unit: 'mm' }] }));
  assert.throws(() => revision({ date: '2026-02-29' }));
  assert.throws(() => revision({ measurements: [] }));
});
test('native note data survives fences and rejects missing or ambiguous blocks', () => {
  const r = revision({ notes: 'Literal ```\nsewlore-revision <img onerror=x>' });
  assert.deepEqual(c.readRevision(c.revisionNote(r)), r);
  assert.throws(() => c.readRevision('Ordinary note'));
  assert.throws(() => c.readRevision(c.revisionNote(r) + c.revisionNote(r)));
  assert.throws(() => c.readRevision('```sewlore-revision\n{bad}\n```'));
  assert.throws(() => c.readRevision('a'.repeat(2_000_001)));
});
test('measurement spreadsheet paste parser accepts explicit columns and rejects ambiguous syntax', () => {
  const rows = c.parseMeasurementLines('bust\t92\tcm\nsleeve\t21.5\tin');
  assert.deepEqual(rows, [{ label: 'bust', value: 92, unit: 'cm' }, { label: 'sleeve', value: 21.5, unit: 'in' }]);
  assert.throws(() => c.parseMeasurementLines('bust,92,cm'));
  assert.throws(() => c.parseMeasurementLines('bust\t9,2\tcm'));
  assert.throws(() => c.parseMeasurementLines('bust\t1e3\tcm'));
});
test('comparison reports preserve sources and exclude forced branding links or active HTML', () => {
  const a = revision({ notes: '<script>alert(1)</script>' });
  const b = revision({ revision: 'B' });
  const report = c.report(a, b, 'measurements/A.md', 'measurements/B.md');
  assert.ok(report.includes('measurements/A.md'));
  assert.ok(report.includes('unchanged'));
  assert.ok(!report.includes('<script>'));
  assert.ok(!report.includes('sewlore.com'));
});
