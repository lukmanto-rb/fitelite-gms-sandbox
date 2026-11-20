import { render, screen, waitFor } from '@testing-library/react';
import TrainersPage from './TrainersPage';
import { fakeServer } from './testApi';

// AC-019 / NFR-006 responsive layout. jsdom cannot measure layout, so the component CSS
// (injected by Vitest, test.css) is read back and its rules asserted.
const pageCss = () =>
  (Array.from(document.querySelectorAll('style'))
    .map((s) => s.textContent ?? '')
    .find((t) => t.includes('.trainers-page')) ?? '').replace(/\s+/g, ' ');

describe('Trainers page layout (AC-019, NFR-006)', () => {
  beforeEach(async () => {
    render(<TrainersPage api={fakeServer([{ id: '1', name: 'Alex Morgan', speciality: 'Strength training' }]).api} />);
    await waitFor(() => expect(screen.queryByText('Loading trainers…')).toBeNull());
  });

  it('places a 360 px form card left of the list at 1024 px and above, 24 px gap; stacked below', () => {
    const css = pageCss();
    expect(css).toMatch(/\.trainers-page__layout \{[^}]*grid-template-columns: minmax\(0, 1fr\);[^}]*gap: 24px;/);
    expect(css).toMatch(/@media \(min-width: 1024px\) \{ \.trainers-page__layout \{ grid-template-columns: 360px minmax\(0, 1fr\); \} \}/);
    // Form before list in the document, so stacking puts the form above.
    const form = screen.getByRole('heading', { name: 'Add trainer' });
    const list = screen.getByRole('heading', { name: 'All trainers' });
    expect(form.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('uses 24 px page padding, 16 px below 768 px, and stacks labelled row values there', () => {
    const css = pageCss();
    expect(css).toMatch(/\.trainers-page \{[^}]*padding: 24px;/);
    expect(css).toMatch(/@media \(max-width: 767\.98px\) \{ \.trainers-page \{ padding: 16px; \}/);
    expect(css).toMatch(/\.trainers-table td::before \{ content: attr\(data-label\);/);
    for (const cell of screen.getAllByRole('cell')) expect(cell).toHaveAttribute('data-label');
  });

  it('uses the PRD type scale: 24 px heading, 18 px card headings, text at least 14 px', () => {
    const css = pageCss();
    expect(css).toMatch(/\.trainers-page__title \{[^}]*font-size: 24px;/);
    expect(css).toMatch(/\.trainers-card__heading \{[^}]*font-size: 18px;/);
    const sizes = [...css.matchAll(/font-size: (\d+)px/g)].map((m) => Number(m[1]));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(14);
  });

  it('never forces horizontal scrolling at 320 px: wraps, never truncates, no fixed widths outside the desktop grid', () => {
    const css = pageCss().replace(/\.visually-hidden \{[^}]*\}/, ''); // screen-reader-only text is 1 px by design
    expect(css).toContain('overflow-wrap: anywhere');
    expect(css).not.toMatch(/text-overflow|white-space: nowrap|overflow-x/);
    // The only fixed px width is the 360 px column inside the >=1024 px media query.
    const withoutDesktop = css.replace(/@media \(min-width: 1024px\) \{[^}]*\} \}/, '');
    expect(withoutDesktop).not.toMatch(/(?<![-\w])(min-)?width: (?!1px)\d+px/);
    expect(withoutDesktop).not.toMatch(/\d{3,}px/);
  });

  it('shows a visible focus outline on keyboard focus', () => {
    expect(pageCss()).toMatch(/\.trainers-page :focus-visible \{ outline: 3px solid #0b57d0;/);
  });
});
