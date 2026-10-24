import { translate as translateUi } from '../i18n';
import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCapabilities } from '../contexts/CapabilitiesContext';
import { text } from '../i18n';
import ScreenState from './ScreenState';

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const access = useCapabilities();
  const { pathname } = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-4 text-tt-text-muted">{translateUi('Carregando...')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (access.loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-tt-page" role="status">
        <p className="text-tt-text-muted">
          {text('Carregando permissões...', 'Loading permissions...')}
        </p>
      </div>
    );
  if (access.error)
    return (
      <div className="flex min-h-screen items-center justify-center bg-tt-page px-4">
        <ScreenState
          variant="error"
          title={text('Não foi possível carregar suas permissões', 'Unable to load your permissions')}
          description={text(
            'Pode ser uma falha temporária de conexão ou excesso de requisições. Tente novamente em instantes.',
            'This may be a temporary connection problem or too many requests. Try again in a moment.'
          )}
          action={{
            label: text('Tentar novamente', 'Try again'),
            onClick: () => {
              void access.refresh();
            },
          }}
        />
      </div>
    );
  if (!access.canVisit(pathname)) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

export default ProtectedRoute;
