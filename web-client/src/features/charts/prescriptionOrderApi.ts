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
import { resolveOrcaOrderItemFields } from './orcaOrderItemMeta';

export type PrescriptionLocation = 'in' | 'out';
export type PrescriptionCategory = 'regular' | 'tonyo' | 'gaiyo';
export type PrescriptionRefillPattern = 'none' | 'standard' | 'alternate';
export type PrescriptionGenericFlagState = 'yes' | 'no' | 'inherit';

export type PrescriptionLowerFields = {
  lowerDrugCode?: string;
  lowerUsageCode?: string;
  lowerClaimCode?: string;
  lowerRouteCode?: string;
  lowerTimingCode?: string;
  lowerClassCode?: string;
};

export type PrescriptionNumberFields = {
  numberCode?: string;
  numberCodeSystem?: string;
  numberCodeName?: string;
};

export type PrescriptionClaimComment = PrescriptionLowerFields & {
  id: string;
  code?: string;
  name: string;
  note?: string;
};

export type PrescriptionDrug = PrescriptionLowerFields & PrescriptionNumberFields & {
  rowId: string;
  code?: string;
  name: string;
  quantity: string;
  unit: string;
  genericChangeAllowed: boolean;
  isGeneralNamePrescription?: boolean;
  drugComment: string;
  claimComments: PrescriptionClaimComment[];
  patientRequest: boolean;
};

export type PrescriptionSetting = {
  code?: string;
  name?: string;
  value?: string;
};

export type PrescriptionRemark = {
  code?: string;
  text?: string;
};

export type PrescriptionRp = PrescriptionLowerFields & {
  rpId: string;
  documentId?: number;
  moduleId?: number;
  name: string;
  medicalClass?: string;
  medicalClassNumber?: string;
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
  claimComments?: PrescriptionClaimComment[];
  drugs: PrescriptionDrug[];
};

export type PrescriptionOrder = {
  patientId: string;
  encounterId?: string;
  encounterDate?: string;
  performDate?: string;
  doctorComment: string;
  rps: PrescriptionRp[];
  deletedDocumentIds: number[];
  prescriptionSettings?: PrescriptionSetting[];
  remarks?: PrescriptionRemark[];
};

export type PrescriptionOrderFetchResult = Omit<OrderBundleFetchResult, 'bundles'> & {
  sourceBundles: OrderBundle[];
  order: PrescriptionOrder;
};

export type PrescriptionOrderSaveResult = OrderBundleMutationResult;

export type PrescriptionClaimCommentCodeIssue = {
  rpIndex: number;
  drugIndex: number;
  commentIndex: number;
  commentName: string;
};

type PrescriptionClaimCommentStructuredValueIssue = {
  rpIndex: number;
  drugIndex: number;
  commentIndex: number;
  commentCode: string;
};

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
  isGeneralNamePrescription?: boolean;
  patientRequest?: boolean;
  numberFields?: PrescriptionNumberFields;
  lowerFields?: PrescriptionLowerFields;
};

type ServerPrescriptionClaimComment = {
  code?: string;
  text?: string;
  category?: string;
  note?: string;
  lowerFields?: PrescriptionLowerFields;
};

type ServerPrescriptionDrug = {
  code?: string;
  name?: string;
  quantity?: string;
  unit?: string;
  memo?: string;
  genericChangeAllowed?: boolean;
  generalNamePrescription?: boolean;
  drugComment?: string;
  claimComments?: ServerPrescriptionClaimComment[];
  patientRequested?: boolean;
  numberCode?: string;
  numberCodeSystem?: string;
  numberCodeName?: string;
  lowerFields?: PrescriptionLowerFields;
};

type ServerPrescriptionRp = {
  documentId?: number;
  moduleId?: number;
  rpNumber?: string;
  bundleName?: string;
  medicalClass?: string;
  medicalClassNumber?: string;
  usageCode?: string;
  usageName?: string;
  memo?: string;
  started?: string;
  remark?: string;
  refillCount?: number;
  refillPattern?: PrescriptionRefillPattern;
  doctorComment?: string;
  drugs?: ServerPrescriptionDrug[];
  claimComments?: ServerPrescriptionClaimComment[];
  lowerFields?: PrescriptionLowerFields;
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
  encounterId?: string;
  encounterDate?: string;
  performDate?: string;
  rps?: ServerPrescriptionRp[];
  doctorComments?: ServerPrescriptionDoctorComment[];
  prescriptionSettings?: ServerPrescriptionSetting[];
  remarks?: ServerPrescriptionRemark[];
};

const COMMENT_CODE_PATTERN = /^(008[1-6]|8[1-6]|098|099|98|99)/;
const STRUCTURED_COMMENT_CODE_PATTERN = /^(830|842|8501|8511|8521|831)/;
const RX_RP_META_PREFIX = '__rx_rp_meta__:';
const RX_DRUG_META_PREFIX = '__rx_drug_meta__:';
const RX_CLAIM_LINK_PREFIX = '__rx_claim_target__:';
const RX_RP_CLAIM_LINK_TARGET = '__rp__';
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

const resolvePrescriptionClassCode = (
  category: PrescriptionCategory,
  location: PrescriptionLocation,
  medicalClass?: string | null,
) => medicalClass?.trim() || PRESCRIPTION_CLASS_CODES[category][location];

