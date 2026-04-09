import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { FocusTrapDialog } from '../../components/modals/FocusTrapDialog';
import { fetchOrderRecommendations, type OrderRecommendationCandidate } from './orderRecommendationApi';

type RecommendationScope = 'category' | 'all';

const buildRecommendationFrom = () => {
  const base = new Date();
  base.setMonth(base.getMonth() - 6);
  return base.toISOString().slice(0, 10);
};

const normalizeKeyword = (value: string) => value.trim().toLowerCase();

const resolveEntityLabel = (entity?: string | null): string => {
  switch ((entity ?? '').trim()) {
    case 'treatmentOrder':
      return '処置';
    case 'surgeryOrder':
      return '手術';
    case 'otherOrder':
      return 'その他';
    case 'testOrder':
      return '検査';
    case 'physiologyOrder':
      return '生理';
    case 'bacteriaOrder':
      return '細菌';
    case 'radiologyOrder':
      return '画像診断';
    case 'instractionChargeOrder':
      return '指導料';
    case 'baseChargeOrder':
      return '基本料';
    case 'injectionOrder':
      return '注射';
    case 'medOrder':
      return '処方';
    default:
      return entity?.trim() || '不明';
  }
};

const resolveCandidateLabel = (candidate: OrderRecommendationCandidate) => {
  const bundle = candidate.template.bundleName?.trim() ?? '';
  const firstItem = candidate.template.items.find((item) => item.name?.trim())?.name?.trim() ?? '';
  const base = bundle || firstItem || '名称未設定';
  const usage = candidate.template.admin?.trim() ?? '';
  return usage ? `${base} / ${usage}` : base;
};

