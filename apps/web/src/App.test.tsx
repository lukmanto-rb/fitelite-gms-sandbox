import { act, fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';

// FR-001 / AC-001: a Trainers entry in the GMS navigation opens the Trainers page; Home stays as it was.
describe('GMS navigation (FIT-941 AC-001)', () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ trainers: [] }), { status: 200 }));

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockClear();
    window.history.replaceState(null, '', '/FIT-941/');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
  });

  const nav = () => screen.getByRole('navigation', { name: 'GMS' });

  it('opens on Home with Home and Trainers in the navigation', () => {
    render(<App />);
    const links = within(nav()).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Home', 'Trainers']);
    expect(within(nav()).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 1, name: 'Fitelite' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('selecting Trainers opens the Trainers page, marks it active and loads through the gateway', async () => {
    render(<App />);
    const link = within(nav()).getByRole('link', { name: 'Trainers' });
    expect(link).toHaveAttribute('href', '#/trainers');
    fireEvent.click(link);
    expect(screen.getByRole('heading', { level: 1, name: 'Trainers' })).toBeInTheDocument();
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Loading trainers…')).toBeInTheDocument();
    await screen.findByText('No trainers yet');
    expect(fetchMock).toHaveBeenCalledWith('api/trainers/trainers', expect.anything());
    // Unrelated navigation is unchanged and still usable.
    fireEvent.click(within(nav()).getByRole('link', { name: 'Home' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Fitelite' })).toBeInTheDocument();
  });

  it('opens Trainers directly from the URL (refresh) and on hash change', async () => {
    window.history.replaceState(null, '', '/FIT-941/#/trainers');
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Trainers' })).toBeInTheDocument();
    await screen.findByText('No trainers yet');
    act(() => {
      window.history.replaceState(null, '', '/FIT-941/#/');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Fitelite' })).toBeInTheDocument();
  });

  it('selecting Trainers again re-enters the page and reloads the list', async () => {
    window.history.replaceState(null, '', '/FIT-941/#/trainers');
    render(<App />);
    await screen.findByText('No trainers yet');
    fireEvent.click(within(nav()).getByRole('link', { name: 'Trainers' }));
    expect(screen.getByText('Loading trainers…')).toBeInTheDocument();
    await screen.findByText('No trainers yet');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('a load failure (e.g. signed out) shows Load Error and leaves navigation usable (AC-005, NFR-005)', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 }));
    window.history.replaceState(null, '', '/FIT-941/#/trainers');
    render(<App />);
    await screen.findByText("Couldn't load trainers. Try again.");
    expect(screen.queryByText('No trainers yet')).toBeNull();
    fireEvent.click(within(nav()).getByRole('link', { name: 'Home' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Fitelite' })).toBeInTheDocument();
  });
});
