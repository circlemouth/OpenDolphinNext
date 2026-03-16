import { httpFetch } from '../../libs/http/httpClient';
import { generateRunId, getObservabilityMeta, updateObservabilityMeta } from '../../libs/observability/observability';
import { importPatientsFromOrca } from '../outpatient/orcaPatientImportApi';
import { buildPatientImportFailureMessage, isRecoverableOrcaNotFound } from '../shared/orcaPatientImportRecovery';
import { parseOrcaApiResponse } from '../shared/orcaApiResponse';
import {
  type OrderBundle,
  type OrderBundleFetchResult,
  type OrderBundleItem,
  type OrderBundleMutationResult,
  type OrderBundleOperation,
} from './orderBundleApi';
import { formatOrcaOrderItemMemo, parseOrcaOrderItemMemo, type OrcaOrderItemMeta } from './orcaOrderItemMeta';

export type PrescriptionLocation = 'in' | 'out';
export type PrescriptionCategory = 'regular' | 'tonyo' | 'gaiyo';
export type PrescriptionRefillPattern = 'none' | 'standard' | 'alternate';

export type PrescriptionLowerFields = {
  lowerDrugCode?: string;
  lowerUsageCode?: string;
  lowerClaimCode?: string;
  lowerRouteCode?: string;
  lowerTimingCode?: string;
  lowerClassCode?: string;
};

export type PrescriptionClaimComment = PrescriptionLowerFields & {
  id: string;
  code?: string;
  name: string;
  note?: string;
};

export type PrescriptionDrug = PrescriptionLowerFields & {
  rowId: string;
  code?: string;
  name: string;
  quantity: string;
  unit: string;
  genericChangeAllowed: boolean;
  drugComment: string;
  claimComments: PrescriptionClaimComment[];
  patientRequest: boolean;
};

export type PrescriptionRp = PrescriptionLowerFields & {
  rpId: string;
  documentId?: number;
  moduleId?: number;
  name: string;
  location: PrescriptionLocation;
  category: PrescriptionCategory;
  usage: string;
  usageCode?: string;
  daysOrTimes: string;
  remark: string;
  refillCount?: 1 | 2 | 3;
  refillPattern: PrescriptionRefillPattern;
  doctorComment: string;
  started?: string;
  drugs: PrescriptionDrug[];
};

export type PrescriptionOrder = {
  patientId: string;
  encounterDate?: string;
  performDate?: string;
  doctorComment: string;
  rps: PrescriptionRp[];
  deletedDocumentIds: number[];
};

export type PrescriptionOrderFetchResult = Omit<OrderBundleFetchResult, 'bundles'> & {
  sourceBundles: OrderBundle[];
  order: PrescriptionOrder;
};

export type PrescriptionOrderSaveResult = OrderBundleMutationResult;

export type PrescriptionDoImportSource =
  | { type: 'bundle'; bundle: OrderBundle }
  | { type: 'rp'; rp: PrescriptionRp }
  | { type: 'order'; order: PrescriptionOrder };

type StoredRpMeta = {
  rpId?: string;
  refillCount?: 1 | 2 | 3;
  refillPattern?: PrescriptionRefillPattern;
  doctorComment?: string;
  usageCode?: string;
  lowerFields?: PrescriptionLowerFields;
};

type StoredDrugMeta = {
  claimComments?: Array<{ code?: string; name?: string; note?: string; lowerFields?: PrescriptionLowerFields }>;
  patientRequest?: boolean;
  lowerFields?: PrescriptionLowerFields;
};

type ServerRpMeta = {
  documentId?: number;
  moduleId?: number;
  entity?: string;
  bundleName?: string;
  bundleNumber?: string;
  classCode?: string;
  classCodeSystem?: string;
  className?: string;
  admin?: string;
  adminMemo?: string;
  started?: string;
};

type ServerPrescriptionClaimComment = {
  code?: string;
  text?: string;
  category?: string;
};

type ServerPrescriptionDrug = {
  code?: string;
  name?: string;
  quantity?: string;
  unit?: string;
  memo?: string;
};

type ServerPrescriptionRp = {
  rpNumber?: string;
  medicalClass?: string;
  medicalClassNumber?: string;
  usageCode?: string;
  usageName?: string;
  memo?: string;
  drugs?: ServerPrescriptionDrug[];
  claimComments?: ServerPrescriptionClaimComment[];
};

type ServerPrescriptionDoctorComment = {
  text?: string;
};

type ServerPrescriptionSetting = {
  code?: string;
  name?: string;
  value?: string;
};

