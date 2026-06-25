import { describe, it, expect, vi, beforeEach } from 'vitest';

// `readTimeoutMs` reads `gitGraphPlus.timeout` (seconds) via the VS Code config
// API. The mock lets each test control what that lookup returns; `undefined`
// means "not set", so the getter hands back the caller-supplied default (60).
const h = vi.hoisted(() => ({ value: undefined as unknown }));

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({
      get: (_key: string, def: number) => (h.value === undefined ? def : h.value),
    }),
  },
}));

import { readTimeoutMs } from '../config';

describe('readTimeoutMs', () => {
  beforeEach(() => {
    h.value = undefined;
  });

  it('converts a positive seconds value to milliseconds', () => {
    h.value = 30;
    expect(readTimeoutMs()).toBe(30_000);
  });

  it('falls back to 60s when the setting is unset (uses the default of 60)', () => {
    h.value = undefined;
    expect(readTimeoutMs()).toBe(60_000);
  });

  it('falls back to 60s for a zero or negative value', () => {
    h.value = 0;
    expect(readTimeoutMs()).toBe(60_000);
    h.value = -5;
    expect(readTimeoutMs()).toBe(60_000);
  });

  it('falls back to 60s for a non-finite value', () => {
    h.value = Infinity;
    expect(readTimeoutMs()).toBe(60_000);
    h.value = NaN;
    expect(readTimeoutMs()).toBe(60_000);
  });

  it('falls back to 60s for a non-number value', () => {
    h.value = 'soon';
    expect(readTimeoutMs()).toBe(60_000);
  });
});
