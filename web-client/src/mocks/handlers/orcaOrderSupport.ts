import { http, HttpResponse, passthrough } from 'msw';

const generateRunId = () => new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';

const generateTraceId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `trace-${Date.now()}`;
};

const resolveAuditHeaders = (request: Request) => {
  const runId = request.headers.get('x-run-id') ?? generateRunId();
  const traceId = request.headers.get('x-trace-id') ?? generateTraceId();
  return { runId, traceId };
};

const shouldBypass = (request: Request): boolean => {
  const transition = request.headers.get('x-datasource-transition');
  return transition != null && transition.trim().toLowerCase() === 'server';
};

type MockInputSetSummary = {
  setCode: string;
  name: string;
  entity: string | null;
  kind: string;
  classCode?: string;
  classCodeSystem?: string;
  itemCount: number;
  validFrom: string;
  validTo: string;
};

type MockInputSetDetail = {
  setCode: string;
  bundle: {
    entity: string | null;
    bundleName: string;
    bundleNumber: string;
    classCode?: string;
    classCodeSystem?: string;
    className?: string;
    admin?: string;
    adminMemo?: string;
    memo?: string;
    started?: string;
    bodyPart?: { code?: string; name?: string; quantity?: string; unit?: string; memo?: string } | null;
    items: Array<{ code?: string; name?: string; quantity?: string; unit?: string; memo?: string }>;
  };
};

const INPUT_SET_SUMMARIES: MockInputSetSummary[] = [
  {
    setCode: 'P01001',
    name: '降圧セット',
    entity: 'medOrder',
    kind: 'P',
    classCode: '212',
    classCodeSystem: 'Claim007',
    itemCount: 2,
    validFrom: '20240401',
    validTo: '99991231',
  },
  {
    setCode: 'G02001',
    name: '胸部X線セット',
    entity: 'radiologyOrder',
    kind: 'G',
    classCode: '700',
    classCodeSystem: 'Claim007',
    itemCount: 2,
    validFrom: '20240401',
    validTo: '99991231',
  },
  {
    setCode: 'N03001',
    name: '汎用処置セット',
    entity: null,
    kind: 'N',
    classCode: '400',
    classCodeSystem: 'Claim007',
    itemCount: 1,
    validFrom: '20240401',
    validTo: '99991231',
  },
];

const INPUT_SET_DETAILS: Record<string, MockInputSetDetail> = {
  P01001: {
    setCode: 'P01001',
    bundle: {
      entity: 'medOrder',
      bundleName: '降圧セット',
      bundleNumber: '14',
      classCode: '212',
      classCodeSystem: 'Claim007',
      className: '内服薬剤（院外処方）',
      admin: '1日1回 朝食後',
      adminMemo: '',
      memo: '',
      started: '2026-03-09',
      bodyPart: null,
      items: [
        { code: '620000001', name: 'アムロジピン錠5mg', quantity: '1', unit: '錠', memo: '' },
        { code: '620000002', name: 'ロサルタン錠50mg', quantity: '1', unit: '錠', memo: '' },
      ],
    },
  },
  G02001: {
    setCode: 'G02001',
    bundle: {
      entity: 'radiologyOrder',
      bundleName: '胸部X線セット',
      bundleNumber: '1',
      classCode: '700',
      classCodeSystem: 'Claim007',
      className: '画像診断',
      admin: '',
      adminMemo: '',
      memo: '撮影条件あり',
      started: '2026-03-09',
      bodyPart: { code: '002001', name: '胸部', quantity: '1', unit: '部位', memo: '' },
      items: [
        { code: '170017510', name: 'ＣＴ撮影', quantity: '1', unit: '回', memo: '' },
        { code: '820181220', name: '撮影部位（単純撮影）：胸部（肩を除く。）', quantity: '1', unit: '部位', memo: '' },
      ],
    },
  },
  N03001: {
    setCode: 'N03001',
    bundle: {
      entity: null,
      bundleName: '汎用処置セット',
      bundleNumber: '1',
      classCode: '400',
      classCodeSystem: 'Claim007',
      className: '処置',
      admin: '',
      adminMemo: '',
      memo: '',
      started: '2026-03-09',
      bodyPart: null,
      items: [{ code: '140000610', name: '創傷処置（１００ｃｍ２未満）', quantity: '1', unit: '回', memo: '' }],
    },
  },
};

const INTERACTION_MAP: Record<string, { interactionCode: string; interactionName: string; message: string }> = {
  '620000001:620000002': {
    interactionCode: 'INT001',
    interactionName: '併用注意',
    message: '相互作用が検出されました',
  },
  '620000001:620000003': {
    interactionCode: 'INT002',
    interactionName: '注意',
    message: '用量・服用タイミングに注意してください',
  },
};

const normalizeYmd = (value: string | null) => {
  const digits = (value ?? '').replace(/[^0-9]/g, '');
  return digits.length === 8 ? digits : null;
};

const matchesEffective = (effective: string | null, validFrom?: string, validTo?: string) => {
  const normalized = normalizeYmd(effective);
  if (!normalized) return true;
  if (validFrom && normalized < validFrom) return false;
  if (validTo && normalized > validTo) return false;
  return true;
};

