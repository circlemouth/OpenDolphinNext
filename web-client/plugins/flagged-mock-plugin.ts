import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PluginOption } from 'vite';

type NextHandleFunction = (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void;

const runId = process.env.RUN_ID ?? process.env.VITE_RUM_RUN_ID ?? '20251202T090000Z';
const mswQueryParam = 'msw';

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
};

const isGateEnabled = () => process.env.VITE_ENABLE_MSW === '1' && process.env.VITE_DISABLE_MSW !== '1';

const hasMswQueryParam = (url: URL) => url.searchParams.get(mswQueryParam) === '1';

const shouldUseMockOrcaQueue = (req: IncomingMessage) => {
  const header = req.headers['x-use-mock-orca-queue'];
  if (header === '1' || header === '0') {
    return header === '1';
  }
  return process.env.VITE_USE_MOCK_ORCA_QUEUE === '1';
};

const shouldVerifyAdminDelivery = (req: IncomingMessage) => {
  const header = req.headers['x-verify-admin-delivery'];
  if (header === '1' || header === '0') {
    return header === '1';
  }
  return process.env.VITE_VERIFY_ADMIN_DELIVERY === '1';
};

const readBooleanFromHeaderOrEnv = (
  req: IncomingMessage,
  headerName: string,
  envName: string,
  fallback: boolean,
) => {
  const header = req.headers[headerName] as string | undefined;
  if (header === '1' || header === '0') {
    return header === '1';
  }
  const env = process.env[envName];
  if (env === '1' || env === '0') {
    return env === '1';
  }
  return fallback;
};

const readChartsMasterSource = (req: IncomingMessage) => {
  const header = (req.headers['x-charts-master-source'] as string | undefined) ?? undefined;
  const env = process.env.VITE_CHARTS_MASTER_SOURCE ?? undefined;
  const raw = (header ?? env ?? 'auto').trim();
  if (raw === 'auto' || raw === 'server' || raw === 'mock' || raw === 'snapshot' || raw === 'fallback') {
    return raw;
  }
  return 'auto';
};

const readOutpatientFlag = (req: IncomingMessage, headerName: string, envName: string, fallback: boolean) => {
  const header = req.headers[headerName] as string | undefined;
  if (header === '1' || header === '0') {
    return header === '1';
  }
  const env = process.env[envName];
  if (env === '1' || env === '0') {
    return env === '1';
  }
  return fallback;
};

const OUTPATIENT_MOCK_PATIENT_ID = '01415';
const OUTPATIENT_MOCK_NAME = '通し検証 太郎';
const OUTPATIENT_MOCK_KANA = 'トオシケンショウ タロウ';
const OUTPATIENT_MOCK_BIRTH = '1980-01-15';
const OUTPATIENT_MOCK_SEX = 'M';
const OUTPATIENT_MOCK_DEPT = '01 内科';
const OUTPATIENT_MOCK_PHYSICIAN = '0001';
const OUTPATIENT_MOCK_INSURANCE = '社保 12';

const shouldUseFlaggedOutpatientMock = (req: IncomingMessage, url: URL) => {
  // Hard gate: explicit env + explicit URL param.
  if (!isGateEnabled()) return false;
  if (!hasMswQueryParam(url)) return false;

  const header = req.headers['x-flagged-mock-outpatient'] as string | undefined;
  if (header === '1' || header === '0') {
    return header === '1';
  }
  const env = process.env.VITE_FLAGGED_MOCK_OUTPATIENT ?? process.env.VITE_ENABLE_FLAGGED_MOCK_OUTPATIENT;
  if (env === '1') return true;
  if (env === '0') return false;
  // Default OFF: never mock without explicit opt-in.
  return false;
};

