import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';

export const ProtectedRoute = () => {
  const { user, accessToken, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--color-bg-base)',
      }}>
        <div style={{
          width: 36, height: 36,
          border: '3px solid var(--color-border)',
          borderTopColor: 'var(--color-primary)',
          borderRadius: '50%',
        }} className="animate-spin" />
      </div>
    );
  }

  return user && accessToken ? <Outlet /> : <Navigate to="/login" replace />;
};
