import React from 'react';
import AppShell from '../../../components/AppShell';
import TrackingImportPanel from '../../../components/tracking/TrackingImportPanel';
import TrackingTimerWidget from '../../../components/tracking/TrackingTimerWidget';
import TimeEntryForm from './components/TimeEntryForm';
import EstimateExplainPanel from './components/EstimateExplainPanel';
import { useTimeEntryPage } from './hooks/useTimeEntryPage';
import { text } from '../../../i18n';

const TimeEntryPage: React.FC = () => {
  const state = useTimeEntryPage();

  return (
    <AppShell
      title={
        state.isEditing
          ? text('Editar lançamento', 'Edit time entry')
          : text('Lançar horas', 'Log time')
      }
      subtitle={
        state.isEditing
          ? text('Ajuste os dados do lançamento', 'Update the time entry')
          : text('Registre um novo lançamento', 'Record a new time entry')
      }
    >
      {state.trackingEnabled && state.isEditing && state.numericEntryId ? (
        <TrackingTimerWidget
          className="mb-5"
          timeEntryId={state.numericEntryId}
          actualTrackedMinutes={state.durations?.actualTrackedMinutes ?? null}
          actualTrackedStatus={state.durations?.actualTrackedStatus ?? 'NOT_TRACKED'}
          onStopped={() => void state.reloadEntryDurations()}
        />
      ) : null}
      {state.trackingEnabled && !state.isEditing ? <TrackingTimerWidget className="mb-5" /> : null}
      {state.trackingEnabled ? (
        <TrackingImportPanel
          className="mb-5"
          timeEntryId={state.isEditing ? state.numericEntryId : null}
          onImported={() => {
            if (state.isEditing) void state.reloadEntryDurations();
          }}
        />
      ) : null}

      <TimeEntryForm
        isEditing={state.isEditing}
        clients={state.clients}
        projects={state.projects}
        projectsEnabled={state.projectsEnabled}
        canConfirmDuration={state.canConfirmDuration}
        confirmJustification={state.confirmJustification}
        onConfirmJustificationChange={state.setConfirmJustification}
        onConfirmDuration={() => void state.confirmDuration()}
        clientId={state.clientId}
        onClientChange={state.setClientId}
        projectId={state.projectId}
        onProjectChange={state.setProjectId}
        date={state.date}
        onDateChange={state.setDate}
        activityDescription={state.activityDescription}
        onActivityDescriptionChange={state.setActivityDescription}
        durationInput={state.durationInput}
        onDurationInputChange={state.setDurationInput}
        durations={state.durations}
        parsedDurationMinutes={state.parsedDurationMinutes}
        status={state.status}
        error={state.error}
        fieldErrors={state.fieldErrors}
        loadingEntry={state.loadingEntry}
        aiStatus={state.aiStatus}
        todayInputDate={state.todayInputDate}
        minSelectableDate={state.minSelectableDate}
        lockStatus={state.lockStatus}
        canPrivilegedCorrectLockedEntry={state.canPrivilegedCorrectLockedEntry}
        lockBlocked={state.lockBlocked}
        lockHint={state.lockHint}
        onSubmit={(event) => {
          event.preventDefault();
          void state.submit();
        }}
        onBack={state.goBack}
      />

      {state.isEditing && state.numericEntryId && state.estimatesEnabled ? (
        <EstimateExplainPanel
          enabled={state.estimatesEnabled}
          canPropose={state.canProposeEstimate}
          canConfirm={state.canConfirmDuration}
          timeEntryId={state.numericEntryId}
          clientId={state.clientId}
          projectId={state.projectId}
          activityTitle={state.activityDescription}
          workActivityId={state.workActivityId}
          durations={state.durations}
          confirmation={state.confirmationSnapshot}
          lastRevision={state.lastEstimateRevision}
          onWorkActivityLinked={state.setWorkActivityId}
          onRevisionCreated={state.setLastEstimateRevision}
          onActivityConfirmed={() => void state.reloadEntryDurations()}
        />
      ) : null}
    </AppShell>
  );
};

export default TimeEntryPage;
