let accessToken: string | null = null;

const SESSION_HINT_KEY = 'tt.sessionHint';

const writeSessionHint = (active: boolean): void => {
  try {
    window.localStorage.setItem(SESSION_HINT_KEY, active ? '1' : '0');
  } catch {
    /* storage unavailable: the hint is only an optimisation */
  }
};

/**
 * False only when this browser knows it has no session (explicit sign-out or a failed
 * refresh). Unknown (first visit, older versions) counts as "maybe", so the cookie is
 * still tried. This avoids a guaranteed 401 on every anonymous page load.
 */
export const mayHaveSession = (): boolean => {
  try {
    return window.localStorage.getItem(SESSION_HINT_KEY) !== '0';
  } catch {
    return true;
  }
};

export const getAccessToken = (): string | null => accessToken;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
  if (token) writeSessionHint(true);
};

export const clearAccessToken = (): void => {
  accessToken = null;
  writeSessionHint(false);
};
