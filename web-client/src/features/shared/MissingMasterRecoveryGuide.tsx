import { Global, css } from '@emotion/react';

import { resolveRunId, resolveTraceId } from '../../libs/observability/observability';
import { copyTextToClipboard } from '../../libs/observability/runIdCopy';
import { useAppToast } from '../../libs/ui/appToast';
import {
  MISSING_MASTER_RECOVERY_ACTIONS,
  MISSING_MASTER_RECOVERY_STEPS,
  buildMissingMasterShareText,
} from './missingMasterRecovery';

const missingMasterRecoveryStyles = css`
  .missing-master-recovery {
    margin: 1rem 0;
    padding: 1rem 1.2rem;
    border-radius: 18px;
    border: 1px solid #fdba74;
    background: #fff7ed;
    color: #0f172a;
  }

  .missing-master-recovery__title {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
  }

  .missing-master-recovery__note {
    margin: 0.35rem 0 0;
    font-size: 0.85rem;
    color: #7c2d12;
  }

  .missing-master-recovery__list {
    margin: 0.75rem 0 0;
    padding-left: 1.25rem;
    display: grid;
    gap: 0.6rem;
  }

  .missing-master-recovery__item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.75rem;
    align-items: start;
  }

  .missing-master-recovery__item-text {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .missing-master-recovery__label {
    font-weight: 700;
    font-size: 0.95rem;
    color: #9a3412;
  }

  .missing-master-recovery__detail {
    font-size: 0.85rem;
    color: #475569;
  }

  .missing-master-recovery__action {
    align-self: start;
  }

  .missing-master-recovery__button {
    padding: 0.4rem 0.85rem;
    border-radius: 999px;
    border: 1px solid #f59e0b;
    background: #ffffff;
    color: #9a3412;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
  }

  .missing-master-recovery__button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .missing-master-recovery__button.secondary {
    border-color: #94a3b8;
    color: #334155;
  }

  .missing-master-recovery__button.share {
    border-color: #38bdf8;
    color: #0f172a;
  }
`;

export type MissingMasterRecoveryGuideProps = {
  runId?: string;
  traceId?: string;
  onRefetch?: () => void;
  onOpenReception?: () => void;
  isRefetching?: boolean;
  refetchDisabled?: boolean;
};

export function MissingMasterRecoveryGuide({
  runId,
  traceId,
  onRefetch,
  onOpenReception,
  isRefetching,
  refetchDisabled,
}: MissingMasterRecoveryGuideProps) {
  const { enqueue } = useAppToast();
  const resolvedRunId = resolveRunId(runId);
  const resolvedTraceId = resolveTraceId(traceId);
  const shareText = buildMissingMasterShareText(resolvedRunId, resolvedTraceId);

  const handleShare = async () => {
    if (!shareText) {
      enqueue({ tone: 'error', message: '共有用IDが未取得です', detail: '再取得後に再度お試しください。' });
      return;
    }
    try {
      const method = await copyTextToClipboard(shareText);
      if (method === 'prompt') {
        enqueue({ tone: 'info', message: '手動コピーを開きました', detail: shareText });
      } else {
        enqueue({ tone: 'success', message: '管理者共有用IDをコピーしました', detail: shareText });
      }
    } catch {
      enqueue({ tone: 'error', message: '共有用IDのコピーに失敗しました', detail: 'クリップボード権限を確認してください。' });
    }
  };

  const refetchDisabledState = refetchDisabled || isRefetching || !onRefetch;
  const receptionDisabledState = !onOpenReception;
  const shareDisabledState = !shareText;

  return (
    <section className="missing-master-recovery" role="group" aria-label="復旧導線">
      <Global styles={missingMasterRecoveryStyles} />
      <h3 className="missing-master-recovery__title">復旧導線（再取得 → 受付 → 管理者共有）</h3>
      <p className="missing-master-recovery__note">
        再取得で解消しない場合は受付で状態を確認し、RUN_ID/traceId を管理者へ共有してください。
      </p>
      <ol className="missing-master-recovery__list">
        {MISSING_MASTER_RECOVERY_STEPS.map((step) => {
          const actionLabel = step.label === MISSING_MASTER_RECOVERY_ACTIONS.reception
            ? '受付へ戻る'
            : step.label === MISSING_MASTER_RECOVERY_ACTIONS.share
              ? '管理者共有'
              : step.label;
          const isRefetch = step.label === MISSING_MASTER_RECOVERY_ACTIONS.refetch;
          const isReception = step.label === MISSING_MASTER_RECOVERY_ACTIONS.reception;
          const isShare = step.label === MISSING_MASTER_RECOVERY_ACTIONS.share;
          const onClick = isRefetch ? onRefetch : isReception ? onOpenReception : handleShare;
          const disabled = isRefetch ? refetchDisabledState : isReception ? receptionDisabledState : shareDisabledState;
          const buttonClass = isShare
            ? 'missing-master-recovery__button share'
            : isReception
              ? 'missing-master-recovery__button secondary'
              : 'missing-master-recovery__button';
          return (
            <li key={step.key} className="missing-master-recovery__item">
              <div className="missing-master-recovery__item-text">
                <span className="missing-master-recovery__label">{step.label}</span>
                <span className="missing-master-recovery__detail">{step.detail}</span>
              </div>
              <div className="missing-master-recovery__action">
                <button
                  type="button"
                  className={buttonClass}
                  onClick={onClick}
                  disabled={disabled}
                  aria-label={`${actionLabel}（${step.label}）`}
                >
                  {isRefetch && isRefetching ? '再取得中…' : actionLabel}
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
