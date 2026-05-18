import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { CriticalOperationConfirmDialog } from '../../components/modals/CriticalOperationConfirmDialog';
import { FocusTrapDialog } from '../../components/modals/FocusTrapDialog';
import { resolveAriaLive } from '../../libs/observability/observability';
import { useMasterVisibilityCategory } from '../administration/useMasterVisibility';
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
  resolveRpRequiredIssue,
  type RpRequiredField,
} from './orderRpRequirements';
import {
  buildEmptyPrescriptionOrder,
  buildEmptyPrescriptionRp,
  fetchPrescriptionOrder,
  finalizePrescriptionAuthority,
  importPrescriptionDoInput,
  resolvePrescriptionRpAutoName,
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
type PrescriptionSafetyItem = {
  key: string;
  tone: 'warning' | 'contra';
  label: string;
  detail: string;
};

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
const RP_SHARED_USAGE_RULE =
  '1つのRPでは用法は共通です。異なる用法の薬剤は別RPに分けてください。';

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

const buildPrescriptionSafetyItems = (
  order: PrescriptionOrder,
  validationIssues: ValidationIssue[],
  interactionPairs: Array<{ code1: string; code2: string; interactionName?: string; message?: string }>,
): PrescriptionSafetyItem[] => {
  const items: PrescriptionSafetyItem[] = [];
  const codeMap = new Map<string, string[]>();
  order.rps.forEach((rp, rpIndex) => {
    rp.drugs.forEach((drug, drugIndex) => {
      const code = drug.code?.trim();
      if (!code) return;
      const labels = codeMap.get(code) ?? [];
      labels.push(`RP${rpIndex + 1} 薬剤${drugIndex + 1}`);
      codeMap.set(code, labels);
    });
  });
  codeMap.forEach((labels, code) => {
    if (labels.length < 2) return;
    items.push({
      key: `duplicate-${code}`,
      tone: 'warning',
      label: '警告',
      detail: `重複投与候補: ${code} が ${labels.join(' / ')} にあります。`,
    });
  });
  interactionPairs.forEach((pair, index) => {
    items.push({
      key: `interaction-${pair.code1}-${pair.code2}-${index}`,
      tone: 'warning',
      label: '警告',
      detail: `相互作用候補: ${pair.interactionName ?? pair.message ?? 'master 静的相互作用あり'}（${pair.code1} / ${pair.code2}）`,
    });
  });
  validationIssues
    .filter((issue) => issue.key.startsWith('drug_rule_') || issue.key.includes('structured_claim'))
    .forEach((issue) => {
      items.push({
        key: `contra-${issue.key}`,
        tone: 'contra',
        label: '禁忌',
        detail: `保存不可: ${issue.message}`,
      });
    });
  return items;
};

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
  const prescriptionMasterVisibility = useMasterVisibilityCategory('prescription');
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
  const [searchOrigin, setSearchOrigin] = useState<'panel' | 'drug-name'>('panel');
  const [manualSearchNonce, setManualSearchNonce] = useState(0);
  const [notice, setNotice] = useState<{ tone: 'info' | 'success' | 'warning' | 'error'; message: string } | null>(null);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [genericPriceCache, setGenericPriceCache] = useState<Record<string, GenericPriceCacheState>>({});
  const [inputSetKeyword, setInputSetKeyword] = useState('');
  const [inputSetLoading, setInputSetLoading] = useState(false);
  const [inputSetItems, setInputSetItems] = useState<OrcaOrderInputSetSummary[]>([]);
  const [interactionConfirmOpen, setInteractionConfirmOpen] = useState(false);
  const [interactionReviewReason, setInteractionReviewReason] = useState('');
  const [finalizeConfirmOpen, setFinalizeConfirmOpen] = useState(false);
  const [interactionPairs, setInteractionPairs] = useState<Array<{
    code1: string;
    code2: string;
    interactionName?: string;
    message?: string;
  }>>([]);
  const [pendingSaveAction, setPendingSaveAction] = useState<SaveAction | null>(null);
  const pendingEditBundleRef = useRef<OrderBundle | null>(null);

  useEffect(() => {
    setSearchMethod(prescriptionMasterVisibility.prescriptionDrugSearchMethodDefault);
  }, [prescriptionMasterVisibility.prescriptionDrugSearchMethodDefault]);

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

    if (request.kind === 'input-set') {
      void applyInputSet(request.candidate);
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
      return;
    }
  }, [isPreviewMode, onRequestConsumed, patientId, request, today]);

  const selectedRp = order.rps[selectedRpIndex] ?? null;
  const selectedDrug = selectedRp?.drugs[selectedDrugIndex] ?? null;
  const prescriptionGridRows = useMemo(
    () =>
      order.rps.flatMap((rp, rpIndex) => {
        const rows = rp.drugs.length > 0 ? rp.drugs : [null];
        return rows.map((drug, drugIndex) => {
          const quantity = drug
            ? [drug.quantity.trim(), drug.unit.trim()].filter(Boolean).join(' ') || '未設定'
            : '未設定';
          const otherParts = drug
            ? [
                drug.patientRequest ? '患者希望' : null,
                drug.isGeneralNamePrescription ? '一般名指定' : null,
                drug.claimComments.length > 0 ? `請求コメント${drug.claimComments.length}件` : null,
              ].filter(Boolean)
            : [];
          return {
            key: `${rp.rpId}-${drug?.rowId ?? `empty-${drugIndex}`}`,
            rpIndex,
            drugIndex,
            rp,
            drug,
            rpLabel: `RP${rpIndex + 1}`,
            drugName: drug?.name.trim() || '未入力',
            quantity,
            ingredientAmount: '未設定',
            ingredientUnresolved: true,
            other: otherParts.length > 0 ? otherParts.join(' / ') : '未設定',
            otherUnresolved: otherParts.length === 0,
            genericChange: drug?.genericChangeAllowed === false ? '変更不可' : '変更可能',
            drugComment: drug?.drugComment.trim() || '未入力',
            usage: rp.usage.trim() || '未設定',
            daysOrTimes: rp.daysOrTimes.trim() || '未設定',
          };
        });
      }),
    [order.rps],
  );
  const showInputSetChooser = variant === 'utility' && prescriptionMasterVisibility.visible;

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
      const deletedDocumentContentHashes =
        typeof target.documentId === 'number' && target.documentId > 0 && target.contentHash?.trim()
          ? {
              ...(prev.deletedDocumentContentHashes ?? {}),
              [String(target.documentId)]: target.contentHash.trim(),
            }
          : prev.deletedDocumentContentHashes;
      return {
        ...prev,
        rps: nextRps.length > 0 ? nextRps : [buildEmptyPrescriptionRp(today)],
        deletedDocumentIds,
        deletedDocumentContentHashes,
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
      const deletedDocumentContentHashes = prev.rps.reduce<Record<string, string>>((acc, rp) => {
        if (typeof rp.documentId === 'number' && rp.documentId > 0 && rp.contentHash?.trim()) {
          acc[String(rp.documentId)] = rp.contentHash.trim();
        }
        return acc;
      }, { ...(prev.deletedDocumentContentHashes ?? {}) });
      return {
        ...buildEmptyPrescriptionOrder(prev.patientId || patientId || '', today),
        deletedDocumentIds: Array.from(new Set([...prev.deletedDocumentIds, ...deletions])),
        deletedDocumentContentHashes,
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
  const shouldRunSearch = active && prescriptionMasterVisibility.visible && Boolean(patientId) && (shouldAutoSearch || manualSearchNonce > 0);

  const drugSearchQuery = useQuery({
    queryKey: [
      'charts-prescription-drug-search-v2',
      trimmedSearchKeyword,
      searchMethod,
      searchEffectiveDate,
      manualSearchNonce,
    ],
    queryFn: () =>
      fetchOrderMasterSearch({
        type: 'drug',
        keyword: trimmedSearchKeyword,
        method: searchMethod,
        effective: searchEffectiveDate,
        asOf: searchEffectiveDate,
      }),
    enabled: shouldRunSearch,
    staleTime: 15_000,
  });

  const filteredCandidates = useMemo(() => {
    if (!prescriptionMasterVisibility.visible) return [];
    const items = drugSearchQuery.data?.items ?? [];
    if (!trimmedSearchKeyword) return [];
    return items
      .filter((item) => isDrugMatched(item, trimmedSearchKeyword, searchMethod))
      .slice(0, 40);
  }, [drugSearchQuery.data?.items, prescriptionMasterVisibility.visible, searchMethod, trimmedSearchKeyword]);

  const ensureGenericPrice = useCallback(
    async (code?: string | null) => {
      if (!prescriptionMasterVisibility.visible) return;
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
    [genericPriceCache, prescriptionMasterVisibility.visible, searchEffectiveDate],
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
    enabled: active && prescriptionMasterVisibility.visible && Boolean(patientId),
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

  const handleDrugNameInput = useCallback(
    (rpIndex: number, drugIndex: number, value: string) => {
      if (isPreviewMode) return;
      const matchedCandidate = filteredCandidates.find((candidate) => candidate.name === value);
      setSelectedRpIndex(rpIndex);
      setSelectedDrugIndex(drugIndex);
      setSearchKeyword(value);
      setSearchOrigin('drug-name');
      if (normalizeSearchText(value).length >= 3) setManualSearchNonce(0);
      updateDrug(rpIndex, drugIndex, (current) => ({
        ...current,
        code: matchedCandidate?.code?.trim() || (value === current.name ? current.code : undefined),
        name: matchedCandidate?.name ?? value,
        unit: matchedCandidate?.unit?.trim() || current.unit,
      }));
      if (matchedCandidate) {
        onDrugCandidateCommit?.({
          rpIndex,
          drugIndex,
          candidate: matchedCandidate,
        });
      }
    },
    [filteredCandidates, isPreviewMode, onDrugCandidateCommit, updateDrug],
  );

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
    setInteractionReviewReason('');
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

  const safetyItems = useMemo(
    () => buildPrescriptionSafetyItems(order, validationIssues, interactionPairs),
    [interactionPairs, order, validationIssues],
  );
  const formatSafetySummaryDetail = (detail: string) => detail;

  const splitDrugToNewRp = (drugIndex: number) => {
    if (isPreviewMode) return;
    const sourceRp = order.rps[selectedRpIndex];
    const targetDrug = sourceRp?.drugs[drugIndex];
    if (!sourceRp || !targetDrug || sourceRp.drugs.length <= 1) return;
    const nextRp: PrescriptionRp = {
      ...buildEmptyPrescriptionRp(sourceRp.started || today, resolveClassCode(sourceRp.category, sourceRp.location)),
      name: targetDrug.name ? `${targetDrug.name} 別RP` : `${sourceRp.name || '処方'} 別RP`,
      location: sourceRp.location,
      category: sourceRp.category,
      usage: '',
      usageCode: undefined,
      daysOrTimes: sourceRp.daysOrTimes,
      drugs: [{ ...targetDrug, rowId: `drug-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}` }],
    };
    setOrder((prev) => {
      const currentRp = prev.rps[selectedRpIndex];
      if (!currentRp || currentRp.drugs.length <= 1) return prev;
      const nextRps = [...prev.rps];
      nextRps[selectedRpIndex] = {
        ...currentRp,
        drugs: currentRp.drugs.filter((_, index) => index !== drugIndex),
      };
      nextRps.splice(selectedRpIndex + 1, 0, nextRp);
      return { ...prev, rps: nextRps };
    });
    setSelectedRpIndex(selectedRpIndex + 1);
    setSelectedDrugIndex(0);
    setNotice({ tone: 'info', message: '薬剤を別RPへ分けました。新しいRPで用法を設定してください。' });
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
        setOrder((prev) => ({ ...prev, deletedDocumentIds: [], deletedDocumentContentHashes: {} }));
        if (action === 'expand') onClose?.();
      }
    },
    onError: (error, payload) => {
      const message = error instanceof Error ? error.message : '処方オーダーの保存に失敗しました。';
      setNotice({ tone: 'error', message });
      onSubmitResult?.({ action: payload?.action ?? 'save', ok: false });
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: async (payload: { order: PrescriptionOrder }) => {
      if (isPreviewMode) throw new Error('preview mode');
      if (!patientId) throw new Error('patientId is required');
      return finalizePrescriptionAuthority({
        patientId,
        encounterId: payload.order.encounterId ?? meta.encounterId,
        order: {
          ...payload.order,
          encounterId: payload.order.encounterId ?? meta.encounterId,
        },
      });
    },
    onSuccess: (result) => {
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.message ?? '処方確定に失敗しました。' });
        return;
      }
      setNotice({
        tone: 'success',
        message: `処方を確定しました。status=${result.status ?? 'FINAL'}`,
      });
      queryClient.invalidateQueries({ queryKey: ['charts-prescription-bundles'] });
      queryClient.invalidateQueries({ queryKey: ['charts-order-bundles'] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '処方確定に失敗しました。';
      setNotice({ tone: 'error', message });
    },
  });

  const finalizeSummary = useMemo(() => {
    const rpCount = order.rps.length;
    const drugCount = order.rps.reduce((sum, rp) => sum + rp.drugs.filter((drug) => drug.name.trim()).length, 0);
    const codedDrugCount = order.rps.reduce(
      (sum, rp) => sum + rp.drugs.filter((drug) => drug.name.trim() && drug.code?.trim()).length,
      0,
    );
    const startedDates = order.rps.map((rp) => rp.started?.trim()).filter((value): value is string => Boolean(value));
    return {
      visitDate: order.performDate ?? order.encounterDate ?? meta.visitDate ?? today,
      encounterId: order.encounterId ?? meta.encounterId ?? '—',
      rpCount: `${rpCount}件`,
      drugCount: `${drugCount}件`,
      codedDrugCount: `${codedDrugCount}件`,
      started: startedDates.length > 0 ? Array.from(new Set(startedDates)).join(' / ') : '—',
    };
  }, [meta.encounterId, meta.visitDate, order.encounterDate, order.encounterId, order.performDate, order.rps, today]);
  const finalizeBlockReason = useMemo(() => {
    if (isPreviewMode) return 'プレビューモードでは処方確定できません。通常入力画面で確定してください。';
    if (finalizeMutation.isPending) return '処方確定を実行中です。完了するまで再実行できません。';
    if (mutation.isPending) return '保存処理中です。保存完了後に処方確定できます。';
    return null;
  }, [finalizeMutation.isPending, isPreviewMode, mutation.isPending]);

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
        const result = await checkOrcaMasterStaticOrderInteractions({ codes, effective: searchEffectiveDate });
        if (!result.ok) {
          setNotice({
            tone: 'warning',
            message: result.message ?? 'ORCA master 参照の静的相互作用チェックに失敗したため、そのまま保存します。',
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
              : 'ORCA master 参照の静的相互作用チェックに失敗したため、そのまま保存します。',
        });
      }
      mutation.mutate({ action, order });
    })();
  };

  const beginFinalize = () => {
    if (isPreviewMode) {
      setNotice({ tone: 'info', message: 'プレビューモードでは処方確定できません。' });
      return;
    }
    if (interactionConfirmOpen || finalizeConfirmOpen || finalizeMutation.isPending) return;
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
    setFinalizeConfirmOpen(true);
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
    <section
      className="charts-side-panel__section"
      data-order-entity="medOrder"
      data-order-layout="compact-kirin"
      data-test-id="medOrder-prescription-editor-v2"
    >
      <FocusTrapDialog
        open={interactionConfirmOpen}
        title="処方安全チェック"
        description="保存前に重複投与、静的相互作用、保存不可ルールを確認します。official patient-aware contraindicationcheckv2 とは別の確認です。"
        role="alertdialog"
        onClose={closeInteractionConfirm}
        testId="prescription-interaction-confirm"
      >
        <div className="charts-side-panel__confirm">
          <p className="charts-side-panel__message">ORCA master 参照の静的相互作用チェック</p>
          <ul className="charts-side-panel__confirm-list" aria-label="処方安全チェック結果">
            {safetyItems.map((item) => (
              <li key={item.key} data-safety-tone={item.tone}>
                <strong>{item.label}</strong>: {item.detail}
              </li>
            ))}
          </ul>
          <div className="charts-side-panel__field">
            <label htmlFor={domId('interaction-review-reason')}>確認理由</label>
            <textarea
              id={domId('interaction-review-reason')}
              value={interactionReviewReason}
              onChange={(event) => setInteractionReviewReason(event.target.value)}
              rows={3}
            />
            <p className="charts-side-panel__help">
              警告を確認済みとして保存する場合に入力してください。禁忌または保存不可は編集に戻って修正してください。
            </p>
          </div>
          {interactionPairs.length > 0 ? (
            <ul className="charts-side-panel__notice-list" aria-label="安全チェック区分">
              <li>警告: 重複投与または master 静的相互作用の候補です。</li>
              <li>禁忌: patient-aware contraindicationcheckv2 由来または保存不可ルールで検出した場合は保存を止めます。</li>
              <li>確認済み: 理由を記録して保存を続行する状態です。</li>
            </ul>
          ) : null}
          <p className="charts-side-panel__block-reason" role="status">
            {!interactionReviewReason.trim()
              ? '確認済みとして保存するには、確認理由を入力してください。'
              : '確認理由が入力済みです。保存を続行できます。'}
          </p>
          <div
            className="charts-side-panel__actions charts-side-panel__actions--dialog"
            role="group"
            aria-label="処方安全チェックの確認"
          >
            <button type="button" className="charts-side-panel__action" onClick={closeInteractionConfirm}>
              処方を修正
            </button>
            <button type="button" className="charts-side-panel__action" onClick={closeInteractionConfirm}>
              中止
            </button>
            <button
              type="button"
              className="charts-side-panel__action charts-side-panel__action--save"
              {...{ 'aria-disabled': !interactionReviewReason.trim() || mutation.isPending }}
              data-disabled-reason={!interactionReviewReason.trim() || mutation.isPending ? 'interaction_review_reason_required' : undefined}
              onClick={() => {
                if (!pendingSaveAction || mutation.isPending || !interactionReviewReason.trim()) {
                  return;
                }
                const action = pendingSaveAction;
                setInteractionConfirmOpen(false);
                setInteractionReviewReason('');
                setPendingSaveAction(null);
                mutation.mutate({ action, order });
              }}
            >
              確認済みとして保存
            </button>
          </div>
          {interactionPairs.length === 0 ? (
            <p className="charts-side-panel__message">ORCA master 静的相互作用候補の詳細は取得できませんでした。</p>
          ) : null}
        </div>
      </FocusTrapDialog>
      <CriticalOperationConfirmDialog
        open={finalizeConfirmOpen}
        title="処方確定の確認"
        description="現在の処方内容を確定します。確定後の変更、中止、取消は履歴として扱われます。"
        operationLabel="処方確定"
        patientName={patientId}
        patientFields={[
          { label: '患者番号', value: patientId ?? '—' },
          { label: '氏名', value: '—' },
          { label: '生年月日', value: '—' },
          { label: '性別', value: '—' },
          { label: '年齢', value: '—' },
          { label: '受付日', value: finalizeSummary.visitDate },
          { label: '診療科', value: '—' },
          { label: '担当医', value: '—' },
          { label: '保険組合せ', value: '—' },
          { label: 'ORCA受付ID', value: meta.receptionId ?? '—' },
          { label: '来院参照', value: finalizeSummary.encounterId },
        ]}
        summaryTitle="確定対象サマリ"
        summaryFields={[
          { label: 'RP', value: finalizeSummary.rpCount },
          { label: '薬剤', value: finalizeSummary.drugCount },
          { label: 'コード付き薬剤', value: finalizeSummary.codedDrugCount },
          { label: '開始日', value: finalizeSummary.started },
          { label: 'ORCA状態', value: 'ORCA送信や会計済み確定ではありません' },
        ]}
        confirmLabel="処方を確定する"
        tone="danger"
        confirmDisabled={finalizeMutation.isPending}
        onCancel={() => setFinalizeConfirmOpen(false)}
        onConfirm={() => {
          setFinalizeConfirmOpen(false);
          finalizeMutation.mutate({ order });
        }}
        testId="prescription-finalize-dialog"
      />
      <header className="charts-side-panel__section-header">
        <div className="charts-side-panel__section-header-main">
          <strong title={RP_SHARED_USAGE_RULE}>処方（RP集合）</strong>
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
        {safetyItems.length > 0 && !interactionConfirmOpen ? (
          <div className="charts-side-panel__notice charts-side-panel__notice--warning" aria-label="処方安全チェック結果">
            <strong>処方安全チェック</strong>
            <ul className="charts-side-panel__notice-list">
              {safetyItems.slice(0, 4).map((item) => (
                <li key={`summary-${item.key}`} data-safety-tone={item.tone}>
                  {item.label}: {formatSafetySummaryDetail(item.detail)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <section
          className="charts-order-editor__kirin-grid charts-order-editor__kirin-grid--prescription charts-order-editor__manual-card"
          aria-label="処方オーダー内容"
          data-testid="prescription-order-kirin-grid"
        >
          <fieldset
            disabled={isPreviewMode}
            className="charts-order-editor__kirin-fieldset"
          >
          <div className="charts-order-editor__kirin-grid-header">
            <strong>オーダー内容</strong>
            <div className="charts-order-editor__kirin-grid-actions" aria-label="処方オーダー内容の操作">
              <button
                type="button"
                className="charts-order-editor__icon-action"
                onClick={addRp}
                title="RPを追加"
                aria-label="＋RP"
              >
                +RP
              </button>
              <button
                type="button"
                className="charts-order-editor__icon-action"
                onClick={addDrug}
                title="薬剤行を追加"
                aria-label="＋薬剤行"
              >
                +
              </button>
              <button
                type="button"
                className="charts-order-editor__icon-action charts-order-editor__icon-action--danger"
                onClick={() => {
                  if (!selectedRp) return;
                  removeDrug(selectedRpIndex, selectedDrugIndex);
                }}
                aria-disabled={!selectedRp ? 'true' : undefined}
                title="選択薬剤を削除"
                aria-label="選択薬剤を削除"
              >
                -
              </button>
              <button
                type="button"
                className="charts-order-editor__icon-action charts-order-editor__icon-action--danger"
                onClick={clearAll}
                title="入力を全クリア"
                aria-label="入力を全クリア"
              >
                x
              </button>
            </div>
          </div>
          {selectedRp ? (
            <div className="charts-order-editor__kirin-rp-settings" aria-label="選択中RP設定">
              <div className="charts-side-panel__field">
                <label>院内/院外</label>
                <div className="charts-side-panel__switch-group" role="group" aria-label="院内院外選択">
                  {(['in', 'out'] as PrescriptionLocation[]).map((location) => (
                    <button
                      key={`rx-grid-location-${location}`}
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
                      key={`rx-grid-category-${category}`}
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
          ) : null}
          <div className="charts-order-editor__kirin-table charts-order-editor__kirin-table--prescription" role="table" aria-label="処方オーダー内容グリッド">
            <div className="charts-order-editor__kirin-table-row charts-order-editor__kirin-table-row--header" role="row">
              {['RP', '薬剤名称', '薬剤量', '成分量', 'その他', '後発変更可否', '薬剤コメント', '用法', '日数・回数'].map((column) => (
                <span key={`rx-grid-column-${column}`} role="columnheader">
                  {column}
                </span>
              ))}
            </div>
            {prescriptionGridRows.map((row) => (
              <div
                key={row.key}
                className="charts-order-editor__kirin-table-row"
                role="row"
                data-selected={selectedRpIndex === row.rpIndex && selectedDrugIndex === row.drugIndex ? 'true' : undefined}
                onClick={() => {
                  setSelectedRpIndex(row.rpIndex);
                  setSelectedDrugIndex(row.drugIndex);
                }}
              >
                <span role="cell">{row.rpLabel}</span>
                <span role="cell">
                  {row.drug ? (
                    <>
                      <input
                        className="charts-order-editor__kirin-cell-control"
                        list={selectedRpIndex === row.rpIndex && selectedDrugIndex === row.drugIndex ? domId(`grid-drug-candidates-${row.rpIndex}-${row.drugIndex}`) : undefined}
                        value={row.drug.name}
                        onFocus={() => {
                          setSelectedRpIndex(row.rpIndex);
                          setSelectedDrugIndex(row.drugIndex);
                          setSearchKeyword(row.drug?.name ?? '');
                          setSearchOrigin('drug-name');
                        }}
                        onChange={(event) => handleDrugNameInput(row.rpIndex, row.drugIndex, event.target.value)}
                        aria-label={`${row.rpLabel} 薬剤${row.drugIndex + 1} 薬剤名称`}
                      />
                      {selectedRpIndex === row.rpIndex && selectedDrugIndex === row.drugIndex ? (
                        <datalist id={domId(`grid-drug-candidates-${row.rpIndex}-${row.drugIndex}`)}>
                          {filteredCandidates.map((item) => (
                            <option
                              key={`rx-grid-drug-option-${item.code ?? item.name}`}
                              value={item.name}
                              label={item.code ? `${item.code} ${item.unit ?? ''}`.trim() : item.unit}
                            />
                          ))}
                        </datalist>
                      ) : null}
                    </>
                  ) : (
                    row.drugName
                  )}
                </span>
                <span role="cell">
                  {row.drug ? (
                    <span className="charts-order-editor__kirin-cell-stack">
                      <input
                        className="charts-order-editor__kirin-cell-control"
                        value={row.drug.quantity}
                        onChange={(event) =>
                          updateDrug(row.rpIndex, row.drugIndex, (current) => ({
                            ...current,
                            quantity: event.target.value,
                          }))
                        }
                        aria-label={`${row.rpLabel} 薬剤${row.drugIndex + 1} 薬剤量`}
                      />
                      <input
                        className="charts-order-editor__kirin-cell-control"
                        value={row.drug.unit}
                        onChange={(event) =>
                          updateDrug(row.rpIndex, row.drugIndex, (current) => ({
                            ...current,
                            unit: event.target.value,
                          }))
                        }
                        aria-label={`${row.rpLabel} 薬剤${row.drugIndex + 1} 単位`}
                      />
                    </span>
                  ) : (
                    row.quantity
                  )}
                </span>
                <span role="cell" data-unresolved={row.ingredientUnresolved ? 'true' : undefined}>
                  {row.ingredientAmount}
                </span>
                <span role="cell" data-unresolved={!row.drug && row.otherUnresolved ? 'true' : undefined}>
                  {row.drug ? (
                    <span className="charts-order-editor__kirin-cell-stack">
                      <label className="charts-order-editor__kirin-checkbox-control">
                        <input
                          type="checkbox"
                          checked={row.drug.patientRequest}
                          onChange={(event) =>
                            updateDrug(row.rpIndex, row.drugIndex, (current) => ({
                              ...current,
                              patientRequest: event.target.checked,
                            }))
                          }
                          aria-label={`${row.rpLabel} 薬剤${row.drugIndex + 1} 患者希望`}
                        />
                        <span>患者希望</span>
                      </label>
                      <label className="charts-order-editor__kirin-checkbox-control">
                        <input
                          type="checkbox"
                          checked={row.drug.isGeneralNamePrescription}
                          onChange={(event) =>
                            updateDrug(row.rpIndex, row.drugIndex, (current) => ({
                              ...current,
                              isGeneralNamePrescription: event.target.checked,
                            }))
                          }
                          aria-label={`${row.rpLabel} 薬剤${row.drugIndex + 1} 一般名指定`}
                        />
                        <span>{row.drug.isGeneralNamePrescription ? '一般名指定' : '銘柄指定'}</span>
                      </label>
                      {row.drug.claimComments.length > 0 ? <span>請求コメント{row.drug.claimComments.length}件</span> : null}
                    </span>
                  ) : (
                    row.other
                  )}
                </span>
                <span role="cell">
                  {row.drug ? (
                    <label className="charts-order-editor__kirin-checkbox-control">
                      <input
                        type="checkbox"
                        checked={row.drug.genericChangeAllowed !== false}
                        onChange={(event) =>
                          updateDrug(row.rpIndex, row.drugIndex, (current) => ({
                            ...current,
                            genericChangeAllowed: event.target.checked,
                          }))
                        }
                        aria-label={`${row.rpLabel} 薬剤${row.drugIndex + 1} 後発変更可否`}
                      />
                      <span>{row.drug.genericChangeAllowed === false ? '変更不可' : '変更可能'}</span>
                    </label>
                  ) : (
                    row.genericChange
                  )}
                </span>
                <span role="cell">
                  {row.drug ? (
                    <input
                      className="charts-order-editor__kirin-cell-control"
                      value={row.drug.drugComment}
                      onChange={(event) =>
                        updateDrug(row.rpIndex, row.drugIndex, (current) => ({
                          ...current,
                          drugComment: event.target.value,
                        }))
                      }
                      aria-label={`${row.rpLabel} 薬剤${row.drugIndex + 1} 薬剤コメント`}
                    />
                  ) : (
                    row.drugComment
                  )}
                </span>
                <span role="cell">
                  <span className="charts-order-editor__kirin-cell-stack">
                    <select
                      className="charts-order-editor__kirin-cell-control"
                      value={row.rp.usageCode ?? ''}
                      onChange={(event) => {
                        const code = event.target.value;
                        const selected = usageOptions.find((option) => (option.code?.trim() ?? '') === code);
                        updateRp(row.rpIndex, (rp) => ({
                          ...rp,
                          usageCode: code || undefined,
                          usage: selected?.name ?? rp.usage,
                        }));
                      }}
                      aria-label={`${row.rpLabel} 用法マスタ`}
                    >
                      <option value="">候補</option>
                      {usageOptions.map((item) => (
                        <option key={`grid-usage-${item.code ?? item.name}`} value={item.code?.trim() ?? ''}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    <input
                      className="charts-order-editor__kirin-cell-control"
                      value={row.rp.usage}
                      onChange={(event) =>
                        updateRp(row.rpIndex, (rp) => ({
                          ...rp,
                          usage: event.target.value,
                        }))
                      }
                      aria-label={`${row.rpLabel} 用法`}
                    />
                  </span>
                </span>
                <span role="cell">
                  <input
                    className="charts-order-editor__kirin-cell-control"
                    value={row.rp.daysOrTimes}
                    onChange={(event) =>
                      updateRp(row.rpIndex, (rp) => ({
                        ...rp,
                        daysOrTimes: event.target.value,
                      }))
                    }
                    aria-label={`${row.rpLabel} 日数・回数`}
                  />
                </span>
              </div>
            ))}
          </div>

          <div className="charts-side-panel__workspace" data-variant={variant} data-order-editor-layout="manual-first">
          <aside className="charts-side-panel__workspace-left charts-order-editor__secondary" aria-label="候補・セット・RP一覧">
            <div className="charts-side-panel__subsection charts-order-editor__secondary-section" aria-label="RP一覧">
              <div className="charts-side-panel__subheader">
                <strong>RP一覧</strong>
                <span className="charts-side-panel__search-count">{order.rps.length}件</span>
              </div>
              <div className="charts-side-panel__template-actions" role="list" aria-label="RP選択">
                {order.rps.map((rp, index) => {
                  const label = resolvePrescriptionRpAutoName(rp);
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
                      <p className="charts-side-panel__help">
                        共通用法: {rp.usage || '未設定'} / {rp.category === 'tonyo' ? '回数' : '日数'}: {rp.daysOrTimes || '未設定'} / 薬剤{rp.drugs.length}件
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {!prescriptionMasterVisibility.visible ? (
              <div className="charts-side-panel__notice charts-side-panel__notice--warning">
                {prescriptionMasterVisibility.hiddenMessage}
              </div>
            ) : (
            <details className="charts-side-panel__subsection charts-side-panel__subsection--search charts-order-editor__secondary-section">
              <summary className="charts-side-panel__subheader charts-order-editor__secondary-summary">
                <strong>薬剤検索</strong>
                <span className="charts-side-panel__search-count">
                  {drugSearchQuery.isFetching ? '検索中...' : `${filteredCandidates.length}件`}
                </span>
                <span className="charts-side-panel__fold-badge">候補を開く</span>
              </summary>
              <div className="charts-side-panel__field">
                <label htmlFor={domId('search-keyword')}>キーワード</label>
                <input
                  id={domId('search-keyword')}
                  value={searchKeyword}
                  onChange={(event) => {
                    setSearchOrigin('panel');
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
              {searchOrigin === 'panel' && filteredCandidates.length > 0 ? (
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
                      <span>反映</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </details>
            )}

            {showInputSetChooser ? (
              <details className="charts-side-panel__subsection charts-side-panel__subsection--search charts-order-editor__secondary-section">
              <summary className="charts-side-panel__subheader charts-order-editor__secondary-summary">
                <strong>ORCA入力セット</strong>
                <span className="charts-side-panel__search-count">{inputSetItems.length}件</span>
                <span className="charts-side-panel__fold-badge">候補を開く</span>
              </summary>
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
              <p className="charts-side-panel__help">ORCA入力セットは下書きフォームへ反映するだけです。処方確定・ORCA送信・会計済み確定は行いません。</p>
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
                      <span>反映</span>
                    </button>
                  ))}
                </div>
              ) : null}
              </details>
            ) : null}
          </aside>

          <div className="charts-side-panel__workspace-right charts-side-panel__workspace-right--full">
            {selectedRp ? (
              <div className="charts-side-panel__form charts-order-editor__integrated-details" aria-label="選択中RP詳細">

                <div className="charts-side-panel__field-row charts-side-panel__meta-section charts-side-panel__meta-section--memo charts-order-editor__rx-compact-footer">
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

                <div className="charts-side-panel__field-row charts-side-panel__meta-section charts-side-panel__meta-section--start charts-order-editor__rx-compact-footer">
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

                {selectedDrug
                  ? (() => {
                      const rowIssueGeneric = issueByKey.get(`drug_rule_generic_${selectedRpIndex}_${selectedDrugIndex}`);
                      const rowIssueClaim = issueByKey.get(`drug_rule_claim_${selectedRpIndex}_${selectedDrugIndex}`);
                      const enforceRule = !selectedDrug.patientRequest;
                      return (
                        <div
                          className="charts-side-panel__subsection charts-side-panel__meta-section charts-side-panel__meta-section--items charts-order-editor__manual-card"
                          data-invalid={rowIssueGeneric || rowIssueClaim ? 'true' : undefined}
                          aria-label="選択薬剤の詳細"
                        >
                          <div className="charts-side-panel__subheader">
                            <strong>薬剤{selectedDrugIndex + 1} 詳細</strong>
                            <span className="charts-side-panel__search-count">最低薬価: {selectedDrugGenericPrice ?? '-'}</span>
                          </div>
                          <div className="charts-side-panel__template-actions" aria-label={`薬剤${selectedDrugIndex + 1}定型文`}>
                            {DRUG_COMMENT_TEMPLATES.map((templateText) => (
                              <button
                                key={`rx-drug-template-${templateText}`}
                                type="button"
                                className="charts-side-panel__chip-button"
                                onClick={() =>
                                  updateDrug(selectedRpIndex, selectedDrugIndex, (current) => ({
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
                            {selectedRp.drugs.length > 1 ? (
                              <button
                                type="button"
                                className="charts-side-panel__action"
                                onClick={() => splitDrugToNewRp(selectedDrugIndex)}
                                title={RP_SHARED_USAGE_RULE}
                              >
                                この薬剤を別RPへ
                              </button>
                            ) : null}
                          </div>
                          <div className="charts-side-panel__template-actions" aria-label={`薬剤${selectedDrugIndex + 1}請求用コメント一覧`}>
                            {selectedDrug.claimComments.map((comment, commentIndex) => {
                              const uiMeta = resolveStructuredCommentUiMeta(comment.code);
                              return (
                                <div key={comment.id} className="charts-side-panel__item-actions">
                                  <button
                                    type="button"
                                    className="charts-side-panel__chip-button charts-side-panel__chip-button--recommend"
                                    onClick={() =>
                                      updateDrug(selectedRpIndex, selectedDrugIndex, (current) => ({
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
                                      <label htmlFor={domId(`drug-claim-note-${selectedDrugIndex}-${commentIndex}`)}>
                                        薬剤{selectedDrugIndex + 1} 請求コメント {commentIndex + 1} 補足値
                                      </label>
                                      <input
                                        id={domId(`drug-claim-note-${selectedDrugIndex}-${commentIndex}`)}
                                        value={comment.note ?? ''}
                                        onChange={(event) =>
                                          updateDrug(selectedRpIndex, selectedDrugIndex, (current) => ({
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
                                  updateDrug(selectedRpIndex, selectedDrugIndex, (current) => ({
                                    ...current,
                                    claimComments: [...current.claimComments, createClaimComment(template.name, template.code)],
                                  }));
                                }}
                              >
                                {template.name}
                              </button>
                            ))}
                          </div>
                          {resolveStructuredCommentUiMeta(claimDraft.code) ? (
                            <p className="charts-side-panel__help">{resolveStructuredCommentUiMeta(claimDraft.code)?.hint}</p>
                          ) : null}
                          {enforceRule ? (
                            <p className="charts-side-panel__help">
                              患者希望以外の場合は「後発変更 不可」+「請求用コメント」が必須です。
                            </p>
                          ) : null}
                          {rowIssueGeneric || rowIssueClaim ? (
                            <p className="charts-side-panel__field-error" role="alert">
                              {[rowIssueGeneric, rowIssueClaim].filter(Boolean).join(' / ')}
                            </p>
                          ) : null}
                        </div>
                      );
                    })()
                  : null}
              </div>
            ) : (
              <p className="order-dock__empty">RPを選択してください。</p>
            )}
          </div>
          </div>
          </fieldset>
        </section>
      </div>

      <footer className="charts-side-panel__dock-footer charts-order-editor__sticky-footer" aria-label="保存操作">
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
          <button
            type="button"
            className="charts-side-panel__action charts-side-panel__action--finalize"
            onClick={beginFinalize}
            aria-describedby={finalizeBlockReason ? domId('finalize-block-reason') : undefined}
            disabled={mutation.isPending || finalizeMutation.isPending || isPreviewMode}
          >
            処方確定
          </button>
          {onClose ? (
            <button type="button" className="charts-side-panel__action charts-side-panel__action--close" onClick={onClose}>
              閉じる
            </button>
          ) : null}
        </div>
        {finalizeBlockReason ? (
          <p id={domId('finalize-block-reason')} className="charts-side-panel__block-reason" role="status">
            {finalizeBlockReason}
          </p>
        ) : null}
      </footer>
    </section>
  );
}