export function OrderRecommendationModal(props: {
  open: boolean;
  patientId?: string;
  defaultEntity?: string;
  defaultScope?: RecommendationScope;
  onClose: () => void;
  onApply: (candidate: OrderRecommendationCandidate, resolvedEntity: string) => void;
}) {
  const { open, patientId, defaultEntity, defaultScope = 'category', onClose, onApply } = props;
  const [scope, setScope] = useState<RecommendationScope>(defaultScope);
  const [keyword, setKeyword] = useState('');
  const recommendationFrom = useMemo(() => buildRecommendationFrom(), []);

  useEffect(() => {
    if (!open) return;
    setScope(defaultScope);
    setKeyword('');
  }, [defaultScope, open]);

  const resolvedEntity = (defaultEntity ?? '').trim();
  const effectiveEntity = scope === 'category' && resolvedEntity ? resolvedEntity : undefined;
  const queryKey = useMemo(
    () => ['charts-order-recommendations-modal', patientId, scope, effectiveEntity ?? 'all', recommendationFrom],
    [effectiveEntity, patientId, recommendationFrom, scope],
  );
  const query = useQuery({
    queryKey,
    queryFn: () => {
      if (!patientId) throw new Error('patientId is required');
      return fetchOrderRecommendations({
        patientId,
        entity: effectiveEntity,
        from: recommendationFrom,
        includeFacility: true,
        patientLimit: scope === 'all' ? 24 : 12,
        facilityLimit: scope === 'all' ? 24 : 12,
        scanLimit: 1200,
      });
    },
    enabled: open && Boolean(patientId) && (scope === 'all' || Boolean(effectiveEntity)),
    staleTime: 60_000,
    retry: 1,
  });

  const candidates = useMemo(() => {
    const list = query.data?.recommendations ?? [];
    const normalized = normalizeKeyword(keyword);
    if (!normalized) return list;
    return list.filter((candidate) => {
      const hay = [
        candidate.key,
        candidate.entity ?? '',
        resolveEntityLabel(candidate.entity),
        resolveCandidateLabel(candidate),
        candidate.template.bundleName,
        candidate.template.admin,
        candidate.template.memo,
        ...candidate.template.items.map((item) => item.name),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(normalized);
    });
  }, [keyword, query.data?.recommendations]);

  const groupedByEntity = useMemo(() => {
    if (scope !== 'all') return null;
    const map = new Map<string, OrderRecommendationCandidate[]>();
    for (const candidate of candidates) {
      const entity = (candidate.entity ?? '').trim() || 'unknown';
      const list = map.get(entity) ?? [];
      list.push(candidate);
      map.set(entity, list);
    }
    return Array.from(map.entries()).sort((a, b) => resolveEntityLabel(a[0]).localeCompare(resolveEntityLabel(b[0]), 'ja'));
  }, [candidates, scope]);

  const canApply = Boolean(patientId);

  return (
    <FocusTrapDialog
      open={open}
      title="頻用オーダー"
      description="カテゴリ内または横断で候補を表示し、右ペインの入力欄へ反映します。"
      onClose={onClose}
      testId="order-recommendation-modal"
    >
      <div className="order-recommend-modal">
        <div className="order-recommend-modal__toolbar" role="group" aria-label="頻用オーダー表示">
          <div className="order-recommend-modal__scope">
            <button
              type="button"
              className="order-recommend-modal__scope-button"
              data-active={scope === 'category' ? '1' : '0'}
              onClick={() => setScope('category')}
              disabled={!resolvedEntity}
              title={!resolvedEntity ? 'カテゴリ未選択のため横断のみ利用できます。' : undefined}
            >
              このカテゴリ
            </button>
            <button
              type="button"
              className="order-recommend-modal__scope-button"
              data-active={scope === 'all' ? '1' : '0'}
              onClick={() => setScope('all')}
            >
              横断
            </button>
          </div>
          <div className="order-recommend-modal__search">
            <label htmlFor="order-recommend-keyword">検索</label>
            <input
              id="order-recommend-keyword"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="例: アムロジピン / 造影 / 初診"
            />
          </div>
          <div className="order-recommend-modal__meta" aria-live="polite">
            {query.isFetching ? '取得中…' : query.isError ? '取得失敗' : `${candidates.length}件`}
          </div>
        </div>

        {!patientId ? <p className="order-recommend-modal__empty">患者未選択のため候補を表示できません。</p> : null}
        {query.isError ? (
          <p className="order-recommend-modal__empty">頻用候補の取得に失敗しました。通信回復後に再試行してください。</p>
        ) : null}
        {!query.isFetching && candidates.length === 0 && patientId ? (
          <p className="order-recommend-modal__empty">候補がありません。</p>
        ) : null}

        {scope === 'all' && groupedByEntity ? (
          <div className="order-recommend-modal__groups" role="list" aria-label="頻用候補（横断）">
            {groupedByEntity.map(([entity, list]) => (
              <section key={entity} className="order-recommend-modal__group" role="listitem">
                <header className="order-recommend-modal__group-header">
                  <strong>{resolveEntityLabel(entity)}</strong>
                  <span>{list.length}件</span>
                </header>
                <div className="order-recommend-modal__candidate-grid">
                  {list.map((candidate) => {
                    const label = resolveCandidateLabel(candidate);
                    return (
                      <button
                        key={candidate.key}
                        type="button"
                        className="order-recommend-modal__candidate"
                        onClick={() => {
                          if (!canApply) return;
                          const nextEntity = (candidate.entity ?? '').trim();
                          onApply(candidate, nextEntity || resolvedEntity);
                        }}
                        disabled={!canApply}
                        title={`${label} / ${candidate.source === 'patient' ? '患者' : '施設'}:${candidate.count}回 / 最終:${candidate.lastUsedAt}`}
                      >
                        <span className="order-recommend-modal__candidate-label">{label}</span>
                        <span className="order-recommend-modal__candidate-meta">
                          {candidate.source === 'patient' ? '患者' : '施設'}:{candidate.count} / {candidate.lastUsedAt}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="order-recommend-modal__candidate-grid" role="list" aria-label="頻用候補（カテゴリ）">
            {candidates.map((candidate) => {
              const label = resolveCandidateLabel(candidate);
              return (
                <button
                  key={candidate.key}
                  type="button"
                  className="order-recommend-modal__candidate"
                  onClick={() => {
                    if (!canApply) return;
                    onApply(candidate, resolvedEntity);
                  }}
                  disabled={!canApply}
                  title={`${label} / ${candidate.source === 'patient' ? '患者' : '施設'}:${candidate.count}回 / 最終:${candidate.lastUsedAt}`}
                >
                  <span className="order-recommend-modal__candidate-label">{label}</span>
                  <span className="order-recommend-modal__candidate-meta">
                    {candidate.source === 'patient' ? '患者' : '施設'}:{candidate.count} / {candidate.lastUsedAt}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </FocusTrapDialog>
  );
}
