import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initialiseSentry } from './lib/sentry';

// Kick off Sentry as early as possible (non-blocking — dynamic import inside)
initialiseSentry();

const container = document.getElementById('root');
if (!container) throw new Error('[BioMusic] Root element #root not found in index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
