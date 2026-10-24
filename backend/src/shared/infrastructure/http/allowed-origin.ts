/**
 * Matching de Origin/Referer para CORS e CSRF.
 * Lista explícita via CORS_ORIGIN; opcionalmente HTTP em LAN privada (dev).
 */

export type AllowedOriginOptions = {
  allowlist: readonly string[];
  /** Só use fora de produção (ex.: testes na rede local). Default false. */
  allowPrivateLan?: boolean;
};

const IPV4_OCTET = '(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)';

/** http://host:port — host = localhost | 127.0.0.1 | RFC1918 */
const PRIVATE_LAN_HTTP_ORIGIN =
  new RegExp(
    `^http://(?:` +
      `localhost|` +
      `127\\.0\\.0\\.1|` +
      `10(?:\\.${IPV4_OCTET}){3}|` +
      `192\\.168(?:\\.${IPV4_OCTET}){2}|` +
      `172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.${IPV4_OCTET}){2}` +
      `):\\d{1,5}$`,
    'i'
  );

export const isPrivateLanHttpOrigin = (origin: string): boolean =>
  PRIVATE_LAN_HTTP_ORIGIN.test(origin);

const matchesAllowlist = (value: string, allowlist: readonly string[]): boolean =>
  allowlist.some((allowed) => value === allowed || value.startsWith(`${allowed}/`));

/**
 * Valida Origin (exato) ou Referer (exato ou path sob a origem).
 * Com allowPrivateLan, também aceita http://RFC1918|loopback:porta (e paths).
 */
export const isAllowedBrowserOrigin = (
  value: string | undefined,
  options: AllowedOriginOptions
): boolean => {
  if (!value) return false;

  if (matchesAllowlist(value, options.allowlist)) return true;

  if (!options.allowPrivateLan) return false;

  try {
    const url = new URL(value);
    const origin = `${url.protocol}//${url.host}`;
    return isPrivateLanHttpOrigin(origin);
  } catch {
    return false;
  }
};