export const buildPatientSearchMock = (req: IncomingMessage) => {
  const cacheHit = readOutpatientFlag(req, 'x-cache-hit', 'VITE_OUTPATIENT_CACHE_HIT', false);
  const missingMaster = readOutpatientFlag(req, 'x-missing-master', 'VITE_OUTPATIENT_MISSING_MASTER', false);
  const fallbackUsed = readOutpatientFlag(req, 'x-fallback-used', 'VITE_OUTPATIENT_FALLBACK_USED', false);
  const dataSourceTransition =
    (req.headers['x-data-source-transition'] as string | undefined) ??
    process.env.VITE_OUTPATIENT_DATA_SOURCE_TRANSITION ??
    'server';
  return {
    runId,
    traceId: `trace-${runId}`,
    cacheHit,
    missingMaster,
    fallbackUsed,
    dataSourceTransition,
    fetchedAt: new Date().toISOString(),
    recordsReturned: 2,
    patients: [
      {
        patientId: OUTPATIENT_MOCK_PATIENT_ID,
        name: OUTPATIENT_MOCK_NAME,
        kana: OUTPATIENT_MOCK_KANA,
        birthDate: OUTPATIENT_MOCK_BIRTH,
        sex: OUTPATIENT_MOCK_SEX,
      },
      { patientId: '000001', name: '山田 花子', kana: 'ヤマダ ハナコ', birthDate: '1985-04-12', sex: 'F' },
    ],
    apiResult: '00',
    apiResultMessage: 'mock patient search',
  };
};

export const buildAppointmentListMock = (req: IncomingMessage) => {
  const cacheHit = readOutpatientFlag(req, 'x-cache-hit', 'VITE_OUTPATIENT_CACHE_HIT', false);
  const missingMaster = readOutpatientFlag(req, 'x-missing-master', 'VITE_OUTPATIENT_MISSING_MASTER', false);
  const fallbackUsed = readOutpatientFlag(req, 'x-fallback-used', 'VITE_OUTPATIENT_FALLBACK_USED', false);
  const dataSourceTransition =
    (req.headers['x-data-source-transition'] as string | undefined) ??
    process.env.VITE_OUTPATIENT_DATA_SOURCE_TRANSITION ??
    'server';
  return {
    runId,
    traceId: `trace-${runId}`,
    cacheHit,
    missingMaster,
    fallbackUsed,
    dataSourceTransition,
    fetchedAt: new Date().toISOString(),
    recordsReturned: 2,
    appointmentDate: new Date().toISOString().slice(0, 10),
    slots: [
      {
        appointmentId: 'APT-1415',
        appointmentTime: '1030',
        departmentName: OUTPATIENT_MOCK_DEPT,
        physicianName: OUTPATIENT_MOCK_PHYSICIAN,
        patient: {
          patientId: OUTPATIENT_MOCK_PATIENT_ID,
          wholeName: OUTPATIENT_MOCK_NAME,
          wholeNameKana: OUTPATIENT_MOCK_KANA,
          birthDate: OUTPATIENT_MOCK_BIRTH,
          sex: OUTPATIENT_MOCK_SEX,
        },
        visitInformation: 'MSW ダミー予約',
        medicalInformation: 'MSW ダミー予約',
      },
    ],
    reservations: [
      {
        appointmentId: 'APT-1415-R',
        appointmentDate: new Date().toISOString().slice(0, 10),
        appointmentTime: '1045',
        visitInformation: 'MSW ダミー予約',
        departmentName: OUTPATIENT_MOCK_DEPT,
        physicianName: OUTPATIENT_MOCK_PHYSICIAN,
        patient: {
          patientId: OUTPATIENT_MOCK_PATIENT_ID,
          wholeName: OUTPATIENT_MOCK_NAME,
          wholeNameKana: OUTPATIENT_MOCK_KANA,
          birthDate: OUTPATIENT_MOCK_BIRTH,
          sex: OUTPATIENT_MOCK_SEX,
        },
      },
    ],
    apiResult: '00',
    apiResultMessage: 'mock appointments',
  };
};

export const buildVisitListMock = (req: IncomingMessage) => {
  const cacheHit = readOutpatientFlag(req, 'x-cache-hit', 'VITE_OUTPATIENT_CACHE_HIT', false);
  const missingMaster = readOutpatientFlag(req, 'x-missing-master', 'VITE_OUTPATIENT_MISSING_MASTER', false);
  const fallbackUsed = readOutpatientFlag(req, 'x-fallback-used', 'VITE_OUTPATIENT_FALLBACK_USED', false);
  const dataSourceTransition =
    (req.headers['x-data-source-transition'] as string | undefined) ??
    process.env.VITE_OUTPATIENT_DATA_SOURCE_TRANSITION ??
    'server';
  const visitDate = new Date().toISOString().slice(0, 10);
  return {
    runId,
    traceId: `trace-${runId}`,
    cacheHit,
    missingMaster,
    fallbackUsed,
    dataSourceTransition,
    fetchedAt: new Date().toISOString(),
    recordsReturned: 1,
    visitDate,
    visits: [
      {
        voucherNumber: 'RCPT-1415',
        sequentialNumber: 'APT-1415-V',
        updateTime: '1045',
        visitDate,
        departmentName: OUTPATIENT_MOCK_DEPT,
        physicianName: OUTPATIENT_MOCK_PHYSICIAN,
        patient: {
          patientId: OUTPATIENT_MOCK_PATIENT_ID,
          wholeName: OUTPATIENT_MOCK_NAME,
          wholeNameKana: OUTPATIENT_MOCK_KANA,
          birthDate: OUTPATIENT_MOCK_BIRTH,
          sex: OUTPATIENT_MOCK_SEX,
        },
        insuranceCombinationNumber: OUTPATIENT_MOCK_INSURANCE,
        visitInformation: 'MSW ダミー受付',
      },
    ],
    apiResult: '00',
    apiResultMessage: 'mock visits',
  };
};

