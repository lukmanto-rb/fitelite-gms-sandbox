import { render, screen } from '@testing-library/react';
import OpeningHoursCard, { todaysHoursText } from './OpeningHoursCard';
import { openingHours } from '../data/sampleData';

// 2026-11-16 is a Monday, 2026-11-15 is a Sunday.
const monday = new Date(2026, 10, 16);
const sunday = new Date(2026, 10, 15);

describe('OpeningHoursCard', () => {
  it('shows the hours on an open day', () => {
    render(<OpeningHoursCard date={monday} />);
    expect(screen.getByRole('heading', { name: "Today's opening hours" })).toBeInTheDocument();
    expect(screen.getByText('06:00–22:00')).toBeInTheDocument();
  });

  it("shows 'Closed today' on a closed day", () => {
    render(<OpeningHoursCard date={sunday} />);
    expect(screen.getByText('Closed today')).toBeInTheDocument();
  });

  it('formats hours from sample data', () => {
    expect(todaysHoursText(new Date(2026, 10, 14), openingHours)).toBe('08:00–18:00');
  });
});
