import { render, screen } from '@testing-library/react';
import OpeningHoursCard, { todaysHoursText } from './OpeningHoursCard';
import { openingHours, type DayHours } from '../data/sampleData';

// 2026-11-16 is a Monday, 2026-11-15 is a Sunday.
const monday = new Date(2026, 10, 16);
const sunday = new Date(2026, 10, 15);

describe('OpeningHoursCard', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the hours on an open day', () => {
    render(<OpeningHoursCard date={monday} />);
    expect(screen.getByRole('heading', { name: "Today's opening hours" })).toBeInTheDocument();
    expect(screen.getByText('06:00–22:00')).toBeInTheDocument();
    expect(screen.queryByText('Closed today')).not.toBeInTheDocument();
  });

  it("shows 'Closed today' on a closed day", () => {
    render(<OpeningHoursCard date={sunday} />);
    expect(screen.getByRole('heading', { name: "Today's opening hours" })).toBeInTheDocument();
    expect(screen.getByText('Closed today')).toBeInTheDocument();
  });

  it('formats hours from sample data', () => {
    expect(todaysHoursText(new Date(2026, 10, 14), openingHours)).toBe('08:00–18:00');
    expect(todaysHoursText(new Date(2026, 10, 20), openingHours)).toBe('06:00–21:00');
    expect(todaysHoursText(sunday, openingHours)).toBe('Closed today');
  });

  it('uses the hours it is given', () => {
    const hours: DayHours[] = [null, { open: '07:30', close: '20:00' }, null, null, null, null, null];
    render(<OpeningHoursCard date={monday} hours={hours} />);
    expect(screen.getByText('07:30–20:00')).toBeInTheDocument();
  });

  it("uses today's date when no date is given", () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 16, 9, 0));
    render(<OpeningHoursCard />);
    expect(screen.getByText('06:00–22:00')).toBeInTheDocument();
  });
});