const resolveGenericFlagState = (value?: boolean | null): PrescriptionGenericFlagState =>
  value === true ? 'yes' : value === false ? 'no' : 'inherit';

function normalizePrescriptionOrder(order: PrescriptionOrder): PrescriptionOrder {
  return {
    ...order,
    patientId: order.patientId.trim(),
    encounterId: order.encounterId?.trim() || undefined,
    encounterDate: order.encounterDate?.trim() || undefined,
    performDate: order.performDate?.trim() || undefined,
    doctorComment: order.doctorComment.trim(),
    deletedDocumentIds: Array.from(new Set((order.deletedDocumentIds ?? []).filter((id) => Number.isInteger(id) && id > 0))),
    prescriptionSettings: (order.prescriptionSettings ?? []).map((setting) => ({
      code: setting.code?.trim() || undefined,
      name: setting.name?.trim() || undefined,
      value: setting.value?.trim() || undefined,
    })),
    remarks: (order.remarks ?? []).map((remark) => ({
      code: remark.code?.trim() || undefined,
      text: remark.text?.trim() || undefined,
    })),
    rps: (order.rps ?? []).map((rp) => cloneRp(rp)),
  };
}

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
  numberCode: undefined,
  numberCodeSystem: undefined,
  numberCodeName: undefined,
  genericChangeAllowed: true,
  isGeneralNamePrescription: undefined,
  drugComment: '',
  claimComments: [],
  patientRequest: true,
});

const hasAnyLowerField = (fields?: PrescriptionLowerFields) => {
  if (!fields) return false;
  return Object.values(fields).some((value) => Boolean(value && value.trim()));
};

const normalizeNumberFields = (fields?: PrescriptionNumberFields): PrescriptionNumberFields | undefined => {
  if (!fields) return undefined;
  const next = {
    numberCode: fields.numberCode?.trim() || undefined,
    numberCodeSystem: fields.numberCodeSystem?.trim() || undefined,
    numberCodeName: fields.numberCodeName?.trim() || undefined,
  } satisfies PrescriptionNumberFields;
  return next.numberCode || next.numberCodeSystem || next.numberCodeName ? next : undefined;
};

const toServerLowerFields = (fields?: PrescriptionLowerFields) =>
  hasAnyLowerField(fields)
    ? {
        lowerDrugCode: fields?.lowerDrugCode,
        lowerUsageCode: fields?.lowerUsageCode,
        lowerClaimCode: fields?.lowerClaimCode,
        lowerRouteCode: fields?.lowerRouteCode,
        lowerTimingCode: fields?.lowerTimingCode,
        lowerClassCode: fields?.lowerClassCode,
      }
    : undefined;

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

export const findFirstPrescriptionClaimCommentCodeIssue = (
  order: PrescriptionOrder,
): PrescriptionClaimCommentCodeIssue | null => {
  for (let rpIndex = 0; rpIndex < order.rps.length; rpIndex += 1) {
    const rp = order.rps[rpIndex];
    const rpClaimComments = normalizeClaimComments(rp.claimComments ?? []);
    for (let commentIndex = 0; commentIndex < rpClaimComments.length; commentIndex += 1) {
      const comment = rpClaimComments[commentIndex];
      if (comment.name.trim() && !comment.code?.trim()) {
        return {
          rpIndex,
          drugIndex: -1,
          commentIndex,
          commentName: comment.name.trim(),
        };
      }
    }
    for (let drugIndex = 0; drugIndex < rp.drugs.length; drugIndex += 1) {
      const drug = rp.drugs[drugIndex];
      const claimComments = normalizeClaimComments(drug.claimComments);
      for (let commentIndex = 0; commentIndex < claimComments.length; commentIndex += 1) {
        const comment = claimComments[commentIndex];
        if (comment.name.trim() && !comment.code?.trim()) {
          return {
            rpIndex,
            drugIndex,
            commentIndex,
            commentName: comment.name.trim(),
          };
        }
      }
    }
  }
  return null;
};

const requiresStructuredClaimCommentValue = (code?: string | null) =>
  STRUCTURED_COMMENT_CODE_PATTERN.test(code?.trim() ?? '');

const findFirstPrescriptionStructuredClaimCommentIssue = (
  order: PrescriptionOrder,
): PrescriptionClaimCommentStructuredValueIssue | null => {
  for (let rpIndex = 0; rpIndex < order.rps.length; rpIndex += 1) {
    const rp = order.rps[rpIndex];
    const rpClaimComments = normalizeClaimComments(rp.claimComments ?? []);
    for (let commentIndex = 0; commentIndex < rpClaimComments.length; commentIndex += 1) {
      const comment = rpClaimComments[commentIndex];
      const code = comment.code?.trim() ?? '';
      if (requiresStructuredClaimCommentValue(code) && !comment.note?.trim()) {
        return { rpIndex, drugIndex: -1, commentIndex, commentCode: code };
      }
    }
    for (let drugIndex = 0; drugIndex < rp.drugs.length; drugIndex += 1) {
      const drug = rp.drugs[drugIndex];
      const claimComments = normalizeClaimComments(drug.claimComments);
      for (let commentIndex = 0; commentIndex < claimComments.length; commentIndex += 1) {
        const comment = claimComments[commentIndex];
        const code = comment.code?.trim() ?? '';
        if (requiresStructuredClaimCommentValue(code) && !comment.note?.trim()) {
          return { rpIndex, drugIndex, commentIndex, commentCode: code };
        }
      }
    }
  }
  return null;
};

