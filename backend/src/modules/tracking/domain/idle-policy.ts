/**
 * TRK-01 — politica de ociosidade / suspensao / encerramento inesperado (plano §4.4).
 * Defaults sao null (sem gate): produto define minutos antes do piloto.
 * Nao inventar limiares; nao habilitar o flow `tracking`.
 */

import type { TrackingSessionState } from './tracking-session.js';

export type IdlePolicyConfig = {
  /** Minutos de ociosidade do usuario antes de auto-pause. null = gate off. */
  autoPauseAfterIdleMinutes: number | null;
  /** Minutos de suspensao do host antes de auto-pause. null = gate off. */
  autoPauseAfterHostSuspendMinutes: number | null;
  /**
   * true = ao encerrar processo com sessao RUNNING, recomendar stop (preserva observado).
   * false/null = sem acao automatica.
   */
  stopOnUnexpectedTermination: boolean | null;
};

export const DEFAULT_IDLE_POLICY: IdlePolicyConfig = {
  autoPauseAfterIdleMinutes: null,
  autoPauseAfterHostSuspendMinutes: null,
  stopOnUnexpectedTermination: null,
};

export type IdleSignal =
  | { kind: 'user_idle'; idleMinutes: number }
  | { kind: 'host_suspend'; suspendedMinutes: number }
  | { kind: 'unexpected_termination' };

export type IdlePolicyAction = 'none' | 'pause' | 'stop';

export type IdlePolicyReason =
  | 'TRACKING_FLOW_OFF'
  | 'SESSION_NOT_RUNNING'
  | 'POLICY_NOT_CONFIGURED'
  | 'BELOW_THRESHOLD'
  | 'IDLE_THRESHOLD_MET'
  | 'HOST_SUSPEND_THRESHOLD_MET'
  | 'UNEXPECTED_TERMINATION';

export type IdlePolicyDecision = {
  action: IdlePolicyAction;
  reason: IdlePolicyReason;
  configuredGateCount: number;
};

export type EvaluateIdlePolicyInput = {
  trackingFlowEnabled: boolean;
  sessionState: TrackingSessionState;
  signal: IdleSignal;
  config: IdlePolicyConfig;
};

const isPositiveIntOrNull = (value: unknown): value is number | null =>
  value === null ||
  (typeof value === 'number' && Number.isInteger(value) && value > 0);

const isBooleanOrNull = (value: unknown): value is boolean | null =>
  value === null || typeof value === 'boolean';

const countConfiguredGates = (config: IdlePolicyConfig): number => {
  let count = 0;
  if (config.autoPauseAfterIdleMinutes != null) count += 1;
  if (config.autoPauseAfterHostSuspendMinutes != null) count += 1;
  if (config.stopOnUnexpectedTermination === true) count += 1;
  return count;
};

/** Normaliza payload admin/env futuro; rejeita minutos inventados invalidos. */
export const parseIdlePolicyConfig = (raw: unknown): IdlePolicyConfig => {
  if (raw == null || typeof raw !== 'object') {
    return { ...DEFAULT_IDLE_POLICY };
  }
  const row = raw as Record<string, unknown>;
  const autoPauseAfterIdleMinutes =
    row.autoPauseAfterIdleMinutes === undefined ? null : row.autoPauseAfterIdleMinutes;
  const autoPauseAfterHostSuspendMinutes =
    row.autoPauseAfterHostSuspendMinutes === undefined
      ? null
      : row.autoPauseAfterHostSuspendMinutes;
  const stopOnUnexpectedTermination =
    row.stopOnUnexpectedTermination === undefined
      ? null
      : row.stopOnUnexpectedTermination;

  if (!isPositiveIntOrNull(autoPauseAfterIdleMinutes)) {
    throw new Error('IDLE_POLICY_THRESHOLD_INVALID');
  }
  if (!isPositiveIntOrNull(autoPauseAfterHostSuspendMinutes)) {
    throw new Error('IDLE_POLICY_THRESHOLD_INVALID');
  }
  if (!isBooleanOrNull(stopOnUnexpectedTermination)) {
    throw new Error('IDLE_POLICY_THRESHOLD_INVALID');
  }

  return {
    autoPauseAfterIdleMinutes,
    autoPauseAfterHostSuspendMinutes,
    stopOnUnexpectedTermination,
  };
};

/**
 * Decisao pura: so recomenda pause/stop quando produto configurou limiar
 * e a sessao esta RUNNING com flow tracking habilitado.
 */
export const evaluateIdlePolicy = (
  input: EvaluateIdlePolicyInput
): IdlePolicyDecision => {
  const configuredGateCount = countConfiguredGates(input.config);

  if (!input.trackingFlowEnabled) {
    return { action: 'none', reason: 'TRACKING_FLOW_OFF', configuredGateCount };
  }

  if (input.sessionState !== 'RUNNING') {
    return { action: 'none', reason: 'SESSION_NOT_RUNNING', configuredGateCount };
  }

  const { signal, config } = input;

  if (signal.kind === 'user_idle') {
    if (config.autoPauseAfterIdleMinutes == null) {
      return { action: 'none', reason: 'POLICY_NOT_CONFIGURED', configuredGateCount };
    }
    if (signal.idleMinutes < config.autoPauseAfterIdleMinutes) {
      return { action: 'none', reason: 'BELOW_THRESHOLD', configuredGateCount };
    }
    return { action: 'pause', reason: 'IDLE_THRESHOLD_MET', configuredGateCount };
  }

  if (signal.kind === 'host_suspend') {
    if (config.autoPauseAfterHostSuspendMinutes == null) {
      return { action: 'none', reason: 'POLICY_NOT_CONFIGURED', configuredGateCount };
    }
    if (signal.suspendedMinutes < config.autoPauseAfterHostSuspendMinutes) {
      return { action: 'none', reason: 'BELOW_THRESHOLD', configuredGateCount };
    }
    return {
      action: 'pause',
      reason: 'HOST_SUSPEND_THRESHOLD_MET',
      configuredGateCount,
    };
  }

  // unexpected_termination
  if (config.stopOnUnexpectedTermination !== true) {
    return { action: 'none', reason: 'POLICY_NOT_CONFIGURED', configuredGateCount };
  }
  return { action: 'stop', reason: 'UNEXPECTED_TERMINATION', configuredGateCount };
};
