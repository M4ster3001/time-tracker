import { text, translate as translateUi } from '../../../i18n';
import React from 'react';
import { Link } from 'react-router-dom';
import { useRegisterPage } from './hooks/useRegisterPage';

const RegisterPage: React.FC = () => {
  const {
    name,
    email,
    password,
    confirmPassword,
    error,
    loading,
    setName,
    setEmail,
    setPassword,
    setConfirmPassword,
    submit,
  } = useRegisterPage();

  return (
    <div className="tt-auth-canvas">
      <div className="tt-auth-card">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.22em] text-tt-link">
          Time Tracker
        </p>
        <h1 className="mt-2 text-center text-3xl font-bold text-tt-text">
          {translateUi('Crie sua conta')}
        </h1>
        <p className="mb-8 mt-2 text-center text-tt-text-muted">
          {text('Registro de horas e fechamento', 'Time tracking and month close')}
        </p>

        {error ? (
          <div className="tt-banner-danger mb-4" role="alert">
            <p className="text-sm">{error}</p>
          </div>
        ) : null}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-tt-text">
              {translateUi('Nome Completo')}
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="tt-input mt-0"
              placeholder={translateUi('Seu nome')}
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
              placeholder="••••••••"
              required
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1 block text-sm font-medium text-tt-text"
            >
              {translateUi('Confirmar Senha')}
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="tt-input mt-0"
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" disabled={loading} className="tt-btn-primary w-full">
            {loading
              ? text('Registrando...', 'Creating account...')
              : text('Registrar', 'Register')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-tt-text-muted">
          {translateUi('Ja tem conta?')}{' '}
          <Link to="/login" className="font-medium text-tt-link underline-offset-2 hover:underline">
            {translateUi('Faca login')}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
