import React from 'react';
import { translate as translateUi } from '../i18n';
import StateBanner from './StateBanner';

type AppErrorBoundaryProps = {
  children: React.ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    const message =
      error instanceof Error && error.message
        ? error.message
        : translateUi('Ocorreu um erro inesperado.');
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    if (typeof console !== 'undefined' && typeof console.error === 'function') {
      console.error('AppErrorBoundary', error, info.componentStack);
    }
  }

  private handleReload = () => {
    this.setState({ hasError: false, message: '' });
    if (typeof window !== 'undefined') {
      window.location.assign(window.location.pathname + window.location.search);
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-tt-bg p-6">
        <div className="w-full max-w-lg space-y-4 rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-tt-text">
            {translateUi('Algo deu errado')}
          </h1>
          <StateBanner
            tone="error"
            message={this.state.message || translateUi('Ocorreu um erro inesperado.')}
            action={{
              label: translateUi('Tentar novamente'),
              onClick: this.handleReload,
            }}
          />
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;
