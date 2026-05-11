import { useEffect, useMemo, useState } from 'react';

import { FocusTrapDialog } from '../../components/modals/FocusTrapDialog';
import { SOAP_SECTION_LABELS, type SoapSectionKey } from './soapNote';

export type DoCopyDialogSection = {
  section: SoapSectionKey;
  source: { authoredAt?: string; authorRole?: string; body: string };
  target: { body: string };
};

export type DoCopyDialogState = {
  open: boolean;
  sections: DoCopyDialogSection[];
  selectedSections: SoapSectionKey[];
  sourceLabel?: string;
  applied: boolean;
};

type DoCopyDialogProps = {
  state: DoCopyDialogState | null;
  onApply: (sections: SoapSectionKey[]) => void;
  onUndo: (sections: SoapSectionKey[]) => void;
  onClose: () => void;
};

export function DoCopyDialog({ state, onApply, onUndo, onClose }: DoCopyDialogProps) {
  const open = state?.open ?? false;
  const sections = state?.sections ?? [];
  const applied = state?.applied ?? false;
  const [selectedSections, setSelectedSections] = useState<SoapSectionKey[]>([]);

  useEffect(() => {
    if (!state) {
      setSelectedSections([]);
      return;
    }
    const fallback = state.sections
      .filter((section) => section.source.body.trim().length > 0)
      .map((section) => section.section);
    setSelectedSections(state.selectedSections.length > 0 ? state.selectedSections : fallback);
  }, [state]);

  const selectedSet = useMemo(() => new Set(selectedSections), [selectedSections]);
  const hasAnySource = sections.some((item) => item.source.body.trim().length > 0);
  const sourceLabel = state?.sourceLabel?.trim();
  const applyBlockedReasonId = 'charts-do-copy-apply-block-reason';
  const applyBlockedReason = !hasAnySource
    ? '転記できる記載がありません。'
    : selectedSections.length === 0
      ? 'Do対象セクションを1つ以上選択してください。'
      : '';

  return (
    <FocusTrapDialog
      open={open}
      role="dialog"
      title={sourceLabel ? `Do転記プレビュー（${sourceLabel}）` : 'Do転記プレビュー'}
      description="転記元の内容を現在のSOAPドラフトへ反映します。複数セクションを選択してまとめてDoできます。"
      onClose={onClose}
      testId="charts-do-copy-dialog"
    >
      <div className="charts-do-copy">
        {hasAnySource ? (
          <div className="charts-do-copy__section-selector" role="group" aria-label="Do対象セクション">
            {sections.map((item) => {
              const hasSource = item.source.body.trim().length > 0;
              return (
                <label key={`do-copy-toggle-${item.section}`} className="charts-do-copy__section-toggle">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(item.section)}
                    disabled={!hasSource || applied}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setSelectedSections((prev) => {
                        if (checked) return Array.from(new Set([...prev, item.section]));
                        return prev.filter((section) => section !== item.section);
                      });
                    }}
                  />
                  <span>{SOAP_SECTION_LABELS[item.section]}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="charts-do-copy__empty">転記できる記載がありません。</p>
        )}

        <div className="charts-do-copy__section-list" role="list" aria-label="セクション別プレビュー">
          {sections.map((item) => {
            const sourceMeta = [item.source.authoredAt ? `authoredAt=${item.source.authoredAt}` : null, item.source.authorRole ? `role=${item.source.authorRole}` : null]
              .filter(Boolean)
              .join(' / ');
            return (
              <div key={`do-copy-preview-${item.section}`} className="charts-do-copy__section-row" role="listitem">
                <div className="charts-do-copy__section-head">
                  <strong>{SOAP_SECTION_LABELS[item.section]}</strong>
                  <span className="charts-do-copy__meta">{sourceMeta || '—'}</span>
                </div>
                <div className="charts-do-copy__section-panels">
                  <div className="charts-do-copy__panel" aria-label={`${SOAP_SECTION_LABELS[item.section]}転記元`}>
                    <div className="charts-do-copy__label">
                      <strong>転記元</strong>
                    </div>
                    <textarea readOnly value={item.source.body ?? ''} rows={5} />
                  </div>
                  <div className="charts-do-copy__panel" aria-label={`${SOAP_SECTION_LABELS[item.section]}転記先`}>
                    <div className="charts-do-copy__label">
                      <strong>転記先（現在ドラフト）</strong>
                    </div>
                    <textarea readOnly value={item.target.body ?? ''} rows={5} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="charts-do-copy__actions" role="group" aria-label="Do転記操作">
          {!applied ? (
            <>
              {applyBlockedReason ? (
                <p id={applyBlockedReasonId} className="charts-do-copy__empty">
                  適用はブロックされています: {applyBlockedReason}
                </p>
              ) : null}
              <button
                type="button"
                className="charts-do-copy__primary"
                onClick={() => onApply(selectedSections)}
                disabled={Boolean(applyBlockedReason)}
                aria-describedby={applyBlockedReason ? applyBlockedReasonId : undefined}
              >
                適用
              </button>
              <button type="button" className="charts-do-copy__ghost" onClick={onClose}>
                キャンセル
              </button>
            </>
          ) : (
            <>
              <button type="button" className="charts-do-copy__primary" onClick={() => onUndo(selectedSections)}>
                Undo（取り消し）
              </button>
              <button type="button" className="charts-do-copy__ghost" onClick={onClose}>
                閉じる
              </button>
            </>
          )}
        </div>
      </div>
    </FocusTrapDialog>
  );
}
