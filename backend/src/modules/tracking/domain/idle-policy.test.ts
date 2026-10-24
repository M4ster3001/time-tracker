import { describe, expect, it } from 'vitest';
import {
  DEFAULT_IDLE_POLICY,
  evaluateIdlePolicy,
  parseIdlePolicyConfig,
} from './idle-policy.js';

describe('TRK-01 idle policy (no invented minute thresholds)', () => {
  it('defaults todos null — nenhum gate; acao none', () => {
    expect(DEFAULT_IDLE_POLICY).toEqual({
      autoPauseAfterIdleMinutes: null,
      autoPauseAfterHostSuspendMinutes: null,
      stopOnUnexpectedTermination: null,
    });

    const decision = evaluateIdlePolicy({
      trackingFlowEnabled: true,
      sessionState: 'RUNNING',
      signal: { kind: 'user_idle', idleMinutes: 60 },
      config: DEFAULT_IDLE_POLICY,
    });
    expect(decision.configuredGateCount).toBe(0);
    expect(decision.action).toBe('none');
    expect(decision.reason).toBe('POLICY_NOT_CONFIGURED');
  });

  it('flow tracking off → none (nao inventa habilitar medicao)', () => {
    const decision = evaluateIdlePolicy({
      trackingFlowEnabled: false,
      sessionState: 'RUNNING',
      signal: { kind: 'user_idle', idleMinutes: 999 },
      config: {
        autoPauseAfterIdleMinutes: 5,
        autoPauseAfterHostSuspendMinutes: null,
        stopOnUnexpectedTermination: null,
      },
    });
    expect(decision.action).toBe('none');
    expect(decision.reason).toBe('TRACKING_FLOW_OFF');
  });

  it('sessao nao RUNNING → none mesmo com limiar produto', () => {
    const decision = evaluateIdlePolicy({
      trackingFlowEnabled: true,
      sessionState: 'PAUSED',
      signal: { kind: 'user_idle', idleMinutes: 30 },
      config: {
        autoPauseAfterIdleMinutes: 10,
        autoPauseAfterHostSuspendMinutes: null,
        stopOnUnexpectedTermination: null,
      },
    });
    expect(decision.action).toBe('none');
    expect(decision.reason).toBe('SESSION_NOT_RUNNING');
  });

  it('parse rejeita minutos invalidos; aceita null explicito', () => {
    expect(parseIdlePolicyConfig(null)).toEqual(DEFAULT_IDLE_POLICY);
    expect(
      parseIdlePolicyConfig({
        autoPauseAfterIdleMinutes: 15,
        autoPauseAfterHostSuspendMinutes: null,
        stopOnUnexpectedTermination: true,
      })
    ).toEqual({
      autoPauseAfterIdleMinutes: 15,
      autoPauseAfterHostSuspendMinutes: null,
      stopOnUnexpectedTermination: true,
    });
    expect(() => parseIdlePolicyConfig({ autoPauseAfterIdleMinutes: 0 })).toThrow(
      'IDLE_POLICY_THRESHOLD_INVALID'
    );
    expect(() => parseIdlePolicyConfig({ autoPauseAfterIdleMinutes: 1.5 })).toThrow(
      'IDLE_POLICY_THRESHOLD_INVALID'
    );
    expect(() =>
      parseIdlePolicyConfig({ stopOnUnexpectedTermination: 'yes' })
    ).toThrow('IDLE_POLICY_THRESHOLD_INVALID');
  });

  it('user_idle abaixo do limiar produto → none BELOW_THRESHOLD', () => {
    const decision = evaluateIdlePolicy({
      trackingFlowEnabled: true,
      sessionState: 'RUNNING',
      signal: { kind: 'user_idle', idleMinutes: 4 },
      config: {
        autoPauseAfterIdleMinutes: 10,
        autoPauseAfterHostSuspendMinutes: null,
        stopOnUnexpectedTermination: null,
      },
    });
    expect(decision.configuredGateCount).toBe(1);
    expect(decision.action).toBe('none');
    expect(decision.reason).toBe('BELOW_THRESHOLD');
  });

  it('user_idle no limiar produto → pause IDLE_THRESHOLD_MET', () => {
    const decision = evaluateIdlePolicy({
      trackingFlowEnabled: true,
      sessionState: 'RUNNING',
      signal: { kind: 'user_idle', idleMinutes: 10 },
      config: {
        autoPauseAfterIdleMinutes: 10,
        autoPauseAfterHostSuspendMinutes: null,
        stopOnUnexpectedTermination: null,
      },
    });
    expect(decision.action).toBe('pause');
    expect(decision.reason).toBe('IDLE_THRESHOLD_MET');
  });

  it('host_suspend no limiar produto → pause HOST_SUSPEND_THRESHOLD_MET', () => {
    const decision = evaluateIdlePolicy({
      trackingFlowEnabled: true,
      sessionState: 'RUNNING',
      signal: { kind: 'host_suspend', suspendedMinutes: 3 },
      config: {
        autoPauseAfterIdleMinutes: null,
        autoPauseAfterHostSuspendMinutes: 2,
        stopOnUnexpectedTermination: null,
      },
    });
    expect(decision.configuredGateCount).toBe(1);
    expect(decision.action).toBe('pause');
    expect(decision.reason).toBe('HOST_SUSPEND_THRESHOLD_MET');
  });

  it('unexpected_termination so age quando produto configura stop=true', () => {
    const off = evaluateIdlePolicy({
      trackingFlowEnabled: true,
      sessionState: 'RUNNING',
      signal: { kind: 'unexpected_termination' },
      config: DEFAULT_IDLE_POLICY,
    });
    expect(off.action).toBe('none');
    expect(off.reason).toBe('POLICY_NOT_CONFIGURED');

    const disabled = evaluateIdlePolicy({
      trackingFlowEnabled: true,
      sessionState: 'RUNNING',
      signal: { kind: 'unexpected_termination' },
      config: {
        autoPauseAfterIdleMinutes: null,
        autoPauseAfterHostSuspendMinutes: null,
        stopOnUnexpectedTermination: false,
      },
    });
    expect(disabled.action).toBe('none');
    expect(disabled.reason).toBe('POLICY_NOT_CONFIGURED');

    const on = evaluateIdlePolicy({
      trackingFlowEnabled: true,
      sessionState: 'RUNNING',
      signal: { kind: 'unexpected_termination' },
      config: {
        autoPauseAfterIdleMinutes: null,
        autoPauseAfterHostSuspendMinutes: null,
        stopOnUnexpectedTermination: true,
      },
    });
    expect(on.configuredGateCount).toBe(1);
    expect(on.action).toBe('stop');
    expect(on.reason).toBe('UNEXPECTED_TERMINATION');
  });
});
