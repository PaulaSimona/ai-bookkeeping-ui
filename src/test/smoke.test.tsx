// Harness smoke test (O-S84-4): proves jsdom, the React plugin, Testing Library
// and the jest-dom matchers are wired together.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('test harness', () => {
  it('renders an element and asserts it with a jest-dom matcher', () => {
    render(<p>harness ok</p>);
    expect(screen.getByText('harness ok')).toBeInTheDocument();
  });
});
