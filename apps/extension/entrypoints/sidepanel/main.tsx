import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppShell } from '@/components/settings/app-shell';
import './style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>,
);
