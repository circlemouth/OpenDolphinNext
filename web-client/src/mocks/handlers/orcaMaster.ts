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
  // When the app explicitly requests server-backed data (e.g. E2E with
  // X-DataSource-Transition=server), do not override master queries.
  const transition = request.headers.get('x-datasource-transition');
  return transition != null && transition.trim().toLowerCase() === 'server';
};

type TensuItem = {
  tensuCode?: string;
  name?: string;
  unit?: string;
  category?: string;
  points?: number;
  noticeDate?: string;
  startDate?: string;
  endDate?: string;
};

type DrugMasterItem = {
  code?: string;
  name?: string;
  unit?: string;
  category?: string;
  note?: string;
  validFrom?: string;
  validTo?: string;
};

type AddressItem = {
  zip: string;
  prefCode: string;
  cityCode: string;
  city: string;
  town: string;
  kana?: string;
  roman?: string;
  fullAddress: string;
};

type HokenjaItem = {
  payerCode: string;
  payerName: string;
  payerType?: string;
  payerRatio?: number;
  prefCode?: string;
  cityCode?: string;
  zip?: string;
  addressLine?: string;
  phone?: string;
  validFrom?: string;
  validTo?: string;
};

type GenericPriceItem = {
  code: string;
  name: string;
  minPrice: number;
  unit?: string;
  validFrom?: string;
  validTo?: string;
};

const ETENSU_ITEMS: TensuItem[] = [
  { tensuCode: '111000110', name: '初診料', unit: '', category: '110', points: 291, noticeDate: '20240101', startDate: '20240101' },
  { tensuCode: '130003510', name: '静脈内注射', unit: '', category: '320', points: 37, noticeDate: '20240101', startDate: '20240101' },
  { tensuCode: '140000610', name: '創傷処置（１００ｃｍ２未満）', unit: '', category: '400', points: 52, noticeDate: '20240101', startDate: '20240101' },
  { tensuCode: '150129210', name: 'カテーテル心臓手術', unit: '', category: '500', points: 1000, noticeDate: '20240101', startDate: '20240101' },
  { tensuCode: '160000110', name: '血液学的検査判断料', unit: '', category: '600', points: 125, noticeDate: '20240101', startDate: '20240101' },
  { tensuCode: '170017510', name: 'ＣＴ撮影', unit: '', category: '700', points: 500, noticeDate: '20240101', startDate: '20240101' },
  { tensuCode: '180000210', name: '薬剤情報提供料', unit: '', category: '800', points: 10, noticeDate: '20240101', startDate: '20240101' },
];

const BODY_PART_ITEMS: TensuItem[] = [
  { tensuCode: '820181220', name: '撮影部位（単純撮影）：胸部（肩を除く。）', unit: '部位', category: '820', points: 0, noticeDate: '20240101', startDate: '20240101' },
  { tensuCode: '820181300', name: '撮影部位（単純撮影）：腹部', unit: '部位', category: '820', points: 0, noticeDate: '20240101', startDate: '20240101' },
  { tensuCode: '820183500', name: '撮影部位（ＭＲＩ撮影）：膝', unit: '部位', category: '820', points: 0, noticeDate: '20240101', startDate: '20240101' },
];

const COMMENT_ITEMS: TensuItem[] = [
  { tensuCode: '820000001', name: '別途コメントあり', unit: '回', category: '820', points: 0, noticeDate: '20240101', startDate: '20240101' },
  { tensuCode: '820181300', name: '撮影部位（単純撮影）：腹部', unit: '部位', category: '820', points: 0, noticeDate: '20240101', startDate: '20240101' },
  { tensuCode: '810000001', name: '混合', unit: '回', category: '810', points: 0, noticeDate: '20240101', startDate: '20240101' },
];

const GENERIC_CLASS_ITEMS: DrugMasterItem[] = [
  {
    code: 'A100',
    name: 'アムロジピン',
    unit: '錠',
    category: '降圧薬',
    note: 'MSW',
    validFrom: '20240101',
    validTo: '99999999',
  },
  {
    code: 'A200',
    name: 'ロサルタン',
    unit: '錠',
    category: '降圧薬',
    note: 'MSW',
    validFrom: '20240101',
    validTo: '99999999',
  },
];

