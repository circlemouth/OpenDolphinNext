import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import * as auditLogger from '../../../libs/audit/auditLogger';
import { OrderBundleEditPanel } from '../OrderBundleEditPanel';

vi.mock('../orderBundleApi', async () => {
  const actual = await vi.importActual<typeof import('../orderBundleApi')>('../orderBundleApi');
  return {
    ...actual,
    fetchOrderBundles: vi.fn().mockResolvedValue({ ok: true, bundles: [] }),
    mutateOrderBundles: vi.fn(),
  };
});

const buildQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

describe('OrderBundleEditPanel audit', () => {
  beforeEach(() => {
    auditLogger.clearAuditEventLog();
  });

  afterEach(() => {
    auditLogger.clearAuditEventLog();
  });

  it('必須違反時に blockedReasons と validationMessages を記録する', async () => {
    const user = userEvent.setup();
    const queryClient = buildQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <OrderBundleEditPanel
          patientId="P-001"
          entity="medOrder"
          title="処方"
          bundleLabel="RP名"
          itemQuantityLabel="数量"
          meta={{
            runId: 'RUN-ORDER',
            cacheHit: false,
            missingMaster: false,
            fallbackUsed: false,
            dataSourceTransition: 'server',
            patientId: 'P-001',
          }}
          request={{
            requestId: 'REQ-ORDER-AUDIT',
            kind: 'edit',
            bundle: {
              entity: 'medOrder',
              bundleName: '監査テストRP',
              bundleNumber: '1',
              admin: '',
              items: [
                {
                  code: '620001402',
                  name: 'アムロジピン',
                  quantity: '1',
                  unit: '錠',
                },
              ],
            },
          }}
        />
      </QueryClientProvider>,
    );

    await screen.findByDisplayValue('アムロジピン');
    expect(screen.queryByLabelText('RP名')).not.toBeInTheDocument();
    const auditSpy = vi.spyOn(auditLogger, 'logAuditEvent');
    await user.click(screen.getByRole('button', { name: /保存して追加/ }));

    await waitFor(() => {
      const blocked = auditSpy.mock.calls.find((call) => {
        const blockedReasons = (call[0].payload as any)?.details?.blockedReasons;
        return Array.isArray(blockedReasons) && blockedReasons.includes('missing_usage');
      });
      expect(blocked).toBeTruthy();
    });

    const blocked = auditSpy.mock.calls.find((call) => {
      const blockedReasons = (call[0].payload as any)?.details?.blockedReasons;
      return Array.isArray(blockedReasons) && blockedReasons.includes('missing_usage');
    });
    const details = (blocked?.[0].payload as any)?.details ?? {};

    expect(blocked).toBeTruthy();
    expect(details.blockedReasons).toEqual(['missing_usage']);
    expect(details.validationMessages).toEqual(['用法を入力してください。']);
    expect(details.operationPhase).toBe('lock');
  });
});
