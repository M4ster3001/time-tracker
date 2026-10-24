import { text, translate as translateUi } from '../../../../i18n';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DashboardListCard,
  DashboardStatCard,
  DashboardTimeline,
} from '../../../../components/DashboardPanels';
import InfoTooltip from '../../../../components/InfoTooltip';
import QuickLogWidget from '../../../../components/QuickLogWidget';
import { formatDate, formatMinutes } from '../../../../utils/formatters';
import type {
  ActivitySuggestion,
  ClientOption,
  DashboardPersonalInsights,
  DashboardPersonalOverviewMetrics,
  DashboardResponse,
  LockStatus,
  QuickLogPayload,
} from '../types/dashboardPersonal.types';
import {
  dashboardPersonalSidebarClass,
  dashboardPersonalSplitLayoutClass,
  dashboardPersonalStatGridClass,
} from '../styles/dashboardPersonal.styles';
import HoursByClientCard from './HoursByClientCard';

interface DashboardPersonalOverviewSectionProps {
  dashboard: DashboardResponse;
  layoutMode: 'simple' | 'complete';
  clientId: number;
  clients: ClientOption[];
  activityTags: ActivitySuggestion[];
  aiStatus?: { enabled: boolean; provider?: string | null } | null;
  clientNameById: Map<number, string>;
  lockByClient: Record<number, LockStatus>;
  selectedLockStatus: LockStatus | null;
  recentWeekFooter: string;
  recentWeekPoints: Parameters<typeof DashboardTimeline>[0]['points'];
  metrics: DashboardPersonalOverviewMetrics;
  insights: DashboardPersonalInsights;
  onQuickLog: (payload: QuickLogPayload) => Promise<void>;
  loadActivitySuggestions: (clientId?: number) => Promise<ActivitySuggestion[]>;
}

