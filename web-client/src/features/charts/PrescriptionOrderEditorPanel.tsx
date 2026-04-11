import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { FocusTrapDialog } from '../../components/modals/FocusTrapDialog';
import { resolveAriaLive } from '../../libs/observability/observability';
import type { OrderBundleEditPanelMeta, OrderBundleEditPanelRequest, OrderBundleEditingContext } from './OrderBundleEditPanel';
import type { OrderBundle } from './orderBundleApi';
import { fetchOrderMasterSearch, type OrderMasterSearchItem } from './orderMasterSearchApi';
import {
  isOrderBundleCommentCode,
  isUnknownStructuredPrescriptionClaimCommentFamily,
  normalizeStructuredPrescriptionClaimCommentNote,
  resolvePrescriptionStructuredCommentSpec,
  requiresStructuredPrescriptionClaimCommentNote,
  validateStructuredPrescriptionClaimCommentNote,
} from './orcaCommentCarrierRules';
import {
  buildRpRequiredEditorMessage,
  resolveRpRequiredFieldLabel,
  resolveRpRequiredIssue,
  RP_REQUIRED_ERROR_LABEL,
  type RpRequiredField,
} from './orderRpRequirements';
import {
  buildEmptyPrescriptionOrder,
  buildEmptyPrescriptionRp,
  fetchPrescriptionOrder,
  importPrescriptionDoInput,
  savePrescriptionOrder,
  toPrescriptionOrder,
  type PrescriptionCategory,
  type PrescriptionClaimComment,
  type PrescriptionDrug,
  type PrescriptionLocation,
  type PrescriptionOrder,
  type PrescriptionRefillPattern,
  type PrescriptionRp,
} from './prescriptionOrderApi';
import { fetchOrcaGenericPrice, type OrcaGenericPriceResult } from './orcaGenericPriceApi';
import {
  fetchOrcaOrderInputSetDetail,
  fetchOrcaOrderInputSets,
  type OrcaOrderInputSetDetailResult,
  type OrcaOrderInputSetSummary,
} from './orcaOrderInputSetApi';
import { checkOrcaMasterStaticOrderInteractions } from './orcaOrderInteractionApi';

export type PrescriptionSearchMethod = 'prefix' | 'partial';
export type PrescriptionSearchScope = 'outside_adopted' | 'in_hospital_adopted' | 'inside_adopted';

type SaveAction = 'save' | 'expand' | 'expand_continue';

type ClaimDraft = {
  code: string;
  name: string;
  note: string;
};

type ValidationIssue = {
  key: string;
  message: string;
  rpIndex?: number;
  drugIndex?: number;
};

type GenericPriceCacheState = OrcaGenericPriceResult | { loading: true };

export type PrescriptionOrderEditorPanelProps = {
  patientId?: string;
  meta: OrderBundleEditPanelMeta;
  readOnlyPreview?: boolean;
  instanceKey?: string;
  variant?: 'utility' | 'embedded';
  bundlesOverride?: OrderBundle[];
  request?: OrderBundleEditPanelRequest | null;
  onRequestConsumed?: (requestId: string) => void;
  onEditingContextChange?: (state: OrderBundleEditingContext) => void;
  onSubmitResult?: (result: { action: SaveAction; ok: boolean }) => void;
  onDrugCandidateCommit?: (payload: {
    rpIndex: number;
    drugIndex: number;
    candidate: OrderMasterSearchItem;
  }) => void;
  onClose?: () => void;
  active?: boolean;
};

const findRpIndexForBundle = (order: PrescriptionOrder, bundle: OrderBundle, patientId: string, encounterId?: string) => {
  const imported = toPrescriptionOrder([bundle], patientId, encounterId).rps[0];
  if (!imported) return -1;
  return order.rps.findIndex((rp) => {
    if (typeof bundle.documentId === 'number' && typeof rp.documentId === 'number') {
      return rp.documentId === bundle.documentId;
    }
    if (typeof bundle.moduleId === 'number' && typeof rp.moduleId === 'number') {
      return rp.moduleId === bundle.moduleId;
    }
    if (rp.rpId && imported.rpId && rp.rpId === imported.rpId) {
      return true;
    }
    return (
      rp.name.trim() === imported.name.trim() &&
      rp.daysOrTimes.trim() === imported.daysOrTimes.trim() &&
      rp.started === imported.started &&
      rp.location === imported.location &&
      rp.category === imported.category
    );
  });
};

const SEARCH_SCOPE_CATEGORY: Record<PrescriptionSearchScope, string> = {
  outside_adopted: 'outer',
  in_hospital_adopted: 'in-hospital',
  inside_adopted: 'adopted',
};

const SEARCH_SCOPE_LABEL: Record<PrescriptionSearchScope, string> = {
  outside_adopted: '採用薬外',
  in_hospital_adopted: '院内採用',
  inside_adopted: '採用薬内',
};

const CATEGORY_LABEL: Record<PrescriptionCategory, string> = {
  regular: '内服',
  tonyo: '頓服',
  gaiyo: '外用',
};

const LOCATION_LABEL: Record<PrescriptionLocation, string> = {
  in: '院内',
  out: '院外',
};

const REFILL_PATTERN_LABEL: Record<PrescriptionRefillPattern, string> = {
  none: 'なし',
  standard: '通常',
  alternate: '隔日',
};

const CLAIM_COMMENT_TEMPLATES: Array<{ code?: string; name: string }> = [
  { code: '810000001', name: '患者希望' },
  { code: '820100001', name: '後発品不可' },
  { code: '820100002', name: '残薬調整' },
];

const DRUG_COMMENT_TEMPLATES = ['食後服用を指導', '眠気に注意', '残薬確認済み'];

