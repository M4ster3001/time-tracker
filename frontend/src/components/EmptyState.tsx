import { translate as translateUi } from '../i18n';
import React from 'react';
import InfoTooltip from './InfoTooltip';

type EmptyStateVariant =
  | 'no-data'
  | 'no-results'
  | 'no-entries'
  | 'no-clients'
  | 'no-users'
  | 'error';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const illustrations: Record<EmptyStateVariant, React.ReactNode> = {
  'no-data': (
    <svg
      className="mx-auto h-24 w-24 text-tt-text-muted"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
      />
    </svg>
  ),
  'no-results': (
    <svg
      className="mx-auto h-24 w-24 text-tt-text-muted"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  ),
  'no-entries': (
    <svg
      className="mx-auto h-24 w-24 text-tt-text-muted"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  'no-clients': (
    <svg
      className="mx-auto h-24 w-24 text-tt-text-muted"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
      />
    </svg>
  ),
  'no-users': (
    <svg
      className="mx-auto h-24 w-24 text-tt-text-muted"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  ),
  error: (
    <svg
      className="mx-auto h-24 w-24 text-tt-danger"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  ),
};

const defaultContent: Record<EmptyStateVariant, { title: string; description: string }> = {
  'no-data': {
    title: translateUi('Nenhum dado encontrado'),
    description: 'Ainda não ha dados para exibir aqui.',
  },
  'no-results': {
    title: translateUi('Nenhum resultado'),
    description: 'Não encontramos resultados para sua busca. Tente outros filtros.',
  },
  'no-entries': {
    title: 'Sem lançamentos',
    description: 'Você ainda não tem lançamentos de horas neste período.',
  },
  'no-clients': {
    title: 'Sem clientes',
    description: 'Nenhum cliente cadastrado ainda.',
  },
  'no-users': {
    title: 'Sem usuários',
    description: 'Nenhum usuário encontrado com os filtros selecionados.',
  },
  error: {
    title: 'Algo deu errado',
    description: 'Ocorreu um erro ao carregar os dados. Tente novamente.',
  },
};

const EmptyState: React.FC<EmptyStateProps> = ({
  variant = 'no-data',
  title,
  description,
  action,
  className = '',
}) => {
  const content = defaultContent[variant];

  return (
    <div
      className={`flex flex-col items-center justify-center py-12 text-center ${className}`}
      role="status"
      aria-live="polite"
    >
      {illustrations[variant]}
      <div className="mt-4 flex items-center gap-2">
        <h3 className="text-lg font-semibold text-tt-text">{title || content.title}</h3>
        <InfoTooltip content={description || content.description} />
      </div>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="tt-btn-primary mt-6 px-6"
          aria-label={action.label}
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
};

export default EmptyState;
