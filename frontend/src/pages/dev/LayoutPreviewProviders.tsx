import React, { useMemo } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import { CapabilitiesContext } from '../../contexts/CapabilitiesContext';

type MockUser = {
  id: number;
  name: string;
  email: string;
  roleId: number;
};

type MockCapabilities = {
  grants: Array<{ permission: string; scope: 'self' | 'team' | 'all' }>;
  flows: Record<string, boolean>;
  locale: 'pt-BR' | 'en';
  navigation: Array<{ path: string; label: string; labelEn: string; section: string }>;
};

export function LayoutPreviewProviders({
  user,
  capabilities,
  children,
}: {
  user: MockUser;
  capabilities: MockCapabilities;
  children: React.ReactNode;
}) {
  const authValue = useMemo(
    () => ({
      user: {
        ...user,
        role: {
          id: user.roleId,
          name:
            user.roleId === 1 ? 'Admin' : user.roleId === 2 ? 'Manager' : 'Consultant',
        },
      },
      token: 'preview-token',
      loading: false,
      login: async () => undefined,
      register: async () => undefined,
      setupAdmin: async () => undefined,
      connect: async () => 'online' as const,
      logout: async () => undefined,
      isAuthenticated: true,
    }),
    [user]
  );

  const capsValue = useMemo(
    () => ({
      capabilities,
      loading: false,
      error: false,
      refresh: async () => undefined,
      can: () => true,
      canVisit: () => true,
    }),
    [capabilities]
  );

  return (
    <AuthContext.Provider value={authValue}>
      <CapabilitiesContext.Provider value={capsValue}>{children}</CapabilitiesContext.Provider>
    </AuthContext.Provider>
  );
}
