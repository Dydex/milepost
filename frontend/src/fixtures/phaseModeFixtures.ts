/**
 * Every phase and every mode a `PhaseBadge` or `ModePill` can render.
 * `'Open'` appears in both — a phase a programme is in, and a mode with no
 * escrow or payee restriction — so the two lists stay separate on purpose.
 */

export const FIXTURE_PHASES = ['Open', 'Review', 'Settled', 'Cancelled'] as const;

export const FIXTURE_MODES = ['Direct', 'Allocated', 'Restricted', 'Open'] as const;