const MATERIAL_ITEMS: DrugMasterItem[] = [
  {
    code: '700000031',
    name: '処置材料A',
    unit: '個',
    category: '処置',
    note: 'MSW',
    validFrom: '20240101',
    validTo: '99999999',
  },
];

const YOUHOU_ITEMS: DrugMasterItem[] = [
  {
    code: 'Y100',
    name: '1日1回 朝食後',
    unit: '回',
    category: '用法',
    note: 'MSW',
    validFrom: '20240101',
    validTo: '99999999',
  },
];

const KENSA_SORT_ITEMS: DrugMasterItem[] = [
  {
    code: 'K01',
    name: '血液検査',
    unit: '回',
    category: '検査区分',
    note: 'MSW',
    validFrom: '20240101',
    validTo: '99999999',
  },
];

const ADDRESS_ITEMS: AddressItem[] = [
  {
    zip: '1000001',
    prefCode: '13',
    cityCode: '13101',
    city: '東京都千代田区',
    town: '千代田',
    kana: 'トウキョウトチヨダクチヨダ',
    roman: 'TOKYO CHIYODA CHIYODA',
    fullAddress: '東京都千代田区千代田',
  },
  {
    zip: '5300001',
    prefCode: '27',
    cityCode: '27127',
    city: '大阪府大阪市北区',
    town: '梅田',
    kana: 'オオサカフオオサカシキタクウメダ',
    roman: 'OSAKA KITA UMEDA',
    fullAddress: '大阪府大阪市北区梅田',
  },
];

const HOKENJA_ITEMS: HokenjaItem[] = [
  {
    payerCode: '06123456',
    payerName: '東京保険者',
    payerType: '社保',
    payerRatio: 30,
    prefCode: '13',
    cityCode: '13101',
    zip: '1000001',
    addressLine: '東京都千代田区千代田1-1',
    phone: '03-1111-2222',
    validFrom: '20240401',
    validTo: '99991231',
  },
  {
    payerCode: '27123456',
    payerName: '大阪国保',
    payerType: '国保',
    payerRatio: 30,
    prefCode: '27',
    cityCode: '27127',
    zip: '5300001',
    addressLine: '大阪府大阪市北区梅田1-1',
    phone: '06-3333-4444',
    validFrom: '20240401',
    validTo: '99991231',
  },
];

const GENERIC_PRICE_ITEMS: GenericPriceItem[] = [
  {
    code: '620000001',
    name: 'アムロジピン錠5mg',
    minPrice: 12.34,
    unit: '錠',
    validFrom: '20240401',
    validTo: '99991231',
  },
  {
    code: '620000002',
    name: 'ロサルタン錠50mg',
    minPrice: 15.5,
    unit: '錠',
    validFrom: '20240401',
    validTo: '99991231',
  },
];

const filterByKeyword = (items: TensuItem[], keyword: string) => {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return items;
  return items.filter((item) => {
    const name = item.name?.toLowerCase() ?? '';
    const code = item.tensuCode?.toLowerCase() ?? '';
    return name.includes(normalized) || code.includes(normalized);
  });
};

const matchesEffective = (effective: string | null, validFrom?: string, validTo?: string) => {
  const normalized = effective?.replace(/[^0-9]/g, '') ?? '';
  if (!normalized || normalized.length !== 8) return true;
  if (validFrom && normalized < validFrom) return false;
  if (validTo && normalized > validTo) return false;
  return true;
};

