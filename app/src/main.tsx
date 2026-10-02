import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { STORE_KEY } from './config';
import './styles/modernist.css';
import './styles/app.css';

// Hydrate localStorage from the backend before the store module loads; fall back to local data if it is down.
try {
  const r = await fetch('/api/state');
  if (r.ok) localStorage.setItem(STORE_KEY, await r.text());
} catch { /* offline: use localStorage */ }
const { App } = await import('./App');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
