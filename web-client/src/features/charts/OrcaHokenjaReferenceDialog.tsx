import { useEffect, useRef, useState, type FormEvent } from 'react';

import { FocusTrapDialog } from '../../components/modals/FocusTrapDialog';
import { fetchOrcaHokenja, type OrcaHokenjaResult } from '../patients/orcaHokenjaApi';
import { useMasterVisibilityCategory } from '../administration/useMasterVisibility';
import { resolveUserSafeFetchFailure } from './userSafeErrorCopy';

export type OrcaHokenjaReferenceDialogProps = {
  open: boolean;
  onClose: () => void;
  patientId?: string;
  patientName?: string;
  insuranceLabel?: string;
  visitDate?: string;
};

const formatYmd = (value?: string) => {
  if (!value) return '—';
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.length !== 8) return value;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
};

const formatRowValue = (value?: string | number | null) => {
  if (value === null || value === undefined) return '—';
  return String(value).trim() || '—';
};

export function OrcaHokenjaReferenceDialog({
  open,
  onClose,
  patientId,
  patientName,
  insuranceLabel,
  visitDate,
}: OrcaHokenjaReferenceDialogProps) {
  const [keyword, setKeyword] = useState('');
  const [pending, setPending] = useState(false);
  const [items, setItems] = useState<OrcaHokenjaResult['items']>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const patientSupportMasterVisibility = useMasterVisibilityCategory('patientSupport');

  useEffect(() => {
    if (!open) return;
    setKeyword('');
    setPending(false);
    setItems([]);
    setMessage(null);
    setSearched(false);
    inputRef.current?.focus();
  }, [open]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextKeyword = keyword.trim();
    if (!nextKeyword) {
      return;
    }
    if (!patientSupportMasterVisibility.visible) {
      setItems([]);
      setSearched(false);
      setMessage(patientSupportMasterVisibility.hiddenMessage);
      return;
    }

    setPending(true);
    setMessage(null);

    try {
      const result = await fetchOrcaHokenja({ keyword: nextKeyword });
      setSearched(true);
      if (result.ok) {
        setItems(result.items);
        setMessage(null);
        return;
      }
      setItems([]);
      setMessage(resolveUserSafeFetchFailure('保険者候補', result.message));
      setSearched(true);
    } catch (error) {
      setItems([]);
      setSearched(true);
      setMessage(resolveUserSafeFetchFailure('保険者候補', error instanceof Error ? error.message : undefined));
    } finally {
      setPending(false);
    }
  };

  const hasResults = items.length > 0;
  const showEmptyState = searched && !pending && !message && !hasResults;

  return (
    <FocusTrapDialog
      open={open}
      title="保険者参照"
      description="ORCA 保険者マスタを参照します。患者情報は更新しません。"
      onClose={onClose}
      initialFocus="none"
    >
      <section className="hokenja-ref__context" aria-label="患者コンテキスト">
        <div className="hokenja-ref__context-grid">
          <div className="hokenja-ref__context-item">
            <span>患者ID</span>
            <strong>{formatRowValue(patientId)}</strong>
          </div>
          <div className="hokenja-ref__context-item">
            <span>氏名</span>
            <strong>{formatRowValue(patientName)}</strong>
          </div>
          <div className="hokenja-ref__context-item">
            <span>現在の保険/自費</span>
            <strong>{formatRowValue(insuranceLabel)}</strong>
          </div>
          <div className="hokenja-ref__context-item">
            <span>来院日</span>
            <strong>{formatRowValue(formatYmd(visitDate))}</strong>
          </div>
        </div>
      </section>

      <form className="hokenja-ref__form" onSubmit={handleSubmit}>
        <div className="hokenja-ref__search-row">
          <label className="hokenja-ref__field">
            <span>保険者番号または名称</span>
            <input
              ref={inputRef}
              type="text"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="例: 06123456 / 東京保険者"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div className="hokenja-ref__actions">
            <button type="submit" className="patients-tab__primary" disabled={pending || !patientSupportMasterVisibility.visible}>
              検索
            </button>
            <button type="button" className="patients-tab__ghost" onClick={onClose}>
              閉じる
            </button>
          </div>
        </div>

        <p className="hokenja-ref__note">この画面では参照のみ行います。患者情報は更新しません。</p>
        {!patientSupportMasterVisibility.visible ? (
          <p className="hokenja-ref__status" role="status">
            {patientSupportMasterVisibility.hiddenMessage}
          </p>
        ) : null}

        {pending ? (
          <p className="hokenja-ref__status" role="status" aria-live="polite">
            検索中…
          </p>
        ) : null}

        {message ? (
          <p className="hokenja-ref__status" role="alert">
            {message}
          </p>
        ) : null}

        {showEmptyState ? (
          <p className="hokenja-ref__empty">該当する保険者が見つかりませんでした。</p>
        ) : null}

        {hasResults ? (
          <ul className="hokenja-ref__results" aria-label="保険者候補一覧">
            {items.map((item) => (
              <li key={item.payerCode ?? `${item.payerName ?? 'hokenja'}-${item.addressLine ?? 'item'}`} className="hokenja-ref__result">
                <div className="hokenja-ref__result-main">
                  <span className="hokenja-ref__result-name">{formatRowValue(item.payerName)}</span>
                  <span className="hokenja-ref__result-code">{formatRowValue(item.payerCode)}</span>
                </div>
                <div className="hokenja-ref__result-meta">
                  <div>
                    {formatRowValue(item.payerType)}
                    {item.payerRatio !== undefined ? ` ・ ${item.payerRatio}%` : ''}
                  </div>
                  {item.addressLine ? <div>{item.addressLine}</div> : null}
                  {item.phone ? <div>{item.phone}</div> : null}
                  {item.validFrom || item.validTo ? (
                    <div>
                      {formatYmd(item.validFrom)} - {formatYmd(item.validTo)}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </form>
    </FocusTrapDialog>
  );
}
