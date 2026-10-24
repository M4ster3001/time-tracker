import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCapabilities } from '../contexts/CapabilitiesContext';

interface RoleRouteProps {
  allowedRoles: number[];
  children: ReactNode;
}

const RoleRoute: React.FC<RoleRouteProps> = ({ children }) => {
  const { user } = useAuth();
  const { canVisit, loading } = useCapabilities();
  const { pathname } = useLocation();
  if (loading) return null;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!canVisit(pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default RoleRoute;