type ServerPrescriptionRemark = {
  code?: string;
  text?: string;
};

type ServerPrescriptionOrder = {
  patientId: string;
  encounterDate?: string;
  performDate?: string;
  rps?: ServerPrescriptionRp[];
  doctorComments?: ServerPrescriptionDoctorComment[];
  prescriptionSettings?: ServerPrescriptionSetting[];
  remarks?: ServerPrescriptionRemark[];
};

const COMMENT_CODE_PATTERN = /^(008[1-6]|8[1-6]|098|099|98|99)/;
const RX_RP_META_PREFIX = '__rx_rp_meta__:';
const RX_DRUG_META_PREFIX = '__rx_drug_meta__:';
const RX_CLAIM_LINK_PREFIX = '__rx_claim_target__:';
const RX_SERVER_RP_META_PREFIX = '__rx_server_rp_meta__:';
const PRESCRIPTION_CLASS_CODES: Record<PrescriptionCategory, Record<PrescriptionLocation, string>> = {
  regular: { in: '211', out: '212' },
  tonyo: { in: '221', out: '222' },
  gaiyo: { in: '231', out: '232' },
};

const createStableId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const parseJsonLine = <T,>(line: string, prefix: string): T | null => {
  if (!line.startsWith(prefix)) return null;
  const raw = line.slice(prefix.length).trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const splitMetaText = <T,>(raw: string | undefined, prefix: string): { meta: T | null; text: string } => {
  if (!raw) return { meta: null, text: '' };
  const lines = raw.split('\n');
  let meta: T | null = null;
  const next: string[] = [];
  lines.forEach((line) => {
    const parsed = parseJsonLine<T>(line, prefix);
    if (parsed && !meta) {
      meta = parsed;
      return;
    }
    next.push(line);
  });
  return { meta, text: next.join('\n').trim() };
};

const withJsonMetaLine = (text: string, prefix: string, meta: unknown, keep: boolean) => {
  const cleaned = text.trim();
  if (!keep) return cleaned;
  const encoded = `${prefix}${JSON.stringify(meta)}`;
  return cleaned ? `${cleaned}\n${encoded}` : encoded;
};

const parsePrescriptionClassCode = (classCode?: string | null): { location: PrescriptionLocation; category: PrescriptionCategory } => {
  if (!classCode) return { location: 'out', category: 'regular' };
  const normalized = classCode.trim();
  const location: PrescriptionLocation = normalized.endsWith('2') ? 'out' : 'in';
  if (normalized.startsWith('22')) return { location, category: 'tonyo' };
  if (normalized.startsWith('23')) return { location, category: 'gaiyo' };
  return { location, category: 'regular' };
};

const resolvePrescriptionClassCode = (category: PrescriptionCategory, location: PrescriptionLocation) =>
  PRESCRIPTION_CLASS_CODES[category][location];

const isClaimCommentItem = (item: OrderBundleItem) => {
  const code = item.code?.trim() ?? '';
  return code.length > 0 && COMMENT_CODE_PATTERN.test(code);
};

const parseClaimTargetIndex = (memo?: string | null): number | null => {
  const raw = memo?.trim() ?? '';
  if (!raw.startsWith(RX_CLAIM_LINK_PREFIX)) return null;
  const index = Number(raw.slice(RX_CLAIM_LINK_PREFIX.length));
  if (!Number.isInteger(index) || index < 0) return null;
  return index;
};

const toClaimComment = (item: OrderBundleItem): PrescriptionClaimComment => ({
  id: createStableId('claim'),
  code: item.code?.trim() || undefined,
  name: item.name?.trim() || '',
  note: item.memo?.trim() || undefined,
});

const buildEmptyDrug = (): PrescriptionDrug => ({
  rowId: createStableId('drug'),
  code: undefined,
  name: '',
  quantity: '',
  unit: '',
  genericChangeAllowed: true,
  drugComment: '',
  claimComments: [],
  patientRequest: true,
});

const hasAnyLowerField = (fields?: PrescriptionLowerFields) => {
  if (!fields) return false;
  return Object.values(fields).some((value) => Boolean(value && value.trim()));
};

const normalizeClaimComments = (comments: PrescriptionClaimComment[]) => {
  const seen = new Set<string>();
  const next: PrescriptionClaimComment[] = [];
  comments.forEach((comment) => {
    const code = comment.code?.trim() ?? '';
    const name = comment.name.trim();
    if (!code && !name) return;
    const key = `${code}|${name}`;
    if (seen.has(key)) return;
    seen.add(key);
    next.push({
      ...comment,
      id: comment.id || createStableId('claim'),
      code: code || undefined,
      name,
    });
  });
  return next;
};

const toDrugFromItem = (item: OrderBundleItem): PrescriptionDrug => {
  const parsed = parseOrcaOrderItemMemo(item.memo);
  const drugMetaParsed = splitMetaText<StoredDrugMeta>(parsed.memoText, RX_DRUG_META_PREFIX);
  const drugMeta = drugMetaParsed.meta;
  const claimComments = normalizeClaimComments(
    (drugMeta?.claimComments ?? []).map((entry) => ({
      id: createStableId('claim'),
      code: entry.code?.trim() || undefined,
      name: entry.name?.trim() || '',
      note: entry.note?.trim() || undefined,
      ...(entry.lowerFields ?? {}),
    })),
  );

  return {
    rowId: createStableId('drug'),
    code: item.code?.trim() || undefined,
    name: item.name?.trim() || '',
    quantity: item.quantity?.trim() || '',
    unit: item.unit?.trim() || '',
    genericChangeAllowed: parsed.meta.genericFlg !== 'no',
    drugComment: parsed.meta.userComment?.trim() || '',
    claimComments,
    patientRequest: drugMeta?.patientRequest ?? true,
    ...(drugMeta?.lowerFields ?? {}),
  };
};

const toRpFromBundle = (bundle: OrderBundle): PrescriptionRp => {
  const classParsed = parsePrescriptionClassCode(bundle.classCode);
  const memoParsed = splitMetaText<StoredRpMeta>(bundle.memo, RX_RP_META_PREFIX);
  const rpMeta = memoParsed.meta;
  const drugs: PrescriptionDrug[] = [];
  const orphanComments: PrescriptionClaimComment[] = [];

  bundle.items.forEach((item) => {
    if (isClaimCommentItem(item)) {
      const comment = toClaimComment(item);
      const targetIndex = parseClaimTargetIndex(item.memo);
      if (targetIndex !== null && drugs[targetIndex]) {
        drugs[targetIndex].claimComments = normalizeClaimComments([
          ...drugs[targetIndex].claimComments,
          comment,
        ]);
        return;
      }
      if (drugs.length > 0) {
        const last = drugs[drugs.length - 1];
        last.claimComments = normalizeClaimComments([...last.claimComments, comment]);
      } else {
        orphanComments.push(comment);
      }
      return;
    }
    drugs.push(toDrugFromItem(item));
  });

  if (drugs.length === 0) {
    drugs.push(buildEmptyDrug());
  }
  if (orphanComments.length > 0) {
    drugs[0].claimComments = normalizeClaimComments([...drugs[0].claimComments, ...orphanComments]);
  }

  const refillCount = rpMeta?.refillCount;

  return {
    rpId: rpMeta?.rpId?.trim() || createStableId('rp'),
    documentId: bundle.documentId,
    moduleId: bundle.moduleId,
    name: bundle.bundleName?.trim() || '',
    location: classParsed.location,
    category: classParsed.category,
    usage: bundle.admin?.trim() || '',
    usageCode: rpMeta?.usageCode ?? (bundle.adminMemo?.trim() || undefined),
    daysOrTimes: bundle.bundleNumber?.trim() || '1',
    remark: memoParsed.text,
    refillCount: refillCount === 1 || refillCount === 2 || refillCount === 3 ? refillCount : undefined,
    refillPattern: rpMeta?.refillPattern ?? 'none',
    doctorComment: rpMeta?.doctorComment?.trim() || '',
    started: bundle.started,
    drugs,
    ...(rpMeta?.lowerFields ?? {}),
  };
};

export const buildEmptyPrescriptionRp = (started?: string): PrescriptionRp => ({
  rpId: createStableId('rp'),
  name: '',
  location: 'out',
  category: 'regular',
  usage: '',
  usageCode: undefined,
  daysOrTimes: '1',
  remark: '',
  refillCount: undefined,
  refillPattern: 'none',
  doctorComment: '',
  started,
  drugs: [buildEmptyDrug()],
});

export const buildEmptyPrescriptionOrder = (patientId: string, started?: string): PrescriptionOrder => ({
  patientId,
  encounterDate: started?.slice(0, 10),
  performDate: started?.slice(0, 10),
  doctorComment: '',
  rps: [buildEmptyPrescriptionRp(started)],
  deletedDocumentIds: [],
});

export const toPrescriptionOrder = (sourceBundles: OrderBundle[], patientId: string): PrescriptionOrder => {
  const medBundles = sourceBundles.filter((bundle) => (bundle.entity?.trim() ?? '') === 'medOrder');
  if (medBundles.length === 0) {
    return buildEmptyPrescriptionOrder(patientId);
  }
  const rps = medBundles.map(toRpFromBundle);
  const startedDates = rps
    .map((rp) => rp.started?.slice(0, 10))
    .filter((value): value is string => Boolean(value));
  const baseDate = startedDates[0];
  return {
    patientId,
    encounterDate: baseDate,
    performDate: baseDate,
    doctorComment: rps.find((rp) => rp.doctorComment.trim())?.doctorComment ?? '',
    rps,
    deletedDocumentIds: [],
  };
};

const normalizeRpMeta = (rp: PrescriptionRp, doctorComment: string): StoredRpMeta => {
  const lowerFields = hasAnyLowerField({
    lowerDrugCode: rp.lowerDrugCode,
    lowerUsageCode: rp.lowerUsageCode,
    lowerClaimCode: rp.lowerClaimCode,
    lowerRouteCode: rp.lowerRouteCode,
    lowerTimingCode: rp.lowerTimingCode,
    lowerClassCode: rp.lowerClassCode,
  })
    ? {
        lowerDrugCode: rp.lowerDrugCode,
        lowerUsageCode: rp.lowerUsageCode,
        lowerClaimCode: rp.lowerClaimCode,
        lowerRouteCode: rp.lowerRouteCode,
        lowerTimingCode: rp.lowerTimingCode,
        lowerClassCode: rp.lowerClassCode,
      }
    : undefined;
  const trimmedDoctorComment = doctorComment.trim() || rp.doctorComment.trim();
  return {
    rpId: rp.rpId?.trim() || undefined,
    refillCount: rp.refillCount,
    refillPattern: rp.refillPattern,
    doctorComment: trimmedDoctorComment || undefined,
    usageCode: rp.usageCode?.trim() || undefined,
    lowerFields,
  };
};

const normalizeDrugMeta = (drug: PrescriptionDrug): StoredDrugMeta => {
  const lowerFields = hasAnyLowerField({
    lowerDrugCode: drug.lowerDrugCode,
    lowerUsageCode: drug.lowerUsageCode,
    lowerClaimCode: drug.lowerClaimCode,
    lowerRouteCode: drug.lowerRouteCode,
    lowerTimingCode: drug.lowerTimingCode,
    lowerClassCode: drug.lowerClassCode,
  })
    ? {
        lowerDrugCode: drug.lowerDrugCode,
        lowerUsageCode: drug.lowerUsageCode,
        lowerClaimCode: drug.lowerClaimCode,
        lowerRouteCode: drug.lowerRouteCode,
        lowerTimingCode: drug.lowerTimingCode,
        lowerClassCode: drug.lowerClassCode,
      }
    : undefined;

  return {
    patientRequest: drug.patientRequest,
    claimComments: normalizeClaimComments(drug.claimComments).map((comment) => ({
      code: comment.code,
      name: comment.name,
      note: comment.note,
      lowerFields: hasAnyLowerField({
        lowerDrugCode: comment.lowerDrugCode,
        lowerUsageCode: comment.lowerUsageCode,
        lowerClaimCode: comment.lowerClaimCode,
        lowerRouteCode: comment.lowerRouteCode,
        lowerTimingCode: comment.lowerTimingCode,
        lowerClassCode: comment.lowerClassCode,
      })
        ? {
            lowerDrugCode: comment.lowerDrugCode,
            lowerUsageCode: comment.lowerUsageCode,
            lowerClaimCode: comment.lowerClaimCode,
            lowerRouteCode: comment.lowerRouteCode,
            lowerTimingCode: comment.lowerTimingCode,
            lowerClassCode: comment.lowerClassCode,
          }
        : undefined,
    })),
    lowerFields,
  };
};

const toOrderBundleItems = (rp: PrescriptionRp): OrderBundleItem[] => {
  const items: OrderBundleItem[] = [];
  rp.drugs.forEach((drug, drugIndex) => {
    const code = drug.code?.trim() || undefined;
    const name = drug.name.trim();
    if (!name && !code) return;

    const orcaMeta: OrcaOrderItemMeta = {
      genericFlg: drug.genericChangeAllowed ? 'yes' : 'no',
      userComment: drug.drugComment.trim() || undefined,
    };

    const drugMeta = normalizeDrugMeta(drug);
    const memoText = withJsonMetaLine('', RX_DRUG_META_PREFIX, drugMeta, Boolean(
      drugMeta.patientRequest !== undefined ||
        (drugMeta.claimComments && drugMeta.claimComments.length > 0) ||
        hasAnyLowerField(drugMeta.lowerFields),
    ));

    items.push({
      code,
      name,
      quantity: drug.quantity.trim() || '',
      unit: drug.unit.trim() || '',
      memo: formatOrcaOrderItemMemo(orcaMeta, memoText),
    });

    normalizeClaimComments(drug.claimComments).forEach((comment) => {
      items.push({
        code: comment.code?.trim() || undefined,
        name: comment.name.trim(),
        quantity: '',
        unit: '',
        memo: `${RX_CLAIM_LINK_PREFIX}${drugIndex}`,
      });
    });
  });
  return items;
};

export const buildPrescriptionMutationOperations = (order: PrescriptionOrder): OrderBundleOperation[] => {
  const operations: OrderBundleOperation[] = [];
  order.rps.forEach((rp) => {
    const classCode = resolvePrescriptionClassCode(rp.category, rp.location);
    const rpMeta = normalizeRpMeta(rp, order.doctorComment);
    const memo = withJsonMetaLine(
      rp.remark.trim(),
      RX_RP_META_PREFIX,
      rpMeta,
      Boolean(
        rpMeta.refillCount ||
          (rpMeta.refillPattern && rpMeta.refillPattern !== 'none') ||
          (rpMeta.doctorComment && rpMeta.doctorComment.trim()) ||
          (rpMeta.usageCode && rpMeta.usageCode.trim()) ||
          hasAnyLowerField(rpMeta.lowerFields),
      ),
    );

    operations.push({
      operation: rp.documentId ? 'update' : 'create',
      documentId: rp.documentId,
      moduleId: rp.moduleId,
      entity: 'medOrder',
      bundleName: rp.name.trim() || '処方RP',
      bundleNumber: rp.daysOrTimes.trim() || '1',
      classCode,
      classCodeSystem: 'Claim007',
      className: undefined,
      admin: rp.usage.trim(),
      adminMemo: rp.usageCode?.trim() || '',
      memo,
      startDate: rp.started,
      items: toOrderBundleItems(rp),
    });
  });

  const deleted = Array.from(
    new Set(
      order.deletedDocumentIds
        .filter((id) => Number.isInteger(id) && id > 0)
        .map((id) => Number(id)),
    ),
  );
  deleted.forEach((documentId) => {
    operations.push({
      operation: 'delete',
      documentId,
      entity: 'medOrder',
    });
  });

  return operations;
};

const buildPrescriptionOrderQuery = (params: { patientId: string; from?: string }) => {
  const query = new URLSearchParams();
  query.set('patientId', params.patientId);
  const encounterDate = params.from?.slice(0, 10);
  if (encounterDate) {
    query.set('encounterDate', encounterDate);
  }
  return query.toString();
};

const toBundleFromOperation = (operation: OrderBundleOperation): OrderBundle => ({
  documentId: operation.documentId,
  moduleId: operation.moduleId,
  entity: 'medOrder',
  bundleName: operation.bundleName,
  bundleNumber: operation.bundleNumber,
  classCode: operation.classCode,
  classCodeSystem: operation.classCodeSystem,
  className: operation.className,
  admin: operation.admin,
  adminMemo: operation.adminMemo,
  memo: operation.memo,
  started: operation.startDate,
  items: (operation.items ?? []).map((item) => ({
    code: item.code,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    memo: item.memo,
  })),
});

const toServerPrescriptionOrder = (order: PrescriptionOrder): ServerPrescriptionOrder => {
  const operations = buildPrescriptionMutationOperations({ ...order, deletedDocumentIds: [] }).filter(
    (operation) => operation.operation !== 'delete',
  );
  const rps: ServerPrescriptionRp[] = operations.map((operation) => {
    const rpMeta: ServerRpMeta = {
      documentId: operation.documentId,
      moduleId: operation.moduleId,
      entity: operation.entity,
      bundleName: operation.bundleName,
      bundleNumber: operation.bundleNumber,
      classCode: operation.classCode,
      classCodeSystem: operation.classCodeSystem,
      className: operation.className,
      admin: operation.admin,
      adminMemo: operation.adminMemo,
      started: operation.startDate,
    };
    const rpMemo = withJsonMetaLine(operation.memo?.trim() ?? '', RX_SERVER_RP_META_PREFIX, rpMeta, true);
    return {
      rpNumber: operation.bundleNumber?.trim() || undefined,
      medicalClass: operation.classCode?.trim() || undefined,
      medicalClassNumber: operation.bundleNumber?.trim() || undefined,
      usageCode: operation.adminMemo?.trim() || undefined,
      usageName: operation.admin?.trim() || undefined,
      memo: rpMemo,
      drugs: (operation.items ?? []).map((item) => ({
        code: item.code?.trim() || undefined,
        name: item.name?.trim() || undefined,
        quantity: item.quantity?.trim() || undefined,
        unit: item.unit?.trim() || undefined,
        memo: item.memo?.trim() || '',
      })),
      claimComments: [],
    };
  });

  const doctorComment = order.doctorComment.trim();
  const startedDates = order.rps
    .map((rp) => rp.started?.slice(0, 10))
    .filter((value): value is string => Boolean(value));

  return {
    patientId: order.patientId,
    encounterDate: order.encounterDate ?? startedDates[0],
    performDate: order.performDate ?? startedDates[0],
    rps,
    doctorComments: doctorComment ? [{ text: doctorComment }] : [],
    prescriptionSettings: [],
    remarks: [],
  };
};

const toSourceBundlesFromServerOrder = (order: ServerPrescriptionOrder): OrderBundle[] => {
  const rps = order.rps ?? [];
  return rps.map((rp, index) => {
    const parsedMemo = splitMetaText<ServerRpMeta>(rp.memo, RX_SERVER_RP_META_PREFIX);
    const meta = parsedMemo.meta;
    return {
      documentId: typeof meta?.documentId === 'number' ? meta.documentId : undefined,
      moduleId: typeof meta?.moduleId === 'number' ? meta.moduleId : undefined,
      entity: meta?.entity?.trim() || 'medOrder',
      bundleName: meta?.bundleName?.trim() || `処方RP${index + 1}`,
      bundleNumber: meta?.bundleNumber?.trim() || rp.medicalClassNumber?.trim() || rp.rpNumber?.trim() || '1',
      classCode: meta?.classCode?.trim() || rp.medicalClass?.trim() || undefined,
      classCodeSystem: meta?.classCodeSystem?.trim() || 'Claim007',
      className: meta?.className?.trim() || undefined,
      admin: meta?.admin?.trim() || rp.usageName?.trim() || '',
      adminMemo: meta?.adminMemo?.trim() || rp.usageCode?.trim() || '',
      memo: parsedMemo.text,
      started: meta?.started?.trim() || undefined,
      items: (rp.drugs ?? []).map((drug) => ({
        code: drug.code?.trim() || undefined,
        name: drug.name?.trim() || '',
        quantity: drug.quantity?.trim() || '',
        unit: drug.unit?.trim() || '',
        memo: drug.memo?.trim() || '',
      })),
    };
  });
};

const parsePrescriptionOrderFetchResponse = (
  json: Record<string, unknown> | null,
): {
  found: boolean;
  runId?: string;
  order?: ServerPrescriptionOrder;
} => {
  if (!json) return { found: false };
  const found = Boolean(json.found);
  const runId = typeof json.runId === 'string' ? json.runId : undefined;
  const orderCandidate = json.order;
  const order =
    orderCandidate && typeof orderCandidate === 'object' && !Array.isArray(orderCandidate)
      ? (orderCandidate as ServerPrescriptionOrder)
      : undefined;
  return { found, runId, order };
};

const fetchPrescriptionOrderBase = async (params: {
  patientId: string;
  from?: string;
}): Promise<PrescriptionOrderFetchResult> => {
  const runId = getObservabilityMeta().runId ?? generateRunId();
  updateObservabilityMeta({ runId });
  const response = await httpFetch(`/api/orca/prescription-orders?${buildPrescriptionOrderQuery(params)}`);
  const parsed = await parseOrcaApiResponse(response, {
    fallbackMessage: '処方オーダー情報の取得に失敗しました。',
  });
  if (parsed.ok && !parsed.json) {
    return {
      ok: false,
      runId,
      patientId: params.patientId,
      sourceBundles: [],
      order: buildEmptyPrescriptionOrder(params.patientId, params.from),
      message: '処方オーダーAPIがJSON以外を返しました。ルーティング設定を確認してください。',
      status: parsed.status,
      errorKind: 'route_not_found',
      routeMismatch: true,
    };
  }

  if (!parsed.ok) {
    return {
      ok: false,
      runId: parsed.runId ?? runId,
      patientId: params.patientId,
      sourceBundles: [],
      order: buildEmptyPrescriptionOrder(params.patientId, params.from),
      message: parsed.message,
      status: parsed.status,
      errorCode: parsed.errorCode,
      errorKind: parsed.errorKind,
      routeMismatch: parsed.routeMismatch,
    };
  }

  const fetchResponse = parsePrescriptionOrderFetchResponse(parsed.json);
  const sourceBundles = fetchResponse.order ? toSourceBundlesFromServerOrder(fetchResponse.order) : [];
  const order =
    fetchResponse.found && sourceBundles.length > 0
      ? toPrescriptionOrder(sourceBundles, params.patientId)
      : buildEmptyPrescriptionOrder(params.patientId, params.from);
  if (fetchResponse.order?.encounterDate) {
    order.encounterDate = fetchResponse.order.encounterDate;
  }
  if (fetchResponse.order?.performDate) {
    order.performDate = fetchResponse.order.performDate;
  }
  if (fetchResponse.order?.doctorComments && fetchResponse.order.doctorComments.length > 0) {
    const latestComment = fetchResponse.order.doctorComments[fetchResponse.order.doctorComments.length - 1];
    const text = latestComment?.text?.trim();
    if (text) {
      order.doctorComment = text;
    }
  }

  return {
    ok: true,
    runId: fetchResponse.runId ?? parsed.runId ?? runId,
    patientId: params.patientId,
    recordsReturned: sourceBundles.length,
    sourceBundles,
    order,
    message: parsed.message,
    status: parsed.status,
    routeMismatch: false,
  };
};

export async function fetchPrescriptionOrder(params: {
  patientId: string;
  from?: string;
}): Promise<PrescriptionOrderFetchResult> {
  const primary = await fetchPrescriptionOrderBase(params);
  if (primary.ok) return primary;
  if (
    !isRecoverableOrcaNotFound({
      patientId: params.patientId,
      status: primary.status,
      errorCode: primary.errorCode,
      errorKind: primary.errorKind,
    })
  ) {
    return primary;
  }

  const importResult = await importPatientsFromOrca({
    patientIds: [params.patientId],
    runId: primary.runId,
  });
  if (!importResult.ok) {
    return {
      ...primary,
      ok: false,
      sourceBundles: [],
      order: buildEmptyPrescriptionOrder(params.patientId, params.from),
      runId: importResult.runId ?? primary.runId,
      status: importResult.status || primary.status,
      message: buildPatientImportFailureMessage('処方オーダー情報', importResult),
      errorCode: importResult.errorCode ?? primary.errorCode,
      errorKind: importResult.errorKind ?? primary.errorKind,
      routeMismatch: importResult.routeMismatch ?? primary.routeMismatch,
      patientImportAttempted: true,
      patientImportStatus: importResult.status,
    };
  }

  const retried = await fetchPrescriptionOrderBase(params);
  return {
    ...retried,
    runId: retried.runId ?? importResult.runId ?? primary.runId,
    patientImportAttempted: true,
    patientImportStatus: importResult.status,
  };
}

export async function savePrescriptionOrder(params: {
  patientId: string;
  order: PrescriptionOrder;
}): Promise<PrescriptionOrderSaveResult> {
  const runId = getObservabilityMeta().runId ?? generateRunId();
  updateObservabilityMeta({ runId });
  const payload = toServerPrescriptionOrder({
    ...params.order,
    patientId: params.patientId,
  });
  const response = await httpFetch('/api/orca/prescription-orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const parsed = await parseOrcaApiResponse(response, {
    fallbackMessage: '処方オーダーの保存に失敗しました。',
  });
  return {
    ok: parsed.ok,
    runId: parsed.runId ?? runId,
    message: parsed.message,
    raw: parsed.json ?? parsed.text,
  };
}

