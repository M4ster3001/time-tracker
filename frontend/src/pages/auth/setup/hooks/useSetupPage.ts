import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isDesktopShell } from '../../../../utils/desktopShell';
import api, { type ApiRequestConfig } from '../../../../services/api';
import { useAuth } from '../../../../contexts/AuthContext';
import { extractApiError } from '../../../../utils/formatters';

/** Mesmas regras do backend (auth.service.validatePasswordStrength). */
export const passwordRules = [
  { label: 'Ao menos 12 caracteres', test: (v: string) => v.length >= 12 },
  { label: 'Uma letra minuscula', test: (v: string) => /[a-z]/.test(v) },
  { label: 'Uma letra maiuscula', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'Um número', test: (v: string) => /[0-9]/.test(v) },
  {
    label: 'Um caractere especial',
    test: (v: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(v),
  },
];

export const useSetupPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const { setupAdmin } = useAuth();
  const navigate = useNavigate();

  // Esta tela e do modo autonomo (web sem nenhum usuario). No desktop o acesso e
  // sempre pelo servidor remoto, entao ela nunca deve aparecer la.
  useEffect(() => {
    let active = true;

    const guard = async () => {
      try {
        if (!isDesktopShell()) throw new Error('not-desktop');
        await api.get('/api/desktop/settings', { skipAuth: true } as ApiRequestConfig);
        // Respondeu => e o app desktop: o caminho e o login contra o servidor.
        if (active) navigate('/login', { replace: true });
        return;
      } catch {
        /* nao e desktop, segue a checagem normal */
      }

      try {
        const response = await api.get('/api/auth/setup-status', {
          skipAuth: true,
        } as ApiRequestConfig);
        if (active && !response.data.data.needsSetup) navigate('/login', { replace: true });
      } catch {
        if (active) navigate('/login', { replace: true });
      } finally {
        if (active) setChecking(false);
      }
    };

    void guard();
    return () => {
      active = false;
    };
  }, [navigate]);

  const failedRules = passwordRules.filter((rule) => !rule.test(password));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('As senhas não correspondem');
      return;
    }
    if (failedRules.length > 0) {
      setError(`A senha não atende aos requisitos: ${failedRules.map((r) => r.label).join(', ')}`);
      return;
    }

    setLoading(true);
    try {
      await setupAdmin(name, email, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(extractApiError(err, 'Falha ao criar o administrador'));
    } finally {
      setLoading(false);
    }
  };

  return {
    name,
    email,
    password,
    confirmPassword,
    error,
    loading,
    checking,
    passwordRules,
    setName,
    setEmail,
    setPassword,
    setConfirmPassword,
    submit,
  };
};
