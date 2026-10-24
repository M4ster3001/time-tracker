/**
 * workspace layout nav IA: collapse redundant section headers when a group has a
 * single child whose label matches the group (case/accent-insensitive).
 */

export type NavItemInput = {
  to: string;
  label: string;
};

export type NavGroupInput = {
  key: string;
  label: string;
  mark: string;
  defaultOpen: boolean;
  items: NavItemInput[];
};

export type NavPresentation =
  | { kind: 'group'; group: NavGroupInput }
  | { kind: 'link'; key: string; mark: string; item: NavItemInput };

/** Normalize for IA compare: lowercase + strip combining diacritics. */
export const normalizeNavLabel = (label: string): string =>
  label
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase()
    .trim();

export const labelsMatchInsensitive = (a: string, b: string): boolean =>
  normalizeNavLabel(a) === normalizeNavLabel(b);

export const isRedundantSingletonGroup = (group: {
  label: string;
  items: Array<{ label: string }>;
}): boolean =>
  group.items.length === 1 && labelsMatchInsensitive(group.label, group.items[0]!.label);

/** Promote matching singletons to flat links; keep multi-item / mismatched groups. */
export const presentNavGroups = (groups: NavGroupInput[]): NavPresentation[] =>
  groups.map((group) => {
    if (isRedundantSingletonGroup(group)) {
      return {
        kind: 'link' as const,
        key: group.key,
        mark: group.mark,
        item: group.items[0]!,
      };
    }
    return { kind: 'group' as const, group };
  });
