import {
  getCurrentMonthRange,
  getCurrentWorkWeekRange,
  getLastMonthRange,
  getLastWorkWeekRange,
  getTodayRange,
} from '../../../../utils/dateRanges';

export const getDashboardPersonalQuickRanges = () => [
  { key: 'current-week', label: 'Semana atual', range: getCurrentWorkWeekRange() },
  { key: 'last-week', label: 'Última semana', range: getLastWorkWeekRange() },
  { key: 'current-month', label: 'Mês atual', range: getCurrentMonthRange() },
  { key: 'last-month', label: 'Último mês', range: getLastMonthRange() },
  { key: 'today', label: 'Hoje', range: getTodayRange() },
];
