import React from 'react';
import { createRoot } from 'react-dom/client';
import { ApolloProvider } from '@apollo/client';
import { apolloClient } from './lib/apollo';
import App from './App';
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
