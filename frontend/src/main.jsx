import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// React Grab - only in development
if (import.meta.env.DEV) {
  import('react-grab');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