const toDrugFromItem = (item: OrderBundleItem): PrescriptionDrug => {
  const parsed = resolveOrcaOrderItemFields(item);
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
    ...(drugMeta?.numberFields ?? {}),
    genericChangeAllowed: true,
    isGeneralNamePrescription:
      drugMeta?.isGeneralNamePrescription ??
      (parsed.genericFlg === 'yes' ? true : parsed.genericFlg === 'no' ? false : undefined),
    drugComment: parsed.userComment?.trim() || '',
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
  const rpClaimComments: PrescriptionClaimComment[] = [];

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
      rpClaimComments.push(comment);
      return;
    }
    drugs.push(toDrugFromItem(item));
  });

  if (drugs.length === 0) {
    drugs.push(buildEmptyDrug());
  }

  const refillCount = rpMeta?.refillCount;

  return {
    rpId: rpMeta?.rpId?.trim() || createStableId('rp'),
    documentId: bundle.documentId,
    moduleId: bundle.moduleId,
    name: bundle.bundleName?.trim() || '',
    medicalClass: bundle.classCode?.trim() || undefined,
    medicalClassNumber: bundle.bundleNumber?.trim() || undefined,
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
    claimComments: normalizeClaimComments(rpClaimComments),
    drugs,
    ...(rpMeta?.lowerFields ?? {}),
  };
};

export const buildEmptyPrescriptionRp = (started?: string, classCode?: string): PrescriptionRp => {
  const classParsed = parsePrescriptionClassCode(classCode);
  return {
    rpId: createStableId('rp'),
    name: '',
    medicalClass: classCode?.trim() || resolvePrescriptionClassCode(classParsed.category, classParsed.location),
    medicalClassNumber: undefined,
    location: classParsed.location,
    category: classParsed.category,
    usage: '',
    usageCode: undefined,
    daysOrTimes: '1',
    remark: '',
    refillCount: undefined,
    refillPattern: 'none',
    doctorComment: '',
    started,
    claimComments: [],
    drugs: [buildEmptyDrug()],
  };
};

export const buildEmptyPrescriptionOrder = (
  patientId: string,
  started?: string,
  encounterId?: string,
): PrescriptionOrder => ({
  patientId,
  encounterId: encounterId?.trim() || undefined,
  encounterDate: started?.slice(0, 10),
  performDate: started?.slice(0, 10),
  doctorComment: '',
  rps: [buildEmptyPrescriptionRp(started)],
  deletedDocumentIds: [],
  prescriptionSettings: [],
  remarks: [],
});

export const toPrescriptionOrder = (
  sourceBundles: OrderBundle[],
  patientId: string,
  encounterId?: string,
): PrescriptionOrder => {
  const medBundles = sourceBundles.filter((bundle) => (bundle.entity?.trim() ?? '') === 'medOrder');
  if (medBundles.length === 0) {
    return buildEmptyPrescriptionOrder(patientId, undefined, encounterId);
  }
  const rps = medBundles.map(toRpFromBundle);
  const startedDates = rps
    .map((rp) => rp.started?.slice(0, 10))
    .filter((value): value is string => Boolean(value));
  const baseDate = startedDates[0];
  return {
    patientId,
    encounterId: encounterId?.trim() || undefined,
    encounterDate: baseDate,
    performDate: baseDate,
    doctorComment: rps.find((rp) => rp.doctorComment.trim())?.doctorComment ?? '',
    rps,
    deletedDocumentIds: [],
    prescriptionSettings: [],
    remarks: [],
  };
};

const toPrescriptionRpFromOperation = (operation: OrderBundleOperation, started?: string): PrescriptionRp =>
  toRpFromBundle({
    documentId: operation.documentId,
    moduleId: operation.moduleId,
    entity: operation.entity ?? 'medOrder',
    bundleName: operation.bundleName,
    bundleNumber: operation.bundleNumber,
    classCode: operation.classCode,
    classCodeSystem: operation.classCodeSystem,
    className: operation.className,
    admin: operation.admin,
    adminCode: operation.adminCode,
    adminCodeSystem: operation.adminCodeSystem,
    adminMemo: operation.adminMemo,
    memo: operation.memo,
    started,
    items: (operation.items ?? []).map((item) => ({
      code: item.code,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      memo: item.memo,
      genericFlg: item.genericFlg,
      userComment: item.userComment,
      rowRole: item.rowRole,
    })),
    bodyPart: operation.bodyPart,
  });

