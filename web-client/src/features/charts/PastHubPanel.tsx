import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { ReceptionEntry } from '../outpatient/types';
import type { OutpatientEncounterContext } from './encounterContext';
import { normalizeVisitDate } from './encounterContext';
import type { LetterModulePayload } from './letterApi';
import { fetchOrderBundles, type OrderBundle } from './orderBundleApi';
import { SOAP_SECTION_LABELS, formatSoapAuthoredAt, getLatestSoapEntries, type SoapEntry, type SoapSectionKey } from './soapNote';
import { resolveUserSafeFetchFailure } from './userSafeErrorCopy';

export type PastHubOrderEntity =
  | 'medOrder'
  | 'injectionOrder'
  | 'treatmentOrder'
  | 'surgeryOrder'
  | 'otherOrder'
  | 'testOrder'
  | 'physiologyOrder'
  | 'bacteriaOrder'
  | 'radiologyOrder'
  | 'instractionChargeOrder'
  | 'baseChargeOrder';

const ORDER_ENTITY_LABEL: Record<PastHubOrderEntity, string> = {
  medOrder: '処方',
  injectionOrder: '注射',
  treatmentOrder: '処置',
  surgeryOrder: '手術',
  otherOrder: 'その他',
  testOrder: '検査',
  physiologyOrder: '生理検査',
  bacteriaOrder: '細菌検査',
  radiologyOrder: '画像診断',
  instractionChargeOrder: '指導料',
  baseChargeOrder: '基本料',
};

const ORDER_ENTITY_SORT: PastHubOrderEntity[] = [
  'medOrder',
  'injectionOrder',
  'treatmentOrder',
  'surgeryOrder',
  'otherOrder',
  'testOrder',
  'physiologyOrder',
  'bacteriaOrder',
  'radiologyOrder',
  'instractionChargeOrder',
  'baseChargeOrder',
];

const isPastHubOrderEntity = (value: string): value is PastHubOrderEntity => {
  return (ORDER_ENTITY_SORT as readonly string[]).includes(value);
};

const DO_COPY_SECTIONS: SoapSectionKey[] = ['subjective', 'objective', 'assessment', 'plan'];

const toIsoDate = (value: Date) => value.toISOString().slice(0, 10);

const resolveEntryId = (entry: ReceptionEntry) =>
  entry.encounterKey ?? entry.scheduleKey ?? entry.receptionId ?? entry.appointmentId ?? entry.patientId ?? entry.id;

const resolveEncounterSelectionKey = (context: OutpatientEncounterContext) =>
  context.encounterKey ??
  context.scheduleKey ??
  context.receptionId ??
  context.appointmentId ??
  context.patientId ??
  context.visitDate;

const resolveVisitDate = (entry: ReceptionEntry): string => {
  const date = normalizeVisitDate(entry.visitDate) ?? '';
  return date;
};

const formatEntryLabel = (entry: ReceptionEntry): string => {
  const date = resolveVisitDate(entry);
  const dept = entry.department ?? '診療科不明';
  const phys = entry.physician ?? '医師不明';
  const parts = [date, dept, phys].filter(Boolean);
  return parts.join(' / ') || '受診情報不明';
};

const formatOrderBundleLabel = (bundle: OrderBundle): string => {
  const started = bundle.started?.slice(0, 10);
  const items = bundle.items?.length ?? 0;
  const name = bundle.bundleName?.trim() || '名称未設定';
  const meta = [started ? `開始:${started}` : null, items ? `項目:${items}` : null].filter(Boolean).join(' / ');
  return meta ? `${name} (${meta})` : name;
};

const makeFromDate = (todayIso: string, days: number): string => {
  const base = new Date(`${todayIso}T00:00:00.000Z`);
  if (!Number.isFinite(base.getTime())) return todayIso;
  base.setUTCDate(base.getUTCDate() - days);
  return toIsoDate(base);
};

type DayGroup = {
  date: string;
  entries: ReceptionEntry[];
};

export type PastHubPanelProps = {
  patientId?: string;
  entries: ReceptionEntry[];
  soapHistory?: SoapEntry[];
  doCopyEnabled?: boolean;
  onRequestDoCopy?: (payload: { section: SoapSectionKey; entry: SoapEntry }) => void;
  onRequestDoCopyBatch?: (payload: { sections: Array<{ section: SoapSectionKey; entry: SoapEntry }>; sourceDate?: string }) => void;
  doOrderEnabled?: boolean;
  doOrderDisabledReason?: string;
  onRequestOrderDo?: (payload: { entity: PastHubOrderEntity; bundle: OrderBundle }) => void;
  doDocumentEnabled?: boolean;
  doDocumentDisabledReason?: string;
  onRequestDocumentDo?: (payload: { letter: LetterModulePayload }) => void;
  selectedContext: OutpatientEncounterContext;
  switchLocked: boolean;
  switchLockedReason?: string;
  todayIso: string; // YYYY-MM-DD
  onSelectEncounter: (next: Partial<OutpatientEncounterContext>) => void;
};