const handleEtensuRequest = (request: Request) => {
  const { runId, traceId } = resolveAuditHeaders(request);
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const keyword = url.searchParams.get('keyword') ?? '';
  const pointsMinRaw = url.searchParams.get('pointsMin');
  const pointsMaxRaw = url.searchParams.get('pointsMax');
  const pointsMin = pointsMinRaw ? Number(pointsMinRaw) : undefined;
  const pointsMax = pointsMaxRaw ? Number(pointsMaxRaw) : undefined;
  if ((pointsMinRaw && Number.isNaN(pointsMin)) || (pointsMaxRaw && Number.isNaN(pointsMax))) {
    return HttpResponse.json(
      { message: 'pointsMin/pointsMax must be numeric', errorCode: 'invalid_request', runId, traceId },
      { status: 400, headers: { 'x-run-id': runId, 'x-trace-id': traceId } },
    );
  }
  if (typeof pointsMin === 'number' && typeof pointsMax === 'number' && pointsMin > pointsMax) {
    return HttpResponse.json(
      { message: 'pointsMin must be less than or equal to pointsMax', errorCode: 'invalid_request', runId, traceId },
      { status: 400, headers: { 'x-run-id': runId, 'x-trace-id': traceId } },
    );
  }
  const filteredByKeyword = filterByKeyword(ETENSU_ITEMS, keyword);
  const categoryFiltered =
    category && category.trim().length > 0
      ? filteredByKeyword.filter((item) => {
          const value = item.category?.trim() ?? '';
          return value.startsWith(category.trim());
        })
      : filteredByKeyword;
  const items = categoryFiltered.filter((item) => {
    if (typeof pointsMin === 'number' && (item.points ?? 0) < pointsMin) return false;
    if (typeof pointsMax === 'number' && (item.points ?? 0) > pointsMax) return false;
    return true;
  });
  return HttpResponse.json(
    { items, totalCount: items.length, runId, traceId },
    { headers: { 'x-run-id': runId, 'x-trace-id': traceId } },
  );
};

const handleBodypartRequest = (request: Request) => {
  const { runId, traceId } = resolveAuditHeaders(request);
  const url = new URL(request.url);
  const keyword = url.searchParams.get('keyword') ?? '';
  const items = filterByKeyword(BODY_PART_ITEMS, keyword);
  return HttpResponse.json(
    { items, totalCount: items.length, runId, traceId },
    { headers: { 'x-run-id': runId, 'x-trace-id': traceId } },
  );
};

const handleCommentRequest = (request: Request) => {
  const { runId, traceId } = resolveAuditHeaders(request);
  const url = new URL(request.url);
  const keyword = url.searchParams.get('keyword') ?? '';
  const items = filterByKeyword(COMMENT_ITEMS, keyword);
  return HttpResponse.json(
    { items, totalCount: items.length, runId, traceId },
    { headers: { 'x-run-id': runId, 'x-trace-id': traceId } },
  );
};

const filterDrugItems = (items: DrugMasterItem[], keyword: string) => {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return items;
  return items.filter((item) => {
    const name = item.name?.toLowerCase() ?? '';
    const code = item.code?.toLowerCase() ?? '';
    return name.includes(normalized) || code.includes(normalized);
  });
};

const handleDrugMasterRequest = (request: Request, items: DrugMasterItem[]) => {
  const { runId, traceId } = resolveAuditHeaders(request);
  const url = new URL(request.url);
  const keyword = url.searchParams.get('keyword') ?? '';
  const filtered = filterDrugItems(items, keyword);
  return HttpResponse.json(
    { items: filtered, totalCount: filtered.length, runId, traceId },
    { headers: { 'x-run-id': runId, 'x-trace-id': traceId } },
  );
};

const handleAddressRequest = (request: Request) => {
  const { runId, traceId } = resolveAuditHeaders(request);
  const url = new URL(request.url);
  const zip = (url.searchParams.get('zip') ?? '').replace(/[^0-9]/g, '');
  const effective = url.searchParams.get('effective');
  if (zip.length !== 7) {
    return HttpResponse.json(
      { message: 'zip must be 7 digits', errorCode: 'invalid_request', runId, traceId },
      { status: 400, headers: { 'x-run-id': runId, 'x-trace-id': traceId } },
    );
  }
  const item = ADDRESS_ITEMS.find((entry) => entry.zip === zip && matchesEffective(effective, '20240401', '99991231'));
  if (!item) {
    return HttpResponse.json(
      { message: '該当する住所が見つかりませんでした', errorCode: 'address_not_found', runId, traceId },
      { status: 404, headers: { 'x-run-id': runId, 'x-trace-id': traceId } },
    );
  }
  return HttpResponse.json(
    { ...item, runId, traceId },
    { headers: { 'x-run-id': runId, 'x-trace-id': traceId } },
  );
};

