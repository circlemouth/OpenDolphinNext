import { css } from '@emotion/react';

export const statusBadgeStyles = css`
  .status-badge {
    border-radius: 16px;
    padding: 0.65rem 0.85rem;
    border: 1px solid rgba(148, 163, 184, 0.4);
    background: #ffffff;
  }

  .status-badge__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }

  .status-badge__label {
    font-size: 0.85rem;
    color: #334155;
  }

  .status-badge__value {
    font-weight: 700;
    color: #0f172a;
  }

  .status-badge__description {
    margin: 0.45rem 0 0;
    font-size: 0.8rem;
    color: #334155;
  }

  .status-badge__tone {
    font-weight: 600;
    color: #0f172a;
  }

  .status-badge--warning {
    border-color: var(--ui-warning-border);
    background: var(--ui-warning-bg);
  }

  .status-badge--error {
    border-color: var(--ui-error-border);
    background: var(--ui-error-bg);
  }

  .status-badge--info {
    border-color: var(--ui-info-border);
    background: var(--ui-info-bg);
  }

  .status-badge--success {
    border-color: var(--ui-success-border);
    background: var(--ui-success-bg);
  }
`;

export const toneBannerStyles = css`
  .tone-banner {
    display: flex;
    gap: 0.8rem;
    align-items: center;
    padding: 0.9rem 1.1rem;
    border-radius: 16px;
    border: 1px solid var(--tone-banner-border, transparent);
    font-size: 0.95rem;
    background: var(--tone-banner-bg, #ffffff);
    color: var(--tone-banner-text, #0f172a);
  }

  .tone-banner__tag {
    font-weight: 700;
    padding: 0.3rem 0.75rem;
    border-radius: 999px;
    background: var(--tone-banner-tag-bg, rgba(255, 255, 255, 0.75));
    border: 1px solid var(--tone-banner-tag-border, rgba(255, 255, 255, 0.45));
    color: var(--tone-banner-tag-text, #0f172a);
  }

  .tone-banner__message {
    margin: 0;
    color: inherit;
    line-height: 1.6;
  }

  .tone-banner--error {
    --tone-banner-bg: var(--ui-error-bg);
    --tone-banner-border: var(--ui-error-border);
    --tone-banner-text: var(--ui-error-text);
    --tone-banner-tag-bg: #fee2e2;
    --tone-banner-tag-border: var(--ui-error-border);
    --tone-banner-tag-text: #7f1d1d;
  }

  .tone-banner--error .tone-banner__tag {
    color: var(--tone-banner-tag-text);
  }

  .tone-banner--warning {
    --tone-banner-bg: var(--ui-warning-bg);
    --tone-banner-border: var(--ui-warning-border);
    --tone-banner-text: var(--ui-warning-text);
    --tone-banner-tag-bg: #ffedd5;
    --tone-banner-tag-border: var(--ui-warning-border);
    --tone-banner-tag-text: var(--ui-warning-strong);
  }

  .tone-banner--warning .tone-banner__tag {
    color: var(--tone-banner-tag-text);
  }

  .tone-banner--info {
    --tone-banner-bg: var(--ui-info-bg);
    --tone-banner-border: var(--ui-info-border);
    --tone-banner-text: var(--ui-info-text);
    --tone-banner-tag-bg: #dbeafe;
    --tone-banner-tag-border: var(--ui-info-border);
    --tone-banner-tag-text: var(--ui-info-text);
  }

  .tone-banner--info .tone-banner__tag {
    color: var(--tone-banner-tag-text);
  }

  .tone-banner:focus-visible {
    outline: 3px solid rgba(37, 99, 235, 0.45);
    outline-offset: 2px;
  }
`;