const buildOutpatientSummaryMock = (req: IncomingMessage) => {
  const cacheHit = readOutpatientFlag(req, 'x-cache-hit', 'VITE_OUTPATIENT_CACHE_HIT', false);
  const missingMaster = readOutpatientFlag(req, 'x-missing-master', 'VITE_OUTPATIENT_MISSING_MASTER', false);
  const fallbackUsed = readOutpatientFlag(req, 'x-fallback-used', 'VITE_OUTPATIENT_FALLBACK_USED', false);
  const dataSourceTransition =
    (req.headers['x-data-source-transition'] as string | undefined) ??
    process.env.VITE_OUTPATIENT_DATA_SOURCE_TRANSITION ??
    'server';
  const fetchedAt = new Date().toISOString();
  return {
    runId,
    traceId: `trace-${runId}`,
    requestId: `req-${runId}`,
    cacheHit,
    missingMaster,
    fallbackUsed,
    dataSourceTransition,
    fetchedAt,
    recordsReturned: 1,
    outcome: missingMaster || fallbackUsed ? 'PARTIAL' : 'SUCCESS',
    outpatientList: [
      {
        voucherNumber: 'RCPT-1415',
        patient: {
          patientId: OUTPATIENT_MOCK_PATIENT_ID,
          wholeName: OUTPATIENT_MOCK_NAME,
          wholeNameKana: OUTPATIENT_MOCK_KANA,
          birthDate: OUTPATIENT_MOCK_BIRTH,
          sex: OUTPATIENT_MOCK_SEX,
        },
        department: OUTPATIENT_MOCK_DEPT,
        physician: OUTPATIENT_MOCK_PHYSICIAN,
        appointmentId: 'APT-1415',
        source: 'visits',
        outcome: missingMaster || fallbackUsed ? 'PARTIAL' : 'SUCCESS',
        sections: {
          diagnosis: {
            outcome: 'SUCCESS',
            recordsReturned: 1,
            items: [{ name: '高血圧症', code: 'I10', date: fetchedAt.slice(0, 10), status: '確定' }],
          },
          prescription: missingMaster
            ? { outcome: 'MISSING', recordsReturned: 0, message: 'マスタ未取得のため未展開' }
            : {
                outcome: 'SUCCESS',
                recordsReturned: 1,
                items: [{ name: 'アムロジピン錠 5mg', dose: '1錠', frequency: '1日1回 朝', days: 28 }],
              },
          lab: { outcome: 'SUCCESS', recordsReturned: 1, items: [{ name: 'HbA1c', value: '5.8', unit: '%', date: fetchedAt.slice(0, 10) }] },
          procedure: { outcome: 'SUCCESS', recordsReturned: 1, items: [{ name: '血圧測定', result: '132/78', date: fetchedAt.slice(0, 10) }] },
          memo: { outcome: 'SUCCESS', recordsReturned: 1, items: [{ text: 'フォロー継続', date: fetchedAt.slice(0, 10) }] },
        },
      },
    ],
  };
};

const buildMedicalModXml = (apiResult: string, message: string) => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toISOString().slice(11, 19).replace(/:/g, '');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<xml>',
    `  <Api_Result>${apiResult}</Api_Result>`,
    `  <Api_Result_Message>${message}</Api_Result_Message>`,
    `  <Information_Date>${date}</Information_Date>`,
    `  <Information_Time>${time}</Information_Time>`,
    '</xml>',
  ].join('\n');
};

