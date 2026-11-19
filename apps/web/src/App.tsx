import { useEffect, useState, type MouseEvent } from 'react';
import HomePage from './HomePage';
import TrainersPage from './trainers/TrainersPage';
import './App.css';

// Hash routes keep the app working under any sub-path (e.g. /FIT-941/) and keep relative
// api/<service>/... calls resolving through the gateway.
export const ROUTES = { home: '#/', trainers: '#/trainers' } as const;
type Page = keyof typeof ROUTES;

const pageFromHash = (hash: string): Page => (hash === ROUTES.trainers ? 'trainers' : 'home');

export default function App() {
  const [page, setPage] = useState<Page>(() => pageFromHash(window.location.hash));
  // Selecting Trainers while on Trainers re-enters the page and reloads the list (prototype).
  const [visit, setVisit] = useState(0);

  useEffect(() => {
    const onHash = () => setPage(pageFromHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (target: Page) => (e: MouseEvent<HTMLAnchorElement>) => {
    // Let modified clicks (new tab/window) behave as normal links.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    if (target === page) {
      setVisit((v) => v + 1);
      return;
    }
    window.location.hash = ROUTES[target];
    setPage(target);
  };

  return (
    <>
      <nav className="gms-nav" aria-label="GMS">
        <ul>
          <li>
            <a href={ROUTES.home} aria-current={page === 'home' ? 'page' : undefined} onClick={go('home')}>
              Home
            </a>
          </li>
          <li>
            <a href={ROUTES.trainers} aria-current={page === 'trainers' ? 'page' : undefined} onClick={go('trainers')}>
              Trainers
            </a>
          </li>
        </ul>
      </nav>
      {page === 'trainers' ? <TrainersPage key={visit} /> : <HomePage key={visit} />}
    </>
  );
}
