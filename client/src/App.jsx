import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import { useAuthStore } from './store/authStore.js';
import { authApi } from './api/auth.api.js';

import { ProtectedRoute } from './routes/ProtectedRoute.jsx';
import { DashboardLayout } from './layouts/DashboardLayout.jsx';

import { Login }       from './pages/Auth/Login.jsx';
import { Register }    from './pages/Auth/Register.jsx';
import { Dashboard }   from './pages/Dashboard/Dashboard.jsx';
import { Projects }    from './pages/Projects/Projects.jsx';
import { ApiKeys }     from './pages/ApiKeys/ApiKeys.jsx';
import { RequestLogs } from './pages/Logs/RequestLogs.jsx';
import { Analytics }   from './pages/Analytics/Analytics.jsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * SessionHydrator runs once on app load.
 * Uses the httpOnly refresh-token cookie to silently restore a session.
 * On success  → setAuth() populates user + accessToken.
 * On failure  → setLoading(false) so ProtectedRoute can redirect to /login.
 */
const SessionHydrator = ({ children }) => {
  const { setAuth, setLoading } = useAuthStore();

  useEffect(() => {
    const hydrateSession = async () => {
      try {
        const { data: refreshData } = await authApi.refresh();
        const newToken = refreshData.data.accessToken;

        const { data: meData } = await authApi.getMe();
        setAuth({ user: meData.data.user, accessToken: newToken });
      } catch {
        // No valid session cookie — let ProtectedRoute redirect to /login
        setLoading(false);
      }
    };

    hydrateSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return children;
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionHydrator>
          <Routes>
            {/* ── Public routes ─────────────────────────────────────── */}
            <Route path="/login"    element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* ── Protected routes (all inside DashboardLayout) ───── */}
            <Route element={<ProtectedRoute />}>
              <Route element={<DashboardLayout />}>
                <Route path="/dashboard"  element={<Dashboard />} />
                <Route path="/projects"   element={<Projects />} />
                <Route path="/keys"       element={<ApiKeys />} />
                <Route path="/logs"       element={<RequestLogs />} />
                <Route path="/analytics"  element={<Analytics />} />
              </Route>
            </Route>

            {/* ── Fallback ───────────────────────────────────────────
                Unauthenticated users hitting "/" get redirected here,
                then ProtectedRoute sends them to /login.             */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>

          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'var(--color-bg-elevated)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border-light)',
                borderRadius: '10px',
                fontSize: '0.875rem',
              },
              success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
              error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
            }}
          />
        </SessionHydrator>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