const createClaimComment = (name: string, code?: string, note?: string): PrescriptionClaimComment => ({
  id: `claim-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
  code: code?.trim() || undefined,
  name: name.trim(),
  note: note?.trim() || undefined,
});

const resolveStructuredCommentUiMeta = (code?: string | null) => {
  const spec = resolvePrescriptionStructuredCommentSpec(code);
  if (!spec) return null;
  return {
    placeholder: spec.placeholder,
    hint: spec.hint,
  };
};

const normalizeSearchText = (value: string) => value.replace(/\s+/g, ' ').trim();

const isDrugMatched = (item: OrderMasterSearchItem, keyword: string, method: PrescriptionSearchMethod) => {
  const normalizedKeyword = keyword.toLowerCase();
  const code = item.code?.toLowerCase() ?? '';
  const name = item.name.toLowerCase();
  if (method === 'prefix') {
    return code.startsWith(normalizedKeyword) || name.startsWith(normalizedKeyword);
  }
  return code.includes(normalizedKeyword) || name.includes(normalizedKeyword);
};

const toFullWidthUnits = (char: string) => {
  if (!char) return 0;
  return char.charCodeAt(0) <= 0xff ? 1 : 2;
};

const clampByFullWidth = (value: string, fullWidthLimit: number) => {
  const sanitized = value.replace(/[\r\n]+/g, ' ');
  const maxUnits = fullWidthLimit * 2;
  let used = 0;
  let result = '';
  for (const char of sanitized) {
    const units = toFullWidthUnits(char);
    if (used + units > maxUnits) break;
    result += char;
    used += units;
  }
  return result;
};

const resolveClassCode = (category: PrescriptionCategory, location: PrescriptionLocation) => {
  if (category === 'regular') return location === 'out' ? '212' : '211';
  if (category === 'tonyo') return location === 'out' ? '222' : '221';
  return location === 'out' ? '232' : '231';
};

const toRpFromRecommendation = (
  candidate: NonNullable<Extract<OrderBundleEditPanelRequest, { kind: 'recommendation' }>['candidate']>,
): PrescriptionRp => {
  const template = candidate.template;
  const rp = buildEmptyPrescriptionRp();
  const mainDrugs: PrescriptionDrug[] = template.items.map((item) => ({
    rowId: `drug-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    code: item.code?.trim() || undefined,
    name: item.name,
    quantity: item.quantity?.trim() || '',
    unit: item.unit?.trim() || '',
    genericChangeAllowed: true,
    isGeneralNamePrescription: false,
    drugComment: '',
    claimComments: [],
    patientRequest: true,
  }));
  if (mainDrugs.length === 0) {
    mainDrugs.push({
      rowId: `drug-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      code: undefined,
      name: '',
      quantity: '',
      unit: '',
      genericChangeAllowed: true,
      isGeneralNamePrescription: false,
      drugComment: '',
      claimComments: [],
      patientRequest: true,
    });
  }
  template.commentItems.forEach((comment) => {
    if (!comment.name.trim()) return;
    rp.claimComments = [...(rp.claimComments ?? []), createClaimComment(comment.name, comment.code)];
  });

  return {
    ...rp,
    name: template.bundleName,
    usage: template.admin,
    daysOrTimes: template.bundleNumber || '1',
    drugs: mainDrugs,
  };
};

const mergeRpRequired = (order: PrescriptionOrder): { issue: ReturnType<typeof resolveRpRequiredIssue>; missing: RpRequiredField[] } => {
  for (const rp of order.rps) {
    const issue = resolveRpRequiredIssue({
      entity: 'medOrder',
      bundleName: rp.name,
      classCode: resolveClassCode(rp.category, rp.location),
      bundleNumber: rp.daysOrTimes,
      items: rp.drugs.map((drug) => ({
        code: drug.code,
        name: drug.name,
        quantity: drug.quantity,
        unit: drug.unit,
        memo: '',
      })),
    });
    if (issue) {
      return {
        issue,
        missing: issue.missing,
      };
    }
  }
  return { issue: null, missing: [] };
};

const isOrcaDrugCode = (value?: string | null) => /^\d{9}$/.test((value ?? '').trim());

const genericPriceCacheKey = (code: string, effective: string) => `${code}:${effective}`;

const toRpFromInputSetDetail = (
  detail: NonNullable<OrcaOrderInputSetDetailResult['bundle']>,
  started: string,
): PrescriptionRp => {
  const claimComments: PrescriptionClaimComment[] = [];
  const drugs: PrescriptionDrug[] = detail.items
    .filter((item) => Boolean(item.code?.trim() || item.name?.trim()))
    .flatMap((item) => {
      const code = item.code?.trim() || undefined;
      const name = item.name?.trim() ?? '';
      if (code && isOrderBundleCommentCode(code) && name) {
        claimComments.push(createClaimComment(name, code, item.memo));
        return [];
      }
      return [{
        rowId: `drug-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        code,
        name,
        quantity: item.quantity?.trim() ?? '',
        unit: item.unit?.trim() ?? '',
        genericChangeAllowed: true,
        isGeneralNamePrescription: false,
        drugComment: item.memo?.trim() ?? '',
        claimComments: [] as PrescriptionClaimComment[],
        patientRequest: true,
      }];
    });
  return {
    ...buildEmptyPrescriptionRp(detail.started ?? started, detail.classCode),
    name: detail.bundleName ?? '',
    usage: detail.admin ?? '',
    usageCode: detail.adminCode?.trim() || undefined,
    daysOrTimes: detail.bundleNumber ?? '1',
    remark: detail.memo?.trim() ?? '',
    claimComments,
    drugs:
      drugs.length > 0
        ? drugs
        : [
            {
              rowId: `drug-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
              code: undefined,
              name: '',
              quantity: '',
              unit: '',
              genericChangeAllowed: true,
              isGeneralNamePrescription: false,
              drugComment: '',
              claimComments: [],
              patientRequest: true,
            },
          ],
  };
};

export function PrescriptionOrderEditorPanel({
  patientId,
  meta,
  readOnlyPreview = false,
  instanceKey,
  variant = 'embedded',
  bundlesOverride,
  request,
  onRequestConsumed,
  onEditingContextChange,
  onSubmitResult,
  onDrugCandidateCommit,
  onClose,
  active = true,
}: PrescriptionOrderEditorPanelProps) {
  const queryClient = useQueryClient();
  const idPrefix = useMemo(() => {
    const raw = instanceKey?.trim();
    if (!raw) return 'rx';
    const safeKey = raw.replace(/[^A-Za-z0-9_-]/g, '-');
    if (!safeKey) return 'rx';
    return `rx-${safeKey}`;
  }, [instanceKey]);
  const domId = useCallback((suffix: string) => `${idPrefix}-${suffix}`, [idPrefix]);
  const isPreviewMode = readOnlyPreview;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [order, setOrder] = useState<PrescriptionOrder>(() =>
    buildEmptyPrescriptionOrder(patientId ?? '', today, meta.encounterId),
  );
  const [selectedRpIndex, setSelectedRpIndex] = useState(0);
  const [selectedDrugIndex, setSelectedDrugIndex] = useState(0);
  const [bulkDaysValue, setBulkDaysValue] = useState('');
  const [claimDraft, setClaimDraft] = useState<ClaimDraft>({ code: '', name: '', note: '' });
  const [rpClaimDraft, setRpClaimDraft] = useState<ClaimDraft>({ code: '', name: '', note: '' });
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchMethod, setSearchMethod] = useState<PrescriptionSearchMethod>('prefix');
  const [searchScope, setSearchScope] = useState<PrescriptionSearchScope>('outside_adopted');
  const [manualSearchNonce, setManualSearchNonce] = useState(0);
  const [notice, setNotice] = useState<{ tone: 'info' | 'success' | 'warning' | 'error'; message: string } | null>(null);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [genericPriceCache, setGenericPriceCache] = useState<Record<string, GenericPriceCacheState>>({});
  const [inputSetKeyword, setInputSetKeyword] = useState('');
  const [inputSetLoading, setInputSetLoading] = useState(false);
  const [inputSetItems, setInputSetItems] = useState<OrcaOrderInputSetSummary[]>([]);
  const [interactionConfirmOpen, setInteractionConfirmOpen] = useState(false);
  const [interactionPairs, setInteractionPairs] = useState<Array<{
    code1: string;
    code2: string;
    interactionName?: string;
    message?: string;
  }>>([]);
  const [pendingSaveAction, setPendingSaveAction] = useState<SaveAction | null>(null);
  const pendingEditBundleRef = useRef<OrderBundle | null>(null);

  const canFetchFromServer = Boolean(patientId) && !bundlesOverride && active;
  const sourceBundleQuery = useQuery({
    queryKey: ['charts-prescription-order-editor-source', patientId, meta.visitDate ?? today, meta.encounterId ?? 'none'],
    queryFn: () => {
      if (!patientId) throw new Error('patientId is required');
      return fetchPrescriptionOrder({
        patientId,
        from: (meta.visitDate ?? today).slice(0, 10),
        encounterId: meta.encounterId,
      });
    },
    enabled: canFetchFromServer,
    staleTime: 30_000,
  });

  const overrideOrder = useMemo(() => {
    if (!bundlesOverride || !patientId) return null;
    const medBundles = bundlesOverride.filter((bundle) => (bundle.entity?.trim() ?? '') === 'medOrder');
    if (medBundles.length === 0) return null;
    return toPrescriptionOrder(medBundles, patientId, meta.encounterId);
  }, [bundlesOverride, meta.encounterId, patientId]);
  const sourceOrder = overrideOrder ?? sourceBundleQuery.data?.order ?? null;

  const sourceSignature = useMemo(() => {
    if (!sourceOrder) return sourceBundleQuery.isSuccess ? 'empty' : 'pending';
    const order = sourceOrder;
    if (order.rps.length === 0) return 'empty';
    return [order.encounterId ?? 'none']
      .concat(
        order.rps.map((rp) => `${rp.documentId ?? 'none'}:${rp.moduleId ?? 'none'}:${rp.started ?? 'none'}:${rp.rpId}`),
      )
      .join('|');
  }, [sourceBundleQuery.isSuccess, sourceOrder]);

  const lastSourceSignatureRef = useRef<string>('');
  useEffect(() => {
    if (!patientId) return;
    if (sourceSignature === lastSourceSignatureRef.current) return;
    lastSourceSignatureRef.current = sourceSignature;
    if (!sourceOrder || sourceOrder.rps.length === 0) {
      setOrder(buildEmptyPrescriptionOrder(patientId, today, meta.encounterId));
      setSelectedRpIndex(0);
      setSelectedDrugIndex(0);
      return;
    }
    setOrder(sourceOrder);
    const pendingEditBundle = pendingEditBundleRef.current;
    const nextRpIndex =
      pendingEditBundle != null ? findRpIndexForBundle(sourceOrder, pendingEditBundle, patientId, meta.encounterId) : -1;
    setSelectedRpIndex(nextRpIndex >= 0 ? nextRpIndex : 0);
    setSelectedDrugIndex(0);
    if (nextRpIndex >= 0) {
      pendingEditBundleRef.current = null;
    }
  }, [meta.encounterId, patientId, sourceOrder, sourceSignature, today]);

  const lastRequestIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!request || !patientId) return;
    if (request.requestId === lastRequestIdRef.current) return;
    lastRequestIdRef.current = request.requestId;
    if (isPreviewMode) {
      onRequestConsumed?.(request.requestId);
      return;
    }

    if (request.kind === 'new') {
      pendingEditBundleRef.current = null;
      setOrder(buildEmptyPrescriptionOrder(patientId, today, meta.encounterId));
      setSelectedRpIndex(0);
      setSelectedDrugIndex(0);
      setNotice(null);
      setValidationIssues([]);
      onRequestConsumed?.(request.requestId);
      return;
    }

    if (request.kind === 'edit') {
      pendingEditBundleRef.current = request.bundle;
      const sourceRpIndex =
        sourceOrder != null ? findRpIndexForBundle(sourceOrder, request.bundle, patientId, meta.encounterId) : -1;
      if (sourceOrder && sourceRpIndex >= 0) {
        setOrder(sourceOrder);
        setSelectedRpIndex(sourceRpIndex);
        setSelectedDrugIndex(0);
        pendingEditBundleRef.current = null;
        setNotice(null);
        setValidationIssues([]);
        onRequestConsumed?.(request.requestId);
        return;
      }
      if (canFetchFromServer) {
        setNotice(
          sourceOrder
            ? { tone: 'warning', message: '選択した処方セットを現在 encounter の first-class order から解決できませんでした。再取得後に再選択してください。' }
            : null,
        );
        setValidationIssues([]);
        onRequestConsumed?.(request.requestId);
        return;
      }

      const imported = toPrescriptionOrder([request.bundle], patientId, meta.encounterId).rps[0] ?? buildEmptyPrescriptionRp(today);
      setOrder((prev) => {
        const next = { ...prev, rps: [...prev.rps] };
        const targetIndex = next.rps.findIndex((rp) => {
          if (request.bundle.documentId && rp.documentId) {
            return rp.documentId === request.bundle.documentId;
          }
          if (imported.rpId && rp.rpId) {
            return rp.rpId === imported.rpId;
          }
          return false;
        });
        if (targetIndex >= 0) {
          next.rps[targetIndex] = imported;
          setSelectedRpIndex(targetIndex);
          setSelectedDrugIndex(0);
          return next;
        }
        next.rps = [...next.rps, imported];
        setSelectedRpIndex(next.rps.length - 1);
        setSelectedDrugIndex(0);
        return next;
      });
      setNotice(null);
      setValidationIssues([]);
      onRequestConsumed?.(request.requestId);
      return;
    }

    if (request.kind === 'copy') {
      setOrder((prev) => importPrescriptionDoInput(prev, { type: 'bundle', bundle: request.bundle }));
      setSelectedRpIndex((prev) => prev + 1);
      setSelectedDrugIndex(0);
      setNotice({ tone: 'info', message: 'Do入力をマージしました。' });
      setValidationIssues([]);
      onRequestConsumed?.(request.requestId);
      return;
    }

    if (request.kind === 'recommendation') {
      setOrder((prev) => ({
        ...prev,
        rps: [...prev.rps, toRpFromRecommendation(request.candidate)],
      }));
      setSelectedRpIndex((prev) => prev + 1);
      setSelectedDrugIndex(0);
      setNotice({ tone: 'info', message: '推薦候補を追加しました。' });
      setValidationIssues([]);
      onRequestConsumed?.(request.requestId);
    }
  }, [isPreviewMode, onRequestConsumed, patientId, request, today]);

  const selectedRp = order.rps[selectedRpIndex] ?? null;
  const selectedDrug = selectedRp?.drugs[selectedDrugIndex] ?? null;

  const rpRequired = useMemo(() => mergeRpRequired(order), [order]);
  useEffect(() => {
    const hasExtraValidationIssue = validationIssues.some((issue) => issue.key.startsWith('drug_rule_'));
    onEditingContextChange?.({
      hasRpRequiredIssue: Boolean(rpRequired.issue) || hasExtraValidationIssue,
      rpRequiredMissing: rpRequired.missing,
    });
  }, [onEditingContextChange, rpRequired.issue, rpRequired.missing, validationIssues]);

  useEffect(
    () => () => {
      onEditingContextChange?.({ hasRpRequiredIssue: false, rpRequiredMissing: [] });
    },
    [onEditingContextChange],
  );

  const updateRp = useCallback((rpIndex: number, updater: (rp: PrescriptionRp) => PrescriptionRp) => {
    setOrder((prev) => {
      if (!prev.rps[rpIndex]) return prev;
      const nextRps = [...prev.rps];
      nextRps[rpIndex] = updater(nextRps[rpIndex]);
      return {
        ...prev,
        rps: nextRps,
      };
    });
  }, []);

  const updateDrug = useCallback(
    (rpIndex: number, drugIndex: number, updater: (drug: PrescriptionDrug) => PrescriptionDrug) => {
      updateRp(rpIndex, (rp) => {
        if (!rp.drugs[drugIndex]) return rp;
        const nextDrugs = [...rp.drugs];
        nextDrugs[drugIndex] = updater(nextDrugs[drugIndex]);
        return {
          ...rp,
          drugs: nextDrugs,
        };
      });
    },
    [updateRp],
  );

  const buildStructuredClaimCommentIssue = useCallback((comment: PrescriptionClaimComment) => {
    const code = comment.code?.trim() ?? '';
    if (!code) return null;
    if (isUnknownStructuredPrescriptionClaimCommentFamily(code)) {
      return `${code} 系コメント family は未対応のため保存できません。`;
    }
    if (requiresStructuredPrescriptionClaimCommentNote(code) && !comment.note?.trim()) {
      return `${code} 系コメントは補足値が必須です。`;
    }
    const formatIssue = validateStructuredPrescriptionClaimCommentNote(code, comment.note);
    if (formatIssue) {
      return `${code} 系コメント: ${formatIssue}`;
    }
    return null;
  }, []);

  const addRp = () => {
    if (isPreviewMode) return;
    setOrder((prev) => ({
      ...prev,
      rps: [...prev.rps, buildEmptyPrescriptionRp(today)],
    }));
    setSelectedRpIndex(order.rps.length);
    setSelectedDrugIndex(0);
  };

  const removeRp = (rpIndex: number) => {
    if (isPreviewMode) return;
    setOrder((prev) => {
      const target = prev.rps[rpIndex];
      if (!target) return prev;
      const nextRps = prev.rps.filter((_, index) => index !== rpIndex);
      const deletedDocumentIds =
        typeof target.documentId === 'number' && target.documentId > 0
          ? Array.from(new Set([...prev.deletedDocumentIds, target.documentId]))
          : prev.deletedDocumentIds;
      return {
        ...prev,
        rps: nextRps.length > 0 ? nextRps : [buildEmptyPrescriptionRp(today)],
        deletedDocumentIds,
      };
    });
    setSelectedRpIndex((prev) => Math.max(0, Math.min(prev, order.rps.length - 2)));
    setSelectedDrugIndex(0);
  };

  const clearAll = () => {
    if (isPreviewMode) return;
    setOrder((prev) => {
      const deletions = prev.rps
        .map((rp) => rp.documentId)
        .filter((id): id is number => typeof id === 'number' && id > 0);
      return {
        ...buildEmptyPrescriptionOrder(prev.patientId || patientId || '', today),
        deletedDocumentIds: Array.from(new Set([...prev.deletedDocumentIds, ...deletions])),
      };
    });
    setSelectedRpIndex(0);
    setSelectedDrugIndex(0);
  };

  const addDrug = () => {
    if (isPreviewMode) return;
    if (!selectedRp) return;
    updateRp(selectedRpIndex, (rp) => ({
      ...rp,
      drugs: [
        ...rp.drugs,
        {
          rowId: `drug-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          code: undefined,
          name: '',
          quantity: '',
          unit: '',
          genericChangeAllowed: true,
          isGeneralNamePrescription: false,
          drugComment: '',
          claimComments: [],
          patientRequest: true,
        },
      ],
    }));
    setSelectedDrugIndex(selectedRp.drugs.length);
  };

  const removeDrug = (rpIndex: number, drugIndex: number) => {
    if (isPreviewMode) return;
    updateRp(rpIndex, (rp) => {
      if (rp.drugs.length <= 1) {
        return {
          ...rp,
          drugs: [
            {
              rowId: `drug-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
              code: undefined,
              name: '',
              quantity: '',
              unit: '',
              genericChangeAllowed: true,
              isGeneralNamePrescription: false,
              drugComment: '',
              claimComments: [],
              patientRequest: true,
            },
          ],
        };
      }
      return {
        ...rp,
        drugs: rp.drugs.filter((_, index) => index !== drugIndex),
      };
    });
    setSelectedDrugIndex((prev) => Math.max(0, prev - 1));
  };

  const applyClaimDraft = useCallback(() => {
    if (isPreviewMode) return;
    if (!selectedRp || !selectedDrug) return;
    const code = claimDraft.code.trim();
    const name = claimDraft.name.trim();
    if (!name) return;
    if (!code) {
      setNotice({ tone: 'error', message: '請求コメントはコード付きで追加してください。自由文は薬剤コメントへ入力してください。' });
      return;
    }
    const normalizedNote = normalizeStructuredPrescriptionClaimCommentNote(code, claimDraft.note);
    const comment = createClaimComment(name, code, normalizedNote ?? claimDraft.note);
    const issue = buildStructuredClaimCommentIssue(comment);
    if (issue) {
      setNotice({ tone: 'error', message: issue });
      return;
    }
    updateDrug(selectedRpIndex, selectedDrugIndex, (drug) => ({
      ...drug,
      claimComments: [...drug.claimComments, comment],
    }));
    setClaimDraft({ code: '', name: '', note: '' });
  }, [
    buildStructuredClaimCommentIssue,
    claimDraft.code,
    claimDraft.name,
    claimDraft.note,
    isPreviewMode,
    selectedDrug,
    selectedDrugIndex,
    selectedRp,
    selectedRpIndex,
    updateDrug,
  ]);

  const applyRpClaimDraft = useCallback(() => {
    if (isPreviewMode) return;
    if (!selectedRp) return;
    const code = rpClaimDraft.code.trim();
    const name = rpClaimDraft.name.trim();
    if (!name) return;
    if (!code) {
      setNotice({ tone: 'error', message: 'RP請求コメントはコード付きで追加してください。自由文は備考へ入力してください。' });
      return;
    }
    const normalizedNote = normalizeStructuredPrescriptionClaimCommentNote(code, rpClaimDraft.note);
    const comment = createClaimComment(name, code, normalizedNote ?? rpClaimDraft.note);
    const issue = buildStructuredClaimCommentIssue(comment);
    if (issue) {
      setNotice({ tone: 'error', message: issue });
      return;
    }
    updateRp(selectedRpIndex, (rp) => ({
      ...rp,
      claimComments: [...(rp.claimComments ?? []), comment],
    }));
    setRpClaimDraft({ code: '', name: '', note: '' });
  }, [
    buildStructuredClaimCommentIssue,
    isPreviewMode,
    rpClaimDraft.code,
    rpClaimDraft.name,
    rpClaimDraft.note,
    selectedRp,
    selectedRpIndex,
    updateRp,
  ]);

  const trimmedSearchKeyword = normalizeSearchText(searchKeyword);
  const searchEffectiveDate = (meta.visitDate ?? today).slice(0, 10);
  const shouldAutoSearch = trimmedSearchKeyword.length >= 3;
  const shouldManualSearch = trimmedSearchKeyword.length > 0 && trimmedSearchKeyword.length <= 2;
  const shouldRunSearch = active && Boolean(patientId) && (shouldAutoSearch || manualSearchNonce > 0);

  const drugSearchQuery = useQuery({
    queryKey: [
      'charts-prescription-drug-search-v2',
      trimmedSearchKeyword,
      searchScope,
      searchMethod,
      searchEffectiveDate,
      manualSearchNonce,
    ],
    queryFn: () =>
      fetchOrderMasterSearch({
        type: 'drug',
        keyword: trimmedSearchKeyword,
        method: searchMethod,
        scope: SEARCH_SCOPE_CATEGORY[searchScope],
        effective: searchEffectiveDate,
        asOf: searchEffectiveDate,
      }),
    enabled: shouldRunSearch,
    staleTime: 15_000,
  });

  const filteredCandidates = useMemo(() => {
    const items = drugSearchQuery.data?.items ?? [];
    if (!trimmedSearchKeyword) return [];
    return items
      .filter((item) => isDrugMatched(item, trimmedSearchKeyword, searchMethod))
      .slice(0, 40);
  }, [drugSearchQuery.data?.items, searchMethod, trimmedSearchKeyword]);

  const ensureGenericPrice = useCallback(
    async (code?: string | null) => {
      const normalizedCode = code?.trim() ?? '';
      if (!isOrcaDrugCode(normalizedCode)) return;
      const key = genericPriceCacheKey(normalizedCode, searchEffectiveDate);
      if (genericPriceCache[key]) return;
      setGenericPriceCache((prev) => {
        if (prev[key]) return prev;
        return { ...prev, [key]: { loading: true } };
      });
      try {
        const result = await fetchOrcaGenericPrice({ srycd: normalizedCode, effective: searchEffectiveDate });
        setGenericPriceCache((prev) => ({ ...prev, [key]: result }));
      } catch (error) {
        setGenericPriceCache((prev) => ({
          ...prev,
          [key]: {
            ok: false,
            status: 0,
            message: error instanceof Error ? error.message : '最低薬価の取得に失敗しました。',
          },
        }));
      }
    },
    [genericPriceCache, searchEffectiveDate],
  );

  useEffect(() => {
    filteredCandidates.forEach((item) => {
      if (typeof item.points === 'number') return;
      void ensureGenericPrice(item.code);
    });
    if (selectedDrug?.code) {
      void ensureGenericPrice(selectedDrug.code);
    }
  }, [ensureGenericPrice, filteredCandidates, selectedDrug?.code]);

  const resolveCandidateGenericPrice = useCallback(
    (item: OrderMasterSearchItem) => {
      if (typeof item.points === 'number') return String(item.points);
      const code = item.code?.trim() ?? '';
      if (!isOrcaDrugCode(code)) return '-';
      const cached = genericPriceCache[genericPriceCacheKey(code, searchEffectiveDate)];
      if (!cached) return '-';
      if ('loading' in cached) return '…';
      return cached.ok && typeof cached.item?.minPrice === 'number' ? String(cached.item.minPrice) : '-';
    },
    [genericPriceCache, searchEffectiveDate],
  );

  const selectedDrugGenericPrice = useMemo(() => {
    const code = selectedDrug?.code?.trim() ?? '';
    if (!isOrcaDrugCode(code)) return null;
    const cached = genericPriceCache[genericPriceCacheKey(code, searchEffectiveDate)];
    if (!cached) return '-';
    if ('loading' in cached) return '…';
    if (!cached.ok) return '-';
    return typeof cached.item?.minPrice === 'number' ? String(cached.item.minPrice) : '-';
  }, [genericPriceCache, searchEffectiveDate, selectedDrug?.code]);

  const usageMasterQuery = useQuery({
    queryKey: ['charts-prescription-usage-master-v2', meta.visitDate ?? today],
    queryFn: () =>
      fetchOrderMasterSearch({
        type: 'youhou',
        keyword: '',
        allowEmpty: true,
        effective: (meta.visitDate ?? today).slice(0, 10),
      }),
    enabled: active && Boolean(patientId),
    staleTime: 60_000,
  });

  const usageOptions = usageMasterQuery.data?.items ?? [];

  const applyDrugCandidate = (candidate: OrderMasterSearchItem) => {
    if (isPreviewMode) return;
    if (!selectedRp || !selectedDrug) return;
    updateDrug(selectedRpIndex, selectedDrugIndex, (drug) => ({
      ...drug,
      code: candidate.code?.trim() || undefined,
      name: candidate.name,
      unit: candidate.unit?.trim() || drug.unit,
    }));
    onDrugCandidateCommit?.({
      rpIndex: selectedRpIndex,
      drugIndex: selectedDrugIndex,
      candidate,
    });
  };

  const handleInputSetSearch = useCallback(async () => {
    const keyword = inputSetKeyword.trim();
    if (!keyword || inputSetLoading) return;
    setInputSetLoading(true);
    try {
      const result = await fetchOrcaOrderInputSets({
        keyword,
        entity: 'medOrder',
        effective: searchEffectiveDate,
        page: 1,
        size: 20,
      });
      if (!result.ok) {
        setInputSetItems([]);
        setNotice({ tone: 'error', message: result.message ?? '入力セット検索に失敗しました。' });
        return;
      }
      const sorted = [...result.items].sort((left, right) => {
        const leftScore = left.entity === 'medOrder' ? 0 : left.entity == null ? 1 : 2;
        const rightScore = right.entity === 'medOrder' ? 0 : right.entity == null ? 1 : 2;
        if (leftScore !== rightScore) return leftScore - rightScore;
        return (left.setCode ?? '').localeCompare(right.setCode ?? '');
      });
      setInputSetItems(sorted.slice(0, 20));
    } finally {
      setInputSetLoading(false);
    }
  }, [inputSetKeyword, inputSetLoading, searchEffectiveDate]);

  const applyInputSet = useCallback(
    async (item: OrcaOrderInputSetSummary) => {
      const setCode = item.setCode?.trim();
      if (!setCode || isPreviewMode) return;
      const detail = await fetchOrcaOrderInputSetDetail({
        setCode,
        entity: item.entity ?? 'medOrder',
        effective: searchEffectiveDate,
      });
      if (!detail.ok || !detail.bundle) {
        setNotice({ tone: 'error', message: detail.message ?? '入力セット詳細の取得に失敗しました。' });
        return;
      }
      if (detail.bundle.entity !== 'medOrder') {
        setNotice({ tone: 'warning', message: 'medOrder 以外の入力セットは処方へ反映できません。' });
        return;
      }
      const nextRp = toRpFromInputSetDetail(detail.bundle, today);
      setOrder((prev) => ({
        ...prev,
        rps: [...prev.rps, nextRp],
      }));
      setSelectedRpIndex(order.rps.length);
      setSelectedDrugIndex(0);
      setNotice({ tone: 'success', message: 'ORCA入力セットを RP に反映しました。' });
    },
    [isPreviewMode, order.rps.length, searchEffectiveDate, today],
  );

  const extractInteractionCodes = useCallback(() => {
    return Array.from(
      new Set(
        order.rps
          .flatMap((rp) => rp.drugs.map((drug) => drug.code?.trim() ?? ''))
          .filter((code) => isOrcaDrugCode(code)),
      ),
    );
  }, [order.rps]);

  const closeInteractionConfirm = useCallback(() => {
    setInteractionConfirmOpen(false);
    setPendingSaveAction(null);
  }, []);

  const validate = (): ValidationIssue[] => {
    const issues: ValidationIssue[] = [];
    order.rps.forEach((rp, rpIndex) => {
      if (!rp.drugs.some((drug) => drug.name.trim() || drug.code?.trim())) {
        issues.push({
          key: `rp_items_${rpIndex}`,
          message: `RP${rpIndex + 1} に薬剤を1件以上入力してください。`,
          rpIndex,
        });
      }
      if ((rp.claimComments ?? []).some((comment) => !comment.code?.trim())) {
        issues.push({
          key: `rp_rule_claim_${rpIndex}`,
          message: `RP${rpIndex + 1}: RP請求コメントはコード付きのみ保存できます。自由文は備考へ入力してください。`,
          rpIndex,
        });
      }
      (rp.claimComments ?? []).forEach((comment, commentIndex) => {
        const issue = buildStructuredClaimCommentIssue(comment);
        if (!issue) return;
        issues.push({
          key: `rp_structured_claim_${rpIndex}_${commentIndex}`,
          message: `RP${rpIndex + 1} RPコメント${commentIndex + 1}: ${issue}`,
          rpIndex,
        });
      });
      rp.drugs.forEach((drug, drugIndex) => {
        if (drug.patientRequest) return;
        if (drug.genericChangeAllowed) {
          issues.push({
            key: `drug_rule_generic_${rpIndex}_${drugIndex}`,
            message: `RP${rpIndex + 1} 薬剤${drugIndex + 1}: 患者希望以外は「変更不可」が必須です。`,
            rpIndex,
            drugIndex,
          });
        }
        if (drug.claimComments.length === 0) {
          issues.push({
            key: `drug_rule_claim_${rpIndex}_${drugIndex}`,
            message: `RP${rpIndex + 1} 薬剤${drugIndex + 1}: 患者希望以外は請求用コメントが必須です。`,
            rpIndex,
            drugIndex,
          });
        }
        if (drug.claimComments.some((comment) => !comment.code?.trim())) {
          issues.push({
            key: `drug_rule_claim_${rpIndex}_${drugIndex}`,
            message: `RP${rpIndex + 1} 薬剤${drugIndex + 1}: 請求コメントはコード付きのみ保存できます。自由文は薬剤コメントへ入力してください。`,
            rpIndex,
            drugIndex,
          });
        }
        drug.claimComments.forEach((comment, commentIndex) => {
          const issue = buildStructuredClaimCommentIssue(comment);
          if (!issue) return;
          issues.push({
            key: `drug_structured_claim_${rpIndex}_${drugIndex}_${commentIndex}`,
            message: `RP${rpIndex + 1} 薬剤${drugIndex + 1} コメント${commentIndex + 1}: ${issue}`,
            rpIndex,
            drugIndex,
          });
        });
      });
      if (rp.refillCount && ![1, 2, 3].includes(rp.refillCount)) {
        issues.push({
          key: `rp_refill_${rpIndex}`,
          message: `RP${rpIndex + 1}: リフィル回数は1〜3回で指定してください。`,
          rpIndex,
        });
      }
    });

    if (rpRequired.issue) {
      issues.push({
        key: 'rp_required',
        message: buildRpRequiredEditorMessage(rpRequired.issue),
      });
    }

    return issues;
  };

  const mutation = useMutation({
    mutationFn: async (payload: { action: SaveAction; order: PrescriptionOrder }) => {
      if (isPreviewMode) throw new Error('preview mode');
      if (!patientId) throw new Error('patientId is required');
      const result = await savePrescriptionOrder({
        patientId,
        order: {
          ...payload.order,
          encounterId: payload.order.encounterId ?? meta.encounterId,
        },
      });
      return { result, action: payload.action };
    },
    onSuccess: ({ result, action }) => {
      const ok = Boolean(result.ok);
      setNotice({
        tone: ok ? 'success' : 'error',
        message: ok ? '処方オーダーを保存しました。' : result.message ?? '処方オーダーの保存に失敗しました。',
      });
      onSubmitResult?.({ action, ok });
      if (ok) {
        queryClient.invalidateQueries({ queryKey: ['charts-order-bundles'] });
        queryClient.invalidateQueries({ queryKey: ['charts-prescription-bundles'] });
        queryClient.invalidateQueries({
          queryKey: ['charts-prescription-order-editor-source', patientId, meta.visitDate ?? today, meta.encounterId ?? 'none'],
        });
        setOrder((prev) => ({ ...prev, deletedDocumentIds: [] }));
        if (action === 'expand') onClose?.();
      }
    },
    onError: (error, payload) => {
      const message = error instanceof Error ? error.message : '処方オーダーの保存に失敗しました。';
      setNotice({ tone: 'error', message });
      onSubmitResult?.({ action: payload?.action ?? 'save', ok: false });
    },
  });

  const submit = (action: SaveAction) => {
    if (isPreviewMode) {
      setNotice({ tone: 'info', message: 'プレビューモードでは保存できません。' });
      return;
    }
    if (interactionConfirmOpen) return;
    const issues = validate();
    setValidationIssues(issues);
    if (issues.length > 0) {
      setNotice({ tone: 'error', message: issues[0].message });
      if (typeof issues[0].rpIndex === 'number') {
        setSelectedRpIndex(issues[0].rpIndex);
      }
      if (typeof issues[0].drugIndex === 'number') {
        setSelectedDrugIndex(issues[0].drugIndex);
      }
      return;
    }
    void (async () => {
      const codes = extractInteractionCodes();
      if (codes.length < 2) {
        mutation.mutate({ action, order });
        return;
      }
      try {
        const result = await checkOrcaMasterStaticOrderInteractions({ codes });
        if (!result.ok) {
          setNotice({
            tone: 'warning',
            message: result.message ?? 'マスタ参照の静的相互作用チェックに失敗したため、そのまま保存します。',
          });
          mutation.mutate({ action, order });
          return;
        }
        if (result.totalCount > 0) {
          setInteractionPairs(result.pairs.slice(0, 20));
          setPendingSaveAction(action);
          setInteractionConfirmOpen(true);
          return;
        }
      } catch (error) {
        setNotice({
          tone: 'warning',
          message:
            error instanceof Error
              ? error.message
              : 'マスタ参照の静的相互作用チェックに失敗したため、そのまま保存します。',
        });
      }
      mutation.mutate({ action, order });
    })();
  };

  const applyBulkDays = () => {
    if (isPreviewMode) return;
    const value = bulkDaysValue.trim();
    if (!value) return;
    setOrder((prev) => ({
      ...prev,
      rps: prev.rps.map((rp) =>
        rp.category === 'regular' || rp.category === 'tonyo'
          ? {
              ...rp,
              daysOrTimes: value,
            }
          : rp,
      ),
    }));
    setBulkDaysValue('');
  };

  const issueByKey = useMemo(() => {
    const map = new Map<string, string>();
    validationIssues.forEach((issue) => {
      if (!map.has(issue.key)) map.set(issue.key, issue.message);
    });
    return map;
  }, [validationIssues]);

  if (!patientId) {
    return <p className="order-dock__empty">患者IDが未選択のため処方オーダー編集を開始できません。</p>;
  }

  return (
    <section className="charts-side-panel__section" data-order-entity="medOrder" data-test-id="medOrder-prescription-editor-v2">
      <FocusTrapDialog
        open={interactionConfirmOpen}
        title="マスタ参照の静的相互作用チェック"
        description="保存前に ORCA マスタ由来の静的な相互作用候補が検出されました。患者別の禁忌チェックとは別です。"
        role="alertdialog"
        onClose={closeInteractionConfirm}
        testId="prescription-interaction-confirm"
      >
        <div className="charts-side-panel__confirm">
          {interactionPairs.length > 0 ? (
            <ul className="charts-side-panel__confirm-list">
              {interactionPairs.map((pair, index) => (
                <li key={`${pair.code1}-${pair.code2}-${index}`}>
                  {pair.code1} / {pair.code2} / {pair.interactionName ?? pair.message ?? '静的相互作用あり'}
                </li>
              ))}
            </ul>
          ) : (
            <p className="charts-side-panel__message">静的相互作用候補の詳細は取得できませんでした。</p>
          )}
          <div
            className="charts-side-panel__actions charts-side-panel__actions--dialog"
            role="group"
            aria-label="マスタ参照の静的相互作用チェックの確認"
          >
            <button type="button" className="charts-side-panel__action" onClick={closeInteractionConfirm}>
              編集に戻る
            </button>
            <button
              type="button"
              className="charts-side-panel__action charts-side-panel__action--save"
              onClick={() => {
                if (!pendingSaveAction || mutation.isPending) {
                  closeInteractionConfirm();
                  return;
                }
                const action = pendingSaveAction;
                setInteractionConfirmOpen(false);
                setPendingSaveAction(null);
                mutation.mutate({ action, order });
              }}
            >
              今回だけ無視して保存
            </button>
          </div>
        </div>
      </FocusTrapDialog>
      <header className="charts-side-panel__section-header">
        <div className="charts-side-panel__section-header-main">
          <strong>処方（RP集合）</strong>
        </div>
        <div className="charts-side-panel__subheader-actions">
          <button type="button" className="charts-side-panel__ghost charts-side-panel__ghost--add" onClick={addRp} disabled={isPreviewMode}>
            +RP
          </button>
          <button type="button" className="charts-side-panel__ghost charts-side-panel__ghost--add" onClick={addDrug} disabled={isPreviewMode}>
            +薬剤
          </button>
          <button
            type="button"
            className="charts-side-panel__row-delete"
            onClick={() => {
              if (!selectedRp) return;
              removeDrug(selectedRpIndex, selectedDrugIndex);
            }}
            disabled={!selectedRp || isPreviewMode}
          >
            薬剤削除
          </button>
          <button type="button" className="charts-side-panel__ghost charts-side-panel__ghost--danger" onClick={clearAll} disabled={isPreviewMode}>
            全クリア
          </button>
        </div>
      </header>

      <div className="charts-side-panel__dock-body">
        {isPreviewMode ? (
          <div className="charts-side-panel__notice charts-side-panel__notice--info">プレビューモード: 編集操作・保存は無効です。</div>
        ) : null}
        {notice ? (
          <div className={`charts-side-panel__notice charts-side-panel__notice--${notice.tone}`} aria-live={resolveAriaLive(notice.tone)}>
            {notice.message}
          </div>
        ) : null}
        {rpRequired.issue ? (
          <div className="charts-side-panel__notice charts-side-panel__notice--warning" data-test-id="medorder-rp-required-warning">
            <strong>{RP_REQUIRED_ERROR_LABEL}</strong>
            <p className="charts-side-panel__notice-detail">{buildRpRequiredEditorMessage(rpRequired.issue)}</p>
            <ul className="charts-side-panel__notice-list" aria-label="不足しているRP必須項目">
              {rpRequired.missing.map((field) => (
                <li key={field}>{resolveRpRequiredFieldLabel(field)}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <fieldset
          disabled={isPreviewMode}
          style={{ margin: 0, padding: 0, border: 0, minInlineSize: 0 }}
        >
        <div className="charts-side-panel__workspace" data-variant={variant}>
          <aside className="charts-side-panel__workspace-left" aria-label="RP一覧">
            <div className="charts-side-panel__subsection">
              <div className="charts-side-panel__subheader">
                <strong>RP一覧</strong>
                <span className="charts-side-panel__search-count">{order.rps.length}件</span>
              </div>
              <div className="charts-side-panel__template-actions" role="list" aria-label="RP選択">
                {order.rps.map((rp, index) => {
                  const label = rp.name.trim() || `${CATEGORY_LABEL[rp.category]} (${LOCATION_LABEL[rp.location]})`;
                  return (
                    <div key={rp.rpId} role="listitem">
                      <button
                        type="button"
                        className="charts-side-panel__chip-button"
                        data-active={selectedRpIndex === index ? 'true' : 'false'}
                        onClick={() => {
                          setSelectedRpIndex(index);
                          setSelectedDrugIndex(0);
                        }}
                      >
                        RP{index + 1}: {label}
                      </button>
                      {order.rps.length > 1 ? (
                        <button
                          type="button"
                          className="charts-side-panel__history-action charts-side-panel__history-action--delete"
                          onClick={() => removeRp(index)}
                          aria-label={`RP${index + 1}を削除`}
                        >
                          削除
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="charts-side-panel__subsection charts-side-panel__subsection--search">
              <div className="charts-side-panel__subheader">
                <strong>薬剤検索</strong>
                <span className="charts-side-panel__search-count">
                  {drugSearchQuery.isFetching ? '検索中...' : `${filteredCandidates.length}件`}
                </span>
              </div>
              <div className="charts-side-panel__field-row">
                <div className="charts-side-panel__field">
                  <label htmlFor={domId('search-method')}>検索方法</label>
                  <select
                    id={domId('search-method')}
                    value={searchMethod}
                    onChange={(event) => setSearchMethod(event.target.value as PrescriptionSearchMethod)}
                  >
                    <option value="prefix">前方一致</option>
                    <option value="partial">部分一致</option>
                  </select>
                </div>
                <div className="charts-side-panel__field">
                  <label htmlFor={domId('search-scope')}>検索範囲</label>
                  <select
                    id={domId('search-scope')}
                    value={searchScope}
                    onChange={(event) => setSearchScope(event.target.value as PrescriptionSearchScope)}
                  >
                    {(Object.keys(SEARCH_SCOPE_LABEL) as PrescriptionSearchScope[]).map((scope) => (
                      <option key={scope} value={scope}>
                        {SEARCH_SCOPE_LABEL[scope]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="charts-side-panel__field">
                <label htmlFor={domId('search-keyword')}>キーワード</label>
                <input
                  id={domId('search-keyword')}
                  value={searchKeyword}
                  onChange={(event) => {
                    setSearchKeyword(event.target.value);
                    if (event.target.value.trim().length >= 3) setManualSearchNonce(0);
                  }}
                  placeholder="薬剤名またはコード"
                />
              </div>
              {shouldManualSearch ? (
                <button
                  type="button"
                  className="charts-side-panel__action charts-side-panel__action--search"
                  onClick={() => setManualSearchNonce((prev) => prev + 1)}
                >
                  検索（2文字以下は明示実行）
                </button>
              ) : null}
              {!shouldAutoSearch && !shouldManualSearch ? (
                <p className="charts-side-panel__help">3文字以上で候補を自動表示します。</p>
              ) : null}
              {drugSearchQuery.data && !drugSearchQuery.data.ok ? (
                <div className="charts-side-panel__notice charts-side-panel__notice--error">
                  {drugSearchQuery.data.message ?? '薬剤検索に失敗しました。'}
                </div>
              ) : null}
              {filteredCandidates.length > 0 ? (
                <div className="charts-side-panel__search-table">
                  <div className="charts-side-panel__search-header">
                    <span>コード</span>
                    <span>名称</span>
                    <span>単位</span>
                    <span>最低薬価</span>
                    <span>分類</span>
                    <span>反映</span>
                  </div>
                  {filteredCandidates.map((item) => (
                    <button
                      key={`rx-candidate-${item.code ?? item.name}`}
                      type="button"
                      className="charts-side-panel__search-row"
                      onClick={() => applyDrugCandidate(item)}
                    >
                      <span>{item.code ?? '-'}</span>
                      <span>{item.name}</span>
                      <span>{item.unit ?? '-'}</span>
                      <span>{resolveCandidateGenericPrice(item)}</span>
                      <span>{item.category ?? '-'}</span>
                      <span>右へ反映</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="charts-side-panel__subsection charts-side-panel__subsection--search">
              <div className="charts-side-panel__subheader">
                <strong>ORCA入力セット</strong>
                <span className="charts-side-panel__search-count">{inputSetItems.length}件</span>
              </div>
              <div className="charts-side-panel__field">
                <label htmlFor={domId('inputset-keyword')}>keyword</label>
                <input
                  id={domId('inputset-keyword')}
                  value={inputSetKeyword}
                  onChange={(event) => setInputSetKeyword(event.target.value)}
                  placeholder="入力セット名またはコード"
                />
              </div>
              <button
                type="button"
                className="charts-side-panel__action charts-side-panel__action--search"
                onClick={() => void handleInputSetSearch()}
                disabled={inputSetLoading || !inputSetKeyword.trim()}
              >
                {inputSetLoading ? '検索中…' : '入力セット検索'}
              </button>
              <p className="charts-side-panel__help">setCode は展開専用です。保存・ORCA送信 payload には保持しません。</p>
              {inputSetItems.length > 0 ? (
                <div className="charts-side-panel__search-table">
                  <div className="charts-side-panel__search-header">
                    <span>setCode</span>
                    <span>name</span>
                    <span>itemCount</span>
                    <span>反映</span>
                  </div>
                  {inputSetItems.map((item) => (
                    <button
                      key={`input-set-${item.setCode ?? item.name}`}
                      type="button"
                      className="charts-side-panel__search-row"
                      onClick={() => void applyInputSet(item)}
                    >
                      <span>{item.setCode ?? '-'}</span>
                      <span>{item.name ?? '-'}</span>
                      <span>{item.itemCount ?? '-'}</span>
                      <span>RPへ反映</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </aside>

          <div className="charts-side-panel__workspace-right">
            {selectedRp ? (
              <form
                className="charts-side-panel__form"
                onSubmit={(event) => {
                  event.preventDefault();
                  submit('save');
                }}
              >
                <div className="charts-side-panel__field charts-side-panel__meta-section charts-side-panel__meta-section--bundle">
                  <label htmlFor={domId('rp-name')}>RP名</label>
                  <input
                    id={domId('rp-name')}
                    value={selectedRp.name}
                    onChange={(event) =>
                      updateRp(selectedRpIndex, (rp) => ({
                        ...rp,
                        name: event.target.value,
                      }))
                    }
                    placeholder="例: 降圧薬RP"
                  />
                </div>

                <div className="charts-side-panel__field-row charts-side-panel__meta-section charts-side-panel__meta-section--rx-class">
                  <div className="charts-side-panel__field">
                    <label>院内/院外</label>
                    <div className="charts-side-panel__switch-group" role="group" aria-label="院内院外選択">
                      {(['in', 'out'] as PrescriptionLocation[]).map((location) => (
                        <button
                          key={`rx-location-${location}`}
                          type="button"
                          className="charts-side-panel__switch-button"
                          data-active={selectedRp.location === location ? 'true' : 'false'}
                          onClick={() =>
                            updateRp(selectedRpIndex, (rp) => ({
                              ...rp,
                              location,
                            }))
                          }
                        >
                          {LOCATION_LABEL[location]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="charts-side-panel__field">
                    <label>処方区分</label>
                    <div className="charts-side-panel__switch-group" role="group" aria-label="処方区分選択">
                      {(['regular', 'tonyo', 'gaiyo'] as PrescriptionCategory[]).map((category) => (
                        <button
                          key={`rx-category-${category}`}
                          type="button"
                          className="charts-side-panel__switch-button"
                          data-active={selectedRp.category === category ? 'true' : 'false'}
                          onClick={() =>
                            updateRp(selectedRpIndex, (rp) => ({
                              ...rp,
                              category,
                            }))
                          }
                        >
                          {CATEGORY_LABEL[category]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="charts-side-panel__field-row charts-side-panel__meta-section charts-side-panel__meta-section--usage">
                  <div className="charts-side-panel__field">
                    <label htmlFor={domId('usage')}>用法マスタ</label>
                    <select
                      id={domId('usage')}
                      value={selectedRp.usageCode ?? ''}
                      onChange={(event) => {
                        const code = event.target.value;
                        const selected = usageOptions.find((option) => (option.code?.trim() ?? '') === code);
                        updateRp(selectedRpIndex, (rp) => ({
                          ...rp,
                          usageCode: code || undefined,
                          usage: selected?.name ?? rp.usage,
                        }));
                      }}
                    >
                      <option value="">候補を選択</option>
                      {usageOptions.map((item) => (
                        <option key={`usage-${item.code ?? item.name}`} value={item.code?.trim() ?? ''}>
                          {item.code ? `${item.code} ${item.name}` : item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="charts-side-panel__field">
                    <label htmlFor={domId('usage-free')}>用法（自由入力）</label>
                    <input
                      id={domId('usage-free')}
                      value={selectedRp.usage}
                      onChange={(event) =>
                        updateRp(selectedRpIndex, (rp) => ({
                          ...rp,
                          usage: event.target.value,
                        }))
                      }
                      placeholder="例: 1日1回 朝食後"
                    />
                  </div>
                  <div className="charts-side-panel__field">
                    <label htmlFor={domId('days')}>{selectedRp.category === 'tonyo' ? '回数' : '日数'}</label>
                    <input
                      id={domId('days')}
                      value={selectedRp.daysOrTimes}
                      onChange={(event) =>
                        updateRp(selectedRpIndex, (rp) => ({
                          ...rp,
                          daysOrTimes: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="charts-side-panel__field-row charts-side-panel__meta-section charts-side-panel__meta-section--memo">
                  <div className="charts-side-panel__field">
                    <label htmlFor={domId('bulk-days')}>日数一括変更（内服/頓服のみ）</label>
                    <div className="charts-side-panel__item-actions">
                      <input
                        id={domId('bulk-days')}
                        value={bulkDaysValue}
                        onChange={(event) => setBulkDaysValue(event.target.value)}
                        placeholder="例: 7"
                      />
                      <button type="button" className="charts-side-panel__action" onClick={applyBulkDays}>
                        一括反映
                      </button>
                    </div>
                  </div>
                  <div className="charts-side-panel__field">
                    <label htmlFor={domId('remark')}>備考（改行不可・全角40文字）</label>
                    <input
                      id={domId('remark')}
                      value={selectedRp.remark}
                      onChange={(event) => {
                        const clamped = clampByFullWidth(event.target.value, 40);
                        updateRp(selectedRpIndex, (rp) => ({
                          ...rp,
                          remark: clamped,
                        }));
                      }}
                      placeholder="備考"
                    />
                    <p className="charts-side-panel__help">備考と医師コメントは院内ローカル保持です。ORCA送信 payload には含めません。</p>
                  </div>
                </div>
                <div className="charts-side-panel__field charts-side-panel__meta-section">
                  <label>RP請求コメント</label>
                  <div className="charts-side-panel__chip-list" aria-label="RP請求コメント一覧">
                    {(selectedRp.claimComments ?? []).length === 0 ? (
                      <span className="charts-side-panel__empty-chip">未設定</span>
                    ) : (
                      (selectedRp.claimComments ?? []).map((comment, commentIndex) => {
                        const uiMeta = resolveStructuredCommentUiMeta(comment.code);
                        return (
                          <div key={comment.id} className="charts-side-panel__item-actions">
                            <button
                              type="button"
                              className="charts-side-panel__chip-button charts-side-panel__chip-button--selected"
                              onClick={() =>
                                updateRp(selectedRpIndex, (rp) => ({
                                  ...rp,
                                  claimComments: (rp.claimComments ?? []).filter((_, idx) => idx !== commentIndex),
                                }))
                              }
                            >
                              {comment.code ? `${comment.code} ` : ''}
                              {comment.name}
                            </button>
                            {uiMeta ? (
                              <div className="charts-side-panel__field">
                                <label htmlFor={domId(`rp-claim-note-${commentIndex}`)}>RP請求コメント {commentIndex + 1} 補足値</label>
                                <input
                                  id={domId(`rp-claim-note-${commentIndex}`)}
                                  value={comment.note ?? ''}
                                  onChange={(event) =>
                                    updateRp(selectedRpIndex, (rp) => ({
                                      ...rp,
                                      claimComments: (rp.claimComments ?? []).map((entry, idx) =>
                                        idx === commentIndex
                                          ? {
                                              ...entry,
                                              note: (() => {
                                                const normalized =
                                                  normalizeStructuredPrescriptionClaimCommentNote(entry.code, event.target.value);
                                                const fallback = event.target.value.trim() || undefined;
                                                return normalized ?? fallback;
                                              })(),
                                            }
                                          : entry,
                                      ),
                                    }))
                                  }
                                  placeholder={uiMeta.placeholder}
                                />
                                <p className="charts-side-panel__help">{uiMeta.hint}</p>
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="charts-side-panel__chip-list">
                    {CLAIM_COMMENT_TEMPLATES.map((template) => (
                      <button
                        key={`rx-rp-claim-template-${template.name}`}
                        type="button"
                        className="charts-side-panel__chip-button"
                        onClick={() =>
                          updateRp(selectedRpIndex, (rp) => ({
                            ...rp,
                            claimComments: [...(rp.claimComments ?? []), createClaimComment(template.name, template.code)],
                          }))
                        }
                      >
                        {template.name}
                      </button>
                    ))}
                  </div>
                  <div className="charts-side-panel__item-actions" aria-label="RP請求コメント入力">
                    <input
                      value={rpClaimDraft.code}
                      onChange={(event) => setRpClaimDraft((prev) => ({ ...prev, code: event.target.value }))}
                      placeholder="RP請求コメントコード"
                    />
                    <input
                      value={rpClaimDraft.name}
                      onChange={(event) => setRpClaimDraft((prev) => ({ ...prev, name: event.target.value }))}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && event.shiftKey) {
                          event.preventDefault();
                          applyRpClaimDraft();
                        }
                      }}
                      placeholder="RP請求コメント名（Shift+Enterで確定）"
                    />
                    <input
                      value={rpClaimDraft.note}
                      onChange={(event) => setRpClaimDraft((prev) => ({ ...prev, note: event.target.value }))}
                      placeholder={resolveStructuredCommentUiMeta(rpClaimDraft.code)?.placeholder ?? '補足値（structured family のみ）'}
                    />
                    <button type="button" className="charts-side-panel__action" onClick={applyRpClaimDraft}>
                      RPコメント追加
                    </button>
                  </div>
                  {resolveStructuredCommentUiMeta(rpClaimDraft.code) ? (
                    <p className="charts-side-panel__help">{resolveStructuredCommentUiMeta(rpClaimDraft.code)?.hint}</p>
                  ) : null}
                  <p className="charts-side-panel__help">
                    RP請求コメントは先頭薬剤へ寄せず、このRPの first-class field として保存・再取得・送信します。
                  </p>
                </div>

                <div className="charts-side-panel__field-row charts-side-panel__meta-section charts-side-panel__meta-section--start">
                  <div className="charts-side-panel__field">
                    <label htmlFor={domId('refill-count')}>処方箋設定（リフィル回数）</label>
                    <select
                      id={domId('refill-count')}
                      value={selectedRp.refillCount ?? ''}
                      onChange={(event) => {
                        const parsed = Number(event.target.value);
                        updateRp(selectedRpIndex, (rp) => ({
                          ...rp,
                          refillCount: parsed === 1 || parsed === 2 || parsed === 3 ? parsed : undefined,
                        }));
                      }}
                    >
                      <option value="">なし</option>
                      <option value="1">1回</option>
                      <option value="2">2回</option>
                      <option value="3">3回</option>
                    </select>
                  </div>
                  <div className="charts-side-panel__field">
                    <label htmlFor={domId('refill-pattern')}>処方箋設定（パターン併用禁止）</label>
                    <select
                      id={domId('refill-pattern')}
                      value={selectedRp.refillPattern}
                      onChange={(event) =>
                        updateRp(selectedRpIndex, (rp) => ({
                          ...rp,
                          refillPattern: event.target.value as PrescriptionRefillPattern,
                        }))
                      }
                    >
                      {(['none', 'standard', 'alternate'] as PrescriptionRefillPattern[]).map((pattern) => (
                        <option key={pattern} value={pattern}>
                          {REFILL_PATTERN_LABEL[pattern]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="charts-side-panel__field">
                    <label htmlFor={domId('doctor-comment')}>医師コメント</label>
                    <input
                      id={domId('doctor-comment')}
                      value={order.doctorComment}
                      onChange={(event) =>
                        setOrder((prev) => ({
                          ...prev,
                          doctorComment: event.target.value,
                        }))
                      }
                      placeholder="医師コメント"
                    />
                  </div>
                </div>

                <div className="charts-side-panel__subsection charts-side-panel__meta-section charts-side-panel__meta-section--items">
                  <div className="charts-side-panel__subheader">
                    <strong>薬剤行</strong>
                    <span className="charts-side-panel__search-count">{selectedRp.drugs.length}件</span>
                  </div>
                  {selectedDrug ? (
                    <p className="charts-side-panel__help">最低薬価: {selectedDrugGenericPrice ?? '-'}</p>
                  ) : null}
                  {selectedRp.drugs.map((drug, drugIndex) => {
                    const enforceRule = !drug.patientRequest;
                    const rowIssueGeneric = issueByKey.get(`drug_rule_generic_${selectedRpIndex}_${drugIndex}`);
                    const rowIssueClaim = issueByKey.get(`drug_rule_claim_${selectedRpIndex}_${drugIndex}`);
                    return (
                      <div
                        key={drug.rowId}
                        className="charts-side-panel__item-row"
                        data-invalid={rowIssueGeneric || rowIssueClaim ? 'true' : undefined}
                        onClick={() => {
                          setSelectedDrugIndex(drugIndex);
                        }}
                      >
                        <input
                          id={domId(`drug-name-${drugIndex}`)}
                          value={drug.name}
                          onChange={(event) =>
                            updateDrug(selectedRpIndex, drugIndex, (current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                          placeholder="薬剤名"
                        />
                        <input
                          id={domId(`drug-quantity-${drugIndex}`)}
                          value={drug.quantity}
                          onChange={(event) =>
                            updateDrug(selectedRpIndex, drugIndex, (current) => ({
                              ...current,
                              quantity: event.target.value,
                            }))
                          }
                          placeholder="数量"
                        />
                        <input
                          id={domId(`drug-unit-${drugIndex}`)}
                          value={drug.unit}
                          onChange={(event) =>
                            updateDrug(selectedRpIndex, drugIndex, (current) => ({
                              ...current,
                              unit: event.target.value,
                            }))
                          }
                          placeholder="単位"
                        />
                        <button
                          type="button"
                          className="charts-side-panel__switch-button"
                          data-active={drug.genericChangeAllowed ? 'true' : 'false'}
                          onClick={() =>
                            updateDrug(selectedRpIndex, drugIndex, (current) => ({
                              ...current,
                              genericChangeAllowed: !current.genericChangeAllowed,
                            }))
                          }
                        >
                          {drug.genericChangeAllowed ? '後発変更 可' : '後発変更 不可'}
                        </button>
                        <button
                          type="button"
                          className="charts-side-panel__switch-button"
                          data-active={drug.isGeneralNamePrescription ? 'true' : 'false'}
                          onClick={() =>
                            updateDrug(selectedRpIndex, drugIndex, (current) => ({
                              ...current,
                              isGeneralNamePrescription: !current.isGeneralNamePrescription,
                            }))
                          }
                        >
                          {drug.isGeneralNamePrescription ? '一般名指定' : '銘柄指定'}
                        </button>
                        <button
                          type="button"
                          className="charts-side-panel__switch-button"
                          data-active={drug.patientRequest ? 'true' : 'false'}
                          onClick={() =>
                            updateDrug(selectedRpIndex, drugIndex, (current) => ({
                              ...current,
                              patientRequest: !current.patientRequest,
                            }))
                          }
                        >
                          {drug.patientRequest ? '患者希望' : '患者希望以外'}
                        </button>
                        <input
                          id={domId(`drug-comment-${drugIndex}`)}
                          value={drug.drugComment}
                          onChange={(event) =>
                            updateDrug(selectedRpIndex, drugIndex, (current) => ({
                              ...current,
                              drugComment: event.target.value,
                            }))
                          }
                          placeholder="薬剤コメント"
                        />
                        <div className="charts-side-panel__template-actions" aria-label={`薬剤${drugIndex + 1}定型文`}>
                          {DRUG_COMMENT_TEMPLATES.map((templateText) => (
                            <button
                              key={`rx-drug-template-${templateText}`}
                              type="button"
                              className="charts-side-panel__chip-button"
                              onClick={() =>
                                updateDrug(selectedRpIndex, drugIndex, (current) => ({
                                  ...current,
                                  drugComment: current.drugComment
                                    ? `${current.drugComment} / ${templateText}`
                                    : templateText,
                                }))
                              }
                            >
                              {templateText}
                            </button>
                          ))}
                        </div>
                        <div className="charts-side-panel__template-actions" aria-label={`薬剤${drugIndex + 1}請求用コメント一覧`}>
                          {drug.claimComments.map((comment, commentIndex) => {
                            const uiMeta = resolveStructuredCommentUiMeta(comment.code);
                            return (
                              <div key={comment.id} className="charts-side-panel__item-actions">
                                <button
                                  type="button"
                                  className="charts-side-panel__chip-button charts-side-panel__chip-button--recommend"
                                  onClick={() =>
                                    updateDrug(selectedRpIndex, drugIndex, (current) => ({
                                      ...current,
                                      claimComments: current.claimComments.filter((_, idx) => idx !== commentIndex),
                                    }))
                                  }
                                  title="クリックで削除"
                                >
                                  {comment.code ? `${comment.code} ` : ''}
                                  {comment.name}
                                </button>
                                {uiMeta ? (
                                  <div className="charts-side-panel__field">
                                    <label htmlFor={domId(`drug-claim-note-${drugIndex}-${commentIndex}`)}>
                                      薬剤{drugIndex + 1} 請求コメント {commentIndex + 1} 補足値
                                    </label>
                                    <input
                                      id={domId(`drug-claim-note-${drugIndex}-${commentIndex}`)}
                                      value={comment.note ?? ''}
                                      onChange={(event) =>
                                        updateDrug(selectedRpIndex, drugIndex, (current) => ({
                                          ...current,
                                          claimComments: current.claimComments.map((entry, idx) =>
                                            idx === commentIndex
                                              ? {
                                                  ...entry,
                                                  note: (() => {
                                                    const normalized =
                                                      normalizeStructuredPrescriptionClaimCommentNote(entry.code, event.target.value);
                                                    const fallback = event.target.value.trim() || undefined;
                                                    return normalized ?? fallback;
                                                  })(),
                                                }
                                              : entry,
                                          ),
                                        }))
                                      }
                                      placeholder={uiMeta.placeholder}
                                    />
                                    <p className="charts-side-panel__help">{uiMeta.hint}</p>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                        {selectedDrugIndex === drugIndex ? (
                          <div className="charts-side-panel__item-actions" aria-label="請求用コメント入力">
                            <input
                              value={claimDraft.code}
                              onChange={(event) => setClaimDraft((prev) => ({ ...prev, code: event.target.value }))}
                              placeholder="請求コメントコード"
                            />
                            <input
                              value={claimDraft.name}
                              onChange={(event) => setClaimDraft((prev) => ({ ...prev, name: event.target.value }))}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' && event.shiftKey) {
                                  event.preventDefault();
                                  applyClaimDraft();
                                }
                              }}
                              placeholder="請求用コメント（Shift+Enterで確定）"
                            />
                            <input
                              value={claimDraft.note}
                              onChange={(event) => setClaimDraft((prev) => ({ ...prev, note: event.target.value }))}
                              placeholder={resolveStructuredCommentUiMeta(claimDraft.code)?.placeholder ?? '補足値（structured family のみ）'}
                            />
                            <button type="button" className="charts-side-panel__action" onClick={applyClaimDraft}>
                              コメント追加
                            </button>
                            {CLAIM_COMMENT_TEMPLATES.map((template) => (
                              <button
                                key={`rx-claim-template-${template.name}`}
                                type="button"
                                className="charts-side-panel__chip-button"
                                onClick={() => {
                                  updateDrug(selectedRpIndex, drugIndex, (current) => ({
                                    ...current,
                                    claimComments: [...current.claimComments, createClaimComment(template.name, template.code)],
                                  }));
                                }}
                              >
                                {template.name}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {selectedDrugIndex === drugIndex && resolveStructuredCommentUiMeta(claimDraft.code) ? (
                          <p className="charts-side-panel__help">{resolveStructuredCommentUiMeta(claimDraft.code)?.hint}</p>
                        ) : null}
                        {enforceRule ? (
                          <p className="charts-side-panel__help">
                            患者希望以外の場合は「後発変更 不可」+「請求用コメント」が必須です。
                          </p>
                        ) : null}
                        <p className="charts-side-panel__help">
                          一般名指定/請求コメントは ORCA送信対象です。後発可否・lower系・numberCode・prescriptionSettings・remarks は preserve-only で、この画面からは編集しません。
                        </p>
                        {rowIssueGeneric || rowIssueClaim ? (
                          <p className="charts-side-panel__field-error" role="alert">
                            {[rowIssueGeneric, rowIssueClaim].filter(Boolean).join(' / ')}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </form>
            ) : (
              <p className="order-dock__empty">RPを選択してください。</p>
            )}
          </div>
        </div>
        </fieldset>
      </div>

      <footer className="charts-side-panel__dock-footer" aria-label="保存操作">
        <p className="charts-side-panel__message">
          Shift+Enter: 請求用コメント確定 / 保存して閉じる: 保存後にドロワーを閉じます
        </p>
        <div className="charts-side-panel__actions charts-side-panel__actions--footer" role="group" aria-label="保存操作">
          <button
            type="button"
            className="charts-side-panel__action charts-side-panel__action--expand"
            onClick={() => submit('expand')}
            disabled={mutation.isPending || isPreviewMode}
          >
            保存して閉じる
          </button>
          <button
            type="button"
            className="charts-side-panel__action charts-side-panel__action--expand-continue"
            onClick={() => submit('expand_continue')}
            disabled={mutation.isPending || isPreviewMode}
          >
            保存して続ける
          </button>
          <button
            type="button"
            className="charts-side-panel__action charts-side-panel__action--save"
            onClick={() => submit('save')}
            disabled={mutation.isPending || isPreviewMode}
          >
            保存
          </button>
          {onClose ? (
            <button type="button" className="charts-side-panel__action charts-side-panel__action--close" onClick={onClose}>
              閉じる
            </button>
          ) : null}
        </div>
      </footer>
    </section>
  );
}
