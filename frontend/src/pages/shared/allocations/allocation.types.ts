export type AllocationType = 'DAILY' | 'MONTHLY';

export interface AllocationDraft {
  allocationType: AllocationType;
  hours: string;
  hourlyRate: string;
}

export interface AllocationRow {
  clientId: number;
  clientName: string;
  allocation: {
    allocationType: AllocationType;
    hoursPerDay: number | null;
    hoursPerMonth: number | null;
    hourlyRate: number | null;
  } | null;
}

/** Item do seletor "qual manager/consultor estou editando". */
export interface ScopeOption {
  id: number;
  name: string;
}

/** Cliente no bloco de vinculo (checkbox), com estado ativo/inativo. */
export interface ClientLinkRow {
  id: number;
  name: string;
  isActive: boolean;
}
