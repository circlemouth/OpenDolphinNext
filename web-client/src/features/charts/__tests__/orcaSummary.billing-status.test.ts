import { describe, expect, it } from 'vitest';

import {
  buildBillingStatusUpdateAudit,
  buildQueueEntryFromSendCache,
  buildSendClaimBundle,
  resolveBillingInvoiceNumber,
  resolveBillingStatusDecision,
  resolveBillingStatusFromInvoice,
  resolveBillingStatusUpdateDurationMs,
} from '../orcaBillingStatus';
import type { OrcaClaimSendCacheEntry } from '../orcaClaimSendCache';

const buildSendCache = (overrides: Partial<OrcaClaimSendCacheEntry> = {}): OrcaClaimSendCacheEntry => ({
  patientId: 'P-1',
  appointmentId: 'A-1',
  invoiceNumber: 'INV-1',
  dataId: 'DATA-1',
  runId: 'RUN-1',
  traceId: 'TRACE-1',
  sendStatus: 'success',
  errorMessage: undefined,
  savedAt: '2026-01-22T09:00:00Z',
  ...overrides,
});

describe('resolveBillingStatusFromInvoice', () => {
  it('伝票番号が一致すれば会計済みを返す', () => {
    const decision = resolveBillingStatusFromInvoice('INV-1', new Set(['INV-1']));
    expect(decision.status).toBe('会計済み');
    expect(decision.paid).toBe(true);
  });

  it('伝票番号が不一致なら会計待ちを返す', () => {
    const decision = resolveBillingStatusFromInvoice('INV-1', new Set(['INV-2']));
    expect(decision.status).toBe('会計待ち');
    expect(decision.paid).toBe(false);
  });

  it('伝票番号が無ければ未決定', () => {
    const decision = resolveBillingStatusFromInvoice(undefined, new Set(['INV-1']));
    expect(decision.status).toBeUndefined();
    expect(decision.paid).toBe(false);
  });
});

describe('resolveBillingInvoiceNumber', () => {
  it('claim invoice を優先する', () => {
    expect(
      resolveBillingInvoiceNumber({
        claimInvoiceNumber: 'INV-CLAIM',
        sendInvoiceNumber: 'INV-SEND',
        sendStatus: 'success',
        paidInvoiceNumbers: new Set(['INV-PAID']),
      }),
    ).toBe('INV-CLAIM');
  });

  it('send invoice があればそれを使う', () => {
    expect(
      resolveBillingInvoiceNumber({
        sendInvoiceNumber: 'INV-SEND',
        sendStatus: 'success',
        paidInvoiceNumbers: new Set(['INV-PAID']),
      }),
    ).toBe('INV-SEND');
  });

  it('送信成功かつ paid invoice が 1 件なら fail-close で推論する', () => {
    expect(
      resolveBillingInvoiceNumber({
        sendStatus: 'success',
        paidInvoiceNumbers: new Set(['INV-ONLY']),
      }),
    ).toBe('INV-ONLY');
  });

  it('paid invoice が複数件なら推論しない', () => {
    expect(
      resolveBillingInvoiceNumber({
        sendStatus: 'success',
        paidInvoiceNumbers: new Set(['INV-1', 'INV-2']),
      }),
    ).toBeUndefined();
  });
});

describe('buildSendClaimBundle', () => {
  it('収納確認済みなら会計済みとして請求バンドルを組み立てる', () => {
    const bundle = buildSendClaimBundle(buildSendCache(), new Set(['INV-1']));
    expect(bundle.invoiceNumber).toBe('INV-1');
    expect(bundle.claimStatus).toBe('会計済み');
  });

  it('送信成功だけでは会計済みにしない', () => {
    const bundle = buildSendClaimBundle(buildSendCache());
    expect(bundle.claimStatus).toBe('会計待ち');
    expect(bundle.claimStatusText).toBe('会計待ち+送信済');
  });
});

describe('buildQueueEntryFromSendCache', () => {
  it('会計済みなら ack にする', () => {
    const queue = buildQueueEntryFromSendCache(buildSendCache(), new Set(['INV-1']));
    expect(queue.phase).toBe('ack');
  });

  it('送信失敗は failed にする', () => {
    const queue = buildQueueEntryFromSendCache(buildSendCache({ sendStatus: 'error', invoiceNumber: 'INV-2' }), new Set());
    expect(queue.phase).toBe('failed');
  });

  it('paid source 未確定なら sent を維持する', () => {
    const queue = buildQueueEntryFromSendCache(buildSendCache());
    expect(queue.phase).toBe('sent');
  });
});

describe('resolveBillingStatusDecision', () => {
  it('UG-01: paid source 未確定なら会計待ち+送信済にする', () => {
    const decision = resolveBillingStatusDecision({
      invoiceNumber: 'INV-1',
      sendStatus: 'success',
      paidInvoiceNumbers: undefined,
    });
    expect(decision.status).toBe('会計待ち');
    expect(decision.statusText).toBe('会計待ち+送信済');
    expect(decision.confirmationSource).toBe('unresolved');
    expect(decision.settingNote).toContain('収納情報の確認前');
  });

  it('送信成功で伝票番号がなくても setting note を fail-close で出す', () => {
    const decision = resolveBillingStatusDecision({
      sendStatus: 'success',
      paidInvoiceNumbers: undefined,
    });
    expect(decision.status).toBe('会計待ち');
    expect(decision.statusText).toBe('会計待ち+送信済');
    expect(decision.confirmationSource).toBe('unresolved');
    expect(decision.settingNote).toContain('収納情報の確認前');
  });

  it('UG-12: correction required は note のみで workflow state に昇格しない', () => {
    const decision = resolveBillingStatusDecision({
      invoiceNumber: 'INV-1',
      sendStatus: 'success',
      paidInvoiceNumbers: new Set(),
      correctionRequired: true,
    });
    expect(decision.status).toBe('会計待ち');
    expect(decision.statusText).toBe('会計待ち+送信済');
    expect(decision.correctionState).toBe('required');
    expect(decision.correctionNote).toContain('補正が必要');
  });
});

describe('resolveBillingStatusUpdateDurationMs', () => {
  it('計測時間を返す', () => {
    const duration = resolveBillingStatusUpdateDurationMs(10, 210);
    expect(duration).toBe(200);
  });

  it('監査ペイロードに durationMs が記録される', () => {
    const duration = resolveBillingStatusUpdateDurationMs(100, 250);
    const payload = buildBillingStatusUpdateAudit({
      status: '会計済み',
      statusText: '会計済み',
      invoiceNumber: 'INV-1',
      durationMs: duration,
      transmissionSource: 'medical-mod-v2',
      confirmationSource: 'income-info',
      correctionState: 'none',
    });
    expect(payload.durationMs).toBe(duration);
    expect(payload.confirmationSource).toBe('income-info');
  });
});
