// The internal console's page frame (Release C2, F-S88-1): every page keeps
// its centred maximum width unless it asks for the whole content width — the
// bank rows list does, the other pages do not.
//
// jsdom lays nothing out, so these pin the class contract a browser turns
// into widths.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageContainer } from './ui';

// The frame is the element that holds the page's heading row and its body.
const frame = () => screen.getByRole('heading', { name: 'A page' }).closest('div.py-8') as HTMLElement;

describe('PageContainer', () => {
  it('keeps its centred maximum width by default', () => {
    render(
      <PageContainer title="A page" subtitle="Its subtitle">
        <p>body</p>
      </PageContainer>,
    );

    expect(frame()).toHaveClass('max-w-6xl', 'mx-auto', 'px-6', 'py-8');
    expect(screen.getByText('Its subtitle')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('fills the content width when asked to: no maximum width, no centring', () => {
    render(
      <PageContainer title="A page" wide>
        <p>body</p>
      </PageContainer>,
    );

    expect(frame()).not.toHaveClass('max-w-6xl');
    expect(frame()).not.toHaveClass('mx-auto');
    // The gutters stay.
    expect(frame()).toHaveClass('px-6', 'py-8');
    expect(screen.getByText('body')).toBeInTheDocument();
  });
});