export function PastHubPanel({
  patientId,
  entries,
  soapHistory = [],
  doCopyEnabled = false,
  onRequestDoCopy,
  onRequestDoCopyBatch,
  doOrderEnabled = false,
  doOrderDisabledReason,
  onRequestOrderDo,
  selectedContext,
  switchLocked,
  switchLockedReason,
  todayIso,
  onSelectEncounter,
}: PastHubPanelProps) {
  const historyEntries = useMemo(() => {
    const copy = [...entries];
    copy.sort((a, b) => (resolveVisitDate(b) || '').localeCompare(resolveVisitDate(a) || ''));
    return copy;
  }, [entries]);

  const dayGroups = useMemo<DayGroup[]>(() => {
    const map = new Map<string, ReceptionEntry[]>();
    historyEntries.forEach((entry) => {
      const date = resolveVisitDate(entry) || '—';
      const list = map.get(date) ?? [];
      list.push(entry);
      map.set(date, list);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, list]) => ({ date, entries: list }));
  }, [historyEntries]);

  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  const [doFeedback, setDoFeedback] = useState<string | null>(null);
  useEffect(() => {
    // Patient switch: reset "initially open last 2" behavior.
    setOpenDays({});
    setDoFeedback(null);
  }, [patientId]);

  const from90Days = useMemo(() => makeFromDate(todayIso, 90), [todayIso]);
  const bundlesQuery = useQuery({
    queryKey: ['charts-past-hub-order-bundles', patientId, from90Days],
    queryFn: async () => {
      if (!patientId) return { ok: false, bundles: [] as OrderBundle[], message: 'patientId is missing' };
      try {
        return await fetchOrderBundles({ patientId, from: from90Days });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, bundles: [] as OrderBundle[], message };
      }
    },
    enabled: Boolean(patientId),
    staleTime: 30 * 1000,
  });

  const bundlesByDate = useMemo(() => {
    const map = new Map<string, OrderBundle[]>();
    const bundles = bundlesQuery.data?.ok ? bundlesQuery.data.bundles : [];
    bundles.forEach((bundle) => {
      const started = bundle.started?.slice(0, 10) ?? '—';
      const list = map.get(started) ?? [];
      list.push(bundle);
      map.set(started, list);
    });
    return map;
  }, [bundlesQuery.data]);

  const selectedEncounterKey = useMemo(() => {
    return resolveEncounterSelectionKey(selectedContext) ?? 'none';
  }, [
    selectedContext.appointmentId,
    selectedContext.encounterKey,
    selectedContext.patientId,
    selectedContext.receptionId,
    selectedContext.scheduleKey,
    selectedContext.visitDate,
  ]);

  const soapLatestBySection = useMemo(() => getLatestSoapEntries(soapHistory), [soapHistory]);
  const canDoCopy = Boolean(doCopyEnabled && onRequestDoCopy);
  const doCopySections = useMemo(
    () =>
      DO_COPY_SECTIONS.flatMap((section) => {
        const entry = soapLatestBySection.get(section);
        return entry ? [{ section, entry }] : [];
      }),
    [soapLatestBySection],
  );
  const canDoCopyBatch = Boolean(canDoCopy && onRequestDoCopyBatch && doCopySections.length > 0);
  const activeDate = normalizeVisitDate(selectedContext.visitDate) ?? '';

  if (!patientId) {
    return (
      <section className="charts-past-hub" aria-label="Past Hub（過去カルテとオーダー）">
        <header className="charts-past-hub__header">
          <div>
            <strong>Past Hub</strong>
            <p className="charts-past-hub__desc">患者未選択のため過去参照は表示できません。</p>
          </div>
        </header>
        <p className="patients-tab__detail-empty" role="status">
          患者未選択です。
        </p>
      </section>
    );
  }

  return (
    <section className="charts-past-hub" aria-label="Past Hub（過去カルテとオーダー）">
      <header className="charts-past-hub__header">
        <div>
          <strong>Past Hub</strong>
          <p className="charts-past-hub__desc">日付ごとに折りたたみ、左に過去カルテ、右にオーダー情報をまとめます（初期表示は全て閉じる）。</p>
        </div>
      </header>

      <div className="charts-past-hub__content" aria-label="過去カルテ一覧">
        {doFeedback ? (
          <p className="charts-past-hub__feedback" role="status">
            {doFeedback}
          </p>
        ) : null}
        {switchLocked ? (
          <p className="charts-past-hub__guard" role="status">
            患者切替はロック中です: {switchLockedReason ?? '処理中/閲覧専用'}
          </p>
        ) : null}

        {dayGroups.length === 0 ? (
          <p className="patients-tab__detail-empty" role="status">
            受診履歴がありません。
          </p>
        ) : (
          <div className="charts-past-hub__days" role="list">
            {dayGroups.slice(0, 20).map((group) => {
              const bundlesForDay = bundlesByDate.get(group.date) ?? [];
              const isActiveDay = activeDate && group.date === activeDate;
              const head = group.entries[0];
              const dept = head?.department ?? '';
              const phys = head?.physician ?? '';
              const meta = [dept, phys].filter(Boolean).join(' / ');

              const bundlesByEntity = new Map<PastHubOrderEntity, OrderBundle[]>();
              bundlesForDay.forEach((bundle) => {
                const rawEntity = (bundle.entity ?? '').trim();
                if (!rawEntity) return;
                if (!isPastHubOrderEntity(rawEntity)) return;
                const list = bundlesByEntity.get(rawEntity) ?? [];
                list.push(bundle);
                bundlesByEntity.set(rawEntity, list);
              });

              const sortedEntities = ORDER_ENTITY_SORT.filter((entity) => (bundlesByEntity.get(entity) ?? []).length > 0);

              return (
                <details
                  key={`past-hub-${group.date}`}
                  className="charts-past-hub__day"
                  role="listitem"
                  open={Boolean(openDays[group.date])}
                  onToggle={(event) => {
                    const nextOpen = event.currentTarget.open;
                    setOpenDays((prev) => ({ ...prev, [group.date]: nextOpen }));
                  }}
                  data-active={isActiveDay ? '1' : '0'}
                >
                  <summary className="charts-past-hub__day-summary">
                    <span className="charts-past-hub__day-date">{group.date}</span>
                    <span className="charts-past-hub__day-meta">{meta || '—'}</span>
                    <span className="charts-past-hub__day-count">オーダー:{bundlesForDay.length}</span>
                    {isActiveDay ? <span className="charts-past-hub__day-active">表示中</span> : null}
                  </summary>

                  <div className="charts-past-hub__day-content">
                    <div className="charts-past-hub__columns">
                      <div className="charts-past-hub__col charts-past-hub__col--chart" aria-label="過去カルテ">
                        <div className="charts-past-hub__col-header">
                          <strong>過去カルテ</strong>
                          <span className="charts-past-hub__col-meta">受診 {group.entries.length} 件</span>
                        </div>

                        <ul className="charts-past-hub__encounters" aria-label="受診一覧">
                          {group.entries.slice(0, 6).map((entry) => {
                            const id = resolveEntryId(entry);
                            const key =
                              entry.encounterKey ??
                              entry.scheduleKey ??
                              entry.receptionId ??
                              entry.appointmentId ??
                              entry.patientId ??
                              entry.id;
                            const active = key === selectedEncounterKey;
                            return (
                              <li key={id} className="charts-past-hub__encounter" data-active={active ? '1' : '0'}>
                                <div className="charts-past-hub__headline">{formatEntryLabel(entry)}</div>
                                <div className="charts-past-hub__actions">
                                  <button
                                    type="button"
                                    className="charts-past-hub__do"
                                    disabled={switchLocked}
                                    title={switchLocked ? switchLockedReason ?? '処理中のため切替できません。' : undefined}
                                    onClick={() => {
                                      const next = {
                                        patientId: entry.patientId ?? entry.id,
                                        appointmentId: entry.appointmentId,
                                        receptionId: entry.receptionId,
                                        scheduleKey: entry.scheduleKey,
                                        encounterKey: entry.encounterKey,
                                        visitDate: normalizeVisitDate(entry.visitDate),
                                      };
                                      onSelectEncounter(next);
                                    }}
                                  >
                                    {active ? '表示中' : '表示'}
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>

                        {isActiveDay ? (
                          <div className="charts-past-hub__notes" aria-label="記載（表示中）">
                            <div className="charts-past-hub__col-header">
                              <strong>記載（表示中）</strong>
                              <span className="charts-past-hub__col-meta">SOAP 最新</span>
                              {onRequestDoCopyBatch ? (
                                <button
                                  type="button"
                                  className="charts-past-hub__do charts-past-hub__do--batch"
                                  disabled={!canDoCopyBatch}
                                  title={!canDoCopyBatch ? '転記可能なSOAPがありません。' : undefined}
                                  onClick={() => {
                                    onRequestDoCopyBatch({
                                      sections: doCopySections,
                                      sourceDate: group.date,
                                    });
                                  }}
                                >
                                  この日のSOAPをまとめてDo
                                </button>
                              ) : null}
                            </div>
                            <div className="charts-past-hub__notes-grid" role="list">
                              {DO_COPY_SECTIONS.map((section) => {
                                const entry = soapLatestBySection.get(section);
                                const body = entry?.body?.trim() ?? '';
                                const metaLine = entry ? `${formatSoapAuthoredAt(entry.authoredAt)} / ${entry.authorName ?? entry.authorRole ?? '—'}` : '—';
                                return (
                                  <div key={section} className="charts-past-hub__note" role="listitem">
                                    <div className="charts-past-hub__note-head">
                                      <strong>{SOAP_SECTION_LABELS[section]}</strong>
                                      <span className="charts-past-hub__note-meta">{metaLine}</span>
                                    </div>
                                    <p className="charts-past-hub__note-body">{body ? body.slice(0, 140) : '記載なし'}</p>
                                    <div className="charts-past-hub__actions">
                                      <button
                                        type="button"
                                        className="charts-past-hub__do"
                                        disabled={!canDoCopy || !entry}
                                        title={!canDoCopy ? 'Do転記は無効です。' : !entry ? '記載がありません。' : undefined}
                                        onClick={() => {
                                          if (!entry) return;
                                          onRequestDoCopy?.({ section, entry });
                                        }}
                                      >
                                        Do転記
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="charts-past-hub__col charts-past-hub__col--orders" aria-label="オーダー情報">
                        <div className="charts-past-hub__col-header">
                          <strong>オーダー</strong>
                          <span className="charts-past-hub__col-meta">
                            {bundlesQuery.isFetching ? '取得中…' : bundlesQuery.data && !bundlesQuery.data.ok ? '取得失敗' : `${bundlesForDay.length} 件`}
                          </span>
                        </div>

                        {bundlesQuery.data && !bundlesQuery.data.ok ? (
                          <p className="charts-past-hub__hint" role="status">
                            {resolveUserSafeFetchFailure('オーダー情報', bundlesQuery.data.message)}
                          </p>
                        ) : bundlesForDay.length === 0 ? (
                          <p className="charts-past-hub__hint" role="status">
                            オーダーはありません。
                          </p>
                        ) : (
                          <div className="charts-past-hub__order-groups" aria-label="オーダー種別">
                            {sortedEntities.map((entity) => {
                              const list = bundlesByEntity.get(entity) ?? [];
                              const label = ORDER_ENTITY_LABEL[entity] ?? entity;
                              return (
                                <div key={entity} className="charts-past-hub__order-group" data-entity={entity}>
                                  <div className="charts-past-hub__group-header">
                                    <strong>{label}</strong>
                                    <span className="charts-past-hub__group-meta">{list.length} 件</span>
                                  </div>
                                  <ul className="charts-past-hub__order-items" aria-label={`${label}一覧`}>
                                    {list.slice(0, 6).map((bundle, bundleIndex) => (
                                      <li
                                        key={`${entity}-${bundle.documentId ?? 'doc'}-${bundle.moduleId ?? 'mod'}-${bundleIndex}`}
                                        className="charts-past-hub__order-item"
                                      >
                                        <span className="charts-past-hub__order-label">{formatOrderBundleLabel(bundle)}</span>
                                        <div className="charts-past-hub__actions">
                                          {onRequestOrderDo ? (
                                            <button
                                              type="button"
                                              className="charts-past-hub__do"
                                              disabled={!doOrderEnabled}
                                              title={!doOrderEnabled ? doOrderDisabledReason ?? 'Doできません。' : undefined}
                                              onClick={() => {
                                                setDoFeedback(`${label}のDoコピーをオーダー入力へ送信しました。`);
                                                onRequestOrderDo({ entity, bundle });
                                              }}
                                            >
                                              Do
                                            </button>
                                          ) : null}
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                  {list.length > 6 ? <p className="charts-past-hub__hint">他 {list.length - 6} 件</p> : null}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
