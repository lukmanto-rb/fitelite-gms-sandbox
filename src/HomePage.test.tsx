import { render, screen } from '@testing-library/react';
import HomePage from './HomePage';

describe('HomePage', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the Next class card and the opening hours card', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: 'Next class' })).toBeInTheDocument();
    expect(screen.getByText('Spin at 18:30 with Alex')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: "Today's opening hours" })).toBeInTheDocument();
  });

  it("shows today's hours on an open day", () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 16, 9, 0)); // Monday
    render(<HomePage />);
    expect(screen.getByText('06:00–22:00')).toBeInTheDocument();
  });

  it("shows 'Closed today' on a closed day", () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 15, 9, 0)); // Sunday
    render(<HomePage />);
    expect(screen.getByText('Closed today')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Next class' })).toBeInTheDocument();
  });
});