const normalizeRpMeta = (rp: PrescriptionRp, _doctorComment: string): StoredRpMeta => {
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
  const trimmedDoctorComment = rp.doctorComment.trim();
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
    isGeneralNamePrescription: drug.isGeneralNamePrescription,
    patientRequest: drug.patientRequest,
    numberFields: normalizeNumberFields(drug),
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

const toServerClaimComment = (comment: PrescriptionClaimComment): ServerPrescriptionClaimComment => ({
  code: comment.code?.trim() || undefined,
  text: comment.name.trim() || undefined,
  category: undefined,
  note: comment.note?.trim() || undefined,
  lowerFields: toServerLowerFields(comment),
});

const toServerDrug = (drug: PrescriptionDrug): ServerPrescriptionDrug => ({
  code: drug.code?.trim() || undefined,
  name: drug.name.trim() || undefined,
  quantity: drug.quantity.trim() || undefined,
  unit: drug.unit.trim() || undefined,
  memo: undefined,
  genericChangeAllowed: drug.genericChangeAllowed,
  generalNamePrescription: drug.isGeneralNamePrescription,
  drugComment: drug.drugComment.trim() || undefined,
  claimComments: normalizeClaimComments(drug.claimComments).map(toServerClaimComment),
  patientRequested: drug.patientRequest,
  numberCode: drug.numberCode?.trim() || undefined,
  numberCodeSystem: drug.numberCodeSystem?.trim() || undefined,
  numberCodeName: drug.numberCodeName?.trim() || undefined,
  lowerFields: toServerLowerFields(drug),
});

const toServerPrescriptionSetting = (setting: PrescriptionSetting): ServerPrescriptionSetting => ({
  code: setting.code?.trim() || undefined,
  name: setting.name?.trim() || undefined,
  value: setting.value?.trim() || undefined,
});

const toServerPrescriptionRemark = (remark: PrescriptionRemark): ServerPrescriptionRemark => ({
  code: remark.code?.trim() || undefined,
  text: remark.text?.trim() || undefined,
});

const toOrderBundleItems = (rp: PrescriptionRp): OrderBundleItem[] => {
  const items: OrderBundleItem[] = [];
  rp.drugs.forEach((drug, drugIndex) => {
    const code = drug.code?.trim() || undefined;
    const name = drug.name.trim();
    if (!name && !code) return;

    const drugMeta = normalizeDrugMeta(drug);
    const memoText = withJsonMetaLine('', RX_DRUG_META_PREFIX, drugMeta, Boolean(
      drugMeta.isGeneralNamePrescription !== undefined ||
      drugMeta.patientRequest !== undefined ||
      (drugMeta.claimComments && drugMeta.claimComments.length > 0) ||
      hasAnyLowerField(drugMeta.lowerFields),
    ));

    items.push({
      code,
      name,
      quantity: drug.quantity.trim() || '',
      unit: drug.unit.trim() || '',
      memo: memoText,
      genericFlg:
        resolveGenericFlagState(drug.isGeneralNamePrescription) === 'inherit'
          ? undefined
          : resolveGenericFlagState(drug.isGeneralNamePrescription),
      userComment: drug.drugComment.trim() || undefined,
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
  normalizeClaimComments(rp.claimComments ?? []).forEach((comment) => {
    items.push({
      code: comment.code?.trim() || undefined,
      name: comment.name.trim(),
      quantity: '',
      unit: '',
      memo: `${RX_CLAIM_LINK_PREFIX}${RX_RP_CLAIM_LINK_TARGET}`,
    });
  });
  return items;
};

export const buildPrescriptionMutationOperations = (order: PrescriptionOrder): OrderBundleOperation[] => {
  const normalizedOrder = normalizePrescriptionOrder(order);
  const operations: OrderBundleOperation[] = [];
  normalizedOrder.rps.forEach((rp) => {
    const classCode = resolvePrescriptionClassCode(rp.category, rp.location, rp.medicalClass);
    const rpMeta = normalizeRpMeta(rp, normalizedOrder.doctorComment);
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
      bundleNumber: rp.medicalClassNumber?.trim() || rp.daysOrTimes.trim() || '1',
      classCode,
      classCodeSystem: 'Claim007',
      className: undefined,
      admin: rp.usage.trim(),
      adminCode: rp.usageCode?.trim() || undefined,
      adminMemo: rp.usageCode?.trim() || '',
      memo,
      startDate: rp.started,
      items: toOrderBundleItems(rp),
    });
  });

  const deleted = normalizedOrder.deletedDocumentIds;
  deleted.forEach((documentId) => {
    operations.push({
      operation: 'delete',
      documentId,
      entity: 'medOrder',
    });
  });

  return operations;
};

export const buildPrescriptionOrderSendBundles = (order: PrescriptionOrder): OrderBundle[] =>
  normalizePrescriptionOrder(order).rps.map((rp) => {
    const items: OrderBundleItem[] = [];
    rp.drugs.forEach((drug, drugIndex) => {
      const code = drug.code?.trim() || undefined;
      const name = drug.name.trim();
      if (!name && !code) return;
      items.push({
        code,
        name,
      quantity: drug.quantity.trim() || '',
      unit: drug.unit.trim() || '',
      genericFlg:
        resolveGenericFlagState(drug.isGeneralNamePrescription) === 'inherit'
          ? undefined
          : resolveGenericFlagState(drug.isGeneralNamePrescription),
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
    normalizeClaimComments(rp.claimComments ?? []).forEach((comment) => {
      items.push({
        code: comment.code?.trim() || undefined,
        name: comment.name.trim(),
        quantity: '',
        unit: '',
        memo: `${RX_CLAIM_LINK_PREFIX}${RX_RP_CLAIM_LINK_TARGET}`,
      });
    });
    return {
      entity: 'medOrder',
      documentId: rp.documentId,
      moduleId: rp.moduleId,
      bundleName: rp.name.trim() || '処方RP',
      bundleNumber: rp.medicalClassNumber?.trim() || rp.daysOrTimes.trim() || '1',
      classCode: resolvePrescriptionClassCode(rp.category, rp.location, rp.medicalClass),
      classCodeSystem: 'Claim007',
      className: undefined,
      admin: rp.usage.trim(),
      adminCode: rp.usageCode?.trim() || undefined,
      adminMemo: rp.usageCode?.trim() || '',
      memo: undefined,
      started: rp.started,
      items,
    } satisfies OrderBundle;
  });

const buildPrescriptionOrderQuery = (params: { patientId: string; from?: string; encounterId?: string }) => {
  const query = new URLSearchParams();
  query.set('patientId', params.patientId);
  const encounterId = params.encounterId?.trim();
  if (encounterId) {
    query.set('encounterId', encounterId);
  }
  const encounterDate = params.from?.slice(0, 10);
  if (encounterDate) {
    query.set('encounterDate', encounterDate);
  }
  return query.toString();
};

const toServerPrescriptionOrder = (order: PrescriptionOrder): ServerPrescriptionOrder => {
  const normalizedOrder = normalizePrescriptionOrder(order);
  const rps: ServerPrescriptionRp[] = normalizedOrder.rps.map((rp) => ({
    rpNumber: rp.rpId?.trim() || undefined,
    bundleName: rp.name.trim() || undefined,
    medicalClass: resolvePrescriptionClassCode(rp.category, rp.location, rp.medicalClass),
    medicalClassNumber: rp.medicalClassNumber?.trim() || rp.daysOrTimes.trim() || undefined,
    usageCode: rp.usageCode?.trim() || undefined,
    usageName: rp.usage.trim() || undefined,
    memo: undefined,
    started: rp.started?.trim() || undefined,
    remark: rp.remark.trim() || undefined,
    refillCount: rp.refillCount,
    refillPattern: rp.refillPattern,
    doctorComment: rp.doctorComment.trim() || undefined,
    drugs: rp.drugs.map(toServerDrug),
    claimComments: normalizeClaimComments(rp.claimComments ?? []).map(toServerClaimComment),
    lowerFields: toServerLowerFields(rp),
  }));

  const doctorComment = normalizedOrder.doctorComment.trim();
  const startedDates = normalizedOrder.rps
    .map((rp) => rp.started?.slice(0, 10))
    .filter((value): value is string => Boolean(value));

  return {
    patientId: normalizedOrder.patientId,
    encounterId: normalizedOrder.encounterId,
    encounterDate: normalizedOrder.encounterDate ?? startedDates[0],
    performDate: normalizedOrder.performDate ?? startedDates[0],
    rps,
    doctorComments: doctorComment ? [{ text: doctorComment }] : [],
    prescriptionSettings: (normalizedOrder.prescriptionSettings ?? []).map(toServerPrescriptionSetting),
    remarks: (normalizedOrder.remarks ?? []).map(toServerPrescriptionRemark),
  };
};

const fromServerClaimComment = (comment: ServerPrescriptionClaimComment): PrescriptionClaimComment => ({
  id: createStableId('claim'),
  code: comment.code?.trim() || undefined,
  name: comment.text?.trim() || '',
  note: comment.note?.trim() || undefined,
  ...(comment.lowerFields ?? {}),
});

const fromServerDrug = (drug: ServerPrescriptionDrug): PrescriptionDrug => ({
  rowId: createStableId('drug'),
  code: drug.code?.trim() || undefined,
  name: drug.name?.trim() || '',
  quantity: drug.quantity?.trim() || '',
  unit: drug.unit?.trim() || '',
  numberCode: drug.numberCode?.trim() || undefined,
  numberCodeSystem: drug.numberCodeSystem?.trim() || undefined,
  numberCodeName: drug.numberCodeName?.trim() || undefined,
  genericChangeAllowed: drug.genericChangeAllowed ?? true,
  isGeneralNamePrescription: drug.generalNamePrescription == null ? undefined : Boolean(drug.generalNamePrescription),
  drugComment: drug.drugComment?.trim() || '',
  claimComments: (drug.claimComments ?? []).map(fromServerClaimComment).filter((entry) => entry.name.trim()),
  patientRequest: drug.patientRequested ?? true,
  ...(drug.lowerFields ?? {}),
});

const fromServerPrescriptionOrder = (order: ServerPrescriptionOrder, patientId: string): PrescriptionOrder | null => {
  const rps = (order.rps ?? []).map((rp) => {
    const classParsed = parsePrescriptionClassCode(rp.medicalClass);
    const drugs = (rp.drugs ?? []).map(fromServerDrug);
    return {
      rpId: rp.rpNumber?.trim() || createStableId('rp'),
      documentId: undefined,
      moduleId: undefined,
      name: rp.bundleName?.trim() || '',
      medicalClass: rp.medicalClass?.trim() || resolvePrescriptionClassCode(classParsed.category, classParsed.location),
      medicalClassNumber: rp.medicalClassNumber?.trim() || undefined,
      location: classParsed.location,
      category: classParsed.category,
      usage: rp.usageName?.trim() || '',
      usageCode: rp.usageCode?.trim() || undefined,
      daysOrTimes: rp.medicalClassNumber?.trim() || '1',
      remark: rp.remark?.trim() || '',
      refillCount: rp.refillCount === 1 || rp.refillCount === 2 || rp.refillCount === 3 ? rp.refillCount : undefined,
      refillPattern: rp.refillPattern ?? 'none',
      doctorComment: rp.doctorComment?.trim() || '',
      started: rp.started?.trim() || undefined,
      claimComments: (rp.claimComments ?? []).map(fromServerClaimComment).filter((entry) => entry.name.trim()),
      ...(rp.lowerFields ?? {}),
      drugs: drugs.length > 0 ? drugs : [buildEmptyDrug()],
    } satisfies PrescriptionRp;
  });
  if (rps.length === 0) return null;
  const latestDoctorComment = [...(order.doctorComments ?? [])]
    .reverse()
    .find((entry) => Boolean(entry?.text?.trim()))
    ?.text?.trim();
  return {
    patientId,
    encounterId: order.encounterId?.trim() || undefined,
    encounterDate: order.encounterDate,
    performDate: order.performDate,
    doctorComment: latestDoctorComment ?? '',
    rps,
    deletedDocumentIds: [],
    prescriptionSettings: (order.prescriptionSettings ?? []).map((setting) => ({
      code: setting.code?.trim() || undefined,
      name: setting.name?.trim() || undefined,
      value: setting.value?.trim() || undefined,
    })),
    remarks: (order.remarks ?? []).map((remark) => ({
      code: remark.code?.trim() || undefined,
      text: remark.text?.trim() || undefined,
    })),
  };
};

const toSourceBundlesFromServerOrder = (order: ServerPrescriptionOrder): OrderBundle[] => {
  const rps = order.rps ?? [];
  return rps.map((rp, index) => {
    const drugs = (rp.drugs ?? []).flatMap((drug, drugIndex) => {
      const itemMemo = withJsonMetaLine(
        '',
        RX_DRUG_META_PREFIX,
        {
          claimComments: (drug.claimComments ?? []).map((comment) => ({
            code: comment.code?.trim() || undefined,
            name: comment.text?.trim() || '',
            note: comment.note?.trim() || undefined,
            lowerFields: hasAnyLowerField(comment.lowerFields) ? comment.lowerFields : undefined,
          })),
          isGeneralNamePrescription: drug.generalNamePrescription == null ? undefined : Boolean(drug.generalNamePrescription),
          patientRequest: drug.patientRequested ?? true,
          numberFields: normalizeNumberFields({
            numberCode: drug.numberCode,
            numberCodeSystem: drug.numberCodeSystem,
            numberCodeName: drug.numberCodeName,
          }),
          lowerFields: hasAnyLowerField(drug.lowerFields) ? drug.lowerFields : undefined,
        },
        Boolean(
          drug.generalNamePrescription != null ||
          (drug.claimComments?.length ?? 0) > 0 ||
            drug.patientRequested !== undefined ||
            normalizeNumberFields({
              numberCode: drug.numberCode,
              numberCodeSystem: drug.numberCodeSystem,
              numberCodeName: drug.numberCodeName,
            }) ||
            hasAnyLowerField(drug.lowerFields),
        ),
      );
      const mainItem: OrderBundleItem = {
        code: drug.code?.trim() || undefined,
        name: drug.name?.trim() || '',
        quantity: drug.quantity?.trim() || '',
        unit: drug.unit?.trim() || '',
        memo: itemMemo,
        genericFlg: resolveGenericFlagState(drug.generalNamePrescription) === 'inherit'
          ? undefined
          : resolveGenericFlagState(drug.generalNamePrescription),
        userComment: drug.drugComment?.trim() || undefined,
      };
      const commentItems = (drug.claimComments ?? []).map<OrderBundleItem>((comment) => ({
        code: comment.code?.trim() || undefined,
        name: comment.text?.trim() || '',
        quantity: '',
        unit: '',
        memo: `${RX_CLAIM_LINK_PREFIX}${drugIndex}`,
      }));
      return [mainItem, ...commentItems];
    });
    const rpMeta: StoredRpMeta = {
      rpId: rp.rpNumber?.trim() || undefined,
      refillCount:
        rp.refillCount === 1 || rp.refillCount === 2 || rp.refillCount === 3 ? rp.refillCount : undefined,
      refillPattern: rp.refillPattern ?? undefined,
      doctorComment: rp.doctorComment?.trim() || undefined,
      usageCode: rp.usageCode?.trim() || undefined,
      lowerFields: hasAnyLowerField(rp.lowerFields) ? rp.lowerFields : undefined,
    };
    const memoText = withJsonMetaLine(
      rp.remark?.trim() || '',
      RX_RP_META_PREFIX,
      rpMeta,
      Boolean(
        rpMeta.rpId ||
          rpMeta.refillCount ||
          rpMeta.refillPattern ||
          rpMeta.doctorComment ||
          rpMeta.usageCode ||
          hasAnyLowerField(rpMeta.lowerFields),
      ),
    );
    return {
      documentId: rp.documentId,
      moduleId: rp.moduleId,
      entity: 'medOrder',
      bundleName: rp.bundleName?.trim() || `処方RP${index + 1}`,
      bundleNumber: rp.medicalClassNumber?.trim() || rp.rpNumber?.trim() || '1',
      classCode: rp.medicalClass?.trim() || undefined,
      classCodeSystem: 'Claim007',
      className: undefined,
      admin: rp.usageName?.trim() || '',
      adminCode: rp.usageCode?.trim() || undefined,
      adminMemo: rp.usageCode?.trim() || '',
      memo: memoText,
      started: rp.started?.trim() || undefined,
      items: [
        ...(rp.claimComments ?? []).map<OrderBundleItem>((comment) => ({
          code: comment.code?.trim() || undefined,
          name: comment.text?.trim() || '',
          quantity: '',
          unit: '',
          memo: `${RX_CLAIM_LINK_PREFIX}${RX_RP_CLAIM_LINK_TARGET}`,
        })),
        ...drugs,
      ],
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
  encounterId?: string;
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
      order: buildEmptyPrescriptionOrder(params.patientId, params.from, params.encounterId),
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
      order: buildEmptyPrescriptionOrder(params.patientId, params.from, params.encounterId),
      message: parsed.message,
      status: parsed.status,
      errorCode: parsed.errorCode,
      errorKind: parsed.errorKind,
      routeMismatch: parsed.routeMismatch,
    };
  }

  const fetchResponse = parsePrescriptionOrderFetchResponse(parsed.json);
  const sourceBundles = fetchResponse.order ? toSourceBundlesFromServerOrder(fetchResponse.order) : [];
  const firstClassOrder = fetchResponse.order ? fromServerPrescriptionOrder(fetchResponse.order, params.patientId) : null;
  const order = fetchResponse.found
    ? firstClassOrder ?? buildEmptyPrescriptionOrder(params.patientId, params.from, params.encounterId)
    : buildEmptyPrescriptionOrder(params.patientId, params.from, params.encounterId);
  order.encounterId = fetchResponse.order?.encounterId?.trim() || order.encounterId || params.encounterId?.trim() || undefined;
  if (fetchResponse.order?.encounterDate) {
    order.encounterDate = fetchResponse.order.encounterDate;
  }
  if (fetchResponse.order?.performDate) {
    order.performDate = fetchResponse.order.performDate;
  }
  if (fetchResponse.order?.prescriptionSettings) {
    order.prescriptionSettings = fetchResponse.order.prescriptionSettings.map((setting) => ({
      code: setting.code?.trim() || undefined,
      name: setting.name?.trim() || undefined,
      value: setting.value?.trim() || undefined,
    }));
  }
  if (fetchResponse.order?.remarks) {
    order.remarks = fetchResponse.order.remarks.map((remark) => ({
      code: remark.code?.trim() || undefined,
      text: remark.text?.trim() || undefined,
    }));
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
  encounterId?: string;
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
      order: buildEmptyPrescriptionOrder(params.patientId, params.from, params.encounterId),
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
  const normalizedOrder = normalizePrescriptionOrder({
    ...params.order,
    patientId: params.patientId,
  });
  const claimCommentCodeIssue = findFirstPrescriptionClaimCommentCodeIssue(normalizedOrder);
  if (claimCommentCodeIssue) {
    const commentTarget =
      claimCommentCodeIssue.drugIndex >= 0 ? `薬剤${claimCommentCodeIssue.drugIndex + 1}` : 'RPコメント';
    throw new Error(
      `RP${claimCommentCodeIssue.rpIndex + 1} ${commentTarget}: 請求コメントコード未入力のコメントは保存できません。`,
    );
  }
  const claimCommentStructuredValueIssue = findFirstPrescriptionStructuredClaimCommentIssue(normalizedOrder);
  if (claimCommentStructuredValueIssue) {
    const commentTarget =
      claimCommentStructuredValueIssue.drugIndex >= 0
        ? `薬剤${claimCommentStructuredValueIssue.drugIndex + 1}`
        : 'RPコメント';
    throw new Error(
      `RP${claimCommentStructuredValueIssue.rpIndex + 1} ${commentTarget}: ${claimCommentStructuredValueIssue.commentCode} 系コメントの構造化値が未入力のため保存できません。`,
    );
  }
  const usageCodeIssueIndex = normalizedOrder.rps.findIndex(
    (rp) => rp.drugs.some((drug) => drug.name.trim() || drug.code?.trim()) && !rp.usageCode?.trim(),
  );
  if (usageCodeIssueIndex >= 0) {
    throw new Error(`RP${usageCodeIssueIndex + 1}: 用法コード未確定の自由入力は保存できません。候補選択で用法を確定してください。`);
  }
  const payload = toServerPrescriptionOrder(normalizedOrder);
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
  encounterId?: string;
}): Promise<OrderBundleFetchResult> => {
  const result = await fetchPrescriptionOrder(params);
  return {
    ...result,
    bundles: result.sourceBundles,
  };
};

export const mutatePrescriptionOrderBundles = async (params: {
  patientId: string;
  encounterId?: string;
  operations: OrderBundleOperation[];
}): Promise<OrderBundleMutationResult> => {
  const current = await fetchPrescriptionOrder({ patientId: params.patientId, encounterId: params.encounterId });
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

  const nextOrder = normalizePrescriptionOrder(current.order);
  if (!nextOrder.encounterId) {
    nextOrder.encounterId = params.encounterId?.trim() || undefined;
  }
  const isPlaceholderOrder =
    !nextOrder.doctorComment.trim() &&
    nextOrder.deletedDocumentIds.length === 0 &&
    nextOrder.rps.length === 1 &&
    !nextOrder.rps[0]?.name.trim() &&
    !nextOrder.rps[0]?.usage.trim() &&
    !nextOrder.rps[0]?.usageCode?.trim() &&
    nextOrder.rps[0]?.daysOrTimes.trim() === '1' &&
    !nextOrder.rps[0]?.remark.trim() &&
    !nextOrder.rps[0]?.doctorComment.trim() &&
    !nextOrder.rps[0]?.started?.trim() &&
    nextOrder.rps[0]?.drugs.every(
      (drug) =>
        !drug.code?.trim() && !drug.name.trim() && !drug.quantity.trim() && !drug.unit.trim() && !drug.drugComment.trim(),
    );
  const nextRps = isPlaceholderOrder ? [] : [...nextOrder.rps];
  const matchesOperation = (rp: PrescriptionRp, operation: OrderBundleOperation) => {
    if (typeof operation.documentId === 'number' && rp.documentId === operation.documentId) return true;
    if (typeof operation.moduleId === 'number' && rp.moduleId === operation.moduleId) return true;
    const bundleName = operation.bundleName?.trim();
    if (!bundleName || rp.name.trim() !== bundleName) return false;
    const operationClass = operation.classCode?.trim() ?? '';
    const rpClass = resolvePrescriptionClassCode(rp.category, rp.location, rp.medicalClass);
    if (operationClass && operationClass !== rpClass) return false;
    const operationNumber = operation.bundleNumber?.trim() ?? '';
    const rpNumber = rp.medicalClassNumber?.trim() || rp.daysOrTimes.trim();
    if (operationNumber && operationNumber !== rpNumber) return false;
    return true;
  };

  params.operations
    .filter((operation) => (operation.entity?.trim() ?? 'medOrder') === 'medOrder')
    .forEach((operation) => {
      if (operation.operation === 'delete') {
        const targetIndex = nextRps.findIndex((rp) => matchesOperation(rp, operation));
        if (targetIndex >= 0) {
          nextRps.splice(targetIndex, 1);
        }
        if (typeof operation.documentId === 'number' && !nextOrder.deletedDocumentIds.includes(operation.documentId)) {
          nextOrder.deletedDocumentIds = [...nextOrder.deletedDocumentIds, operation.documentId];
        }
        return;
      }

      const started = operation.startDate?.trim() || nextOrder.performDate || nextOrder.encounterDate;
      const nextRp = toPrescriptionRpFromOperation(operation, started);
      const targetIndex = nextRps.findIndex((rp) => matchesOperation(rp, operation));
      if (targetIndex >= 0) {
        nextRps[targetIndex] = {
          ...nextRps[targetIndex],
          ...nextRp,
        };
        return;
      }
      nextRps.push(nextRp);
    });

  nextOrder.rps = nextRps;
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
  note: comment.note?.trim() || undefined,
});

const cloneDrug = (drug: PrescriptionDrug): PrescriptionDrug => ({
  ...drug,
  rowId: drug.rowId || createStableId('drug'),
  code: drug.code?.trim() || undefined,
  name: drug.name.trim(),
  quantity: drug.quantity.trim(),
  unit: drug.unit.trim(),
  ...(normalizeNumberFields(drug) ?? {}),
  genericChangeAllowed: drug.genericChangeAllowed,
  isGeneralNamePrescription: drug.isGeneralNamePrescription,
  drugComment: drug.drugComment.trim(),
  claimComments: normalizeClaimComments(drug.claimComments).map(cloneClaimComment),
  patientRequest: drug.patientRequest,
});

const cloneRp = (rp: PrescriptionRp): PrescriptionRp => ({
  ...rp,
  rpId: rp.rpId || createStableId('rp'),
  documentId: rp.documentId,
  moduleId: rp.moduleId,
  name: rp.name.trim(),
  location: rp.location,
  category: rp.category,
  usage: rp.usage.trim(),
  usageCode: rp.usageCode?.trim() || undefined,
  daysOrTimes: rp.daysOrTimes.trim() || '1',
  remark: rp.remark.trim(),
  refillCount: rp.refillCount === 1 || rp.refillCount === 2 || rp.refillCount === 3 ? rp.refillCount : undefined,
  refillPattern: rp.refillPattern ?? 'none',
  doctorComment: rp.doctorComment.trim(),
  started: rp.started?.trim() || undefined,
  claimComments: normalizeClaimComments(rp.claimComments ?? []).map(cloneClaimComment),
  drugs: rp.drugs.map(cloneDrug),
});

export const importPrescriptionDoInput = (
  baseOrder: PrescriptionOrder,
  source: PrescriptionDoImportSource,
): PrescriptionOrder => {
  const nextBase: PrescriptionOrder = {
    ...baseOrder,
    deletedDocumentIds: [...baseOrder.deletedDocumentIds],
    prescriptionSettings: [...(baseOrder.prescriptionSettings ?? [])],
    remarks: [...(baseOrder.remarks ?? [])],
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
