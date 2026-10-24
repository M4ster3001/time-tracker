import { translate as translateUi } from '../../../i18n';
import React from 'react';
import AppShell from '../../../components/AppShell';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { useTimeEntryCorrectionsPage } from './hooks';
import {
  TIME_ENTRY_CORRECTIONS_PAGE_SUBTITLE,
  TIME_ENTRY_CORRECTIONS_PAGE_TITLE,
} from './constants';
import {
  TimeEntryCorrectionsEditDialog,
  TimeEntryCorrectionsFilters,
  TimeEntryCorrectionsList,
} from './components';
import { TIME_ENTRY_CORRECTIONS_SECTION_CLASS_NAME } from './styles';

const TimeEntryCorrectionsPage: React.FC = () => {
  const { state, actions } = useTimeEntryCorrectionsPage();

  return (
    <AppShell
      title={TIME_ENTRY_CORRECTIONS_PAGE_TITLE}
      subtitle={TIME_ENTRY_CORRECTIONS_PAGE_SUBTITLE}
    >
      <section className={TIME_ENTRY_CORRECTIONS_SECTION_CLASS_NAME}>
        <TimeEntryCorrectionsFilters
          userId={state.userId}
          clientId={state.clientId}
          startDate={state.startDate}
          endDate={state.endDate}
          users={state.users}
          clients={state.clients}
          onUserChange={actions.handleUserChange}
          onClientChange={actions.handleClientChange}
          onStartDateChange={actions.handleStartDateChange}
          onEndDateChange={actions.handleEndDateChange}
          onRefresh={actions.refreshEntries}
        />
      </section>

      <TimeEntryCorrectionsList
        entries={state.entries}
        total={state.total}
        page={state.page}
        pageSize={state.pageSize}
        loading={state.loading}
        error={state.error}
        onPageChange={actions.setPage}
        onPageSizeChange={actions.setPageSize}
        onEdit={actions.openEdit}
        onDelete={actions.openDelete}
      />

      {state.editing ? (
        <TimeEntryCorrectionsEditDialog
          editing={state.editing}
          editClients={state.editClients}
          saving={state.saving}
          onClose={actions.closeEdit}
          onSave={actions.handleSaveEdit}
          onChange={actions.updateEditing}
        />
      ) : null}

      <ConfirmDialog
        isOpen={state.deleteConfirm.isOpen}
        title={translateUi('Excluir lancamento')}
        message={`Tem certeza que deseja excluir "${state.deleteConfirm.title}"? Esta ação não pode ser desfeita.`}
        confirmLabel={state.saving ? 'Excluindo...' : 'Excluir'}
        onConfirm={actions.handleDelete}
        onCancel={actions.closeDelete}
      />
    </AppShell>
  );
};

export default TimeEntryCorrectionsPage;
