import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './ErrorBoundary';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Register service worker (offline app shell). Skip in development.
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(() => {
        // Also register the FCM messaging service worker if available.
        navigator.serviceWorker.register('/firebase-messaging-sw.js').catch((err) => console.error('[index:firebase-messaging-sw]', err));
      })
      .catch((err) => console.warn('SW registration failed:', err));
  });
}
