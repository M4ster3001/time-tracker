import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api, { type ApiRequestConfig } from '../services/api';
import { clearAccessToken, mayHaveSession, setAccessToken } from '../services/tokenStore';

interface User {
  id: number;
  name: string;
  email: string;
  roleId: number;
  role: {
    id: number;
    name: string;
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  setupAdmin: (name: string, email: string, password: string) => Promise<void>;
  connect: (remoteUrl: string, email: string, password: string) => Promise<'online' | 'offline'>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      if (!mayHaveSession()) {
        setLoading(false);
        return;
      }
      try {
        const response = await api.post('/api/auth/refresh', undefined, {
          skipAuth: true,
        } as ApiRequestConfig);
        const { token: newToken, user: newUser } = response.data.data;
        setAccessToken(newToken);
        setToken(newToken);
        setUser(newUser);
      } catch (_error) {
        clearAccessToken();
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const handleRefresh = (event: Event) => {
      const detail = (event as CustomEvent<{ token: string; user: User }>).detail;
      if (detail?.token) {
        setToken(detail.token);
      }
      if (detail?.user) {
        setUser(detail.user);
      }
    };

    window.addEventListener('auth:refresh', handleRefresh);
    return () => {
      window.removeEventListener('auth:refresh', handleRefresh);
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/api/auth/login', { email, password }, {
        skipAuth: true,
      } as ApiRequestConfig);
      const { token: newToken, user: newUser } = response.data.data;
      setAccessToken(newToken);
      setToken(newToken);
      setUser(newUser);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      const response = await api.post('/api/auth/register', { name, email, password }, {
        skipAuth: true,
      } as ApiRequestConfig);
      const { token: newToken, user: newUser } = response.data.data;
      setAccessToken(newToken);
      setToken(newToken);
      setUser(newUser);
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  /**
   * Login online-first do desktop: autentica no servidor remoto quando ha
   * conexao (e sincroniza), ou cai para a sessao local espelhada quando offline.
   */
  const connect = async (remoteUrl: string, email: string, password: string) => {
    const response = await api.post(
      '/api/desktop/connect',
      { remoteUrl: remoteUrl || undefined, email, password },
      { skipAuth: true } as ApiRequestConfig
    );
    const { token: newToken, user: newUser, mode } = response.data.data;
    setAccessToken(newToken);
    setToken(newToken);
    setUser(newUser);
    return mode as 'online' | 'offline';
  };

  // Primeiro boot: cria o administrador inicial (o backend so aceita com o banco vazio).
  const setupAdmin = async (name: string, email: string, password: string) => {
    const response = await api.post('/api/auth/setup', { name, email, password }, {
      skipAuth: true,
    } as ApiRequestConfig);
    const { token: newToken, user: newUser } = response.data.data;
    setAccessToken(newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (_error) {
      // ignore logout errors to ensure client clears state
    } finally {
      clearAccessToken();
      setUser(null);
      setToken(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        setupAdmin,
        connect,
        logout,
        isAuthenticated: !!user && !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