const sanitizeCodes = (values: unknown) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0),
    ),
  );

export const orcaOrderSupportHandlers = [
  http.get(/\/api\/orca\/master\/order\/inputsets(?:\?.*)?$/, ({ request }) => {
    if (shouldBypass(request)) {
      return passthrough();
    }
    const { runId, traceId } = resolveAuditHeaders(request);
    const url = new URL(request.url);
    const keyword = (url.searchParams.get('keyword') ?? '').trim().toLowerCase();
    const entity = (url.searchParams.get('entity') ?? '').trim();
    const effective = url.searchParams.get('effective');
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
    const size = Math.min(100, Math.max(1, Number(url.searchParams.get('size') ?? '20') || 20));
    const filtered = INPUT_SET_SUMMARIES.filter((item) => {
      const matchesKeyword =
        !keyword ||
        item.setCode.toLowerCase().includes(keyword) ||
        item.name.toLowerCase().includes(keyword);
      const matchesEntity = !entity || item.entity === entity;
      return item.name.trim() && matchesKeyword && matchesEntity && matchesEffective(effective, item.validFrom, item.validTo);
    }).sort((left, right) => left.setCode.localeCompare(right.setCode));
    const offset = (page - 1) * size;
    return HttpResponse.json(
      {
        totalCount: filtered.length,
        items: filtered.slice(offset, offset + size),
        runId,
        traceId,
      },
      { headers: { 'x-run-id': runId, 'x-trace-id': traceId } },
    );
  }),
  http.get(/\/api\/orca\/master\/order\/inputsets\/([^/?#]+)(?:\?.*)?$/, ({ request }) => {
    if (shouldBypass(request)) {
      return passthrough();
    }
    const { runId, traceId } = resolveAuditHeaders(request);
    const url = new URL(request.url);
    const entity = (url.searchParams.get('entity') ?? '').trim();
    const effective = url.searchParams.get('effective');
    const pathname = new URL(request.url).pathname;
    const setCode = pathname.slice(pathname.lastIndexOf('/') + 1);
    const detail = INPUT_SET_DETAILS[setCode];
    if (
      !detail ||
      (entity && detail.bundle.entity && detail.bundle.entity !== entity) ||
      !matchesEffective(effective, INPUT_SET_SUMMARIES.find((item) => item.setCode === setCode)?.validFrom, INPUT_SET_SUMMARIES.find((item) => item.setCode === setCode)?.validTo)
    ) {
      return HttpResponse.json(
        { message: '入力セットが見つかりませんでした', errorCode: 'inputset_not_found', runId, traceId },
        { status: 404, headers: { 'x-run-id': runId, 'x-trace-id': traceId } },
      );
    }
    const startedSource = normalizeYmd(effective);
    return HttpResponse.json(
      {
        ok: true,
        setCode,
        bundle: {
          ...detail.bundle,
          started: startedSource ? `${startedSource.slice(0, 4)}-${startedSource.slice(4, 6)}-${startedSource.slice(6, 8)}` : detail.bundle.started,
        },
        runId,
        traceId,
      },
      { headers: { 'x-run-id': runId, 'x-trace-id': traceId } },
    );
  }),
  http.post(/\/api\/orca\/master\/order\/interactions\/check(?:\?.*)?$/, async ({ request }) => {
    if (shouldBypass(request)) {
      return passthrough();
    }
    const { runId, traceId } = resolveAuditHeaders(request);
    const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!payload || (!Array.isArray(payload.codes) && !Array.isArray(payload.existingCodes))) {
      return HttpResponse.json(
        { message: 'codes is required', errorCode: 'invalid_request', runId, traceId },
        { status: 400, headers: { 'x-run-id': runId, 'x-trace-id': traceId } },
      );
    }
    const codes = sanitizeCodes(payload.codes);
    const existingCodes = sanitizeCodes(payload.existingCodes);
    if (codes.length === 0) {
      return HttpResponse.json(
        { message: 'codes is required', errorCode: 'invalid_request', runId, traceId },
        { status: 400, headers: { 'x-run-id': runId, 'x-trace-id': traceId } },
      );
    }
    const pairKeys = new Set<string>();
    const pairs: Array<{
      code1: string;
      code2: string;
      interactionCode?: string;
      interactionName?: string;
      message?: string;
    }> = [];
    const candidates =
      existingCodes.length > 0
        ? codes.flatMap((code) => existingCodes.map((other) => [code, other] as const))
        : codes.flatMap((code, index) => codes.slice(index + 1).map((other) => [code, other] as const));
    candidates.forEach(([left, right]) => {
      if (left === right) return;
      const normalizedKey = [left, right].sort().join(':');
      if (pairKeys.has(normalizedKey)) return;
      pairKeys.add(normalizedKey);
      const interaction = INTERACTION_MAP[normalizedKey];
      if (!interaction) return;
      pairs.push({
        code1: left,
        code2: right,
        interactionCode: interaction.interactionCode,
        interactionName: interaction.interactionName,
        message: interaction.message,
      });
    });
    return HttpResponse.json(
      {
        ok: true,
        totalCount: pairs.length,
        pairs,
        runId,
        traceId,
      },
      { headers: { 'x-run-id': runId, 'x-trace-id': traceId } },
    );
  }),
];
