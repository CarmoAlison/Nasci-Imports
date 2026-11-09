import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import './styles/variables.css';
import './styles/global.css';
import './styles/layout.css';
import './styles/store.css';
import './styles/account.css';
import './styles/chat.css';
import './styles/admin.css';

import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { NotificationProvider } from './contexts/NotificationContext';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
            <CartProvider>
              <App />
              <Toaster
                position="top-center"
                toastOptions={{
                  duration: 3500,
                  style: {
                    background: 'var(--cor-superficie-2)',
                    color: 'var(--cor-texto)',
                    border: '1px solid var(--cor-borda)',
                  },
                  success: { iconTheme: { primary: '#1BFD00', secondary: '#000000' } },
                }}
              />
            </CartProvider>
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
