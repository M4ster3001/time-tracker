import { text, translate as translateUi } from '../../../i18n';
import React from 'react';
import { useSetupPage } from './hooks/useSetupPage';

const SetupPage: React.FC = () => {
  const {
    name,
    email,
    password,
    confirmPassword,
    error,
    loading,
    checking,
    passwordRules,
    setName,
    setEmail,
    setPassword,
    setConfirmPassword,
    submit,
  } = useSetupPage();

  if (checking) {
    return (
      <div className="tt-auth-canvas">
        <p className="text-sm text-tt-text-muted">{translateUi('Verificando configuracao...')}</p>
      </div>
    );
  }

  return (
    <div className="tt-auth-canvas">
      <div className="tt-auth-card">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.22em] text-tt-link">
          Time Tracker
        </p>
        <h1 className="mt-2 text-center text-3xl font-bold text-tt-text">
          {translateUi('Bem-vindo')}
        </h1>
        <p className="mb-8 mt-2 text-center text-tt-text-muted">
          {translateUi('Crie a conta de administrador para comecar a usar o Time Tracker.')}
        </p>

        {error ? (
          <div className="tt-banner-danger mb-4" role="alert">
            <p className="text-sm">{error}</p>
          </div>
        ) : null}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-tt-text">
              {translateUi('Nome')}
            </label>
            <input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="tt-input mt-0"
              placeholder={translateUi('Seu nome')}
              minLength={2}
              required
            />
          </div>

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
              {translateUi('Senha')}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="tt-input mt-0"
              placeholder="••••••••••••"
              required
            />
            <ul className="mt-2 space-y-1">
              {passwordRules.map((rule) => {
                const ok = rule.test(password);
                return (
                  <li
                    key={rule.label}
                    className={`text-xs ${ok ? 'text-tt-success' : 'text-tt-text-muted'}`}
                  >
                    {ok ? '✓' : '○'} {rule.label}
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1 block text-sm font-medium text-tt-text"
            >
              {translateUi('Confirme a senha')}
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="tt-input mt-0"
              placeholder="••••••••••••"
              required
            />
          </div>

          <button type="submit" disabled={loading} className="tt-btn-primary w-full">
            {loading
              ? text('Criando...', 'Creating...')
              : text('Criar administrador', 'Create administrator')}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-tt-text-muted">
          {translateUi(
            'Esta tela aparece apenas no primeiro uso, enquanto nao existe nenhum usuario.'
          )}
        </p>
      </div>
    </div>
  );
};

export default SetupPage;
