// The staff tax-review data hooks are staff-only (S98 P1d item 1): no customer
// page may import them. Read from the sources themselves, so a new import
// anywhere in src/ is caught.
import { describe, expect, it } from 'vitest';

const sources = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const STAFF_HOOKS = ['useStaffTaxReview', 'useStaffAccountPurposes', 'useStaffOrgProjects'];

// Where staff code lives. Tiers share presentational components only — never
// data hooks — so nothing outside these folders may reach the hooks.
const STAFF_FOLDERS = ['/src/views/internal/', '/src/components/internal/', '/src/hooks/'];

const importsOf = (source: string): string[] =>
  [...source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);

describe('the staff tax-review hooks stay in staff code', () => {
  it('reads the source tree', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(100);
    for (const hook of STAFF_HOOKS) {
      expect(Object.keys(sources)).toContain(`/src/hooks/${hook}.ts`);
    }
  });

  it('no file outside the staff folders imports one of them', () => {
    const offenders: string[] = [];
    for (const [path, source] of Object.entries(sources)) {
      if (STAFF_FOLDERS.some((folder) => path.startsWith(folder))) continue;
      for (const target of importsOf(source)) {
        if (STAFF_HOOKS.some((hook) => target.endsWith(`/${hook}`))) {
          offenders.push(`${path} imports ${target}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('inside src/hooks, only the hooks themselves and their tests name them', () => {
    const offenders: string[] = [];
    for (const [path, source] of Object.entries(sources)) {
      if (!path.startsWith('/src/hooks/')) continue;
      if (STAFF_HOOKS.some((hook) => path.startsWith(`/src/hooks/${hook}.`))) continue;
      if (path === '/src/hooks/staffTaxBoundary.test.ts') continue;
      for (const target of importsOf(source)) {
        if (STAFF_HOOKS.some((hook) => target.endsWith(`/${hook}`))) {
          offenders.push(`${path} imports ${target}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