export const fetchPrescriptionOrderBundlesWithPatientImportRecovery = async (params: {
  patientId: string;
  from?: string;
}): Promise<OrderBundleFetchResult> => {
  const result = await fetchPrescriptionOrder(params);
  return {
    ...result,
    bundles: result.sourceBundles,
  };
};

export const mutatePrescriptionOrderBundles = async (params: {
  patientId: string;
  operations: OrderBundleOperation[];
}): Promise<OrderBundleMutationResult> => {
  const current = await fetchPrescriptionOrder({ patientId: params.patientId });
  if (!current.ok) {
    return {
      ok: false,
      runId: current.runId,
      message: current.message ?? '処方オーダーの取得に失敗したため更新できません。',
      raw: {
        status: current.status,
        errorCode: current.errorCode,
        errorKind: current.errorKind,
      },
    };
  }

  const nextBundles = [...current.sourceBundles];
  params.operations
    .filter((operation) => (operation.entity?.trim() ?? 'medOrder') === 'medOrder')
    .forEach((operation) => {
      if (operation.operation === 'delete') {
        const documentId = typeof operation.documentId === 'number' ? operation.documentId : null;
        const moduleId = typeof operation.moduleId === 'number' ? operation.moduleId : null;
        for (let i = nextBundles.length - 1; i >= 0; i -= 1) {
          const bundle = nextBundles[i];
          const docMatched = documentId !== null && bundle.documentId === documentId;
          const moduleMatched = moduleId !== null && bundle.moduleId === moduleId;
          if (docMatched || moduleMatched) {
            nextBundles.splice(i, 1);
          }
        }
        return;
      }

      const nextBundle = toBundleFromOperation({
        ...operation,
        entity: 'medOrder',
      });
      if (operation.operation === 'update') {
        const targetIndex = nextBundles.findIndex((bundle) => {
          if (typeof operation.documentId === 'number' && typeof bundle.documentId === 'number') {
            return bundle.documentId === operation.documentId;
          }
          if (typeof operation.moduleId === 'number' && typeof bundle.moduleId === 'number') {
            return bundle.moduleId === operation.moduleId;
          }
          return false;
        });
        if (targetIndex >= 0) {
          nextBundles[targetIndex] = {
            ...nextBundles[targetIndex],
            ...nextBundle,
          };
          return;
        }
      }
      nextBundles.push(nextBundle);
    });

  const nextOrder = toPrescriptionOrder(nextBundles, params.patientId);
  const saveResult = await savePrescriptionOrder({
    patientId: params.patientId,
    order: nextOrder,
  });
  return {
    ...saveResult,
    createdDocumentIds: undefined,
    updatedDocumentIds: undefined,
    deletedDocumentIds: undefined,
  };
};

