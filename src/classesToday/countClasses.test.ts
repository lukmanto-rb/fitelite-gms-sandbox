import { countClassesOn, formatClassCount } from './countClasses';
import { normalSample, zeroSample, type SampleClass } from './sampleClasses';

const D = new Date(2026, 10, 16);

describe('countClassesOn (FR-003)', () => {
  it('normal sample counts 3 for D (AC-002)', () => {
    expect(countClassesOn(normalSample(D), D)).toBe(3);
  });

  it('zero sample counts 0 for D (AC-003)', () => {
    expect(countClassesOn(zeroSample(D), D)).toBe(0);
  });

  it('excludes the preceding-day and following-day records', () => {
    const adjacent = normalSample(D).filter((r) => !r.startsAt.startsWith('2026-11-16'));
    expect(adjacent.map((r) => r.name)).toEqual(['Mobility', 'Cycling']);
    expect(countClassesOn(adjacent, D)).toBe(0);
  });

  it('ignores the time of day when D carries one', () => {
    expect(countClassesOn(normalSample(D), new Date(2026, 10, 16, 23, 30))).toBe(3);
  });

  it('counts each record once', () => {
    const records = normalSample(D);
    expect(countClassesOn([...records, records[1]], D)).toBe(3);
  });

  it('applies no status filter (OQ-001 open)', () => {
    const other = { ...normalSample(D)[1], id: 'x', status: 'Cancelled' } as unknown as SampleClass;
    expect(countClassesOn([other], D)).toBe(1);
  });
});

describe('formatClassCount (NFR-007)', () => {
  it('formats a non-negative integer with no decimals', () => {
    expect(formatClassCount(3)).toBe('3');
    expect(formatClassCount(0)).toBe('0');
    expect(formatClassCount(2.7)).toBe('2');
    expect(formatClassCount(-1)).toBe('0');
    expect(formatClassCount(Number.NaN)).toBe('0');
  });
});

describe('sample source only (AC-009)', () => {
  it('Classes today modules import no live schedule data', () => {
    const sources = import.meta.glob<string>(['./*.ts', '!./*.test.*'], {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    expect(Object.keys(sources).length).toBeGreaterThanOrEqual(5);
    for (const src of Object.values(sources)) {
      const imports = [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const spec of imports) {
        expect(spec === 'react' || spec.startsWith('./')).toBe(true);
      }
      expect(src).not.toMatch(/fetch\(|XMLHttpRequest|nextClass/);
    }
  });
});
