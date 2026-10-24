import React from 'react';
import { Link } from 'react-router-dom';
import { useLoginPage } from './hooks/useLoginPage';
import { setLocale, text, useLocale, type Locale } from '../../../i18n';
import ThemeIconToggle from '../../../components/shell/ThemeIconToggle';
import AppBrandMark from '../../../components/shell/AppBrandMark';
import { APP_NAME, APP_TAGLINE_EN, APP_TAGLINE_PT } from '../../../config/branding';

const LoginPage: React.FC = () => {
  const locale = useLocale();
  const {
    email,
    password,
    remoteUrl,
    error,
    notice,
    loading,
    checking,
    desktop,
    registrationEnabled,
    setEmail,
    setPassword,
    setRemoteUrl,
    submit,
  } = useLoginPage();

  if (checking) {
    return (
      <div className="tt-auth-canvas">
        <p className="text-sm text-tt-text-muted" role="status" aria-live="polite">
          {text('Carregando...', 'Loading...')}
        </p>
      </div>
    );
  }

  return (
    <div className="tt-auth-canvas">
      <div className="tt-auth-theme">
        <ThemeIconToggle />
      </div>
      <div className="tt-auth-stage">
        <main className="tt-auth-card">
          <div className="tt-auth-card-brand">
            <AppBrandMark className="tt-auth-logo" title={APP_NAME} />
            <div>
              <p className="tt-auth-eyebrow">{APP_NAME}</p>
              <h1 className="tt-auth-title">{text('Entrar', 'Sign in')}</h1>
            </div>
          </div>
          <p className="tt-auth-lede">
            {text(APP_TAGLINE_PT, APP_TAGLINE_EN)}
          </p>

          <label className="workspace-label mb-4" htmlFor="login-locale">
            {text('Idioma', 'Language')}
            <select
              id="login-locale"
              className="workspace-input"
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
            >
              <option value="pt-BR">Português</option>
              <option value="en">English</option>
            </select>
          </label>

          {error ? (
            <div className="tt-banner-danger mb-4" role="alert">
              <p className="text-sm">{error}</p>
            </div>
          ) : null}

          {notice ? (
            <div className="tt-banner-warning mb-4" role="status">
              <p className="text-sm">{notice}</p>
            </div>
          ) : null}

          <form onSubmit={submit} className="space-y-4">
            {desktop ? (
              <div>
                <label htmlFor="remoteUrl" className="mb-1 block text-sm font-medium text-tt-text">
                  {text('Servidor', 'Server')}
                </label>
                <input
                  id="remoteUrl"
                  type="url"
                  value={remoteUrl}
                  onChange={(event) => setRemoteUrl(event.target.value)}
                  className="tt-input mt-0"
                  placeholder="http://localhost:5001"
                />
                <p className="mt-1 text-xs text-tt-text-muted">
                  {text(
                    'Seus dados são sincronizados com este servidor. Sem conexão, o app usa a cópia local.',
                    'Your data syncs with this server. When offline, the app uses the local copy.'
                  )}
                </p>
              </div>
            ) : null}

            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-tt-text">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="tt-input mt-0"
                placeholder="seu@email.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-tt-text">
                {text('Senha', 'Password')}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="tt-input mt-0"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="tt-btn-primary w-full"
              aria-busy={loading}
            >
              {loading ? text('Entrando...', 'Signing in...') : text('Entrar', 'Sign in')}
            </button>
          </form>

          {registrationEnabled ? (
            <p className="mt-6 text-center text-sm text-tt-text-muted">
              {text('Não tem conta?', 'Need an account?')}{' '}
              <Link
                to="/register"
                className="font-medium text-tt-link underline-offset-2 hover:underline"
              >
                {text('Registre-se', 'Register')}
              </Link>
            </p>
          ) : null}
        </main>
      </div>
    </div>
  );
};

export default LoginPage;
