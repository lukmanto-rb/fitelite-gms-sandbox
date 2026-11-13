import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders the Next class card with the next sample class', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Fitelite GMS' })).toBeInTheDocument();
    // Sample data: Spin Class starts 2h from now, the soonest upcoming one.
    expect(screen.getByTestId('next-class-name')).toHaveTextContent('Spin Class');
    expect(screen.getByTestId('next-class-studio')).toHaveTextContent('Cycle Studio');
  });
});
