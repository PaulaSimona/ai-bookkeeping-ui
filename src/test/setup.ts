// Vitest setup (O-S84-4). Registers the jest-dom matchers on Vitest's expect and
// unmounts rendered trees after each test. Testing Library only auto-registers
// its cleanup when a global afterEach exists; tests here import from 'vitest'
// explicitly (no globals), so the cleanup is wired by hand.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