const createFlagAwareMiddleware = (): NextHandleFunction => (req, res, next) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const useMock = shouldUseMockOrcaQueue(req);
  const verifyAdmin = shouldVerifyAdminDelivery(req);
  const isAdminConfig = url.pathname.startsWith('/api/admin/config');
  const chartsDisplayEnabled = readBooleanFromHeaderOrEnv(req, 'x-charts-display-enabled', 'VITE_CHARTS_DISPLAY_ENABLED', true);
  const chartsSendEnabled = readBooleanFromHeaderOrEnv(req, 'x-charts-send-enabled', 'VITE_CHARTS_SEND_ENABLED', true);
  const chartsMasterSource = readChartsMasterSource(req);
  const environment =
    (process.env.VITE_ENVIRONMENT ??
      process.env.VITE_DEPLOY_ENV ??
      process.env.VITE_STAGE ??
      (process.env.NODE_ENV === 'production' ? 'prod' : 'dev')) || 'dev';

  if (url.pathname.startsWith('/api/orca/queue')) {
    res.setHeader('x-orca-queue-mode', useMock ? 'mock' : 'live');
    res.setHeader('x-admin-delivery-verification', verifyAdmin ? 'enabled' : 'disabled');

    if (useMock) {
      json(res, 200, {
        runId,
        source: 'mock',
        verifyAdminDelivery: verifyAdmin,
        queue: [
          {
            patientId: 'MOCK-001',
            status: 'pending',
            retryable: true,
            lastDispatchAt: new Date().toISOString(),
          },
          {
            patientId: 'MOCK-002',
            status: 'delivered',
            retryable: false,
            lastDispatchAt: new Date(Date.now() - 90_000).toISOString(),
          },
        ],
      });
      return;
    }
  }

  if (isAdminConfig) {
    res.setHeader('x-admin-delivery-verification', verifyAdmin ? 'enabled' : 'disabled');
    res.setHeader('x-orca-queue-mode', useMock ? 'mock' : 'live');
    res.setHeader('x-environment', environment);
    // モック/検証ヘッダーが有効な場合は、実 API へ到達させずにここで応答を返す。
    if (verifyAdmin || useMock) {
      json(res, 200, {
        runId,
        verified: true,
        source: useMock ? 'mock' : 'live',
        environment,
        deliveredAt: new Date().toISOString(),
        chartsDisplayEnabled,
        chartsSendEnabled,
        chartsMasterSource,
        note: 'Flagged by x-verify-admin-delivery header for Playwright/preview checks.',
      });
      return;
    }
  }

  if (url.pathname.startsWith('/orca/patients/local-search/mock')) {
    if (shouldUseFlaggedOutpatientMock(req, url)) {
      json(res, 200, buildPatientSearchMock(req));
      return;
    }
  }

  if (url.pathname.startsWith('/orca/appointments/list/mock')) {
    if (shouldUseFlaggedOutpatientMock(req, url)) {
      json(res, 200, buildAppointmentListMock(req));
      return;
    }
  }

  if (url.pathname.startsWith('/orca/visits/list/mock')) {
    if (shouldUseFlaggedOutpatientMock(req, url)) {
      json(res, 200, buildVisitListMock(req));
      return;
    }
  }

  if (url.pathname.startsWith('/orca21/medicalmodv2/outpatient')) {
    if (shouldUseFlaggedOutpatientMock(req, url)) {
      json(res, 200, buildOutpatientSummaryMock(req));
      return;
    }
  }

  if (url.pathname.startsWith('/api21/medicalmodv2')) {
    if (shouldUseFlaggedOutpatientMock(req, url)) {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/xml; charset=UTF-8');
      res.end(buildMedicalModXml('00', '正常終了'));
      return;
    }
  }

  if (url.pathname.startsWith('/api21/medicalmodv23')) {
    if (shouldUseFlaggedOutpatientMock(req, url)) {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/xml; charset=UTF-8');
      res.end(buildMedicalModXml('00', '正常終了'));
      return;
    }
  }

  next();
};

export const flaggedMockPlugin = (): PluginOption => ({
  name: 'flagged-mock-switch',
  configureServer(server) {
    server.middlewares.use(createFlagAwareMiddleware());
  },
  configurePreviewServer(server) {
    server.middlewares.use(createFlagAwareMiddleware());
  },
});
