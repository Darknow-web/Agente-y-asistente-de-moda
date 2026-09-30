import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ProveedorSesion } from './lib/sesion';
import './styles/app.css';

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('No existe el elemento #raiz en index.html.');

createRoot(raiz).render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorSesion>
        <App />
      </ProveedorSesion>
    </BrowserRouter>
  </StrictMode>,
);
