import { render, screen } from '@testing-library/react';
import HomePage from './HomePage';

describe('HomePage', () => {
  it('shows the Next class card and the opening hours card', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: 'Next class' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: "Today's opening hours" })).toBeInTheDocument();
  });
});
