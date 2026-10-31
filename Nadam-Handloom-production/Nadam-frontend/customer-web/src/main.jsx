// Starts the website: fonts and styles, the visitor's first-visit details, the server's
// settings, an earlier sign-in (if any), then the pages.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/bodoni-moda/400.css';
import '@fontsource/bodoni-moda/500.css';
import '@fontsource-variable/figtree';
import './theme/tokens.css';
import './theme/base.css';
import './theme/pages.css';
import './theme/shop.css';
import './theme/home.css';
import './theme/bag.css';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { ToastProvider } from './components/Toasts.jsx';
import { ConfirmProvider } from './components/Modal.jsx';
import { loadConfig } from './config/config.js';
import { bootstrap } from './auth/session.js';
import { startBag } from './bag/store.js';
import { captureFirstVisit } from './utils/attribution.js';

captureFirstVisit();
loadConfig();
bootstrap();
startBag();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
