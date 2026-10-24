const toDateInput = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startOfWeekMonday = (date: Date): Date => {
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = base.getDay(); // 0..6
  const diffToMonday = day === 0 ? -6 : 1 - day;
  base.setDate(base.getDate() + diffToMonday);
  return base;
};

const endOfWeekFriday = (monday: Date): Date => {
  const friday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
  friday.setDate(friday.getDate() + 4);
  return friday;
};

export const getCurrentWorkWeekRange = (now = new Date()): { start: string; end: string } => {
  const monday = startOfWeekMonday(now);
  const friday = endOfWeekFriday(monday);
  return { start: toDateInput(monday), end: toDateInput(friday) };
};

export const getLastWorkWeekRange = (now = new Date()): { start: string; end: string } => {
  const mondayThisWeek = startOfWeekMonday(now);
  const mondayLastWeek = new Date(
    mondayThisWeek.getFullYear(),
    mondayThisWeek.getMonth(),
    mondayThisWeek.getDate() - 7
  );
  const fridayLastWeek = endOfWeekFriday(mondayLastWeek);
  return { start: toDateInput(mondayLastWeek), end: toDateInput(fridayLastWeek) };
};

export const getTodayRange = (now = new Date()): { start: string; end: string } => {
  const today = toDateInput(now);
  return { start: today, end: today };
};

export const getCurrentMonthRange = (now = new Date()): { start: string; end: string } => {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: toDateInput(start), end: toDateInput(end) };
};

export const getLastMonthRange = (now = new Date()): { start: string; end: string } => {
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { start: toDateInput(start), end: toDateInput(end) };
};
