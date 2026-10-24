export interface ManagerAssignmentWindow {
  startDate: Date;
  endDate: Date | null;
}

export interface ManagedConsultantIdsInput {
  currentConsultantIds: number[];
  historicalConsultantIds: number[];
}

export interface ManagerConsultantAccessInput {
  managerId: number;
  consultantId: number;
  currentLinkExists: boolean;
  assignmentWindows: ManagerAssignmentWindow[];
  date: Date;
}

export interface ConsultantClientAccessInput {
  linked: boolean;
  historical: boolean;
}

export interface AccessibleClientIdsInput {
  linkedClientIds: number[];
  historicalClientIds: number[];
}

export interface ManagerAccessibleClientIdsInput {
  ownLinkedClientIds: number[];
  managedLinkedClientIds: number[];
  ownHistoricalClientIds: number[];
  managedHistoricalClientIds: number[];
}

const uniqueIds = (values: number[]): number[] => Array.from(new Set(values));

const toDateOnly = (value: Date): string => value.toISOString().slice(0, 10);

export const getManagedConsultantIds = (params: ManagedConsultantIdsInput): number[] =>
  uniqueIds([...params.currentConsultantIds, ...params.historicalConsultantIds]);

export const canManagerAccessConsultantOnDate = (params: ManagerConsultantAccessInput): boolean => {
  if (params.managerId === params.consultantId) return true;
  if (params.currentLinkExists) return true;

  const targetDate = toDateOnly(params.date);
  return params.assignmentWindows.some((window) => {
    const start = toDateOnly(window.startDate);
    const end = window.endDate ? toDateOnly(window.endDate) : '9999-12-31';
    return start <= targetDate && end >= targetDate;
  });
};

export const canConsultantAccessClientWithHistory = (
  params: ConsultantClientAccessInput
): boolean => params.linked || params.historical;

export const getAccessibleClientIdsForConsultant = (params: AccessibleClientIdsInput): number[] =>
  uniqueIds([...params.linkedClientIds, ...params.historicalClientIds]);

export const getAccessibleClientIdsForManager = (
  params: ManagerAccessibleClientIdsInput
): number[] =>
  uniqueIds([
    ...params.ownLinkedClientIds,
    ...params.managedLinkedClientIds,
    ...params.ownHistoricalClientIds,
    ...params.managedHistoricalClientIds,
  ]);