export const receptionStyles = css`
  ${statusBadgeStyles}

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .reception-modal__actions {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .reception-page {
    --reception-page-gutter: clamp(1rem, 4vw, 2.75rem);
    --reception-floating-offset-right: max(1rem, calc(env(safe-area-inset-right) + 0.65rem));
    --reception-floating-offset-bottom: max(1rem, calc(env(safe-area-inset-bottom) + 0.65rem));
    --reception-floating-stack-height: 0rem;
    min-height: 100vh;
    padding: 1rem var(--reception-page-gutter) 3rem;
    background: var(--ui-surface-muted);
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .reception-table__status {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    align-items: flex-start;
  }

  .reception-status-mvp {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
  }

  .reception-status-mvp__dot {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 999px;
    background: rgba(148, 163, 184, 0.9);
    box-shadow: 0 0 0 2px rgba(148, 163, 184, 0.25);
  }

  .reception-status-mvp__dot[data-status='受付中'] {
    background: rgba(2, 132, 199, 0.9);
    box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.18);
  }

  .reception-status-mvp__dot[data-status='診療中'] {
    background: rgba(99, 102, 241, 0.9);
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.18);
  }

  .reception-status-mvp__dot[data-status='会計待ち'] {
    background: rgba(234, 88, 12, 0.9);
    box-shadow: 0 0 0 2px rgba(234, 88, 12, 0.18);
  }

  .reception-status-mvp__dot[data-status='会計済み'] {
    background: rgba(22, 163, 74, 0.9);
    box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.18);
  }

  .reception-status-mvp__dot[data-status='予約'] {
    background: rgba(100, 116, 139, 0.9);
    box-shadow: 0 0 0 2px rgba(100, 116, 139, 0.18);
  }

  .reception-status-mvp__next {
    display: flex;
    gap: 0.4rem;
    align-items: baseline;
    flex-wrap: wrap;
    font-size: 0.82rem;
    color: #475569;
    max-width: 12rem;
  }

  .reception-status-mvp__next[data-tone='error'] {
    color: var(--ui-error-text);
  }

  .reception-status-mvp__next[data-tone='warning'] {
    color: var(--ui-warning-strong);
  }

  .reception-status-mvp__next[data-tone='success'] {
    color: var(--ui-success-text);
  }

  .reception-status-mvp__next-label {
    color: rgba(100, 116, 139, 0.95);
  }

  .reception-status-mvp__next-detail {
    width: 100%;
    color: rgba(71, 85, 105, 0.95);
  }

  .reception-page__header {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96));
    border-radius: var(--ui-radius-lg);
    padding: 1.5rem;
    box-shadow: var(--ui-shadow-soft);
    border: 1px solid var(--ui-border-subtle);
  }

  .reception-page__title {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .reception-page__title-main {
    min-width: 0;
  }

  @keyframes reception-float-up {
    from {
      opacity: 0;
      transform: translateY(12px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes reception-sheet-up {
    from {
      opacity: 0;
      transform: translateY(22px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .reception-toolbar {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    background: rgba(255, 255, 255, 0.96);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: var(--ui-radius-lg);
    box-shadow: none;
    padding: 0.9rem;
  }

  .reception-toolbar__form {
    display: grid;
    grid-template-columns: minmax(320px, 0.95fr) minmax(320px, 1.2fr) max-content;
    gap: 0.75rem;
    align-items: stretch;
  }

  .reception-toolbar__cluster,
  .reception-toolbar__status {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.55rem;
    min-width: 0;
    min-height: 4.75rem;
    border: 1px solid rgba(148, 163, 184, 0.24);
    border-radius: 8px;
    background: #f8fafc;
    padding: 0.65rem;
  }

  .reception-toolbar__cluster-title {
    flex: 0 0 100%;
    font-size: 0.78rem;
    font-weight: 800;
    color: #334155;
    line-height: 1;
  }

  .reception-toolbar__date-inline,
  .reception-toolbar__keyword-control {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    min-width: 0;
    width: 100%;
  }

  .reception-date-shift-button {
    display: inline-flex;
    flex: 0 0 2.25rem;
    width: 2.25rem;
    min-height: 2.25rem;
    align-items: center;
    justify-content: center;
    border: 1px solid #1d4ed8;
    border-radius: 8px;
    background: #ffffff;
    color: #1d4ed8;
    cursor: pointer;
  }

  .reception-date-shift-button:hover {
    background: #eff6ff;
  }

  .reception-date-shift-button:focus-visible {
    outline: 3px solid rgba(37, 99, 235, 0.35);
    outline-offset: 2px;
  }

  .reception-date-shift-button__triangle {
    display: block;
    width: 0;
    height: 0;
    border-top: 0.42rem solid transparent;
    border-bottom: 0.42rem solid transparent;
  }

  .reception-date-shift-button__triangle--prev {
    border-right: 0.62rem solid currentColor;
  }

  .reception-date-shift-button__triangle--next {
    border-left: 0.62rem solid currentColor;
  }

  .reception-toolbar__keyword-label {
    flex: 0 0 100%;
    color: #0f172a;
    font-size: 0.78rem;
    font-weight: 800;
    line-height: 1;
  }

  .reception-toolbar__keyword-input {
    flex: 1 1 auto;
    min-width: 0;
  }

  .reception-toolbar__keyword-submit {
    flex: 0 0 auto;
  }

  .reception-toolbar__cluster--actions {
    justify-content: flex-end;
    align-content: flex-end;
  }

  .reception-toolbar__disclosure-actions {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    align-content: center;
    gap: 0.45rem;
    min-width: 0;
    align-self: stretch;
    min-height: 4.75rem;
    border: 1px solid rgba(148, 163, 184, 0.24);
    border-radius: 8px;
    background: #f8fafc;
    padding: 0.65rem;
  }

  .reception-toolbar--embedded .reception-toolbar__disclosure-actions {
    align-self: stretch;
  }

  .reception-toolbar__view-actions {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.45rem;
    margin-left: auto;
  }

  .reception-toolbar__view-mode {
    display: inline-flex;
    align-items: center;
    gap: 0;
    padding: 0.18rem;
    border: 1px solid rgba(37, 99, 235, 0.28);
    border-radius: 999px;
    background: #eff6ff;
  }

  .reception-toolbar__view-actions .reception-results-toolbar__toggle {
    min-height: 2.15rem;
    border-radius: 999px;
    padding: 0.35rem 0.7rem;
    font-size: 0.76rem;
    line-height: 1;
  }

  .reception-toolbar__view-mode .reception-results-toolbar__toggle {
    border: 0;
    background: transparent;
    color: #1e3a8a;
    box-shadow: none;
  }

  .reception-toolbar__view-mode .reception-results-toolbar__toggle[aria-pressed='true'] {
    background: #1d4ed8;
    color: #ffffff;
    box-shadow: 0 4px 10px rgba(37, 99, 235, 0.22);
  }

  .reception-toolbar__view-actions .reception-results-toolbar__toggle--refresh {
    margin-left: 0.2rem;
    border-color: #0f766e;
    background: #ecfdf5;
    color: #0f766e;
  }

  .reception-toolbar__view-actions .reception-results-toolbar__toggle--refresh:hover {
    background: #ccfbf1;
    border-color: #0d9488;
  }

  .reception-toolbar__date-field {
    flex: 1 1 9.6rem;
    min-width: 0;
  }

  .reception-toolbar__keyword-field {
    flex: 1 1 13.5rem;
    min-width: 12rem;
  }

  .reception-toolbar__status {
    grid-column: 1 / -1;
    padding: 0;
    border: 0;
    background: transparent;
  }

  @media (max-width: 1180px) {
    .reception-toolbar__form {
      grid-template-columns: minmax(230px, 0.9fr) minmax(260px, 1fr) minmax(250px, max-content);
      gap: 0.5rem;
    }

    .reception-toolbar__disclosure-actions {
      grid-column: auto;
      justify-content: flex-end;
    }
  }

  .reception-toolbar__advanced {
    margin-top: -1rem;
    background: #f8fafc;
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: var(--ui-radius-md);
    padding: 0.85rem;
  }

  .reception-toolbar__advanced-grid {
    display: grid;
    grid-template-columns: minmax(280px, 1.35fr) minmax(260px, 1fr) minmax(160px, 0.6fr);
    gap: 0.6rem;
    align-items: stretch;
  }

  .reception-toolbar__panel {
    background: #f8fafc;
    border: 1px solid rgba(148, 163, 184, 0.24);
    border-radius: var(--ui-radius-md);
    padding: 0.7rem;
  }

  .reception-toolbar__panel-group {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.55rem;
    align-items: end;
    min-width: 0;
    margin: 0;
    border: 1px solid rgba(148, 163, 184, 0.24);
    border-radius: 8px;
    background: #ffffff;
    padding: 0.75rem;
  }

  .reception-toolbar__panel-group h3,
  .reception-toolbar__panel-group legend {
    margin: 0;
    padding: 0;
    color: #334155;
    font-size: 0.78rem;
    font-weight: 800;
    line-height: 1.2;
  }

  .reception-toolbar__panel-group legend {
    padding: 0 0.25rem;
  }

  .reception-toolbar__panel-group--actions,
  .reception-toolbar__panel-group--utility {
    grid-template-columns: minmax(0, 1fr);
  }

  .reception-toolbar__panel-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
  }

  .reception-toolbar__panel-status {
    color: #475569;
    font-size: 0.82rem;
    font-weight: 700;
  }

  .reception-search__field-help {
    color: #475569;
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1.25;
  }

  .reception-toolbar__summary {
    margin-top: 0.75rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem 1rem;
    color: #475569;
    font-size: 0.85rem;
  }

  .reception-toolbar--embedded {
    gap: 0.5rem;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }

  .reception-toolbar--embedded .reception-toolbar__form {
    grid-template-columns: minmax(300px, 0.95fr) minmax(280px, 1.15fr) minmax(170px, auto);
    gap: 0.5rem;
    align-items: stretch;
  }

  .reception-toolbar--embedded .reception-toolbar__cluster,
  .reception-toolbar--embedded .reception-toolbar__status {
    gap: 0.42rem;
    padding: 0.48rem;
    border-color: rgba(148, 163, 184, 0.2);
    background: #f8fafc;
    align-self: stretch;
    min-height: 0;
  }

  .reception-toolbar--embedded .reception-toolbar__cluster {
    display: grid;
    grid-template-rows: 1rem minmax(2.25rem, auto);
    align-content: start;
    align-items: start;
  }

  .reception-toolbar--embedded .reception-toolbar__cluster--search {
    background: #ffffff;
  }

  .reception-toolbar--embedded .reception-toolbar__cluster-title,
  .reception-toolbar--embedded .reception-search__field > span,
  .reception-toolbar--embedded .reception-toolbar__keyword-label {
    font-size: 0.72rem;
    line-height: 1.1;
  }

  .reception-toolbar--embedded .reception-toolbar__cluster-title {
    flex: 0 0 auto;
    margin-right: 0.1rem;
    align-self: end;
  }

  .reception-toolbar--embedded .reception-toolbar__cluster--date {
    align-items: start;
  }

  .reception-toolbar--embedded .reception-toolbar__date-inline {
    width: 100%;
    align-self: start;
  }

  .reception-toolbar--embedded .reception-toolbar__cluster--search {
    align-content: start;
  }

  .reception-toolbar--embedded .reception-toolbar__keyword-label {
    align-self: end;
  }

  .reception-toolbar--embedded .reception-toolbar__keyword-control {
    align-self: start;
  }

  .reception-toolbar--embedded .reception-search__button,
  .reception-toolbar__advanced--embedded .reception-search__button,
  .reception-toolbar__panel--list-actions .reception-search__button {
    min-height: 2.25rem;
    padding: 0.38rem 0.68rem;
  }

  .reception-toolbar--embedded .reception-toolbar__date-field {
    flex-basis: 8.8rem;
  }

  .reception-toolbar--embedded .reception-toolbar__keyword-field {
    min-width: 10rem;
  }

  .reception-toolbar__advanced--embedded {
    margin-top: 0.55rem;
    padding: 0.65rem;
  }

  .reception-toolbar__advanced--embedded .reception-toolbar__advanced-grid {
    grid-template-columns: minmax(280px, 1.35fr) minmax(260px, 1fr) minmax(150px, 0.6fr);
    gap: 0.5rem;
  }

  .reception-toolbar__advanced--embedded .reception-toolbar__summary {
    margin-top: 0.5rem;
    font-size: 0.78rem;
  }

  .reception-list {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    width: calc(100% + (var(--reception-page-gutter) * 2));
    margin-inline: calc(var(--reception-page-gutter) * -1);
  }

  .reception-page__header h1 {
    margin: 0;
    font-size: 2rem;
    color: #0f172a;
  }

  .reception-page__header p {
    margin: 0.65rem 0 0;
    color: #475569;
    line-height: 1.6;
  }

  .order-console {
    background: #ffffff;
    border-radius: 28px;
    padding: 1.5rem;
    border: 1px solid var(--ui-border);
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    box-shadow: var(--ui-shadow);
  }

  .order-console__status-steps {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .order-console__step {
    background: var(--ui-surface-muted);
    border-radius: 20px;
    padding: 0.95rem 1.05rem;
    border: 1px solid var(--ui-border);
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .order-console__step-label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #1d4ed8;
  }

  .tone-banner {
    display: flex;
    gap: 0.8rem;
    align-items: center;
    padding: 0.9rem 1.1rem;
    border-radius: 16px;
    border: 1px solid var(--tone-banner-border, transparent);
    font-size: 0.95rem;
    background: var(--tone-banner-bg, #ffffff);
    color: var(--tone-banner-text, #0f172a);
  }

  .tone-banner__tag {
    font-weight: 700;
    padding: 0.3rem 0.75rem;
    border-radius: 999px;
    background: var(--tone-banner-tag-bg, rgba(255, 255, 255, 0.75));
    border: 1px solid var(--tone-banner-tag-border, rgba(255, 255, 255, 0.45));
    color: var(--tone-banner-tag-text, #0f172a);
  }

  .tone-banner__message {
    margin: 0;
    color: inherit;
    line-height: 1.6;
  }

  .tone-banner--error {
    --tone-banner-bg: var(--ui-error-bg);
    --tone-banner-border: var(--ui-error-border);
    --tone-banner-text: var(--ui-error-text);
    --tone-banner-tag-bg: #fee2e2;
    --tone-banner-tag-border: var(--ui-error-border);
    --tone-banner-tag-text: #7f1d1d;
  }

  .tone-banner--error .tone-banner__tag {
    color: var(--tone-banner-tag-text);
  }

  .tone-banner--warning {
    --tone-banner-bg: var(--ui-warning-bg);
    --tone-banner-border: var(--ui-warning-border);
    --tone-banner-text: var(--ui-warning-text);
    --tone-banner-tag-bg: #ffedd5;
    --tone-banner-tag-border: var(--ui-warning-border);
    --tone-banner-tag-text: var(--ui-warning-strong);
  }

  .tone-banner--warning .tone-banner__tag {
    color: var(--tone-banner-tag-text);
  }

  .tone-banner--info {
    --tone-banner-bg: var(--ui-info-bg);
    --tone-banner-border: var(--ui-info-border);
    --tone-banner-text: var(--ui-info-text);
    --tone-banner-tag-bg: #dbeafe;
    --tone-banner-tag-border: var(--ui-info-border);
    --tone-banner-tag-text: var(--ui-info-text);
  }

  .tone-banner--info .tone-banner__tag {
    color: var(--tone-banner-tag-text);
  }

  .tone-banner:focus-visible {
    outline: 3px solid rgba(37, 99, 235, 0.45);
    outline-offset: 2px;
  }

  .resolve-master {
    border-radius: 18px;
    padding: 0.85rem 1.15rem;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    align-items: center;
    gap: 0.6rem;
    background: #f8fafc;
    border: 1px solid rgba(148, 163, 184, 0.35);
  }

  .resolve-master__label {
    font-size: 0.85rem;
    color: #475569;
  }

  .resolve-master__value {
    font-weight: 700;
    color: #0f172a;
  }

  .resolve-master__marker {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #1d4ed8;
  }

  .resolve-master__transition {
    font-size: 0.75rem;
    color: #475569;
  }

  .order-console__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1rem;
    align-items: flex-start;
  }

  .order-console__status-group {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .order-console__control-panel {
    background: #eef2ff;
    border-radius: 18px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }

  .order-console__label {
    font-weight: 600;
    color: #0f172a;
    font-size: 0.9rem;
  }

  .order-console__control select,
  .order-console__control textarea {
    width: 100%;
    border-radius: 12px;
    border: 1px solid #cbd5f5;
    padding: 0.6rem 0.75rem;
    font-family: inherit;
    font-size: 0.95rem;
    background: #ffffff;
  }

  .order-console__control-row {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .order-console__action {
    flex: 1;
    border: none;
    border-radius: 999px;
    background: #2563eb;
    color: #ffffff;
    padding: 0.65rem 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .order-console__action:hover {
    background: #1d4ed8;
  }

  .order-console__note {
    font-size: 0.85rem;
    color: #0f172a;
    background: #ffffff;
    border-radius: 10px;
    padding: 0.65rem;
    border: 1px solid rgba(37, 99, 235, 0.5);
  }

  .reception-page__meta {
    background: #ffffff;
    padding: 1.5rem;
    border-radius: 22px;
    border: 1px solid rgba(148, 163, 184, 0.3);
  }

  .reception-page__meta h2 {
    margin-top: 0;
  }

  .reception-page__meta ol {
    padding-left: 1.25rem;
    margin: 0.5rem 0 0;
    color: #475569;
    line-height: 1.7;
  }

  .reception-page__meta-bar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .reception-page__meta-primary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    min-width: 0;
  }

  .reception-page__meta-details {
    border: 1px solid rgba(148, 163, 184, 0.45);
    border-radius: 999px;
    background: #ffffff;
    padding: 0.1rem 0.25rem;
  }

  .reception-page__meta-details-summary {
    cursor: pointer;
    list-style: none;
    padding: 0.35rem 0.75rem;
    font-weight: 800;
    font-size: 0.85rem;
    color: #334155;
  }

  .reception-page__meta-details-summary::-webkit-details-marker {
    display: none;
  }

  .reception-page__meta-advanced {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.5rem 0.5rem 0.6rem;
  }

  .reception-page__alerts {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 1.25rem;
  }

  .reception-pill {
    font-size: 0.85rem;
  }

  .reception-exception-indicator {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.45);
    background: #ffffff;
    color: #0f172a;
    font-weight: 800;
    padding: 0.35rem 0.75rem;
    cursor: pointer;
    transition: transform 0.08s ease, background 0.2s ease, border-color 0.2s ease;
  }

  .reception-exception-indicator:hover {
    background: #f8fafc;
  }

  .reception-exception-indicator:active {
    transform: translateY(1px);
  }

  .reception-exception-indicator__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.15rem;
    height: 1.15rem;
    border-radius: 999px;
    background: rgba(148, 163, 184, 0.18);
    font-weight: 900;
  }

  .reception-exception-indicator__label {
    font-size: 0.85rem;
    font-weight: 800;
  }

  .reception-exception-indicator__count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.65rem;
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.08);
    font-size: 0.82rem;
    font-weight: 900;
  }

  .reception-exception-indicator.is-active[data-tone='error'] {
    border-color: var(--ui-error-border);
    background: var(--ui-error-bg);
    color: var(--ui-error-text);
  }

  .reception-exception-indicator.is-active[data-tone='warning'] {
    border-color: var(--ui-warning-border);
    background: var(--ui-warning-bg);
    color: var(--ui-warning-strong);
  }

  .reception-exception-indicator.is-active[data-tone='info'] {
    border-color: var(--ui-info-border);
    background: var(--ui-info-bg);
    color: var(--ui-info-text);
  }

  .reception-error-notices {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .reception-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1.5rem;
    align-items: start;
    width: 100%;
  }

  .reception-layout__main {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    width: 100%;
    min-width: 0;
  }

  /* Most frequent operation: status check. Put the board at the top visually. */
  .reception-layout__main > .reception-board {
    order: -20;
  }

  .reception-layout__main > .reception-selection {
    order: -19;
  }

  .reception-layout__main > .reception-search {
    order: -18;
  }

  .reception-layout__main > .reception-master {
    order: -17;
  }

  .reception-layout__main > .reception-section {
    order: -16;
  }

  .reception-layout__side {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    position: sticky;
    top: 1.5rem;
    align-self: start;
    max-height: calc(100vh - 3rem);
    overflow-y: auto;
    padding-right: 0.35rem;
  }

  .reception-layout__side::-webkit-scrollbar {
    width: 10px;
  }

  .reception-layout__side::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.5);
    border-radius: 999px;
    border: 3px solid transparent;
    background-clip: content-box;
  }

  .reception-layout__side::-webkit-scrollbar-track {
    background: transparent;
  }

  .reception-accept-workflow-modal {
    position: fixed;
    right: var(--reception-floating-offset-right);
    bottom: calc(var(--reception-floating-offset-bottom) + var(--reception-floating-stack-height) + 0.5rem);
    left: auto;
    top: auto;
    width: min(760px, calc(100vw - env(safe-area-inset-left) - env(safe-area-inset-right) - 2rem));
    height: min(960px, calc(100vh - var(--reception-floating-stack-height) - 7.2rem));
    max-height: calc(100vh - var(--reception-floating-stack-height) - 6rem);
    min-height: 14.5rem;
    z-index: 10800;
    border-radius: 22px;
    border: 1px solid rgba(148, 163, 184, 0.45);
    background: rgba(255, 255, 255, 0.98);
    box-shadow: 0 20px 70px rgba(15, 23, 42, 0.25);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    transform-origin: right bottom;
    animation: reception-sheet-up 220ms cubic-bezier(0.22, 1, 0.36, 1);
    transition: max-height 220ms ease, box-shadow 220ms ease, border-radius 220ms ease;
  }

  .reception-accept-workflow-modal__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.8rem 1rem;
    border-bottom: 1px solid rgba(148, 163, 184, 0.22);
    background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
  }

  .reception-accept-workflow-modal__heading h2 {
    margin: 0;
    font-size: 1.15rem;
    color: #0f172a;
  }

  .reception-accept-workflow-modal__heading {
    cursor: default;
    user-select: auto;
    touch-action: auto;
  }

  .reception-accept-workflow-modal__heading p {
    margin: 0.35rem 0 0;
    font-size: 0.85rem;
    color: #475569;
  }

  .reception-accept-workflow-modal__body {
    flex: 1;
    min-height: 0;
    padding: 0.9rem;
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    max-height: 100%;
  }

  .reception-accept-modal {
    display: grid;
    grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
    gap: 0.9rem;
    height: 100%;
    min-height: 0;
  }

  .reception-accept-modal__left,
  .reception-accept-modal__right {
    border: 1px solid rgba(148, 163, 184, 0.3);
    border-radius: 16px;
    background: #f8fafc;
    min-height: 0;
  }

  .reception-accept-modal__left {
    padding: 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    overflow: hidden;
  }

  .reception-accept-modal__left .reception-patient-search__form {
    margin-top: 0.25rem;
  }

  .reception-accept-modal__search-results {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    min-height: 0;
    flex: 1;
  }

  .reception-accept-modal__right {
    display: flex;
    flex-direction: column;
    background: #ffffff;
    padding: 0.8rem;
    overflow: hidden;
  }

  .reception-accept-modal__results-header {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    align-items: flex-start;
    border-bottom: 1px solid rgba(148, 163, 184, 0.25);
    padding-bottom: 0.6rem;
  }

  .reception-accept-modal__results-header h3 {
    margin: 0;
    font-size: 1rem;
    color: #0f172a;
  }

  .reception-accept-modal__results-body {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    min-height: 0;
    overflow: hidden;
    padding-top: 0.55rem;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }

  .reception-accept-modal__search-results .reception-patient-search__list {
    flex: 1;
    min-height: 0;
    max-height: none;
  }

  .reception-accept-modal__accept-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.6rem;
    border-bottom: 1px solid rgba(148, 163, 184, 0.22);
    padding-bottom: 0.6rem;
  }

  .reception-accept-modal__accept-header h3 {
    margin: 0;
    font-size: 1rem;
    color: #0f172a;
  }

  .reception-accept-modal__selected-patient {
    margin: 0.35rem 0 0;
    font-size: 0.84rem;
    color: #334155;
    font-weight: 700;
  }

  .reception-accept-modal__accept-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.45rem;
  }

  .reception-accept-modal__accept {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    padding: 0.75rem;
    border: 1px solid rgba(148, 163, 184, 0.36);
    border-radius: 14px;
    background:
      linear-gradient(180deg, rgba(248, 250, 252, 0.98) 0%, rgba(255, 255, 255, 0) 1.15rem) top / 100% 1.15rem no-repeat,
      linear-gradient(0deg, rgba(248, 250, 252, 0.98) 0%, rgba(255, 255, 255, 0) 1.15rem) bottom / 100% 1.15rem no-repeat,
      #ffffff;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.9),
      inset 0 -1rem 1.1rem -1.2rem rgba(15, 23, 42, 0.32);
    scrollbar-gutter: stable;
    scrollbar-width: thin;
    scrollbar-color: rgba(37, 99, 235, 0.42) rgba(226, 232, 240, 0.68);
  }

  .reception-accept-modal__accept::-webkit-scrollbar {
    width: 10px;
  }

  .reception-accept-modal__accept::-webkit-scrollbar-track {
    background: rgba(226, 232, 240, 0.68);
    border-radius: 999px;
  }

  .reception-accept-modal__accept::-webkit-scrollbar-thumb {
    background: rgba(37, 99, 235, 0.46);
    border-radius: 999px;
    border: 2px solid rgba(248, 250, 252, 0.95);
    background-clip: content-box;
  }

  .reception-accept-modal__submit {
    margin-top: auto;
    padding-top: 0.55rem;
    border-top: 1px solid rgba(148, 163, 184, 0.22);
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .reception-accept-modal__submit .reception-search__button {
    width: 100%;
  }

  .reception-accept-modal__submit-hint {
    margin: 0;
    font-size: 0.82rem;
    color: #475569;
  }

  .reception-sidepane {
    background: #ffffff;
    border-radius: 20px;
    padding: 1.1rem;
    border: 1px solid rgba(148, 163, 184, 0.3);
    box-shadow: 0 14px 36px rgba(15, 23, 42, 0.08);
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .reception-sidepane:focus-visible {
    outline: 3px solid rgba(37, 99, 235, 0.45);
    outline-offset: 2px;
  }

  .reception-sidepane__header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .reception-sidepane__header h2 {
    margin: 0;
    font-size: 1.05rem;
    color: #0f172a;
  }

  .reception-sidepane__actions {
    display: flex;
    gap: 0.5rem;
  }

  .reception-sidepane__action {
    border-radius: 999px;
    border: 1px solid #1d4ed8;
    background: #ffffff;
    color: #1d4ed8;
    font-weight: 700;
    padding: 0.35rem 0.75rem;
    cursor: pointer;
  }

  .reception-sidepane__action.primary {
    background: #1d4ed8;
    color: #ffffff;
    box-shadow: 0 8px 18px rgba(29, 78, 216, 0.2);
  }

  .reception-sidepane__action:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .reception-sidepane__meta {
    font-size: 0.85rem;
    color: #64748b;
  }

  .reception-sidepane__lead {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
    font-size: 0.85rem;
    color: #475569;
  }

  .reception-sidepane__lead-meta {
    color: #1f2937;
    font-weight: 600;
  }

  .reception-sidepane__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.6rem;
  }

  .reception-sidepane__item {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    background: #f8fafc;
    border-radius: 12px;
    padding: 0.6rem;
    border: 1px solid rgba(148, 163, 184, 0.25);
    font-size: 0.85rem;
    color: #475569;
  }

  .reception-sidepane__item strong {
    color: #0f172a;
    font-size: 0.95rem;
  }

  .reception-sidepane__item small {
    font-size: 0.75rem;
    color: #64748b;
  }

  .reception-sidepane__item--wide {
    grid-column: 1 / -1;
  }

  .reception-sidepane__empty {
    margin: 0;
    color: #64748b;
  }

  .reception-master {
    background: #ffffff;
    border-radius: 24px;
    padding: 1.1rem;
    border: 1px solid rgba(37, 99, 235, 0.15);
    box-shadow: 0 14px 36px rgba(15, 23, 42, 0.08);
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }

  .reception-master__header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .reception-master__lead {
    margin: 0.3rem 0 0;
    color: #475569;
  }

  .reception-master__meta {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .reception-master__form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .reception-master__form-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.75rem;
  }

  .reception-master__field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-weight: 600;
    color: #0f172a;
    font-size: 0.92rem;
  }

  .reception-master__required {
    margin-left: 0.35rem;
    color: #b91c1c;
    font-size: 0.8rem;
    font-weight: 700;
  }

  .reception-master__field input,
  .reception-master__field select {
    width: 100%;
    border-radius: 12px;
    border: 1px solid #cbd5e1;
    padding: 0.55rem 0.75rem;
    background: #ffffff;
    font-size: 0.95rem;
  }

  .reception-master__actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .reception-master__hints {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.85rem;
    color: #475569;
  }

  .reception-master__error {
    color: #b91c1c;
    font-weight: 700;
  }

  .reception-master__buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
  }

  .reception-master__results {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .reception-master__results-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.8rem;
    font-size: 0.85rem;
    color: #475569;
  }

  .reception-master__empty {
    margin: 0;
    color: #64748b;
  }

  .reception-master__list {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .reception-master__row {
    border-radius: 14px;
    border: 1px solid var(--ui-border);
    background: var(--ui-surface);
    padding: 0.85rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    text-align: left;
    cursor: pointer;
    transition: box-shadow 0.2s ease, border-color 0.2s ease;
  }

  .reception-master__row:hover {
    border-color: rgba(37, 99, 235, 0.35);
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
  }

  .reception-master__row.is-selected {
    border-color: #2563eb;
    box-shadow: 0 12px 28px rgba(37, 99, 235, 0.25);
  }

  .reception-master__row:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .reception-master__row-main {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
    align-items: baseline;
  }

  .reception-master__row-meta {
    display: flex;
    gap: 0.8rem;
    flex-wrap: wrap;
    font-size: 0.85rem;
    color: #475569;
  }

  .reception-accept {
    background: #ffffff;
    border-radius: 24px;
    padding: 1.1rem;
    border: 1px solid rgba(37, 99, 235, 0.15);
    box-shadow: 0 14px 36px rgba(15, 23, 42, 0.08);
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }

  .reception-accept__header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .reception-accept__lead {
    margin: 0.3rem 0 0;
    color: #475569;
  }

  .reception-accept__meta {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .reception-selection__button.danger {
    border-color: #b91c1c;
    background: #b91c1c;
  }

  .reception-selection__button.danger:hover {
    border-color: #991b1b;
    background: #991b1b;
  }

  .reception-accept__acceptbar {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;
    padding: 0.75rem 0.9rem;
    border-radius: 18px;
    border: 1px solid rgba(37, 99, 235, 0.14);
    background: linear-gradient(180deg, rgba(239, 246, 255, 0.9), rgba(248, 250, 252, 0.9));
  }

  .reception-accept__acceptbar-main {
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
    flex-wrap: wrap;
    color: #0f172a;
  }

  .reception-accept__acceptbar-label {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #2563eb;
    font-weight: 800;
  }

  .reception-accept__acceptbar-meta {
    font-size: 0.85rem;
    color: #475569;
    font-weight: 600;
  }

  .reception-accept__acceptbar-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
  }

  .reception-accept__acceptbar--modal {
    margin: 0;
    border-style: dashed;
    border-color: rgba(37, 99, 235, 0.3);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.45);
  }

  .reception-accept__detail-panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .reception-accept__detail-panel--modal {
    gap: 0.65rem;
  }

  .reception-accept__identity-card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.65rem;
    align-items: center;
    padding: 0.65rem 0.75rem;
    border: 1px solid rgba(37, 99, 235, 0.14);
    border-radius: 14px;
    background: linear-gradient(180deg, rgba(239, 246, 255, 0.72), rgba(248, 250, 252, 0.92));
  }

  .reception-accept__identity-card .reception-patient-icon {
    width: 2.35rem;
    height: 2.35rem;
    flex-basis: 2.35rem;
  }

  .reception-accept__identity-card .reception-patient-icon svg {
    width: 1.8rem;
    height: 1.8rem;
  }

  .reception-accept__identity-text {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.08rem;
  }

  .reception-accept__identity-kana {
    color: #64748b;
    font-size: 0.75rem;
    font-weight: 800;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }

  .reception-accept__identity-name {
    color: #0f172a;
    font-size: 1.18rem;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .reception-accept__identity-age {
    color: #475569;
    font-size: 0.9rem;
    font-weight: 800;
    white-space: nowrap;
  }

  .reception-cancel__identity-card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    gap: 0.65rem;
    align-items: center;
    padding: 0.75rem 0.85rem;
    border: 1px solid rgba(248, 113, 113, 0.32);
    border-radius: 14px;
    background: linear-gradient(180deg, rgba(254, 242, 242, 0.84), rgba(255, 251, 251, 0.96));
  }

  .reception-cancel__identity-card .reception-patient-icon {
    width: 2.45rem;
    height: 2.45rem;
    flex-basis: 2.45rem;
  }

  .reception-cancel__identity-card .reception-patient-icon svg {
    width: 1.85rem;
    height: 1.85rem;
  }

  .reception-cancel__identity-text {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.08rem;
  }

  .reception-cancel__identity-eyebrow {
    color: #991b1b;
    font-size: 0.73rem;
    font-weight: 900;
    line-height: 1.15;
  }

  .reception-cancel__identity-name {
    color: #0f172a;
    font-size: 1.2rem;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .reception-cancel__identity-age {
    color: #475569;
    font-size: 0.92rem;
    font-weight: 900;
    white-space: nowrap;
  }

  .reception-accept__details {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .reception-accept__requirements {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.75rem 0.9rem;
    border-radius: 14px;
    border: 1px dashed #cbd5f5;
    background: #f8fafc;
    font-size: 0.85rem;
    color: #475569;
  }

  .reception-accept__requirements strong {
    color: #0f172a;
    font-size: 0.9rem;
  }

  .reception-accept__notice {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.75rem 0.9rem;
    border-radius: 14px;
    border: 1px solid #fdba74;
    background: #fff7ed;
    color: #7c2d12;
    font-size: 0.85rem;
  }

  .reception-accept__notice strong {
    font-weight: 700;
  }

  .reception-accept__form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .reception-accept__row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 0.75rem;
  }

  .reception-accept__field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-weight: 600;
    color: #0f172a;
  }

  .reception-accept__field input,
  .reception-accept__field select {
    width: 100%;
    border-radius: 12px;
    border: 1px solid #cbd5f5;
    padding: 0.55rem 0.75rem;
    background: #ffffff;
    font-size: 0.95rem;
  }

  .reception-accept__field--alert input {
    border-color: #f59e0b;
    background: #fff7ed;
    box-shadow: 0 0 0 2px rgba(251, 191, 36, 0.2);
  }

  .reception-accept__field--inline {
    padding: 0.5rem;
    border: 1px dashed #cbd5f5;
    border-radius: 12px;
  }

  .reception-accept__radio {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin-right: 1rem;
  }

  .reception-accept__required {
    margin-left: 0.35rem;
    color: #b91c1c;
    font-size: 0.8rem;
    font-weight: 700;
  }

  .reception-accept__optional {
    margin-left: 0.35rem;
    color: #64748b;
    font-size: 0.78rem;
    font-weight: 600;
  }

  .reception-accept__error {
    color: #b91c1c;
    font-size: 0.82rem;
  }

  .reception-accept__manual {
    margin-top: 0.4rem;
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .reception-accept__manual input {
    flex: 1 1 160px;
    border-radius: 12px;
    border: 1px solid #cbd5e1;
    padding: 0.45rem 0.65rem;
    font-size: 0.85rem;
  }

  .reception-accept__actions {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .reception-accept__buttons {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .reception-accept__hints {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.85rem;
    color: #475569;
  }

  .reception-accept__result {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 0.95rem;
    border-radius: 18px;
    border: 1px solid rgba(148, 163, 184, 0.35);
    background: #f8fafc;
  }

  .reception-accept__result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .reception-accept__result-header h3 {
    margin: 0;
    font-size: 1rem;
    color: #0f172a;
  }

  .reception-accept__result-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    font-size: 0.85rem;
    color: #475569;
  }

  .reception-accept__result-detail {
    margin: 0;
    font-size: 0.85rem;
    color: #475569;
  }

  .reception-accept__result-empty {
    margin: 0;
    font-size: 0.9rem;
    color: #64748b;
  }

  .reception-search {
    background: #ffffff;
    border-radius: 24px;
    padding: 1.25rem;
    border: 1px solid rgba(148, 163, 184, 0.3);
    box-shadow: 0 8px 32px rgba(15, 23, 42, 0.06);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .reception-search--header {
    background: #f8fafc;
    border-color: rgba(148, 163, 184, 0.22);
    box-shadow: none;
    margin-top: 1rem;
  }

  .reception-search__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .reception-search__header-main {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 0;
  }

  .reception-search__header-main h2 {
    margin: 0;
    font-size: 1.05rem;
    color: #0f172a;
  }

  .reception-search__header-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 0.75rem;
    font-size: 0.82rem;
    color: #475569;
    font-weight: 650;
  }

  .reception-search__header-meta-advanced {
    font-size: 0.82rem;
    color: #64748b;
    font-weight: 650;
  }

  .reception-search__header-summary {
    color: #0f172a;
    font-weight: 800;
    font-size: 0.92rem;
  }

  .reception-search[data-collapsed='true'] .reception-search__header-meta-advanced {
    display: none;
  }

  .reception-search.is-collapsed {
    padding-bottom: 0.9rem;
  }

  .reception-search__form {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .reception-search__row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.75rem;
  }

  .reception-search__row--secondary {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.55rem;
    margin-top: 0.55rem;
  }

  .reception-search__details {
    border: 1px solid rgba(148, 163, 184, 0.22);
    background: #ffffff;
    border-radius: 14px;
    padding: 0.35rem 0.6rem;
  }

  .reception-search__details-summary {
    cursor: pointer;
    list-style: none;
    font-weight: 800;
    color: #334155;
    padding: 0.35rem 0.25rem;
  }

  .reception-search__details-summary::-webkit-details-marker {
    display: none;
  }

  .reception-search__field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-weight: 600;
    color: #0f172a;
    font-size: 0.92rem;
  }

  .reception-search__field input,
  .reception-search__field select,
  .reception-toolbar__keyword-input {
    width: 100%;
    border-radius: 8px;
    border: 1px solid #cbd5e1;
    padding: 0.55rem 0.75rem;
    min-height: 2.25rem;
    background: #ffffff;
    font-size: 0.95rem;
  }

  .reception-search__actions {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  .reception-search__date-history {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    padding: 0.65rem 0.75rem;
    border-radius: 12px;
    border: 1px solid rgba(148, 163, 184, 0.28);
    background: #f8fafc;
  }

  .reception-search__date-history-label {
    color: #334155;
    font-size: 0.82rem;
    font-weight: 700;
  }

  .reception-search__date-history-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.42rem;
  }

  .reception-search__date-chip {
    border: 1px solid rgba(148, 163, 184, 0.58);
    background: #ffffff;
    color: #0f172a;
    border-radius: 999px;
    padding: 0.32rem 0.62rem;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
  }

  .reception-search__date-chip:hover {
    border-color: rgba(37, 99, 235, 0.45);
    background: #eff6ff;
  }

  .reception-search__date-chip.is-active {
    border-color: rgba(30, 64, 175, 0.68);
    background: #dbeafe;
    color: #1e3a8a;
  }

  .reception-search__saved {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 0.75rem;
    background: #f8fafc;
    border-radius: 16px;
    border: 1px solid rgba(148, 163, 184, 0.2);
  }

  .reception-search__saved-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    font-size: 0.85rem;
    color: #475569;
  }

  .reception-search__saved-share {
    font-weight: 700;
    color: #1d4ed8;
  }

  .reception-search__saved-updated {
    color: #475569;
  }

  .reception-search__saved-row {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
    align-items: flex-end;
  }

  .reception-search__button {
    padding: 0.65rem 1rem;
    border-radius: 12px;
    min-height: 2.25rem;
    border: 1px solid #1d4ed8;
    background: #ffffff;
    color: #1d4ed8;
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.08s ease, background 0.2s ease, color 0.2s ease;
  }

  .reception-search__button.primary {
    background: #1d4ed8;
    color: #ffffff;
  }

  .reception-search__button.danger {
    border-color: #dc2626;
    background: #dc2626;
    color: #ffffff;
    box-shadow: 0 8px 18px rgba(220, 38, 38, 0.18);
  }

  .reception-search__button.danger:hover {
    border-color: #b91c1c;
    background: #b91c1c;
  }

  .reception-search__button.ghost:hover {
    background: #eef2ff;
  }

  .reception-search__button:active {
    transform: translateY(1px);
  }

  .reception-search__button[data-disabled='true'] {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .reception-search__actions [role='group'] .reception-search__button {
    border-radius: 8px;
  }

  .reception-search__actions [role='group'] .reception-search__button[aria-pressed='true'] {
    font-weight: 800;
    border-color: var(--ui-selected-border);
    background: var(--ui-selected-bg);
    box-shadow: inset 3px 0 0 var(--ui-selected-rail);
  }

  .reception-exceptions {
    background: #ffffff;
    border-radius: 24px;
    padding: 1.25rem;
    border: 1px solid rgba(148, 163, 184, 0.3);
    box-shadow: 0 8px 32px rgba(15, 23, 42, 0.06);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .reception-exceptions__header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .reception-exceptions__title {
    max-width: 520px;
  }

  .reception-exceptions__header h2 {
    margin: 0;
    color: #0f172a;
  }

  .reception-exceptions__header p {
    margin: 0.35rem 0 0;
    color: #64748b;
    font-size: 0.9rem;
  }

  .reception-exceptions__note {
    margin: 0.35rem 0 0;
    color: #475569;
    font-size: 0.82rem;
  }

  .reception-exceptions__counts {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    min-width: min(420px, 100%);
  }

  .reception-exceptions__count {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    align-items: flex-start;
  }

  .reception-exceptions__count-note {
    font-size: 0.75rem;
    color: #64748b;
  }

  .reception-exceptions__count--total .reception-exceptions__count-note {
    color: #0f172a;
    font-weight: 600;
  }

  .reception-exceptions__empty {
    margin: 0;
    color: #64748b;
  }

  .reception-exceptions__list {
    display: grid;
    gap: 0.85rem;
  }

  .reception-exception {
    border-radius: 18px;
    border: 1px solid rgba(148, 163, 184, 0.3);
    background: #f8fafc;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    border-left: 4px solid transparent;
  }

  .reception-exception--send_error {
    border-left-color: #ef4444;
  }

  .reception-exception--delayed {
    border-left-color: #f59e0b;
  }

  .reception-exception--unapproved {
    border-left-color: #6366f1;
  }

  .reception-exception__head {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .reception-exception__title {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .reception-exception__badge {
    padding: 0.35rem 0.8rem;
    border-radius: 999px;
    font-weight: 700;
    font-size: 0.85rem;
  }

  .reception-exception__badge--send_error {
    background: #fee2e2;
    color: #7f1d1d;
  }

  .reception-exception__badge--delayed {
    background: #fef3c7;
    color: #78350f;
  }

  .reception-exception__badge--unapproved {
    background: #e0e7ff;
    color: #3730a3;
  }

  .reception-exception__patient strong {
    display: block;
    color: #0f172a;
  }

  .reception-exception__patient small {
    color: #64748b;
  }

  .reception-exception__priority {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    align-items: flex-end;
    font-size: 0.8rem;
    color: #475569;
  }

  .reception-exception__priority-value {
    color: #0f172a;
    font-weight: 700;
  }

  .reception-exception__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1rem;
    font-size: 0.9rem;
    color: #0f172a;
  }

  .reception-exception__signals {
    display: grid;
    gap: 0.5rem;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  }

  .reception-exception__signal {
    padding: 0.5rem 0.65rem;
    border-radius: 12px;
    border: 1px dashed #cbd5f5;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    color: #475569;
    font-size: 0.8rem;
  }

  .reception-exception__signal.is-active {
    border-style: solid;
    border-color: rgba(59, 130, 246, 0.35);
    background: #eff6ff;
    color: #0f172a;
  }

  .reception-exception__signal-label {
    font-weight: 700;
    font-size: 0.75rem;
    color: #1e293b;
  }

  .reception-exception__signal-detail {
    color: #475569;
    word-break: break-word;
  }

  .reception-exception__queue {
    display: grid;
    gap: 0.4rem;
  }

  .reception-exception__queue-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: #0f172a;
  }

  .reception-exception__queue-title {
    font-weight: 700;
    color: #1e293b;
  }

  .reception-exception__queue-status {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    border: 1px solid #e2e8f0;
    background: #ffffff;
    font-weight: 600;
  }

  .reception-exception__queue-status small {
    font-weight: 500;
    color: #475569;
  }

  .reception-exception__queue-status[data-tone='error'] {
    background: #fee2e2;
    color: #7f1d1d;
    border-color: rgba(248, 113, 113, 0.4);
  }

  .reception-exception__queue-status[data-tone='warning'] {
    background: #fef3c7;
    color: #78350f;
    border-color: rgba(251, 191, 36, 0.4);
  }

  .reception-exception__queue-status[data-tone='info'] {
    background: #dbeafe;
    color: #1e3a8a;
    border-color: rgba(147, 197, 253, 0.5);
  }

  .reception-exception__queue-status[data-tone='success'] {
    background: #dcfce7;
    color: #166534;
    border-color: rgba(74, 222, 128, 0.4);
  }

  .reception-exception__queue-source {
    font-size: 0.75rem;
    color: #64748b;
  }

  .reception-exception__detail strong {
    display: block;
    margin-bottom: 0.35rem;
    color: #0f172a;
  }

  .reception-exception__detail p {
    margin: 0;
    color: #475569;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-word;
  }

  .reception-exception__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.8rem 1rem;
    justify-content: space-between;
  }

  .reception-exception__next {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    color: #0f172a;
    font-weight: 600;
  }

  .reception-exception__next-label {
    font-size: 0.75rem;
    font-weight: 700;
    color: #64748b;
  }

  .reception-exception__action-buttons {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .reception-exception__action-button {
    border-radius: 999px;
    border: 1px solid #1d4ed8;
    background: #ffffff;
    color: #1d4ed8;
    font-weight: 700;
    padding: 0.4rem 0.9rem;
    cursor: pointer;
    transition: transform 0.08s ease, background 0.2s ease, color 0.2s ease;
  }

  .reception-exception__action-button.primary {
    background: #1d4ed8;
    color: #ffffff;
  }

  .reception-exception__action-button.warning {
    border-color: #f59e0b;
    color: #b45309;
  }

  .reception-exception__action-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .reception-summary {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-weight: 600;
    color: #0f172a;
  }

  .reception-summary__main {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
  }

  .reception-summary__state {
    color: #1d4ed8;
    font-weight: 700;
    font-size: 0.85rem;
  }

  .reception-summary__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.8rem;
    font-size: 0.85rem;
    color: #475569;
  }

  .reception-summary__empty {
    margin: 0;
    font-size: 0.9rem;
    color: #475569;
  }

  .reception-summary__empty-hint {
    display: block;
    margin-top: 0.3rem;
    font-size: 0.8rem;
    color: #64748b;
  }

  .reception-selection {
    background: #ffffff;
    border-radius: 18px;
    border: 1px solid rgba(148, 163, 184, 0.35);
    padding: 0.9rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    box-shadow: 0 12px 26px rgba(15, 23, 42, 0.08);
  }

  .reception-selection__main {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    align-items: baseline;
    color: #0f172a;
  }

  .reception-selection__label {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #2563eb;
    font-weight: 700;
  }

  .reception-selection__meta {
    color: #475569;
    font-size: 0.85rem;
  }

  .reception-selection__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    align-items: center;
  }

  .reception-selection__button {
    border-radius: 999px;
    border: 1px solid #1d4ed8;
    background: #1d4ed8;
    color: #ffffff;
    font-weight: 700;
    padding: 0.35rem 0.9rem;
    cursor: pointer;
  }

  .reception-selection__button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .reception-selection__hint {
    font-size: 0.85rem;
    color: #475569;
  }

  .reception-selection__notice {
    font-size: 0.8rem;
    font-weight: 700;
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    border: 1px solid transparent;
  }

  .reception-selection__notice--info {
    background: #eff6ff;
    color: #1d4ed8;
    border-color: #bfdbfe;
  }

  .reception-selection__notice--warning {
    background: #fff7ed;
    color: #c2410c;
    border-color: #fdba74;
  }

  .reception-status {
    margin: 0;
    color: #475569;
  }

  .reception-status--error {
    color: #b91c1c;
    font-weight: 700;
  }

  .reception-status-tabs {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-start;
    align-self: stretch;
    width: 100%;
    gap: 0.5rem 0.75rem;
    background: transparent;
    border-radius: 0;
    border: 0;
    padding: 0;
    box-shadow: none;
  }

  .reception-status-tabs__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.65rem;
  }

  .reception-status-tabs__summary {
    display: inline-flex;
    align-items: baseline;
    gap: 0.6rem;
    min-width: 0;
  }

  .reception-status-tabs__filters {
    margin: 0 0 0.7rem;
  }

  .reception-status-tabs__list {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 0.5rem;
    min-width: 0;
  }

  .reception-status-tabs .reception-toolbar__view-actions {
    margin-left: auto;
  }

  .reception-status-tabs__tab {
    border: 1px solid rgba(148, 163, 184, 0.48);
    background: #ffffff;
    color: #1f2937;
    border-radius: var(--ui-radius-md);
    padding: 0.42rem 0.68rem;
    min-height: 2.25rem;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
  }

  .reception-status-tabs__tab.is-active {
    border-color: var(--ui-selected-border);
    background: var(--ui-selected-bg);
    color: var(--ui-text);
    font-weight: 800;
    box-shadow: inset 3px 0 0 var(--ui-selected-rail);
  }

  .reception-status-tabs__dot {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 999px;
    background: rgba(100, 116, 139, 0.85);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.7);
  }

  .reception-status-tabs__dot[data-tone='error'] {
    background: #dc2626;
  }

  .reception-status-tabs__dot[data-tone='warning'] {
    background: #d97706;
  }

  .reception-status-tabs__dot[data-tone='info'] {
    background: #2563eb;
  }

  .reception-status-tabs__panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .reception-board {
    display: flex;
    gap: 1rem;
    align-items: stretch;
    overflow-x: auto;
    padding-bottom: 0.75rem;
    scroll-snap-type: x proximity;
  }

  .reception-board--table {
    flex-direction: column;
    gap: 0.9rem;
    overflow: visible;
    padding-bottom: 0;
    scroll-snap-type: none;
  }

  .reception-board__column {
    flex: 1 1 auto;
    width: 100%;
    max-width: none;
    min-height: 240px;
    max-height: none;
    border-radius: 20px;
    border: 1px solid rgba(148, 163, 184, 0.3);
    background: #ffffff;
    box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
    overflow: hidden;
    scroll-snap-align: start;
    display: flex;
    flex-direction: column;
    --reception-board-accent: rgba(148, 163, 184, 0.65);
  }

  .reception-board__column[data-status='受付中'] {
    --reception-board-accent: rgba(2, 132, 199, 0.85);
  }

  .reception-board__column[data-status='診療中'] {
    --reception-board-accent: rgba(99, 102, 241, 0.85);
  }

  .reception-board__column[data-status='会計待ち'] {
    --reception-board-accent: rgba(234, 88, 12, 0.85);
  }

  .reception-board__column[data-status='会計済み'] {
    --reception-board-accent: rgba(22, 163, 74, 0.85);
  }

  .reception-board__column[data-status='予約'] {
    --reception-board-accent: rgba(100, 116, 139, 0.85);
  }

  .reception-board__header {
    padding: 0.9rem 1.05rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.6rem;
    background: linear-gradient(90deg, rgba(238, 242, 255, 0.95) 0%, #ffffff 65%);
    border-bottom: 1px solid rgba(148, 163, 184, 0.22);
    border-top: 4px solid var(--reception-board-accent);
  }

  .reception-board__header--workspace,
  .reception-section__header--workspace {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    gap: 0.65rem;
    position: relative;
    padding: 0.85rem 1rem;
    background: #f8fafc;
    border-top: 4px solid var(--reception-board-accent, rgba(2, 132, 199, 0.85));
    border-bottom: 1px solid rgba(148, 163, 184, 0.22);
  }

  .reception-workspace-header__primary {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .reception-workspace-header__title {
    display: inline-flex;
    align-items: baseline;
    gap: 0.6rem;
    min-width: 0;
  }

  .reception-workspace-header__title:focus-visible {
    outline: 3px solid rgba(37, 99, 235, 0.45);
    outline-offset: 3px;
    border-radius: 8px;
  }

  .reception-workspace-header__title h2 {
    margin: 0;
    color: #0f172a;
    font-size: 1.2rem;
    line-height: 1.2;
  }

  .reception-workspace-header__chips {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.35rem;
    min-width: 0;
  }

  .reception-workspace-header__chip {
    display: inline-flex;
    align-items: center;
    min-height: 1.7rem;
    border: 1px solid rgba(37, 99, 235, 0.24);
    border-radius: 999px;
    background: #eff6ff;
    color: #1e3a8a;
    padding: 0.2rem 0.55rem;
    font-size: 0.78rem;
    font-weight: 800;
    white-space: nowrap;
  }

  .reception-workspace-header__controls {
    min-width: 0;
  }

  .reception-board__title {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    align-items: baseline;
    min-width: 0;
  }

  .reception-board__title h2 {
    margin: 0;
    font-size: 1rem;
    color: #0f172a;
    white-space: nowrap;
  }

  .reception-board__count {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.06);
    color: #0f172a;
    font-weight: 700;
    font-size: 0.85rem;
    white-space: nowrap;
  }

  .reception-board__toggle {
    border: 1px solid rgba(148, 163, 184, 0.55);
    background: #ffffff;
    color: #0f172a;
    border-radius: 8px;
    min-height: 2.25rem;
    padding: 0.35rem 0.75rem;
    cursor: pointer;
    font-weight: 700;
  }

  .reception-board__toggle[aria-expanded='true'] {
    font-weight: 800;
    border-color: var(--ui-selected-border);
    background: var(--ui-selected-bg);
    box-shadow: inset 3px 0 0 var(--ui-selected-rail);
  }

  .reception-board__body {
    padding: 0.9rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    flex: 1 1 auto;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .reception-board__empty {
    margin: 0;
    padding: 0.85rem 0.9rem;
    border-radius: 16px;
    border: 1px dashed rgba(148, 163, 184, 0.55);
    background: #f8fafc;
    color: #64748b;
    font-weight: 600;
    text-align: center;
  }

  .reception-card {
    border-radius: 18px;
    border: 1px solid rgba(148, 163, 184, 0.35);
    background: #f8fafc;
    padding: 0.85rem 0.9rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    cursor: pointer;
    transition: box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease;
    outline: none;
  }

  .reception-card:hover {
    border-color: rgba(37, 99, 235, 0.35);
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
    background: #ffffff;
  }

  .reception-card.is-selected {
    border-color: rgba(37, 99, 235, 0.75);
    box-shadow: 0 14px 30px rgba(37, 99, 235, 0.16);
    background: #ffffff;
  }

  .reception-card[data-sex-tone='male'] {
    border-left: 6px solid #2563eb;
  }

  .reception-card[data-sex-tone='female'] {
    border-left: 6px solid #e11d48;
  }

  .reception-card.is-selected[data-sex-tone='male'] {
    border-left-color: #2563eb;
  }

  .reception-card.is-selected[data-sex-tone='female'] {
    border-left-color: #e11d48;
  }

  .reception-card[data-elapsed-severity='1']:not(:hover):not(.is-selected) {
    border-color: rgba(234, 179, 8, 0.35);
    background: #fffbeb;
  }

  .reception-card[data-elapsed-severity='2']:not(:hover):not(.is-selected) {
    border-color: rgba(234, 88, 12, 0.38);
    background: #fff7ed;
  }

  .reception-card[data-elapsed-severity='3']:not(:hover):not(.is-selected) {
    border-color: rgba(220, 38, 38, 0.4);
    background: #fef2f2;
  }

  .reception-card:focus-visible {
    outline: 3px solid rgba(37, 99, 235, 0.45);
    outline-offset: 2px;
  }

  .reception-card__summary {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    align-items: flex-start;
    min-width: 0;
  }

  .reception-card__identity {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .reception-card__identity-text {
    display: flex;
    flex-direction: column;
    gap: 0.16rem;
    min-width: 0;
  }

  .reception-card__kana {
    font-size: 0.78rem;
    color: #64748b;
    font-weight: 700;
    letter-spacing: 0.02em;
    line-height: 1.2;
  }

  .reception-card__display-name {
    font-size: 1.08rem;
    font-weight: 900;
    color: #0f172a;
    line-height: 1.15;
    letter-spacing: 0.01em;
  }

  .reception-card__patient-id {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-weight: 900;
    font-size: 0.9rem;
    color: #0f172a;
    white-space: nowrap;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.45);
    background: rgba(15, 23, 42, 0.06);
    padding: 0.18rem 0.55rem;
  }

  .reception-card__expand {
    margin-top: 0.35rem;
    padding-top: 0.65rem;
    border-top: 1px dashed rgba(148, 163, 184, 0.35);
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .reception-card__head {
    display: flex;
    justify-content: space-between;
    gap: 0.6rem;
    align-items: flex-start;
  }

  .reception-card__time-block {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  .reception-card__time-main {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    min-width: 0;
  }

  .reception-card__time-label {
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 800;
    color: rgba(71, 85, 105, 0.95);
  }

  .reception-card__time-value {
    font-weight: 900;
    color: #0f172a;
    letter-spacing: 0.02em;
    font-size: 1rem;
  }

  .reception-card__time-sub {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    color: #475569;
    font-weight: 700;
    font-size: 0.85rem;
  }

  .reception-card__time-sub-value {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 0.85rem;
  }

  .reception-card__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    align-items: center;
  }

  .reception-card__chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border-radius: 999px;
    padding: 0.15rem 0.55rem;
    font-size: 0.78rem;
    font-weight: 900;
    border: 1px solid transparent;
    white-space: nowrap;
  }

  .reception-card__chip--kind[data-kind='reserved'] {
    background: #ede9fe;
    border-color: #c4b5fd;
    color: #5b21b6;
  }

  .reception-card__chip--kind[data-kind='walkin'] {
    background: #ecfeff;
    border-color: #a5f3fc;
    color: #0e7490;
  }

  .reception-card__chip--elapsed[data-severity='0'] {
    background: rgba(15, 23, 42, 0.06);
    border-color: rgba(148, 163, 184, 0.4);
    color: #0f172a;
  }

  .reception-card__chip--elapsed[data-severity='1'] {
    background: #fffbeb;
    border-color: #fcd34d;
    color: #92400e;
  }

  .reception-card__chip--elapsed[data-severity='2'] {
    background: #fff7ed;
    border-color: #fdba74;
    color: #9a3412;
  }

  .reception-card__chip--elapsed[data-severity='3'] {
    background: #fef2f2;
    border-color: #fca5a5;
    color: #991b1b;
  }

  .reception-card__name {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: baseline;
    color: #0f172a;
  }

  .reception-card__name strong {
    font-size: 1.05rem;
  }

  .reception-card__name small {
    font-size: 0.85rem;
    color: #64748b;
  }

  .reception-card__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 0.75rem;
    color: #475569;
    font-size: 0.86rem;
    font-weight: 600;
  }

  .reception-card__meta code {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 0.82rem;
    background: rgba(15, 23, 42, 0.06);
    padding: 0.1rem 0.35rem;
    border-radius: 8px;
  }

  .reception-card__signals {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    align-items: center;
  }

  .reception-card__signals small {
    color: #64748b;
    font-size: 0.78rem;
    font-weight: 600;
  }

  .reception-card__actions {
    display: flex;
    gap: 0.45rem;
    flex-wrap: nowrap;
    justify-content: flex-end;
    align-items: center;
    margin-top: 0.15rem;
  }

  .reception-card__menu {
    position: relative;
    display: inline-flex;
  }

  .reception-card__menu.is-open .reception-card__action--menu-trigger {
    background: #e0e7ff;
  }

  .reception-card__action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    border-radius: 999px;
    border: 1px solid #1d4ed8;
    background: #ffffff;
    color: #1d4ed8;
    font-weight: 800;
    padding: 0.3rem 0.65rem;
    cursor: pointer;
    font-size: 0.85rem;
    transition: background 0.2s ease;
  }

  .reception-card__action:hover {
    background: #eef2ff;
  }

  .reception-card__action--primary {
    background: #1d4ed8;
    color: #ffffff;
  }

  .reception-card__action--primary:hover {
    background: #1e40af;
  }

  .reception-card__action--menu-trigger {
    border-color: #94a3b8;
    color: #334155;
  }

  .reception-card__submenu {
    position: absolute;
    top: calc(100% + 0.35rem);
    right: 0;
    width: max-content;
    min-width: 8rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.4rem;
    border-radius: 12px;
    border: 1px solid rgba(148, 163, 184, 0.45);
    background: #ffffff;
    box-shadow: 0 14px 28px rgba(15, 23, 42, 0.16);
    z-index: 4;
  }

  .reception-board--table .reception-card__submenu {
    z-index: 8;
  }

  .reception-card__submenu-item {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border-radius: 10px;
    border: 1px solid #cbd5e1;
    background: #ffffff;
    color: #1e293b;
    font-weight: 700;
    padding: 0.32rem 0.55rem;
    cursor: pointer;
    font-size: 0.8rem;
    text-align: left;
    transition: background 0.2s ease, border-color 0.2s ease;
  }

  .reception-card__action .clinical-icon,
  .reception-card__submenu-item .clinical-icon,
  .reception-search__button .clinical-icon {
    width: 1.2em;
    height: 1.2em;
    margin-inline-end: 0;
  }

  .reception-card__submenu-item:hover {
    background: #f8fafc;
    border-color: #94a3b8;
  }

  .reception-card__submenu-item.warning {
    border-color: #f59e0b;
    color: #b45309;
    background: #fffbeb;
  }

  .reception-card__submenu-item.primary {
    border-color: #1d4ed8;
    background: #1d4ed8;
    color: #ffffff;
  }

  .reception-card__submenu-item.primary:hover {
    background: #1e40af;
    border-color: #1e40af;
  }

  .reception-card__submenu-item.danger {
    border-color: #ef4444;
    color: #b91c1c;
    background: #fef2f2;
  }

  .reception-card__submenu-item.danger:hover {
    background: #fee2e2;
  }

  .reception-card__submenu-item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: #f8fafc;
  }

  .reception-card__submenu-item.primary:disabled {
    background: #bfdbfe;
    border-color: #93c5fd;
    color: #1e3a8a;
    opacity: 0.75;
  }

  .reception-card__action.warning {
    border-color: #f59e0b;
    color: #b45309;
  }

  .reception-card__action.danger {
    border-color: #ef4444;
    color: #b91c1c;
  }

  .reception-card__action.danger:hover {
    background: #fef2f2;
  }

  .reception-card__action:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: #ffffff;
  }

  .reception-card__action--primary:disabled {
    border-color: #93c5fd;
    background: #bfdbfe;
    color: #1e3a8a;
  }

  .reception-patient-search {
    background: #ffffff;
    border-radius: 20px;
    padding: 1.1rem;
    border: 1px solid rgba(148, 163, 184, 0.3);
    box-shadow: 0 14px 36px rgba(15, 23, 42, 0.08);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .reception-patient-search--embedded {
    background: #f8fafc;
    border-color: rgba(148, 163, 184, 0.22);
    box-shadow: none;
  }

  .reception-patient-search__collapsed-hint {
    margin: 0;
    color: #64748b;
    font-size: 0.85rem;
    line-height: 1.6;
  }

  .reception-patient-search__header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .reception-patient-search__header h2,
  .reception-patient-search__header h3 {
    margin: 0;
    font-size: 1.05rem;
    color: #0f172a;
  }

  .reception-patient-search__header-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .reception-patient-search__meta {
    font-size: 0.85rem;
    color: #64748b;
  }

  .reception-patient-search__form {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .reception-patient-search__row {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    align-items: flex-end;
  }

  .reception-patient-search__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .reception-patient-search__field {
    flex: 1 1 220px;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-weight: 700;
    color: #0f172a;
    font-size: 0.92rem;
  }

  .reception-patient-search__field input {
    width: 100%;
    border-radius: 12px;
    border: 1px solid #cbd5e1;
    padding: 0.55rem 0.75rem;
    background: #ffffff;
    font-size: 0.95rem;
  }

  .reception-patient-search__buttons {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .reception-patient-search-panel {
    position: fixed;
    z-index: 2400;
    width: min(420px, 80vw);
    max-height: 70vh;
    border-radius: 18px;
    border: 1px solid rgba(148, 163, 184, 0.35);
    background: #ffffff;
    box-shadow: 0 22px 56px rgba(15, 23, 42, 0.22);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .reception-patient-search-panel__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.8rem 0.9rem 0.7rem;
    border-bottom: 1px solid rgba(148, 163, 184, 0.22);
    background: #f8fafc;
    cursor: grab;
    user-select: none;
    touch-action: none;
  }

  .reception-patient-search-panel__header-actions {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .reception-patient-search-panel__header.is-dragging {
    cursor: grabbing;
    background: #f1f5f9;
  }

  .reception-patient-search-panel__title {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }

  .reception-patient-search-panel__title h3 {
    margin: 0;
    font-size: 1rem;
    color: #0f172a;
  }

  .reception-patient-search-panel__meta {
    font-size: 0.82rem;
    color: #64748b;
  }

  .reception-patient-search-panel__body {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    padding: 0 0.9rem 0.9rem;
    min-height: 0;
    overflow: auto;
  }

  .reception-patient-search-panel.is-collapsed {
    max-height: none;
  }

  .reception-patient-search-panel__accept {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    padding-top: 0.2rem;
    border-top: 1px solid rgba(148, 163, 184, 0.22);
  }

  .reception-patient-search__list {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    max-height: 300px;
    overflow: auto;
    padding-right: 0.25rem;
  }

  .reception-patient-search-panel .reception-patient-search__list {
    max-height: min(420px, calc(70vh - 260px));
  }

  .reception-patient-search__item {
    border-radius: 16px;
    border: 1px solid rgba(148, 163, 184, 0.3);
    background: #ffffff;
    padding: 0.75rem 0.85rem;
    text-align: left;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .reception-patient-search__item:focus-visible {
    outline: 3px solid rgba(37, 99, 235, 0.45);
    outline-offset: 2px;
    border-radius: 14px;
  }

  .reception-patient-search__item-select {
    border: 0;
    background: transparent;
    padding: 0;
    text-align: left;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .reception-patient-search__item-main {
    display: flex;
    justify-content: space-between;
    gap: 0.6rem;
    align-items: baseline;
    flex-wrap: wrap;
  }

  .reception-patient-search__item-id {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 0.85rem;
    font-weight: 700;
    color: #475569;
  }

  .reception-patient-search__item-select:focus-visible {
    outline: 3px solid rgba(37, 99, 235, 0.45);
    outline-offset: 2px;
    border-radius: 12px;
  }

  .reception-patient-search__item-details {
    border-top: 1px solid rgba(148, 163, 184, 0.25);
    padding-top: 0.55rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .reception-patient-search__item-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .reception-patient-search__item-actions .reception-search__button {
    padding: 0.45rem 0.75rem;
    font-size: 0.85rem;
  }

  .reception-patient-search__item:hover {
    border-color: rgba(37, 99, 235, 0.35);
    box-shadow: 0 10px 22px rgba(15, 23, 42, 0.1);
    background: #ffffff;
  }

  .reception-patient-search__item.is-selected {
    border-color: rgba(37, 99, 235, 0.95);
    box-shadow:
      0 0 0 2px rgba(37, 99, 235, 0.28),
      0 12px 26px rgba(37, 99, 235, 0.16);
    background: linear-gradient(180deg, rgba(239, 246, 255, 0.9), #ffffff);
  }

  .reception-patient-search__item.is-selected .reception-patient-search__item-id {
    color: #1d4ed8;
  }

  .reception-patient-search__item strong {
    display: block;
    color: #0f172a;
  }

  .reception-patient-search__item small {
    display: block;
    margin-top: 0.2rem;
    color: #64748b;
  }

  .reception-patient-search__item-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 0.75rem;
    font-size: 0.85rem;
    color: #475569;
    font-weight: 600;
  }

  .reception-patient-search__pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
    border-top: 1px solid rgba(148, 163, 184, 0.22);
    padding-top: 0.6rem;
  }

  .reception-patient-search__pagination-range {
    font-size: 0.82rem;
    color: #64748b;
    font-weight: 700;
  }

  .reception-patient-search__pagination-actions {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  .reception-patient-search__pagination-actions .reception-search__button {
    padding: 0.4rem 0.65rem;
    font-size: 0.8rem;
  }

  .reception-patient-search__pagination-page {
    min-width: 4.6rem;
    text-align: center;
    font-size: 0.82rem;
    font-weight: 700;
    color: #334155;
  }

  .reception-history {
    background: #ffffff;
    border-radius: 20px;
    padding: 1.1rem;
    border: 1px solid rgba(148, 163, 184, 0.3);
    box-shadow: 0 14px 36px rgba(15, 23, 42, 0.08);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .reception-history__header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .reception-history__header h2 {
    margin: 0;
    font-size: 1.05rem;
    color: #0f172a;
  }

  .reception-history__meta {
    font-size: 0.85rem;
    color: #64748b;
  }

  .reception-history__list {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    max-height: 340px;
    overflow: auto;
    padding-right: 0.25rem;
  }

  .reception-history__item {
    border-radius: 16px;
    border: 1px solid rgba(148, 163, 184, 0.3);
    background: #f8fafc;
    padding: 0.7rem 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .reception-history__item strong {
    color: #0f172a;
    font-size: 0.95rem;
  }

  .reception-history__item small {
    color: #64748b;
    font-size: 0.8rem;
    font-weight: 600;
  }

  .reception-results-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding: 0.85rem 1rem;
    border-radius: 16px;
    border: 1px solid rgba(148, 163, 184, 0.25);
    background: #ffffff;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
  }

  .reception-results-toolbar__summary {
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
    min-width: 0;
  }

  .reception-results-toolbar__loading {
    font-size: 0.85rem;
    color: #475569;
    font-weight: 700;
  }

  .reception-results-toolbar__actions {
    display: inline-flex;
    gap: 0.4rem;
  }

  .reception-results-toolbar__toggle {
    border-radius: 10px;
    border: 1px solid #cbd5e1;
    background: #ffffff;
    color: #0f172a;
    padding: 0.45rem 0.75rem;
    font-weight: 800;
    cursor: pointer;
  }

  .reception-results-toolbar__toggle[aria-pressed='true'] {
    background: var(--ui-selected-bg);
    border-color: var(--ui-selected-border);
    box-shadow: inset 3px 0 0 var(--ui-selected-rail);
  }

  .reception-section {
    background: #ffffff;
    border-radius: 20px;
    border: 1px solid rgba(148, 163, 184, 0.3);
    box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
    overflow: hidden;
  }

  .reception-board--table .reception-section {
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }

  .reception-section + .reception-section {
    margin-top: 1rem;
  }

  .reception-board--table .reception-section + .reception-section {
    margin-top: 0;
  }

  .reception-section__header {
    padding: 1rem 1.25rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: linear-gradient(90deg, #eef2ff 0%, #ffffff 60%);
  }

  .reception-board--table .reception-section__header {
    border-right: 0;
  }

  .reception-section__header h2 {
    margin: 0;
    color: #0f172a;
  }

  .reception-board--table .reception-section__header h2 {
    font-size: 1.2rem;
    line-height: 1.2;
    color: #0f172a;
    letter-spacing: 0;
  }

  .reception-section__count {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin-left: 0.75rem;
    padding: 0.35rem 0.7rem;
    border-radius: 999px;
    background: #f1f5f9;
    color: #0f172a;
    font-weight: 700;
  }

  .reception-board--table .reception-section__count {
    margin-left: 0;
    padding: 0.2rem 0.55rem;
    font-size: 0.82rem;
  }

  .reception-section__toggle {
    border: 1px solid #cbd5e1;
    background: #ffffff;
    color: #0f172a;
    border-radius: 12px;
    padding: 0.45rem 0.85rem;
    cursor: pointer;
  }

  .reception-table__wrapper {
    overflow-x: auto;
    overflow-y: visible;
  }

  .reception-board--table .reception-table__wrapper {
    max-height: none;
  }

  .reception-table__wrapper:focus-visible {
    outline: 3px solid rgba(37, 99, 235, 0.45);
    outline-offset: 2px;
  }

  .reception-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 760px;
  }

  .reception-table th,
  .reception-table td {
    padding: 0.75rem 0.9rem;
    border-bottom: 1px solid #e2e8f0;
    text-align: left;
    color: #0f172a;
  }

  .reception-table th {
    background: #f8fafc;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #475569;
  }

  .reception-board--table .reception-table thead th {
    position: sticky;
    top: 0;
    z-index: 2;
  }

  .reception-table tr:hover {
    background: #f8fafc;
  }

  .reception-table__row {
    --reception-sex-rail: transparent;
    transition: background-color 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
    box-shadow: inset 4px 0 0 var(--reception-sex-rail);
  }

  .reception-table__row[data-sex-tone='male'] {
    --reception-sex-rail: #2563eb;
  }

  .reception-table__row[data-sex-tone='female'] {
    --reception-sex-rail: #e11d48;
  }

  .reception-table__row--selected {
    background: var(--ui-selected-bg);
    box-shadow: inset 0 0 0 1px var(--ui-selected-border), inset 4px 0 0 var(--reception-sex-rail);
  }

  .reception-table__row--selected[data-sex-tone='unknown'] {
    --reception-sex-rail: var(--ui-selected-rail);
  }

  .reception-table__row--selected:hover {
    background: rgba(219, 234, 254, 0.8);
  }

  .reception-table__empty {
    text-align: center;
    color: #475569;
  }

  .reception-table__time {
    font-weight: 700;
  }

  .reception-table__id {
    color: #475569;
    display: inline-flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .reception-table__id .patient-meta-row__line {
    gap: 0.2rem 0.4rem;
  }

  .reception-table__id-item {
    align-items: baseline;
  }

  .reception-table__id-label {
    font-size: 0.7rem;
    color: #64748b;
  }

  .reception-table__id-value {
    font-weight: 700;
    color: #0f172a;
  }

  .reception-table__sub {
    color: #64748b;
    display: block;
    font-size: 0.78rem;
  }

  .reception-table__patient {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    min-width: 0;
  }

  .reception-table__patient-text {
    min-width: 0;
  }

  .reception-table__patient strong {
    display: block;
  }

  .reception-table__kana {
    font-weight: 700;
    line-height: 1.2;
  }

  .reception-table__age {
    font-weight: 700;
  }

  .reception-table__age-cell {
    color: #475569;
    font-weight: 800;
    white-space: nowrap;
  }

  .reception-patient-icon {
    --reception-patient-icon-bg: #f8fafc;
    --reception-patient-icon-bg-strong: #e2e8f0;
    --reception-patient-icon-fg: #64748b;
    --reception-patient-icon-fg-soft: #94a3b8;
    --reception-patient-icon-ring: rgba(100, 116, 139, 0.28);
    --reception-patient-icon-glow: rgba(100, 116, 139, 0.12);
    display: inline-flex;
    flex: 0 0 2rem;
    width: 2rem;
    height: 2rem;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background:
      radial-gradient(circle at 32% 24%, rgba(255, 255, 255, 0.95), transparent 38%),
      linear-gradient(145deg, var(--reception-patient-icon-bg) 0%, var(--reception-patient-icon-bg-strong) 100%);
    box-shadow:
      inset 0 0 0 1px var(--reception-patient-icon-ring),
      0 0.35rem 0.8rem var(--reception-patient-icon-glow);
  }

  .reception-patient-icon svg {
    width: 1.55rem;
    height: 1.55rem;
    overflow: visible;
  }

  .reception-patient-icon[data-sex-tone='male'] {
    --reception-patient-icon-bg: #eff6ff;
    --reception-patient-icon-bg-strong: #bfdbfe;
    --reception-patient-icon-fg: #1d4ed8;
    --reception-patient-icon-fg-soft: #60a5fa;
    --reception-patient-icon-ring: rgba(37, 99, 235, 0.28);
    --reception-patient-icon-glow: rgba(37, 99, 235, 0.16);
  }

  .reception-patient-icon[data-sex-tone='female'] {
    --reception-patient-icon-bg: #fff1f2;
    --reception-patient-icon-bg-strong: #fecdd3;
    --reception-patient-icon-fg: #be123c;
    --reception-patient-icon-fg-soft: #fb7185;
    --reception-patient-icon-ring: rgba(225, 29, 72, 0.28);
    --reception-patient-icon-glow: rgba(225, 29, 72, 0.16);
  }

  .reception-patient-icon[data-age-group='child'] {
    border-radius: 12px;
  }

  .reception-patient-icon__halo {
    fill: rgba(255, 255, 255, 0.34);
    stroke: var(--reception-patient-icon-fg-soft);
    stroke-width: 0.9;
  }

  .reception-patient-icon__shadow {
    fill: none;
    stroke: var(--reception-patient-icon-fg-soft);
    stroke-linecap: round;
    stroke-width: 2.3;
    opacity: 0.34;
  }

  .reception-patient-icon__head,
  .reception-patient-icon__body {
    fill: var(--reception-patient-icon-fg);
  }

  .reception-patient-icon__highlight {
    fill: none;
    stroke: rgba(255, 255, 255, 0.88);
    stroke-linecap: round;
    stroke-width: 1.45;
    opacity: 0.9;
  }

  .reception-patient-icon__age-mark circle {
    fill: #ffffff;
    stroke: var(--reception-patient-icon-fg-soft);
    stroke-width: 0.9;
  }

  .reception-patient-icon__age-mark path {
    fill: none;
    stroke: var(--reception-patient-icon-fg);
    stroke-linecap: round;
    stroke-width: 1.15;
  }

  .reception-table__insurance {
    font-weight: 600;
    color: #0f172a;
  }

  .reception-table__claim {
    font-weight: 600;
    color: #0f172a;
  }

  .reception-table__last {
    font-weight: 600;
    color: #0f172a;
  }

  .reception-table__note {
    color: #1f2937;
  }

  .reception-table__source {
    color: #64748b;
    font-size: 0.8rem;
  }

  .reception-table__action {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.45rem;
    min-height: 4.75rem;
    white-space: nowrap;
  }

  .reception-table__action-heading {
    width: 15rem;
  }

  .reception-table__action .reception-card__action {
    min-height: 2.25rem;
    padding: 0.42rem 0.82rem;
  }

  .reception-table__action-button {
    border-radius: 999px;
    border: 1px solid #1d4ed8;
    background: #ffffff;
    color: #1d4ed8;
    font-weight: 700;
    padding: 0.35rem 0.75rem;
    cursor: pointer;
    margin: 0;
  }

  .reception-table__action-button:hover {
    background: #eef2ff;
  }

  .reception-table__action-button.primary {
    border-color: #1d4ed8;
    background: #1d4ed8;
    color: #ffffff;
  }

  .reception-table__action-button.primary:hover {
    background: #1e40af;
  }

  .reception-table__action-button.warning {
    border-color: rgba(234, 88, 12, 0.95);
    color: rgba(234, 88, 12, 0.95);
  }

  .reception-table__action-button.warning:hover {
    background: #fff7ed;
  }

  .reception-table__action-button.danger {
    border-color: rgba(220, 38, 38, 0.95);
    color: rgba(220, 38, 38, 0.95);
  }

  .reception-table__action-button.danger:hover {
    background: #fef2f2;
  }

  .reception-table__action-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: #ffffff;
  }

  .reception-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.65rem;
    border-radius: 999px;
    font-weight: 700;
    font-size: 0.85rem;
  }

  .reception-badge--受付中 {
    background: #dbeafe;
    color: #1e3a8a;
  }

  .reception-badge--診療中 {
    background: #ffedd5;
    color: #7c2d12;
  }

  .reception-badge--会計待ち {
    background: #fef3c7;
    color: #78350f;
  }

  .reception-badge--会計済み {
    background: #d1fae5;
    color: #065f46;
  }

  .reception-badge--予約 {
    background: #bae6fd;
    color: #0c4a6e;
  }

  .reception-badge--muted {
    background: #f1f5f9;
    color: #475569;
  }

  .reception-queue {
    display: inline-flex;
    align-items: center;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    font-weight: 700;
    font-size: 0.8rem;
  }

  .reception-queue--info {
    background: #dbeafe;
    color: #1e3a8a;
  }

  .reception-queue--warning {
    background: #fef3c7;
    color: #78350f;
  }

  .reception-queue--error {
    background: #fee2e2;
    color: #7f1d1d;
  }

  .reception-queue--success {
    background: #d1fae5;
    color: #065f46;
  }

  .reception-table tr:focus-visible {
    outline: 2px solid #1d4ed8;
    outline-offset: -2px;
  }

  .reception-audit {
    margin-top: 1.75rem;
    background: #ffffff;
    border-radius: 24px;
    padding: 1.5rem;
    border: 1px solid rgba(148, 163, 184, 0.3);
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .reception-audit__header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .reception-audit__header h2 {
    margin: 0;
    color: #0f172a;
  }

  .reception-audit__header p {
    margin: 0.35rem 0 0;
    color: #64748b;
    font-size: 0.9rem;
  }

  .reception-audit__header button {
    border-radius: 999px;
    border: 1px solid #1d4ed8;
    background: #ffffff;
    color: #1d4ed8;
    font-weight: 700;
    padding: 0.45rem 0.9rem;
    cursor: pointer;
  }

  .reception-audit__controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: flex-end;
  }

  .reception-audit__field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-weight: 600;
    color: #0f172a;
    min-width: 260px;
  }

  .reception-audit__field input {
    border-radius: 12px;
    border: 1px solid #cbd5e1;
    padding: 0.55rem 0.75rem;
    font-size: 0.95rem;
  }

  .reception-audit__toggle {
    display: flex;
    gap: 0.35rem;
    align-items: center;
    font-weight: 600;
    color: #0f172a;
  }

  .reception-audit__controls button {
    border-radius: 999px;
    border: 1px solid #1d4ed8;
    background: #1d4ed8;
    color: #ffffff;
    font-weight: 700;
    padding: 0.45rem 0.9rem;
    cursor: pointer;
  }

  .reception-audit__summary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    font-weight: 600;
    color: #0f172a;
  }

  .reception-audit__list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .reception-audit__row {
    border-radius: 16px;
    border: 1px solid rgba(148, 163, 184, 0.3);
    padding: 0.85rem;
    background: #f8fafc;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .reception-audit__row-main {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }

  .reception-audit__row-sub {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    color: #475569;
    font-size: 0.85rem;
  }

  .reception-audit__row-queue {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    color: #0f172a;
    font-size: 0.85rem;
  }

  .reception-audit__row-queue code {
    background: #e2e8f0;
    padding: 0.2rem 0.4rem;
    border-radius: 6px;
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  }

  .reception-audit__pill {
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    background: #e2e8f0;
    font-weight: 700;
    font-size: 0.8rem;
  }

  .reception-audit__pill--error {
    background: #fee2e2;
    color: #7f1d1d;
  }

  .reception-audit__pill--info {
    background: #e0e7ff;
    color: #3730a3;
  }

  .reception-audit__empty {
    margin: 0;
    color: #64748b;
  }

  @media (max-width: 768px) {
    .reception-page {
      --reception-floating-offset-right: max(0.65rem, calc(env(safe-area-inset-right) + 0.45rem));
      --reception-floating-offset-bottom: max(0.65rem, calc(env(safe-area-inset-bottom) + 0.45rem));
      --reception-floating-stack-height: 0rem;
    }

    .reception-toolbar {
      padding: 0.7rem;
    }

    .reception-toolbar--embedded {
      padding: 0;
    }

    .reception-toolbar__form {
      grid-template-columns: minmax(0, 1fr);
    }

    .reception-toolbar--embedded .reception-toolbar__form {
      grid-template-columns: minmax(0, 1fr);
      width: 100%;
    }

    .reception-toolbar--embedded .reception-toolbar__cluster,
    .reception-toolbar--embedded .reception-toolbar__status {
      align-self: stretch;
      width: 100%;
    }

    .reception-toolbar__disclosure-actions {
      width: 100%;
      justify-content: flex-end;
    }

    .reception-toolbar__panel,
    .reception-toolbar__advanced--embedded {
      padding: 0.6rem;
    }

    .reception-toolbar__advanced-grid,
    .reception-toolbar__advanced--embedded .reception-toolbar__advanced-grid,
    .reception-toolbar__panel-group {
      grid-template-columns: minmax(0, 1fr);
    }

    .reception-workspace-header__primary,
    .reception-status-tabs {
      align-items: stretch;
    }

    .reception-status-tabs__list,
    .reception-workspace-header__chips {
      justify-content: flex-start;
    }

    .reception-toolbar__cluster,
    .reception-toolbar__status {
      align-items: stretch;
    }

    .reception-toolbar__date-field,
    .reception-toolbar__keyword-field {
      flex: 1 1 100%;
      width: 100%;
    }

    .order-console__action {
      flex: 1 1 100%;
    }

    .reception-page__meta-bar {
      grid-template-columns: minmax(0, 1fr);
    }

    .reception-page__meta-details {
      justify-self: start;
    }

    .reception-results-toolbar__actions {
      width: 100%;
      justify-content: flex-start;
    }

    .reception-layout {
      grid-template-columns: 1fr;
    }

    .reception-layout__side {
      position: static;
      max-height: none;
      overflow: visible;
      padding-right: 0;
    }

    .reception-accept-workflow-modal {
      left: max(0.45rem, calc(env(safe-area-inset-left) + 0.25rem));
      right: max(0.45rem, calc(env(safe-area-inset-right) + 0.25rem));
      bottom: calc(var(--reception-floating-offset-bottom) + var(--reception-floating-stack-height) + 0.45rem);
      top: auto;
      width: auto;
      height: min(86vh, 880px);
      max-height: calc(100vh - env(safe-area-inset-top) - var(--reception-floating-stack-height) - 1.5rem);
      border-radius: 16px;
    }

    .reception-accept-workflow-modal__header {
      padding: 0.7rem;
      align-items: flex-start;
    }

    .reception-accept-workflow-modal__body {
      padding: 0.7rem;
    }

    .reception-accept-modal {
      grid-template-columns: 1fr;
      min-height: 0;
      height: 100%;
    }

    .reception-accept-modal__left,
    .reception-accept-modal__right {
      padding: 0.7rem;
    }

    .reception-accept-modal__accept-header {
      flex-direction: column;
      align-items: stretch;
    }

    .reception-accept-modal__accept-actions {
      justify-content: flex-end;
    }

    .reception-patient-search-panel {
      width: min(420px, calc(100vw - 1rem));
      max-height: 68vh;
    }

    .reception-patient-search-panel__body {
      padding: 0 0.7rem 0.7rem;
    }

    .reception-patient-search-panel .reception-patient-search__list {
      max-height: calc(68vh - 250px);
    }

    .reception-table {
      min-width: 840px;
    }

    .reception-board__column {
      flex: 0 0 300px;
    }

    .reception-board--table .reception-section__header {
      border-right: none;
      border-bottom: 1px solid rgba(148, 163, 184, 0.22);
    }
  }
`;
