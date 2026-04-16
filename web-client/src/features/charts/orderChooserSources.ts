import {
  resolveCanonicalOrderEntity,
  resolveOrderGroupKeyByEntity,
  type OrderEntity,
  type OrderGroupKey,
} from './orderCategoryRegistry';
import type { OrcaOrderInputSetSummary } from './orcaOrderInputSetApi';
import type { OrderRecommendationCandidate } from './orderRecommendationApi';

export type OrderChooserSourceKey =
  | 'existing'
  | 'patient'
  | 'facility'
  | 'orca-input-set'
  | 'orca-set'
  | 'search';

export type OrderChooserSourceSpec = {
  key: OrderChooserSourceKey;
  label: string;
  note?: string;
};

const BASE_ORDER_CHOOSER_SOURCES: ReadonlyArray<OrderChooserSourceSpec> = [
  { key: 'existing', label: '既存オーダー' },
  { key: 'patient', label: '患者候補', note: '患者候補はこの患者の既存入力から出します。' },
  { key: 'facility', label: '施設頻用', note: '施設頻用は施設全体の頻用候補です。' },
  { key: 'search', label: '検索して追加' },
];

const PRESCRIPTION_CHOOSER_SOURCES: ReadonlyArray<OrderChooserSourceSpec> = [
  ...BASE_ORDER_CHOOSER_SOURCES.slice(0, 3),
  { key: 'orca-input-set', label: 'ORCA入力セット', note: 'setCode は展開専用です。反映後の編集内容には保持しません。' },
  BASE_ORDER_CHOOSER_SOURCES[3]!,
];

const GENERIC_ORDER_CHOOSER_SOURCES: ReadonlyArray<OrderChooserSourceSpec> = [
  ...BASE_ORDER_CHOOSER_SOURCES.slice(0, 3),
  { key: 'orca-set', label: 'ORCA診療セット', note: 'setCode は展開専用です。反映後の編集内容には保持しません。' },
  BASE_ORDER_CHOOSER_SOURCES[3]!,
];

export const resolveOrderChooserSources = (groupKey: OrderGroupKey): ReadonlyArray<OrderChooserSourceSpec> => {
  if (groupKey === 'prescription') return PRESCRIPTION_CHOOSER_SOURCES;
  return GENERIC_ORDER_CHOOSER_SOURCES;
};

export const splitRecommendationCandidates = (candidates: OrderRecommendationCandidate[]) => {
  return {
    patient: candidates.filter((candidate) => candidate.source === 'patient'),
    facility: candidates.filter((candidate) => candidate.source === 'facility'),
  };
};

export const resolveOrderChooserCtaLabel = (mode: 'edit' | 'apply' | 'create') => {
  switch (mode) {
    case 'apply':
      return '反映';
    case 'create':
      return '新規作成を開く';
    default:
      return '編集面で開く';
  }
};

export const filterInputSetItemsForEntity = (
  items: OrcaOrderInputSetSummary[],
  selectedEntity: OrderEntity,
): OrcaOrderInputSetSummary[] => {
  const canonicalSelected = resolveCanonicalOrderEntity(selectedEntity) ?? selectedEntity;
  const selectedGroup = resolveOrderGroupKeyByEntity(canonicalSelected);
  if (!selectedGroup) return [];

  return items.filter((item) => {
    const rawEntity = typeof item.entity === 'string' ? item.entity.trim() : '';
    if (!rawEntity) return false;
    const canonicalEntity = resolveCanonicalOrderEntity(rawEntity) ?? rawEntity;
    const itemGroup = resolveOrderGroupKeyByEntity(canonicalEntity);
    if (!itemGroup || itemGroup !== selectedGroup) return false;
    if (itemGroup === 'prescription') {
      return canonicalEntity === 'medOrder';
    }
    return canonicalEntity === canonicalSelected;
  });
};
