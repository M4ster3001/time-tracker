/**
 * PRJ-01 — regras de projeto no lote (alinhadas ao create individual / API).
 */

export type BulkClientOption = {
  id: number;
  name: string;
  requireProjectOnEntries?: boolean;
};

export type BulkProjectOption = {
  id: number;
  code: string;
  name: string;
  state: string;
  clientId: number;
};

/** Cliente exige projeto nos novos lançamentos (flow projects). */
export const clientRequiresProject = (
  clients: BulkClientOption[],
  clientId: number,
  projectsEnabled: boolean
): boolean => {
  if (!projectsEnabled || !clientId) return false;
  const client = clients.find((item) => item.id === clientId);
  return Boolean(client?.requireProjectOnEntries);
};

/** Linha válida quanto a projeto: obrigatório só quando o cliente exige. */
export const isBulkRowProjectValid = (input: {
  projectsEnabled: boolean;
  requireProject: boolean;
  projectId: number | null;
}): boolean => {
  if (!input.projectsEnabled) return true;
  if (!input.requireProject) return true;
  return input.projectId != null && input.projectId > 0;
};

/** Opções do seletor: sem “Sem projeto” quando o cliente exige. */
export const projectSelectOptionsForBulk = (input: {
  projects: BulkProjectOption[];
  requireProject: boolean;
  locale: 'pt' | 'en';
}): Array<{ value: number; label: string }> => {
  const noProjectLabel = input.locale === 'en' ? 'No project' : 'Sem projeto';
  const usable = input.projects.filter((p) => p.state === 'ACTIVE' || p.state === 'PLANNED');
  const mapped = usable.map((p) => ({
    value: p.id,
    label: `${p.code} — ${p.name}`,
  }));
  if (input.requireProject) return mapped;
  return [{ value: 0, label: noProjectLabel }, ...mapped];
};
