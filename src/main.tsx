import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { KeepAliveProvider } from './contexts/KeepAliveContext';
import { SchedulingProvider } from './contexts/SchedulingContext';
import { SupabaseProvider } from './contexts/SupabaseContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <KeepAliveProvider>
      <SchedulingProvider>
        <SupabaseProvider>
          <RouterProvider router={router} />
        </SupabaseProvider>
      </SchedulingProvider>
    </KeepAliveProvider>
  </React.StrictMode>
);
