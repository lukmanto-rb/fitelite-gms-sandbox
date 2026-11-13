import { render, screen } from '@testing-library/react';
import { NextClassCard } from './NextClassCard';
import type { GymClass } from '../types';

const now = new Date('2026-11-13T12:00:00Z');

describe('NextClassCard', () => {
  it("shows the upcoming class's name, start time and studio", () => {
    const classes: GymClass[] = [
      { id: '1', name: 'Spin Class', startTime: '2026-11-13T18:30:00Z', studio: 'Cycle Studio' },
    ];
    render(<NextClassCard classes={classes} now={now} />);

    expect(screen.getByRole('heading', { name: 'Next class' })).toBeInTheDocument();
    expect(screen.getByTestId('next-class-name')).toHaveTextContent('Spin Class');
    expect(screen.getByTestId('next-class-start')).toHaveTextContent('Fri 13 Nov, 18:30');
    expect(screen.getByTestId('next-class-start').querySelector('time')).toHaveAttribute(
      'datetime',
      '2026-11-13T18:30:00Z',
    );
    expect(screen.getByTestId('next-class-studio')).toHaveTextContent('Cycle Studio');
    expect(screen.queryByTestId('next-class-empty')).not.toBeInTheDocument();
  });

  it('shows the class with the earliest future start time when there are several', () => {
    const classes: GymClass[] = [
      { id: 'past', name: 'Morning Yoga', startTime: '2026-11-13T08:00:00Z', studio: 'Studio A' },
      { id: 'late', name: 'HIIT Blast', startTime: '2026-11-13T20:00:00Z', studio: 'Studio B' },
      { id: 'next', name: 'Pilates', startTime: '2026-11-13T14:15:00Z', studio: 'Studio C' },
      { id: 'tmrw', name: 'Boxing', startTime: '2026-11-14T07:00:00Z', studio: 'Ring' },
    ];
    render(<NextClassCard classes={classes} now={now} />);

    expect(screen.getByTestId('next-class-name')).toHaveTextContent('Pilates');
    expect(screen.getByTestId('next-class-start')).toHaveTextContent('Fri 13 Nov, 14:15');
    expect(screen.getByTestId('next-class-studio')).toHaveTextContent('Studio C');
  });

  it('shows a clear empty state when there are no classes', () => {
    render(<NextClassCard classes={[]} now={now} />);

    expect(screen.getByRole('heading', { name: 'Next class' })).toBeInTheDocument();
    expect(screen.getByTestId('next-class-empty')).toHaveTextContent('No upcoming classes.');
    expect(screen.queryByTestId('next-class-name')).not.toBeInTheDocument();
  });

  it('shows the empty state when every class has already started', () => {
    const classes: GymClass[] = [
      { id: 'past', name: 'Morning Yoga', startTime: '2026-11-13T08:00:00Z', studio: 'Studio A' },
    ];
    render(<NextClassCard classes={classes} now={now} />);

    expect(screen.getByTestId('next-class-empty')).toHaveTextContent('No upcoming classes.');
  });
});
