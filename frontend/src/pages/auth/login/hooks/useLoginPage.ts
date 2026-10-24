import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isDesktopShell } from '../../../../utils/desktopShell';
import api, { type ApiRequestConfig } from '../../../../services/api';
import { useAuth } from '../../../../contexts/AuthContext';
import { extractApiError } from '../../../../utils/formatters';

export const useLoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [desktop, setDesktop] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const { login, connect } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    /**
     * Quem manda aqui e o BACKEND: /api/desktop/settings so responde quando o
     * backend roda em modo desktop. Nao dependemos da ponte window.desktopRuntime
     * -- se ela falhasse, o app cairia na tela de "criar admin" mesmo havendo um
     * servidor para conectar.
     */
    const detect = async () => {
      try {
        // Web builds have no desktop API; skip the probe instead of logging a 400.
        if (!isDesktopShell()) throw new Error('not-desktop');
        const settings = await api.get('/api/desktop/settings', {
          skipAuth: true,
        } as ApiRequestConfig);

        if (!active) return;
        setDesktop(true);
        setRemoteUrl(settings.data.data.remoteUrl ?? '');
      } catch {
        if (!active) return;
        // Web: sem nenhum usuario ainda, vai para a criacao do primeiro admin.
        try {
          const status = await api.get('/api/auth/setup-status', {
            skipAuth: true,
          } as ApiRequestConfig);
          if (active) setRegistrationEnabled(Boolean(status.data.data.registrationEnabled));
          if (active && status.data.data.needsSetup) {
            navigate('/setup', { replace: true });
            return;
          }
        } catch {
          /* segue para o login normal */
        }
      } finally {
        if (active) setChecking(false);
      }
    };

    void detect();
    return () => {
      active = false;
    };
  }, [navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);

    try {
      if (desktop) {
        const mode = await connect(remoteUrl.trim(), email, password);
        if (mode === 'offline') {
          setNotice('Sem conexão com o servidor: entrando com os dados locais.');
        }
      } else {
        await login(email, password);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(extractApiError(err, 'Falha ao fazer login'));
    } finally {
      setLoading(false);
    }
  };

  return {
    email,
    password,
    remoteUrl,
    error,
    notice,
    loading,
    checking,
    desktop,
    registrationEnabled,
    setEmail,
    setPassword,
    setRemoteUrl,
    submit,
  };
};
