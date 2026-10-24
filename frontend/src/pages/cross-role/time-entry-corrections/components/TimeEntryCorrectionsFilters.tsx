import { text, translate as translateUi } from '../../../../i18n';
import React from 'react';
import SearchableSelect from '../../../../components/SearchableSelect';
import {
  TIME_ENTRY_CORRECTIONS_INPUT_CLASS_NAME,
  TIME_ENTRY_CORRECTIONS_PRIMARY_BUTTON_CLASS_NAME,
} from '../styles';
import type { TimeEntryCorrectionsClientOption, TimeEntryCorrectionsUserOption } from '../types';

interface TimeEntryCorrectionsFiltersProps {
  userId: number;
  clientId: number;
  startDate: string;
  endDate: string;
  users: TimeEntryCorrectionsUserOption[];
  clients: TimeEntryCorrectionsClientOption[];
  onUserChange: (value: number) => void;
  onClientChange: (value: number) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onRefresh: () => void;
}

const TimeEntryCorrectionsFilters: React.FC<TimeEntryCorrectionsFiltersProps> = ({
  userId,
  clientId,
  startDate,
  endDate,
  users,
  clients,
  onUserChange,
  onClientChange,
  onStartDateChange,
  onEndDateChange,
  onRefresh,
}) => {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
      <SearchableSelect
        value={userId}
        onChange={(value) => onUserChange(Number(value))}
        className="w-full"
        options={[
          { value: 0, label: translateUi('Todos os usuarios') },
          ...users.map((option) => ({ value: option.id, label: option.name })),
        ]}
        placeholder={translateUi('Todos os usuarios')}
        searchPlaceholder={translateUi('Buscar usuario...')}
      />
      <SearchableSelect
        value={clientId}
        onChange={(value) => onClientChange(Number(value))}
        className="w-full"
        options={[
          { value: 0, label: translateUi('Todos os clientes') },
          ...clients.map((option) => ({ value: option.id, label: option.name })),
        ]}
        placeholder={translateUi('Todos os clientes')}
        searchPlaceholder={translateUi('Buscar cliente...')}
      />
      <input
        type="date"
        value={startDate}
        aria-label={text('Data inicial', 'Start date')}
        onChange={(event) => onStartDateChange(event.target.value)}
        className={TIME_ENTRY_CORRECTIONS_INPUT_CLASS_NAME}
      />
      <input
        type="date"
        value={endDate}
        aria-label={text('Data final', 'End date')}
        onChange={(event) => onEndDateChange(event.target.value)}
        className={TIME_ENTRY_CORRECTIONS_INPUT_CLASS_NAME}
      />
      <button
        type="button"
        onClick={onRefresh}
        className={TIME_ENTRY_CORRECTIONS_PRIMARY_BUTTON_CLASS_NAME}
      >
        {translateUi('Atualizar')}
      </button>
    </div>
  );
};

export default TimeEntryCorrectionsFilters;
