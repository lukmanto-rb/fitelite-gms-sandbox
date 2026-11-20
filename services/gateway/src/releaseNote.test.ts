import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// FIT-941 release note v0.3.0 (rework 2): keeps the note honest and in step with the runbook.
const docs = fileURLToPath(new URL('../../../docs/', import.meta.url));
const note = readFileSync(`${docs}FIT-941-release-note-v0.3.0.md`, 'utf8');
const runbook = readFileSync(`${docs}FIT-941-release.md`, 'utf8');
const section = (title: string) => {
  const start = note.indexOf(`## ${title}`);
  expect(start, title).toBeGreaterThanOrEqual(0);
  const end = note.indexOf('\n## ', start + 1);
  return note.slice(start, end === -1 ? undefined : end);
};

describe('FIT-941 release note v0.3.0', () => {
  it('states plainly that browser adding is blocked by the missing sign-in screen, and the first test step matches', () => {
    expect(section('Known issues')).toMatch(/Adding trainers in the browser is blocked: there is no sign-in screen/);
    const firstStep = section('How to test').split('\n').find((l) => l.startsWith('1. '))!;
    expect(firstStep).not.toMatch(/sign in as/i);
    expect(firstStep).toMatch(/no sign-in screen yet, so you cannot sign in/);
  });

  it('drops "validation not recorded", reports validation honestly and gives a result for AC-001 to AC-020', () => {
    expect(note).not.toMatch(/Product validation has not been recorded/);
    const results = section('Test results');
    expect(results).toMatch(/Product validation: pending/);
    expect(results).toMatch(/170 passed, 0 failed/);
    expect(results).toContain('https://github.com/lukmanto-rb/fitelite-gms-sandbox/actions/runs/44664928881/job/136051782695');
    for (let i = 1; i <= 20; i++) {
      const id = `AC-${String(i).padStart(3, '0')}`;
      expect(results, id).toMatch(new RegExp(`^\\| ${id} \\|.*\\| Passed.*\\| Not run.*\\|$`, 'm'));
    }
  });

  it('gives start steps with exactly the runbook commands and says the live release and smoke check have not run', () => {
    const start = section('Start the test release on the MacBook');
    expect(start).toMatch(/live test release and the smoke check have not been run yet/);
    const commands = [...note.matchAll(/```\n\s*(.*)\n\s*```/g)].map((m) => m[1].trim());
    expect(commands).toEqual(['docker compose up --build --wait', 'docker compose exec gateway node dist/smoke.js']);
    for (const c of commands) expect(runbook).toContain(c);
  });

  it('lists interim behaviour for OQ-001 to OQ-004 as known issues', () => {
    const known = section('Known issues');
    for (const oq of ['OQ-001', 'OQ-002', 'OQ-003', 'OQ-004']) expect(known).toMatch(new RegExp(`\\*\\*${oq}.*not yet decided\\.\\*\\* For now,`));
  });

  it('keeps the unchanged parts: 7 features, the edit/delete issue, 12 test steps, rollout and version', () => {
    expect(section('New features').match(/^\d\. /gm)).toHaveLength(7);
    expect(section('Known issues')).toContain('Trainers cannot be edited or deleted in this release.');
    expect(section('How to test').match(/^\d+\. /gm)).toHaveLength(12);
    expect(section('Rollout')).toContain('A production release requires approval.');
    expect(note).toMatch(/Version 0\.3\.0/);
  });
});