const DashboardPersonalOverviewSection: React.FC<DashboardPersonalOverviewSectionProps> = ({
  dashboard,
  layoutMode,
  clientId,
  clients,
  activityTags,
  aiStatus,
  clientNameById,
  lockByClient,
  selectedLockStatus,
  recentWeekFooter,
  recentWeekPoints,
  metrics,
  insights,
  onQuickLog,
  loadActivitySuggestions,
}) => {
  const navigate = useNavigate();
  const filteredEntries = clientId
    ? dashboard.entries.filter((entry) => entry.clientId === clientId)
    : dashboard.entries;
  const isCompleteLayout = layoutMode === 'complete';
  const normalProgress =
    metrics.targetMinutes > 0
      ? Math.min(100, (metrics.normalMinutes / metrics.targetMinutes) * 100)
      : 0;

  return (
    <section className={dashboardPersonalSplitLayoutClass}>
      <div className="space-y-6">
        <div className="@container">
        <div className={dashboardPersonalStatGridClass}>
          <DashboardStatCard
            label={translateUi('Horas normais')}
            value={formatMinutes(metrics.normalMinutes)}
            description="Parte do ciclo fechado que conta dentro da meta."
            tone="success"
            empty={metrics.normalMinutes === 0}
            emptyLabel={
              metrics.targetMinutes > 0
                ? undefined
                : text('Nenhuma hora normal no ciclo', 'No regular hours in the cycle')
            }
            progress={metrics.targetMinutes > 0 ? normalProgress : undefined}
            hint={
              metrics.targetMinutes > 0
                ? text(
                    `${Math.round(normalProgress)}% da meta de ${formatMinutes(metrics.targetMinutes)}`,
                    `${Math.round(normalProgress)}% of the ${formatMinutes(metrics.targetMinutes)} target`
                  )
                : undefined
            }
          />
          <DashboardStatCard
            label={translateUi('Horas extras')}
            value={formatMinutes(metrics.overtimeMinutes)}
            description="Excedente do ciclo já fechado."
            tone="warning"
            emphasis
            empty={metrics.overtimeMinutes === 0}
            emptyLabel={text('Sem extras no ciclo', 'No overtime in the cycle')}
            hint={
              metrics.targetMinutes > 0
                ? text(
                    `+${Math.round((metrics.overtimeMinutes / metrics.targetMinutes) * 100)}% sobre a meta`,
                    `+${Math.round((metrics.overtimeMinutes / metrics.targetMinutes) * 100)}% over target`
                  )
                : metrics.overtimeMinutes > 0
                  ? text(
                      'Sem meta/alocação no ciclo: as horas contam como extras.',
                      'No target/allocation in the cycle: hours count as overtime.'
                    )
                  : undefined
            }
          />
          <DashboardStatCard
            label={translateUi('Ciclo fechado')}
            value={formatMinutes(metrics.targetMinutes)}
            description="Meta prevista para a janela já encerrada."
            tone="info"
            empty={metrics.targetMinutes === 0}
            emptyLabel={text('Sem meta definida', 'No target set')}
          />
          <DashboardStatCard
            label={translateUi('Previa do proximo ciclo')}
            value={formatMinutes(metrics.previewOvertimeMinutes)}
            description="Extras já acumuladas na janela em andamento."
            tone="warning"
            empty={metrics.previewOvertimeMinutes === 0}
            emptyLabel={text('Nada acumulado ainda', 'Nothing accumulated yet')}
          />
        </div>
        </div>

        {isCompleteLayout ? (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-tt-info bg-tt-info-soft px-4 py-3 text-sm text-tt-info">
              <span className="font-semibold">{translateUi('Como ler o fechamento')}</span>
              <InfoTooltip content="O ciclo fechado mostra apenas o que já encerrou no cliente. A prévia do próximo ciclo acompanha o que esta sendo construido agora e ainda pode mudar ate a próxima data de fechamento." />
            </div>

            {metrics.overtimeMinutes > 0 || metrics.previewOvertimeMinutes > 0 ? (
              <div className="rounded-3xl border border-tt-border bg-tt-warning-soft/80 p-4 text-sm text-tt-warning">
                {translateUi('Fechado:')} {formatMinutes(metrics.overtimeMinutes)}{' '}
                {translateUi('extras. Previa:')} {formatMinutes(metrics.previewOvertimeMinutes)}{' '}
                {translateUi('extras potenciais.')}
              </div>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-2">
              <DashboardListCard
                title={translateUi('Pendencias de hoje')}
                description="Clientes esperados hoje que ainda não tiveram registro."
                items={insights.pendingClients}
                emptyMessage="Nenhum cliente pendente hoje."
              />
              <DashboardListCard
                title={translateUi('Fechamentos proximos')}
                description="Clientes que vão fechar nos próximos dias."
                items={insights.closingSoonClients}
                emptyMessage="Nenhum fechamento próximo neste momento."
              />
            </div>
          </>
        ) : null}

        <HoursByClientCard clients={metrics.byClient} />

        {isCompleteLayout ? (
          <>
            <DashboardTimeline
              title={translateUi('Linha do tempo semanal')}
              description="Últimos 7 dias carregados no dashboard."
              points={recentWeekPoints}
              footer={recentWeekFooter}
            />

            <div className="grid gap-6 xl:grid-cols-2">
              <DashboardListCard
                title={translateUi('Alocacoes sem uso')}
                description="Clientes com meta no ciclo fechado, mas sem uso."
                items={insights.unusedAllocations}
                emptyMessage="Todas as alocações com meta tiveram uso no ciclo fechado."
              />
              <DashboardListCard
                title={translateUi('Feed relevante')}
                description="Sinais operacionais para agir sem abrir outras telas."
                items={insights.feedItems}
                emptyMessage="Nenhum sinal relevante por enquanto."
              />
            </div>
          </>
        ) : null}

        <div className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-tt-text">
            {translateUi('Ultimos lancamentos')}
          </h3>
          <div className="mt-4 space-y-3">
            {filteredEntries.length === 0 ? (
              <p className="text-sm text-tt-text-muted">
                {translateUi('Nenhum lancamento recente.')}
              </p>
            ) : (
              filteredEntries.slice(0, 5).map((entry) => {
                const entryLocked = lockByClient[entry.clientId]?.locked ?? false;
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-tt border border-tt-border bg-tt-surface px-4 py-3"
                  >
                    <div>
                      <p
                        className="max-w-[200px] truncate text-sm font-semibold text-tt-text md:max-w-[320px]"
                        title={entry.activityDescription}
                      >
                        {entry.activityDescription}
                      </p>
                      <p className="text-xs text-tt-text-muted">
                        {formatDate(entry.date)} ·{' '}
                        <span
                          className="inline-block max-w-[160px] truncate align-bottom md:max-w-[240px]"
                          title={clientNameById.get(entry.clientId) ?? `Cliente #${entry.clientId}`}
                        >
                          {clientNameById.get(entry.clientId) ?? `Cliente #${entry.clientId}`}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-tt-action">
                        {formatMinutes(entry.durationMinutes)}
                      </span>
                      {entryLocked ? null : (
                        <button
                          type="button"
                          onClick={() => navigate(`/time-entries/${entry.id}/edit`)}
                          className="rounded-full border border-tt-border px-3 py-1 text-xs text-tt-warning hover:bg-tt-warning-soft"
                        >
                          {translateUi('Editar')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <aside className={dashboardPersonalSidebarClass} aria-label={text('Ações rápidas', 'Quick actions')}>
        <QuickLogWidget
          clients={clients}
          activities={activityTags}
          aiStatus={aiStatus ?? undefined}
          onSave={onQuickLog}
          loadSuggestions={loadActivitySuggestions}
        />

        <div className="rounded-tt border border-tt-border bg-tt-surface p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-tt-text">{translateUi('Ritmo do mes')}</h3>
          <p className="mt-2 text-sm text-tt-text-muted">
            {translateUi('Fechado:')} {dashboard.progressPercent}% da meta do ciclo. A previa segue
            separada para nao misturar o que ja encerrou com o que ainda esta aberto.
          </p>
          {selectedLockStatus?.locked ? (
            <p className="mt-3 text-xs font-semibold text-tt-warning">
              Fechamento ativo. Edicoes do mes selecionado estao bloqueadas.
            </p>
          ) : null}
        </div>
      </aside>
    </section>
  );
};

export default DashboardPersonalOverviewSection;