const handleHokenjaRequest = (request: Request) => {
  const { runId, traceId } = resolveAuditHeaders(request);
  const url = new URL(request.url);
  const keyword = (url.searchParams.get('keyword') ?? '').trim().toLowerCase();
  const pref = (url.searchParams.get('pref') ?? '').replace(/[^0-9]/g, '');
  const effective = url.searchParams.get('effective');
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
  const size = Math.min(100, Math.max(1, Number(url.searchParams.get('size') ?? '50') || 50));
  const filtered = HOKENJA_ITEMS.filter((item) => {
    const matchesKeyword =
      !keyword || item.payerCode.toLowerCase().includes(keyword) || item.payerName.toLowerCase().includes(keyword);
    const matchesPref = !pref || item.prefCode === pref;
    return matchesKeyword && matchesPref && matchesEffective(effective, item.validFrom, item.validTo);
  });
  const offset = (page - 1) * size;
  const items = filtered.slice(offset, offset + size);
  return HttpResponse.json(
    { items, totalCount: filtered.length, runId, traceId },
    { headers: { 'x-run-id': runId, 'x-trace-id': traceId } },
  );
};

const handleGenericPriceRequest = (request: Request) => {
  const { runId, traceId } = resolveAuditHeaders(request);
  const url = new URL(request.url);
  const srycd = (url.searchParams.get('srycd') ?? '').trim();
  const effective = url.searchParams.get('effective');
  if (!/^\d{9}$/.test(srycd)) {
    return HttpResponse.json(
      { message: 'srycd must be 9 digits', errorCode: 'invalid_request', runId, traceId },
      { status: 400, headers: { 'x-run-id': runId, 'x-trace-id': traceId } },
    );
  }
  const item = GENERIC_PRICE_ITEMS.find((entry) => entry.code === srycd && matchesEffective(effective, entry.validFrom, entry.validTo));
  if (!item) {
    return HttpResponse.json(
      { message: '最低薬価が見つかりませんでした', errorCode: 'generic_price_not_found', runId, traceId },
      { status: 404, headers: { 'x-run-id': runId, 'x-trace-id': traceId } },
    );
  }
  return HttpResponse.json(
    { ...item, runId, traceId },
    { headers: { 'x-run-id': runId, 'x-trace-id': traceId } },
  );
};

export const orcaMasterHandlers = [
  http.get(/\/api\/orca\/master\/etensu(?:\?.*)?$/, ({ request }) => (shouldBypass(request) ? passthrough() : handleEtensuRequest(request))),
  http.get(/\/api\/orca\/master\/address(?:\?.*)?$/, ({ request }) => (shouldBypass(request) ? passthrough() : handleAddressRequest(request))),
  http.get(/\/api\/orca\/master\/hokenja(?:\?.*)?$/, ({ request }) => (shouldBypass(request) ? passthrough() : handleHokenjaRequest(request))),
  http.get(/\/api\/orca\/master\/generic-price(?:\?.*)?$/, ({ request }) => (shouldBypass(request) ? passthrough() : handleGenericPriceRequest(request))),
  http.get(/\/api\/orca\/master\/bodypart(?:\?.*)?$/, ({ request }) => (shouldBypass(request) ? passthrough() : handleBodypartRequest(request))),
  http.get(/\/api\/orca\/master\/comment(?:\?.*)?$/, ({ request }) => (shouldBypass(request) ? passthrough() : handleCommentRequest(request))),
  http.get(/\/api\/orca\/master\/generic-class(?:\?.*)?$/, ({ request }) => (shouldBypass(request) ? passthrough() : handleDrugMasterRequest(request, GENERIC_CLASS_ITEMS))),
  http.get(/\/api\/orca\/master\/material(?:\?.*)?$/, ({ request }) => (shouldBypass(request) ? passthrough() : handleDrugMasterRequest(request, MATERIAL_ITEMS))),
  http.get(/\/api\/orca\/master\/youhou(?:\?.*)?$/, ({ request }) => (shouldBypass(request) ? passthrough() : handleDrugMasterRequest(request, YOUHOU_ITEMS))),
  http.get(/\/api\/orca\/master\/kensa-sort(?:\?.*)?$/, ({ request }) => (shouldBypass(request) ? passthrough() : handleDrugMasterRequest(request, KENSA_SORT_ITEMS))),
];
