import { ApolloProvider } from '@apollo/client/react';
import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { apolloClient } from './lib/apollo';
import './styles/index.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found. Ensure index.html has <div id="root"></div>');
}

createRoot(root).render(
  <React.StrictMode>
    <ApolloProvider client={apolloClient}>
      <App />
    </ApolloProvider>
  </React.StrictMode>
);
