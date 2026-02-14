import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

export function ProtectedRoute() {
  const { user, loading, isLoggingOut } = useAuthStore();

  if (loading || isLoggingOut) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
