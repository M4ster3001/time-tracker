import React from 'react';
import DashboardPersonalPage from '../../consultant/dashboard';
import DashboardAdminPage from '../../admin/dashboard';
import { useCapabilities } from '../../../contexts/CapabilitiesContext';
import AppShell from '../../../components/AppShell';
import { text } from '../../../i18n';
import { Link } from 'react-router-dom';

const DashboardHomePage: React.FC = () => {
  const { can, capabilities } = useCapabilities();
  if (can('dashboard.read', 'all')) return <DashboardAdminPage />;
  if (can('dashboard.read')) {
    return <DashboardPersonalPage />;
  }
  return (
    <AppShell title={text('Meu espaço', 'My workspace')}>
      <section className="tt-panel">
        <p className="text-tt-text">
          {text(
            'Escolha uma atividade disponível para seu grupo.',
            'Choose an activity available to your group.'
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {capabilities?.navigation.map((entry) => (
            <Link className="tt-btn-secondary" key={entry.path} to={entry.path}>
              {text(entry.label, entry.labelEn)}
            </Link>
          ))}
        </div>
        {!capabilities?.navigation.length ? (
          <p className="mt-4 text-tt-text-muted">
            {text(
              'Solicite ao administrador a atribuição de um grupo.',
              'Ask an administrator to assign you to a group.'
            )}
          </p>
        ) : null}
      </section>
    </AppShell>
  );
};

export default DashboardHomePage;
