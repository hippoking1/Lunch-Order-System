import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { LS_THEME_KEY } from './constants';

// Initialize theme before React mounts to prevent flash
const savedTheme = localStorage.getItem(LS_THEME_KEY) || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('No root element');
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (e: unknown) {
  const el = document.getElementById('error-log');
  if (el) {
    el.innerHTML += '<p style="color:red">React Mount Error: ' + (e instanceof Error ? e.message : String(e)) + '</p>';
    el.style.display = 'block';
  }
}
