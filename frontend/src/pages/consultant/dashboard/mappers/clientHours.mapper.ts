export interface ClientHoursInput {
  clientId: number;
  clientName: string;
  workedMinutes: number;
  overtimeMinutes: number;
}

export interface ClientHoursRow extends ClientHoursInput {
  /** Name shown in the row (child rows drop the shared "Parent - " prefix). */
  label: string;
}

export interface ClientHoursGroup {
  key: string;
  name: string;
  workedMinutes: number;
  overtimeMinutes: number;
  /** Visible rows (worked > 0). A single row means the group is rendered flat. */
  rows: ClientHoursRow[];
}

export interface ClientHoursView {
  groups: ClientHoursGroup[];
  /** Clients with no worked minutes in the period, kept out of the main list. */
  emptyClients: ClientHoursInput[];
  totalWorkedMinutes: number;
  maxGroupMinutes: number;
}

const SEPARATOR = /\s+[-–—]\s+/;

const splitClientName = (name: string): { parent: string; child: string | null } => {
  const trimmed = name.trim();
  const match = SEPARATOR.exec(trimmed);
  if (!match || match.index === 0) return { parent: trimmed, child: null };
  const parent = trimmed.slice(0, match.index).trim();
  const child = trimmed.slice(match.index + match[0].length).trim();
  return child ? { parent, child } : { parent: trimmed, child: null };
};

const byWorkedDesc = <T extends { workedMinutes: number }>(a: T, b: T) =>
  b.workedMinutes - a.workedMinutes;

/**
 * Groups "Parent - Child" clients under their parent, sorts by worked minutes
 * (desc) and moves clients without hours out of the main list.
 */
export const buildClientHoursView = (
  clients: ClientHoursInput[],
  parentLabel = 'Geral'
): ClientHoursView => {
  const emptyClients: ClientHoursInput[] = [];
  const grouped = new Map<string, { name: string; rows: ClientHoursRow[] }>();

  for (const client of clients) {
    if (client.workedMinutes <= 0) {
      emptyClients.push(client);
      continue;
    }
    const { parent, child } = splitClientName(client.clientName);
    const key = parent.toLowerCase();
    const group = grouped.get(key) ?? { name: parent, rows: [] };
    group.rows.push({ ...client, label: child ?? parentLabel });
    grouped.set(key, group);
  }

  const groups = Array.from(grouped.entries())
    .map(([key, group]): ClientHoursGroup => {
      const rows = [...group.rows].sort(byWorkedDesc);
      // A lone row keeps its full client name and renders as a flat row.
      if (rows.length === 1) rows[0] = { ...rows[0], label: rows[0].clientName };
      return {
        key,
        name: rows.length === 1 ? rows[0].clientName : group.name,
        workedMinutes: rows.reduce((sum, row) => sum + row.workedMinutes, 0),
        overtimeMinutes: rows.reduce((sum, row) => sum + row.overtimeMinutes, 0),
        rows,
      };
    })
    .sort(byWorkedDesc);

  return {
    groups,
    emptyClients,
    totalWorkedMinutes: groups.reduce((sum, group) => sum + group.workedMinutes, 0),
    maxGroupMinutes: groups[0]?.workedMinutes ?? 0,
  };
};