const cloneClaimComment = (comment: PrescriptionClaimComment): PrescriptionClaimComment => ({
  ...comment,
  id: comment.id || createStableId('claim'),
  code: comment.code?.trim() || undefined,
  name: comment.name.trim(),
});

const cloneDrug = (drug: PrescriptionDrug): PrescriptionDrug => ({
  ...drug,
  rowId: drug.rowId || createStableId('drug'),
  code: drug.code?.trim() || undefined,
  name: drug.name,
  claimComments: normalizeClaimComments(drug.claimComments).map(cloneClaimComment),
});

const cloneRp = (rp: PrescriptionRp): PrescriptionRp => ({
  ...rp,
  rpId: rp.rpId || createStableId('rp'),
  usageCode: rp.usageCode?.trim() || undefined,
  drugs: rp.drugs.map(cloneDrug),
});

export const importPrescriptionDoInput = (
  baseOrder: PrescriptionOrder,
  source: PrescriptionDoImportSource,
): PrescriptionOrder => {
  const nextBase: PrescriptionOrder = {
    ...baseOrder,
    deletedDocumentIds: [...baseOrder.deletedDocumentIds],
    rps: baseOrder.rps.map(cloneRp),
  };

  if (source.type === 'bundle') {
    const importedRp = toRpFromBundle(source.bundle);
    nextBase.rps = [...nextBase.rps, importedRp];
    if (!nextBase.doctorComment.trim() && importedRp.doctorComment.trim()) {
      nextBase.doctorComment = importedRp.doctorComment;
    }
    return nextBase;
  }

  if (source.type === 'rp') {
    const importedRp = cloneRp(source.rp);
    nextBase.rps = [...nextBase.rps, importedRp];
    if (!nextBase.doctorComment.trim() && importedRp.doctorComment.trim()) {
      nextBase.doctorComment = importedRp.doctorComment;
    }
    return nextBase;
  }

  const incoming = source.order;
  const importedRps = incoming.rps.map(cloneRp);
  const importedDeletes = incoming.deletedDocumentIds.filter((id) => Number.isInteger(id) && id > 0);
  nextBase.rps = [...nextBase.rps, ...importedRps];
  nextBase.deletedDocumentIds = Array.from(new Set([...nextBase.deletedDocumentIds, ...importedDeletes]));
  if (!nextBase.doctorComment.trim() && incoming.doctorComment.trim()) {
    nextBase.doctorComment = incoming.doctorComment;
  }
  return nextBase;
};
