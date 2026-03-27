import { http, HttpResponse } from 'msw';

import { applyFaultDelay, parseFaultSpec } from '../utils/faultInjection';

const buildResponse = (body: Record<string, unknown>, status = 200, runId?: string, traceId?: string) =>
  HttpResponse.json(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(runId ? { 'x-run-id': runId } : {}),
      ...(traceId ? { 'x-trace-id': traceId } : {}),
    },
  });

const buildPayload = async (request: Request) => {
  const fault = parseFaultSpec(request);
  await applyFaultDelay(fault);
  const headers = request.headers;
  const url = new URL(request.url);
  const now = new Date();
  const toDate = (d: Date) => d.toISOString().slice(0, 10);
  const toTime = (d: Date) => d.toISOString().slice(11, 19);
  const body = (await request.json().catch(() => ({}))) as Record<string, any>;
  const patientId = (body.patientId as string | undefined) ?? '000001';
  const requestNumber = (body.requestNumber as string | undefined) ?? '01';
  const runId = headers.get('x-run-id') ?? 'MSW-ACCEPT-RUN';
  const traceId = headers.get('x-trace-id') ?? `trace-${now.getTime()}`;
  const scenario = headers.get('x-msw-scenario') ?? url.searchParams.get('scenario') ?? undefined;

  const shouldWarn = fault.tokens.has('api-21') || patientId === '00021';
  const shouldError = fault.tokens.has('api-error');
  const http500 = fault.tokens.has('http-500') || fault.tokens.has('500');
  const realNoEcho = fault.tokens.has('real-no-echo') || scenario === 'real-no-echo';

  const apiOverrides: Array<{ token: string; apiResult: string; apiResultMessage: string }> = [
    { token: 'api-02', apiResult: '02', apiResultMessage: '診療科が未設定です' },
    { token: 'api-03', apiResult: '03', apiResultMessage: 'ドクターが未設定です' },
    { token: 'api-13', apiResult: '13', apiResultMessage: '対象がありません' },
    { token: 'api-14', apiResult: '14', apiResultMessage: 'ドクターが存在しません' },
    { token: 'api-52', apiResult: '52', apiResultMessage: '受付登録エラー' },
    { token: 'api-91', apiResult: '91', apiResultMessage: '処理区分未設定' },
  ];
  const override = apiOverrides.find((entry) => fault.tokens.has(entry.token) || scenario === entry.token);

  const apiResult = override?.apiResult ?? (shouldError ? 'E99' : shouldWarn ? '21' : '00');
  const apiResultMessage =
    override?.apiResultMessage ??
    (shouldError ? 'mocked error' : shouldWarn ? '受付が存在しません (Api_Result=21)' : '正常終了');

  const shouldEchoEmpty = realNoEcho || Boolean(override && override.apiResult !== '00');
  const acceptanceId =
    apiResult === '21'
      ? undefined
      : shouldEchoEmpty
        ? ''
        : (body.acceptanceId as string | undefined) ?? `A-${patientId}-MSW`;

  const acceptanceDate = apiResult === '21' ? undefined : shouldEchoEmpty ? '' : body.acceptanceDate ?? toDate(now);
  const acceptanceTime = apiResult === '21' ? undefined : shouldEchoEmpty ? '' : body.acceptanceTime ?? toTime(now);
  const departmentCode = apiResult === '21' ? undefined : shouldEchoEmpty ? '' : body.departmentCode ?? '01';
  const physicianCode = apiResult === '21' ? undefined : shouldEchoEmpty ? '' : body.physicianCode ?? '1001';

  const patientPayload = shouldEchoEmpty
    ? {
        patientId: '',
        wholeName: '',
        wholeNameKana: '',
        birthDate: '',
        sex: '',
      }
    : {
        patientId,
        name: (body.patientName as string | undefined) ?? 'MSW 患者',
        kana: (body.patientKana as string | undefined) ?? 'エムエスダブリュ',
        birthDate: '1990-01-01',
        sex: 'F',
      };

  const payload: Record<string, unknown> = {
    apiResult,
    apiResultMessage,
    runId,
    traceId,
    requestId: `msw-${now.getTime()}`,
    dataSourceTransition: shouldEchoEmpty ? 'server' : 'mock',
    cacheHit: false,
    missingMaster: false,
    fetchedAt: now.toISOString(),
    acceptanceId,
    acceptanceDate,
    acceptanceTime,
    departmentCode,
    physicianCode,
    medicalInformation: body.medicalInformation ?? '外来受付',
    requestNumber,
    patient: patientPayload,
    warnings: shouldWarn ? ['受付が見つかりません'] : [],
  };

  if (http500) {
    return buildResponse(payload, 500, runId, traceId);
  }
  return buildResponse(payload, 200, runId, traceId);
};

export const orcaReceptionHandlers = [
  http.post('/api/orca/visits/mutation', async ({ request }) => buildPayload(request)),
];
