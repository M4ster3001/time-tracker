import { describe, expect, it } from 'vitest';
import { isAllowedBrowserOrigin, isPrivateLanHttpOrigin } from './allowed-origin.js';

describe('isPrivateLanHttpOrigin', () => {
  it('aceita RFC1918 e loopback em http com porta', () => {
    expect(isPrivateLanHttpOrigin('http://192.168.31.119:3000')).toBe(true);
    expect(isPrivateLanHttpOrigin('http://10.0.0.5:3000')).toBe(true);
    expect(isPrivateLanHttpOrigin('http://172.16.1.2:5173')).toBe(true);
    expect(isPrivateLanHttpOrigin('http://127.0.0.1:3000')).toBe(true);
    expect(isPrivateLanHttpOrigin('http://localhost:3000')).toBe(true);
  });

  it('rejeita publico, https e hostnames que so parecem LAN', () => {
    expect(isPrivateLanHttpOrigin('https://192.168.31.119:3000')).toBe(false);
    expect(isPrivateLanHttpOrigin('http://8.8.8.8:3000')).toBe(false);
    expect(isPrivateLanHttpOrigin('http://172.32.0.1:3000')).toBe(false);
    expect(isPrivateLanHttpOrigin('http://192.168.31.119.evil.com:3000')).toBe(false);
    expect(isPrivateLanHttpOrigin('http://evil.com:3000')).toBe(false);
  });
});

describe('isAllowedBrowserOrigin', () => {
  const allowlist = ['http://localhost:3000', 'https://app.example.com'];

  it('aceita match exato e Referer sob a origem permitida', () => {
    expect(isAllowedBrowserOrigin('http://localhost:3000', { allowlist })).toBe(true);
    expect(
      isAllowedBrowserOrigin('http://localhost:3000/login', { allowlist })
    ).toBe(true);
    expect(isAllowedBrowserOrigin('https://app.example.com', { allowlist })).toBe(true);
  });

  it('rejeita LAN quando o padrao privado esta desligado', () => {
    expect(
      isAllowedBrowserOrigin('http://192.168.31.119:3000', {
        allowlist,
        allowPrivateLan: false,
      })
    ).toBe(false);
  });

  it('aceita LAN privada so quando allowPrivateLan=true', () => {
    expect(
      isAllowedBrowserOrigin('http://192.168.31.119:3000', {
        allowlist,
        allowPrivateLan: true,
      })
    ).toBe(true);
    expect(
      isAllowedBrowserOrigin('http://192.168.31.119:3000/dashboard', {
        allowlist,
        allowPrivateLan: true,
      })
    ).toBe(true);
  });

  it('nunca trata valor vazio como permitido', () => {
    expect(isAllowedBrowserOrigin(undefined, { allowlist, allowPrivateLan: true })).toBe(
      false
    );
    expect(isAllowedBrowserOrigin('', { allowlist, allowPrivateLan: true })).toBe(false);
  });
});
