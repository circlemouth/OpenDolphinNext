import { css } from '@emotion/react';

export const chartsStyles = css`
  .charts-page {
    min-height: 100vh;
    padding: 2.25rem clamp(1rem, 4vw, 2.75rem);
    background: var(--ui-surface-muted);
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xl);
    --charts-space-2xs: 4px;
    --charts-space-xs: 6px;
    --charts-space-sm: 10px;
    --charts-space-md: 14px;
    --charts-space-lg: 18px;
    --charts-space-xl: 24px;
    --charts-space-2xl: 32px;
    --charts-radius-sm: var(--ui-radius-sm);
    --charts-radius-md: var(--ui-radius-md);
    --charts-radius-lg: var(--ui-radius-lg);
    --charts-shadow-none: none;
    --charts-shadow-1: var(--ui-shadow-soft);
    --charts-shadow-2: var(--ui-shadow-overlay);
    --charts-card-padding: var(--charts-space-md);
    --charts-card-border: 1px solid var(--ui-border);
    --charts-card-shadow: var(--charts-shadow-1);
    --charts-side-padding: var(--charts-space-md);
    --charts-side-border: 1px solid var(--ui-border);
    --charts-side-shadow: var(--charts-shadow-2);
  }

  /* Charts UI Optimization (Proposal B) - Phase1 (UI only). */
  .charts-page[data-charts-ui-opt-b='1'] {
    --charts-card-padding: var(--charts-space-sm);
    --charts-card-border: 1px solid var(--ui-border-subtle);
    --charts-card-shadow: var(--charts-shadow-none);
    --charts-side-padding: var(--charts-space-sm);
    --charts-side-border: 1px solid var(--ui-border-subtle);
    --charts-side-shadow: var(--charts-shadow-1);
  }

  .charts-page__header {
    background: #ffffff;
    border-radius: 12px;
    padding: var(--charts-space-md) var(--charts-space-lg);
    border: 1px solid var(--ui-border);
    box-shadow: var(--charts-shadow-1);
  }

  .charts-page__header-toprow {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--charts-space-md);
  }

  .charts-page__header h1 {
    margin: 0;
    font-size: 1.6rem;
    color: #0f172a;
  }

  .charts-page__header p {
    margin: var(--charts-space-xs) 0 0;
    color: #475569;
    line-height: 1.6;
  }

  .charts-topbar__toggle {
    border: 1px solid var(--ui-border);
    background: #ffffff;
    border-radius: var(--ui-radius-md);
    padding: 0.5rem 0.9rem;
    min-height: 2.25rem;
    font-size: 0.85rem;
    font-weight: 700;
    color: #0f172a;
    cursor: pointer;
    white-space: nowrap;
  }

  .charts-topbar__toggle:hover {
    background: #f8fafc;
  }

  .charts-topbar__toggle:focus-visible {
    outline: 2px solid rgba(59, 130, 246, 0.6);
    outline-offset: 2px;
  }

  .charts-topbar__toggle[aria-expanded='true'] {
    font-weight: 800;
    border-color: var(--ui-selected-border);
    background: var(--ui-selected-bg);
    box-shadow: inset 3px 0 0 var(--ui-selected-rail);
  }

  .charts-page[data-charts-compact-header='1'] {
    padding: 1.35rem clamp(0.75rem, 3vw, 2.25rem);
    gap: var(--charts-space-lg);
  }

  .charts-page[data-charts-compact-header='1'] .charts-page__header {
    padding: var(--charts-space-sm) var(--charts-space-md);
  }

  .charts-page[data-charts-compact-header='1'] .charts-page__header-toprow {
    align-items: center;
  }

  .charts-page[data-charts-compact-header='1'] .charts-page__header h1 {
    font-size: 1.25rem;
  }

  .charts-page[data-charts-compact-header='1'] .charts-card--summary {
    padding: var(--charts-space-2xs) var(--charts-space-sm);
  }

  .charts-page[data-charts-compact-header='1'] .charts-patient-summary__embedded-actions {
    padding-top: var(--charts-space-xs);
  }

  .charts-page[data-charts-compact-header='1'] .charts-patient-summary__name {
    font-size: 1.25rem;
  }

  .charts-page[data-charts-compact-header='1'] .charts-patient-summary__kana,
  .charts-page[data-charts-compact-header='1'] .charts-patient-summary__sex-age {
    font-size: 0.9rem;
  }

  .charts-page[data-charts-compact-header='1'] .charts-patient-summary__clinical-row:not(.charts-patient-summary__clinical-row--compact) {
    display: none;
  }

  .charts-page__meta {
    margin-top: var(--charts-space-sm);
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-sm);
  }

  .charts-page__meta-grid {
    margin-top: var(--charts-space-sm);
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--charts-space-sm);
  }

  .charts-page__meta-group {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
    padding: var(--charts-space-sm);
    border-radius: var(--ui-radius-md);
    border: 1px solid var(--ui-border-subtle);
    background: rgba(248, 250, 252, 0.96);
  }

  .charts-page__meta-title {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #64748b;
  }

  .charts-page__meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-sm);
    align-items: center;
  }

  .charts-context-recovery {
    border-color: rgba(245, 158, 11, 0.32);
    background: linear-gradient(180deg, rgba(255, 251, 235, 0.96), rgba(255, 255, 255, 0.98));
  }

  .charts-context-recovery__body {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--charts-space-md);
    flex-wrap: wrap;
  }

  .charts-context-recovery h2 {
    margin: 0 0 0.3rem;
    font-size: 1rem;
    color: #92400e;
  }

  .charts-context-recovery p {
    margin: 0;
    color: #78350f;
    line-height: 1.55;
  }

  .charts-context-recovery__actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-xs);
  }

  .charts-page__pill {
    font-size: 0.85rem;
  }

  .charts-page__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    gap: var(--charts-space-lg);
    align-items: start;
  }

  .charts-workbench {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-md);
    --charts-column-left: minmax(250px, 0.82fr);
    --charts-column-center: minmax(460px, 2.25fr);
    --charts-column-right: minmax(260px, 1fr);
    --charts-column-gap: var(--charts-space-sm);
    --charts-utility-compact-width: 72px;
    --charts-utility-expanded-width: clamp(760px, 64vw, 1200px);
    --charts-utility-expanded-height: clamp(420px, 62vh, 760px);
    --charts-utility-width: var(--charts-utility-compact-width);
    --charts-utility-height: clamp(420px, 72vh, 760px);
    --charts-side-width: 0px;
    --charts-floating-offset-x: clamp(10px, 2vw, 24px);
    --charts-floating-offset-y: max(10px, env(safe-area-inset-bottom));
    --charts-floating-compact-width: min(1320px, calc(100vw - (var(--charts-floating-offset-x) * 2)));
    --charts-utility-footer-width: clamp(420px, 34vw, 680px);
    --charts-utility-drawer-width: var(--charts-utility-footer-width);
    --charts-utility-footer-height: clamp(76px, 11vh, 116px);
    --charts-utility-drawer-height: min(72vh, 760px);
    position: relative;
    isolation: isolate;
    padding-bottom: calc(var(--charts-utility-footer-height) + var(--charts-floating-offset-y) + var(--charts-space-sm));
  }

  .charts-workbench[data-utility-state='expanded'] {
    --charts-utility-width: min(var(--charts-utility-expanded-width), calc(100vw - (var(--charts-floating-offset-x) * 2)));
  }

  .charts-workbench[data-utility-state='expanded'][data-charts-compact-ui='1'] {
    --charts-column-left: minmax(180px, 0.62fr);
    --charts-column-center: minmax(320px, 1.02fr);
  }

  .charts-workbench[data-charts-compact-ui='1'] {
    --charts-column-left: minmax(230px, 0.75fr);
    --charts-column-center: minmax(520px, 2.25fr);
    --charts-column-right: minmax(230px, 0.86fr);
  }

  .charts-page[data-charts-ui-opt-b='1'] .charts-workbench {
    /* Center-first distribution while keeping 3 columns (layout only). */
    --charts-column-left: minmax(240px, 0.76fr);
    --charts-column-center: minmax(560px, 2.32fr);
    --charts-column-right: minmax(240px, 0.88fr);
    --charts-column-gap: var(--charts-space-xs);
  }

  .charts-page[data-charts-ui-opt-b='1'] .charts-workbench[data-charts-compact-ui='1'] {
    --charts-column-left: minmax(220px, 0.68fr);
    --charts-column-center: minmax(580px, 2.42fr);
    --charts-column-right: minmax(220px, 0.8fr);
    --charts-column-gap: var(--charts-space-xs);
  }

  .charts-page[data-charts-ui-opt-b='1'] .charts-workbench[data-utility-state='expanded'] {
    --charts-utility-width: min(var(--charts-utility-expanded-width), calc(100vw - (var(--charts-floating-offset-x) * 2)));
  }

  .charts-page[data-charts-ui-opt-b='1'] .charts-workbench[data-utility-state='compact'] .charts-shortcuts {
    /* Compact utility drawer should not fight for vertical space. */
    display: none;
  }

  .charts-page[data-charts-ui-opt-b='1'] #charts-soap-note {
    /* Visual-only accent for the primary work area. */
    border-color: rgba(37, 99, 235, 0.26);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(239, 246, 255, 0.82) 72%);
    box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.08), var(--ui-shadow-soft);
  }

  @media (min-width: 1280px) and (min-height: 760px) {
    .charts-page {
      --charts-space-2xs: 5px;
      --charts-space-xs: 8px;
      --charts-space-sm: 12px;
      --charts-space-md: 16px;
      --charts-space-lg: 22px;
      --charts-space-xl: 28px;
      --charts-space-2xl: 36px;
    }

    .charts-page__pill {
      font-size: 0.92rem;
    }

    .charts-column-header__label {
      font-size: 0.98rem;
    }

    .charts-column-header__meta {
      font-size: 0.8rem;
    }

    .charts-patient-tabs__select {
      font-size: 0.93rem;
      padding: 0.4rem 0.82rem;
      min-height: 2rem;
    }

    .charts-docked-panel__tab-label {
      font-size: 0.98rem;
    }

    .charts-docked-panel__tab-shortcut {
      font-size: 0.78rem;
    }

    .charts-page button,
    .charts-page input,
    .charts-page select,
    .charts-page textarea {
      font-size: 0.95rem;
    }
  }

  @media (max-width: 1279px) {
    .charts-workbench {
      --charts-utility-compact-width: 62px;
      --charts-utility-expanded-width: clamp(680px, 72vw, 1000px);
    }
  }

  .charts-workbench__sticky {
    position: sticky;
    top: 0.9rem;
    z-index: 4;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .charts-workbench__sticky-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--charts-space-md);
    align-items: start;
    width: 100%;
  }

  .charts-workbench__sticky-side {
    display: none;
  }

  .charts-encounter-header {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--charts-space-sm);
    align-items: start;
  }

  .charts-encounter-header:not(:has(.charts-edit-state-bar)) {
    gap: var(--charts-space-xs);
  }

  .charts-edit-state-bar {
    grid-column: 1 / -1;
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border);
    background: #f8fafc;
    padding: 0.45rem 0.65rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--charts-space-sm);
    flex-wrap: wrap;
  }

  .charts-edit-state-bar__main {
    display: flex;
    align-items: center;
    gap: var(--charts-space-sm);
    flex-wrap: wrap;
    font-size: 0.84rem;
    color: #334155;
  }

  .charts-edit-state-bar__main strong {
    color: #0f172a;
    font-size: 0.86rem;
  }

  .charts-edit-state-bar__actions {
    display: flex;
    gap: var(--charts-space-xs);
    flex-wrap: wrap;
  }

  .charts-edit-state-bar__actions button {
    border-radius: 999px;
    border: 1px solid var(--ui-border);
    background: #ffffff;
    color: #334155;
    padding: 0.22rem 0.62rem;
    font-size: 0.76rem;
    font-weight: 700;
    cursor: pointer;
  }

  .charts-edit-state-bar--ready {
    border-color: rgba(34, 197, 94, 0.3);
    background: rgba(236, 253, 245, 0.85);
  }

  .charts-edit-state-bar--warning {
    border-color: rgba(245, 158, 11, 0.35);
    background: rgba(255, 247, 237, 0.88);
  }

  .charts-edit-state-bar--blocked {
    border-color: rgba(244, 63, 94, 0.38);
    background: rgba(255, 241, 242, 0.9);
  }

  .hokenja-ref__context {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .hokenja-ref__context-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--charts-space-sm);
  }

  .hokenja-ref__context-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: var(--charts-space-sm);
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border);
    background: #f8fafc;
  }

  .hokenja-ref__context-item span {
    font-size: 0.78rem;
    font-weight: 700;
    color: #64748b;
  }

  .hokenja-ref__context-item strong {
    font-size: 0.95rem;
    color: #0f172a;
  }

  .hokenja-ref__form {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
    margin-top: var(--charts-space-md);
  }

  .hokenja-ref__search-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: var(--charts-space-sm);
    align-items: end;
  }

  .hokenja-ref__field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .hokenja-ref__field span {
    font-size: 0.86rem;
    font-weight: 700;
    color: #334155;
  }

  .hokenja-ref__field input {
    width: 100%;
    border-radius: 10px;
    border: 1px solid var(--ui-border-strong);
    background: #ffffff;
    padding: 0.58rem 0.75rem;
    color: #0f172a;
  }

  .hokenja-ref__field input:focus-visible {
    outline: 2px solid rgba(37, 99, 235, 0.6);
    outline-offset: 2px;
  }

  .hokenja-ref__actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-xs);
  }

  .hokenja-ref__status {
    margin: 0;
    font-size: 0.9rem;
    color: #334155;
  }

  .hokenja-ref__note {
    margin: 0;
    font-size: 0.85rem;
    color: #64748b;
  }

  .hokenja-ref__results {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
    margin: 0;
    padding: 0;
  }

  .hokenja-ref__result {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: var(--charts-space-sm);
    border-radius: var(--charts-radius-md);
    border: 1px solid var(--ui-border);
    background: #ffffff;
    box-shadow: var(--charts-shadow-1);
  }

  .hokenja-ref__result-main {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--charts-space-sm);
  }

  .hokenja-ref__result-name {
    font-size: 0.98rem;
    font-weight: 800;
    color: #0f172a;
  }

  .hokenja-ref__result-code {
    font-size: 0.9rem;
    font-weight: 800;
    color: #334155;
    white-space: nowrap;
  }

  .hokenja-ref__result-meta {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.88rem;
    line-height: 1.55;
    color: #334155;
  }

  .hokenja-ref__empty {
    margin: 0;
    padding: var(--charts-space-sm);
    border-radius: var(--charts-radius-sm);
    border: 1px dashed var(--ui-border);
    background: rgba(248, 250, 252, 0.8);
    color: #475569;
  }

  @media (max-width: 960px) {
    .charts-encounter-header {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 920px) {
    .hokenja-ref__context-grid,
    .hokenja-ref__search-row {
      grid-template-columns: 1fr;
    }

    .hokenja-ref__result-main {
      flex-direction: column;
    }
  }

  .charts-patient-tabs {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: var(--charts-space-sm);
    padding: 0.35rem 0.55rem;
    border-radius: 12px;
    border: 1px solid var(--ui-border);
    background: rgba(255, 255, 255, 0.94);
    box-shadow: var(--charts-shadow-1);
    flex-wrap: wrap;
  }

  .charts-patient-tabs__list {
    flex: 1;
    min-width: min(220px, 100%);
    display: flex;
    align-items: center;
    gap: 0.4rem;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    padding: 0.1rem;
    scrollbar-width: thin;
  }

  .charts-patient-tabs__item {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }

  .charts-patient-tabs__select {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    max-width: 220px;
    padding: 0.32rem 0.7rem;
    min-height: 2.25rem;
    border-radius: 8px;
    border: 1px solid var(--ui-border-strong);
    background: #ffffff;
    cursor: pointer;
    font-weight: 800;
    color: #0f172a;
    font-size: 0.86rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: background 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
  }

  .charts-patient-tabs__select:hover {
    background: rgba(239, 246, 255, 0.65);
  }

  .charts-patient-tabs__select:focus-visible {
    outline: 2px solid rgba(37, 99, 235, 0.55);
    outline-offset: 2px;
  }

  .charts-patient-tabs__item.is-active .charts-patient-tabs__select {
    border-color: var(--ui-selected-border);
    box-shadow: inset 3px 0 0 var(--ui-selected-rail);
    background: var(--ui-selected-bg);
    font-weight: 900;
  }

  .charts-patient-tabs__select[data-dirty='true'] {
    border-color: rgba(220, 38, 38, 0.5);
    background: rgba(254, 242, 242, 0.88);
  }

  .charts-patient-tabs__name {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .charts-patient-tabs__dirty-dot {
    color: #dc2626;
    font-size: 0.72rem;
    line-height: 1;
    transform: translateY(-1px);
    flex-shrink: 0;
  }

  .charts-patient-tabs__id {
    font-size: 0.78rem;
    color: rgba(71, 85, 105, 0.95);
    font-weight: 800;
  }

  .charts-patient-tabs__close {
    width: 28px;
    height: 28px;
    border-radius: 999px;
    border: 1px solid var(--ui-border);
    background: #ffffff;
    display: grid;
    place-items: center;
    cursor: pointer;
    color: rgba(71, 85, 105, 0.9);
    font-weight: 900;
    line-height: 1;
    transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
  }

  .charts-patient-tabs__close:hover {
    background: rgba(254, 226, 226, 0.9);
    border-color: rgba(248, 113, 113, 0.6);
    color: rgba(127, 29, 29, 0.95);
  }

  .charts-patient-tabs__close:focus-visible {
    outline: 2px solid rgba(220, 38, 38, 0.55);
    outline-offset: 2px;
  }

  .charts-patient-tabs__empty {
    padding: 0.15rem 0.6rem;
    border-radius: 999px;
    border: 1px dashed var(--ui-border-strong);
    background: rgba(248, 250, 252, 0.92);
    color: rgba(71, 85, 105, 0.95);
    font-size: 0.84rem;
    font-weight: 800;
    white-space: nowrap;
  }

  .charts-patient-tabs__quick-open {
    margin-left: auto;
    display: flex;
    align-items: flex-end;
    gap: 0.45rem;
    flex-wrap: wrap;
  }

  .charts-patient-tabs__quick-field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-weight: 800;
    color: #0f172a;
    font-size: 0.85rem;
  }

  .charts-patient-tabs__quick-field span {
    font-size: 0.75rem;
    color: rgba(71, 85, 105, 0.95);
    letter-spacing: 0.02em;
  }

  .charts-patient-tabs__quick-field input {
    width: 7.5rem;
    border-radius: 8px;
    border: 1px solid var(--ui-border-strong);
    padding: 0.45rem 0.6rem;
    min-height: 2.25rem;
    background: #ffffff;
    font-size: 0.9rem;
  }

  .charts-patient-tabs__quick-button {
    padding: 0.55rem 0.9rem;
    border-radius: 12px;
    min-height: 2.25rem;
    border: 1px solid rgba(37, 99, 235, 0.72);
    background: rgba(37, 99, 235, 0.98);
    color: #ffffff;
    font-weight: 900;
    cursor: pointer;
  }

  .charts-patient-tabs__quick-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 720px) {
    .charts-patient-tabs__quick-field input {
      width: min(10rem, 70vw);
    }
  }

  .charts-tab-guard {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-md);
  }

  .charts-tab-guard__message {
    margin: 0;
    color: #0f172a;
    line-height: 1.65;
  }

  .charts-tab-guard__actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--charts-space-sm);
    flex-wrap: wrap;
  }

  .charts-tab-guard__actions button {
    padding: 0.6rem 0.95rem;
    border-radius: 999px;
    border: 1px solid var(--ui-border-strong);
    background: #ffffff;
    color: #0f172a;
    font-weight: 900;
    cursor: pointer;
  }

  .charts-tab-guard__actions button:hover {
    background: rgba(248, 250, 252, 0.92);
  }

  .charts-tab-guard__danger {
    border-color: rgba(220, 38, 38, 0.75);
    background: rgba(220, 38, 38, 0.98);
    color: #ffffff;
  }

  .charts-tab-guard__danger:hover {
    background: rgba(185, 28, 28, 0.98);
  }

  .charts-card--summary {
    padding: var(--charts-space-sm);
    border-color: rgba(37, 99, 235, 0.16);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96));
    box-shadow: var(--ui-shadow-soft);
  }

  .charts-card--identity {
    border-color: var(--ui-selected-border);
    box-shadow: var(--ui-shadow-soft);
  }

  .charts-card--soap-primary {
    border-color: var(--ui-selected-border);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(248, 250, 252, 0.98));
    box-shadow: var(--ui-shadow-soft);
  }

  .charts-card--summary-with-actions {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .charts-patient-summary__embedded-actions {
    border-top: 1px solid var(--ui-border-subtle);
    padding-top: var(--charts-space-sm);
  }

  .charts-summary__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--charts-space-sm);
  }

  .charts-summary__title {
    font-size: 0.9rem;
    color: #0f172a;
  }

  .charts-summary__toggle {
    border: 1px solid var(--ui-border);
    background: #ffffff;
    border-radius: 999px;
    padding: 0.3rem 0.7rem;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    color: #0f172a;
    white-space: nowrap;
  }

  .charts-summary__toggle:hover {
    background: #f8fafc;
  }

  .charts-summary__toggle:focus-visible {
    outline: 2px solid rgba(59, 130, 246, 0.6);
    outline-offset: 2px;
  }

  .charts-card--memo {
    padding: var(--charts-space-sm);
  }

  .charts-patient-summary {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .charts-patient-summary__identity-bar .patient-identity-bar__surface {
    border-color: transparent;
    background: transparent;
    box-shadow: none;
    padding: 0;
  }

  .charts-patient-summary__identity-bar .patient-identity-bar__body {
    gap: var(--charts-space-sm);
  }

  .charts-patient-summary__identity-bar .patient-identity-bar__avatar {
    width: 3rem;
    height: 3rem;
    border-radius: var(--ui-radius-md);
    border-color: rgba(37, 99, 235, 0.18);
    background: rgba(239, 246, 255, 0.78);
    color: #1d4ed8;
  }

  .charts-patient-summary__identity-bar .patient-identity-bar__eyebrow {
    color: #475569;
  }

  .charts-patient-summary__identity-bar .patient-identity-bar__title-row {
    gap: 0.75rem;
  }

  .charts-patient-summary__identity-bar .patient-identity-bar__title {
    font-size: clamp(1.18rem, 1.65vw, 1.55rem);
    font-weight: 800;
  }

  .charts-patient-summary__identity-bar .patient-identity-bar__name {
    font-size: 0.98rem;
    font-weight: 700;
    color: #0f172a;
  }

  .charts-patient-summary__identity-bar .patient-identity-bar__id {
    border-color: rgba(37, 99, 235, 0.18);
    background: rgba(239, 246, 255, 0.62);
    color: #1e3a8a;
  }

  .charts-patient-summary__identity-bar .patient-identity-bar__kana {
    font-size: 0.82rem;
  }

  .charts-patient-summary__identity-bar .patient-identity-bar__meta {
    padding-top: var(--charts-space-xs);
    border-top: 1px solid rgba(226, 232, 240, 0.92);
  }

  .charts-patient-summary__identity-bar .patient-identity-bar__chips {
    gap: 0.35rem;
  }

  .charts-patient-summary__supporting {
    display: grid;
    gap: var(--charts-space-xs);
  }

  .charts-patient-summary__encounter-band {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(164px, 1fr));
    gap: var(--charts-space-xs);
  }

  .charts-patient-summary__encounter-item {
    display: grid;
    gap: 2px;
    padding: 0.7rem 0.8rem;
    border: 1px solid rgba(37, 99, 235, 0.16);
    border-radius: var(--ui-radius-md);
    background: linear-gradient(180deg, rgba(239, 246, 255, 0.88), rgba(248, 250, 252, 0.96));
  }

  .charts-patient-summary__encounter-label {
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #1d4ed8;
  }

  .charts-patient-summary__encounter-value {
    color: #0f172a;
    font-size: 0.86rem;
    font-weight: 700;
    line-height: 1.45;
    word-break: break-word;
  }

  .charts-patient-summary__fact-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
    gap: var(--charts-space-xs);
  }

  .charts-patient-summary__fact {
    display: grid;
    gap: 2px;
    padding: 0.65rem 0.75rem;
    border: 1px solid var(--ui-border-subtle);
    border-radius: var(--ui-radius-md);
    background: rgba(248, 250, 252, 0.8);
  }

  .charts-patient-summary__fact-label {
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #64748b;
  }

  .charts-patient-summary__fact-value {
    color: #0f172a;
    font-size: 0.86rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .charts-patient-summary__extra {
    margin: 0;
    border: 1px solid var(--ui-border-subtle);
    border-radius: var(--ui-radius-md);
    background: rgba(248, 250, 252, 0.76);
    padding: 0.7rem 0.85rem;
  }

  .charts-patient-summary__extra-summary {
    cursor: pointer;
    color: #334155;
    font-size: 0.8rem;
    font-weight: 700;
    list-style: none;
  }

  .charts-patient-summary__extra-summary::-webkit-details-marker {
    display: none;
  }

  .charts-patient-summary__extra-body {
    margin-top: var(--charts-space-xs);
    display: grid;
    gap: 0.2rem;
  }

  .charts-patient-summary__address {
    margin: 0;
    color: #334155;
    font-size: 0.78rem;
    line-height: 1.45;
    word-break: break-word;
  }

  .charts-patient-summary__memo-panel {
    display: grid;
    gap: var(--charts-space-xs);
    padding: 0.85rem 0.95rem;
    border: 1px solid rgba(14, 116, 144, 0.16);
    border-radius: var(--ui-radius-md);
    background: linear-gradient(180deg, rgba(240, 249, 255, 0.86), rgba(248, 250, 252, 0.98));
  }

  .charts-patient-summary__memo-title {
    margin: 0;
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #155e75;
  }

  .charts-patient-summary__memo-body {
    margin: 0;
    color: #0f172a;
    font-size: 0.86rem;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .charts-patient-summary__alert-pill {
    min-height: 1.7rem;
  }

  .charts-patient-summary__inline-actionbar {
    border-top: 1px solid var(--ui-border-subtle);
    padding-top: var(--charts-space-xs);
  }

  .charts-patient-summary__inline-actionbar .charts-actions {
    gap: 0.4rem;
  }

  .charts-patient-summary__inline-actionbar .charts-actions__header {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.3rem;
  }

  .charts-patient-summary__inline-actionbar .charts-actions__header > div:first-of-type {
    display: none;
  }

  .charts-patient-summary__inline-actionbar .charts-actions__kicker {
    display: none;
  }

  .charts-patient-summary__inline-actionbar .charts-actions__header h2 {
    display: none;
  }

  .charts-patient-summary__inline-actionbar .charts-actions__status {
    display: none;
  }

  .charts-patient-summary__inline-actionbar .charts-actions__quick-controls {
    margin-top: 0;
    justify-content: flex-end;
    gap: 0.35rem;
  }

  .charts-patient-summary__inline-actionbar .charts-actions__toggle {
    margin-top: 0;
    padding: 0.2rem 0.56rem;
    font-size: 0.74rem;
  }

  .charts-patient-summary__inline-actionbar .charts-actions__button--compact {
    padding: 0.24rem 0.55rem;
    font-size: 0.74rem;
    line-height: 1.2;
  }

  .charts-patient-summary__inline-actionbar .charts-actions__meta {
    display: none;
  }

  .charts-patient-summary__inline-actionbar .charts-actions__group[data-group='encounter'] {
    display: none;
  }

  .charts-patient-summary__inline-actionbar .charts-actions__guard-summary,
  .charts-patient-summary__inline-actionbar .charts-actions__banner,
  .charts-patient-summary__inline-actionbar .charts-actions__banner-actions,
  .charts-patient-summary__inline-actionbar .charts-actions__conflict,
  .charts-patient-summary__inline-actionbar .charts-actions__controls,
  .charts-patient-summary__inline-actionbar .charts-actions__more,
  .charts-patient-summary__inline-actionbar .charts-actions__guard,
  .charts-patient-summary__inline-actionbar .charts-actions__skeleton,
  .charts-patient-summary__inline-actionbar .charts-actions__toast {
    margin-top: 0.2rem;
  }

  @media (max-width: 720px) {
    .charts-patient-summary__encounter-band,
    .charts-patient-summary__fact-grid {
      grid-template-columns: 1fr;
    }
  }

  .charts-orca-original {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-md);
  }

  .charts-orca-original__header h3 {
    margin: 0;
  }

  .charts-orca-original__kicker {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #64748b;
    font-size: 0.75rem;
  }

  .charts-orca-original__sub {
    margin: var(--charts-space-xs) 0 0;
    color: #475569;
    font-size: 0.85rem;
  }

  .charts-orca-original__defaults {
    margin-top: var(--charts-space-xs);
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-sm);
    font-size: 0.8rem;
    color: #64748b;
  }

  .charts-orca-original__empty {
    margin: 0;
    color: #64748b;
  }

  .charts-orca-original__section {
    border-radius: var(--charts-radius-md);
    border: 1px solid var(--ui-border-subtle);
    background: #f8fafc;
    padding: var(--charts-space-sm);
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .charts-orca-original__section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--charts-space-sm);
    flex-wrap: wrap;
  }

  .charts-orca-original__section-head strong {
    display: block;
    font-size: 0.95rem;
    color: #0f172a;
  }

  .charts-orca-original__section-head span {
    font-size: 0.8rem;
    color: #64748b;
  }

  .charts-orca-original__section-actions {
    display: flex;
    gap: var(--charts-space-xs);
    flex-wrap: wrap;
  }

  .charts-orca-original__section-actions button {
    border: none;
    border-radius: 10px;
    padding: 0.45rem 0.8rem;
    font-weight: 700;
    cursor: pointer;
    background: #0f172a;
    color: #ffffff;
  }

  .charts-orca-original__section-actions button.ghost {
    background: #e2e8f0;
    color: #0f172a;
  }

  .charts-orca-original__textarea {
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    padding: 0.6rem 0.75rem;
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 0.85rem;
    line-height: 1.4;
    resize: vertical;
  }

  .charts-orca-original__meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-sm);
    font-size: 0.85rem;
    color: #475569;
  }

  .charts-orca-original__warning {
    color: #b45309;
    font-weight: 600;
  }

  .charts-orca-original__response {
    margin: 0;
    padding: var(--charts-space-sm);
    border-radius: 12px;
    border: 1px solid var(--ui-border-subtle);
    background: #0f172a;
    color: #e2e8f0;
    font-size: 0.8rem;
    line-height: 1.5;
    max-height: 280px;
    overflow: auto;
  }

  .charts-orca-original__summary {
    cursor: pointer;
    font-weight: 700;
    list-style: none;
  }

  .charts-orca-original__summary::-webkit-details-marker {
    display: none;
  }

  .charts-orca-original__direct {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .charts-patient-memo {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .charts-patient-memo__label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #64748b;
  }

  .charts-patient-memo__text {
    margin: 0;
    padding: var(--charts-space-sm) var(--charts-space-md);
    border-radius: var(--charts-radius-sm);
    background: #f8fafc;
    border: 1px dashed var(--ui-border);
    color: #334155;
  }

  .charts-fold {
    padding: 0;
  }

  .charts-fold__summary {
    cursor: pointer;
    list-style: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--charts-space-sm);
    padding: var(--charts-space-sm) var(--charts-space-md);
    font-weight: 900;
    color: #0f172a;
  }

  .charts-fold__summary::-webkit-details-marker {
    display: none;
  }

  .charts-fold__summary::after {
    content: '>';
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    color: #64748b;
    transition: transform 120ms ease;
  }

  .charts-fold[open] > .charts-fold__summary {
    border-bottom: 1px solid var(--ui-border-subtle);
  }

  .charts-fold[open] > .charts-fold__summary::after {
    transform: rotate(90deg);
  }

  .charts-fold__content {
    padding: var(--charts-space-sm) var(--charts-space-md);
  }

  .charts-fold--free-doc[data-dirty='1'] > .charts-fold__summary {
    color: #b45309;
  }

  .charts-free-doc__meta {
    margin-left: auto;
    font-size: 0.75rem;
    font-weight: 800;
    color: #64748b;
    background: rgba(226, 232, 240, 0.6);
    border: 1px solid var(--ui-border-subtle);
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
    white-space: nowrap;
  }

  .charts-fold--free-doc[data-dirty='1'] .charts-free-doc__meta {
    background: rgba(254, 243, 199, 0.8);
    border-color: rgba(245, 158, 11, 0.25);
    color: #92400e;
  }

  .charts-free-doc__error {
    margin: 0;
    color: #b91c1c;
    font-size: 0.85rem;
  }

  .charts-free-doc__statusline {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-xs);
    font-size: 0.78rem;
    color: #475569;
    margin-bottom: var(--charts-space-xs);
  }

  .charts-free-doc__textarea {
    width: 100%;
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border);
    padding: var(--charts-space-sm) var(--charts-space-sm);
    font-family: inherit;
    resize: vertical;
    background: #ffffff;
  }

  .charts-free-doc__textarea[readonly] {
    background: rgba(241, 245, 249, 0.6);
    color: #475569;
  }

  .charts-free-doc__actions {
    margin-top: var(--charts-space-xs);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--charts-space-xs);
  }

  .charts-free-doc__save,
  .charts-free-doc__reset {
    border-radius: 999px;
    border: 1px solid var(--ui-border);
    background: #ffffff;
    padding: 0.25rem 0.7rem;
    font-weight: 900;
    cursor: pointer;
    color: #0f172a;
    white-space: nowrap;
  }

  .charts-free-doc__save {
    border-color: rgba(37, 99, 235, 0.35);
    background: #eff6ff;
    color: #1d4ed8;
  }

  .charts-free-doc__save:disabled,
  .charts-free-doc__reset:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .charts-free-doc__status {
    font-size: 0.78rem;
    color: #64748b;
  }

  .charts-free-doc__status--error {
    color: #b91c1c;
    font-weight: 700;
  }

  .charts-workbench__layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--charts-space-md);
    align-items: start;
  }

  .charts-workbench__body {
    display: grid;
    grid-template-columns: var(--charts-column-left) var(--charts-column-center);
    gap: var(--charts-column-gap);
    align-items: start;
    min-width: 0;
  }

  .charts-workbench__column {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
    min-width: 0;
  }

  .charts-workbench__column[data-column-role='primary'] {
    gap: var(--charts-space-md);
  }

  @media (min-width: 1281px) {
    .charts-workbench__column + .charts-workbench__column {
      border-left: 1px solid var(--ui-border-subtle);
      padding-left: var(--charts-space-sm);
    }
  }

  @media (min-width: 1281px) {
    .charts-page[data-charts-ui-opt-b='1'] .charts-workbench__column + .charts-workbench__column {
      border-left-color: var(--ui-border-subtle);
      padding-left: var(--charts-space-xs);
    }
  }

  .charts-column-header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--charts-space-xs);
    padding-bottom: var(--charts-space-xs);
    border-bottom: 1px solid var(--ui-border);
  }

  .charts-page[data-charts-ui-opt-b='1'] .charts-column-header {
    padding-bottom: var(--charts-space-2xs);
    border-bottom-color: var(--ui-border-subtle);
  }

  .charts-column-header__label {
    font-size: 0.88rem;
    font-weight: 700;
    color: #0f172a;
  }

  .charts-column-header__meta {
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #64748b;
  }

  .charts-workbench__column[data-column-role='primary'] .charts-column-header {
    padding: var(--charts-space-xs) var(--charts-space-sm);
    border: 1px solid var(--ui-selected-border);
    border-radius: var(--ui-radius-md);
    border-inline-start: 3px solid var(--ui-selected-rail);
    background: var(--ui-selected-bg);
  }

  .charts-workbench__column[data-column-role='primary'] .charts-column-header__label {
    font-weight: 800;
  }

  .charts-workbench__side {
    position: fixed;
    left: auto;
    right: var(--charts-floating-offset-x);
    bottom: var(--charts-floating-offset-y);
    width: min(var(--charts-utility-footer-width), calc(100vw - (var(--charts-floating-offset-x) * 2)));
    max-width: calc(100vw - (var(--charts-floating-offset-x) * 2));
    min-width: min(320px, calc(100vw - (var(--charts-floating-offset-x) * 2)));
    z-index: 30;
    background: #ffffff;
    border-radius: var(--charts-radius-lg);
    padding: 5px;
    border: var(--charts-side-border);
    box-shadow: var(--ui-shadow-overlay);
    overflow: hidden;
    transition: box-shadow 120ms ease, border-color 120ms ease;
  }

  .charts-workbench::before {
    opacity: 0;
    pointer-events: none;
    content: none;
  }

  .charts-workbench[data-utility-state='expanded']::before {
    opacity: 0;
    pointer-events: none;
  }

  .charts-workbench[data-utility-state='expanded'] .charts-workbench__side {
    z-index: 32;
    box-shadow: var(--ui-shadow-overlay);
    border-color: rgba(37, 99, 235, 0.28);
  }

  .charts-shortcuts {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-sm);
    border: 1px solid var(--ui-border);
    background: #f8fafc;
    margin-bottom: var(--charts-space-sm);
  }

  .charts-shortcuts--dialog {
    margin: 0;
    border: none;
    background: transparent;
    padding: 0;
  }

  .charts-shortcuts--dialog .charts-shortcuts__groups {
    max-height: min(60vh, 520px);
    overflow-y: auto;
    padding-right: var(--charts-space-xs);
  }

  .charts-shortcuts__header h3 {
    margin: var(--charts-space-2xs) 0 0;
    font-size: 1rem;
    color: #0f172a;
  }

  .charts-shortcuts__eyebrow {
    margin: 0;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #64748b;
  }

  .charts-shortcuts__desc {
    margin: var(--charts-space-2xs) 0 0;
    font-size: 0.82rem;
    color: #475569;
  }

  .charts-shortcuts__groups {
    display: grid;
    gap: var(--charts-space-sm);
  }

  .charts-shortcuts__group {
    display: grid;
    gap: var(--charts-space-xs);
  }

  .charts-shortcuts__group-title {
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #475569;
  }

  .charts-shortcuts__items {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--charts-space-2xs);
  }

  .charts-shortcuts__items li {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .charts-shortcuts__keys {
    display: inline-flex;
    align-self: flex-start;
    padding: 0.1rem 0.4rem;
    border-radius: 999px;
    background: #e2e8f0;
    color: #0f172a;
    font-size: 0.74rem;
    font-weight: 700;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  }

  .charts-shortcuts__label {
    font-size: 0.82rem;
    color: #475569;
  }

  .charts-shortcuts__note {
    margin: 0;
    font-size: 0.8rem;
    color: #1f2937;
    background: #e2e8f0;
    border-radius: 10px;
    padding: 0.35rem 0.55rem;
  }

  .charts-docked-panel {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--charts-space-xs);
    min-width: 0;
  }

  .charts-docked-panel__footer {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: var(--charts-space-xs);
  }

  .charts-docked-panel__mini {
    display: flex;
    justify-content: flex-end;
    align-items: center;
  }

  .charts-docked-panel__mini-button {
    border-radius: 999px;
    border: 1px solid var(--ui-border);
    background: #f8fafc;
    color: #1d4ed8;
    cursor: pointer;
    font-weight: 800;
    padding: var(--charts-space-2xs) var(--charts-space-sm);
    display: inline-flex;
    align-items: center;
    gap: var(--charts-space-2xs);
  }

  .charts-docked-panel__mini-button:hover {
    background: #eff6ff;
  }

  .charts-docked-panel__mini-button:focus-visible {
    outline: 2px solid rgba(59, 130, 246, 0.6);
    outline-offset: 2px;
  }

  .charts-docked-panel__mini-label {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .charts-focus-anchor {
    height: 0;
    width: 100%;
    outline: none;
    pointer-events: none;
  }

  [data-focus-anchor='true']:focus {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }

  .charts-docked-panel__tabs {
    display: flex;
    flex-wrap: nowrap;
    align-items: stretch;
    gap: var(--charts-space-xs);
    overflow-x: auto;
    overscroll-behavior-x: contain;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    padding: 1px;
  }

  .charts-docked-panel__tab {
    flex: 0 0 auto;
    min-width: 112px;
    min-height: 2.25rem;
    border-radius: 8px;
    border: 1px solid var(--ui-border);
    background: #f8fafc;
    padding: 0.4rem 0.52rem;
    font-weight: 700;
    cursor: pointer;
    color: #0f172a;
    display: flex;
    align-items: center;
    gap: var(--charts-space-xs);
    text-align: left;
    transition: box-shadow 120ms ease, background 120ms ease, border-color 120ms ease;
  }

  .charts-docked-panel__tab:hover {
    background: #f1f5f9;
  }

  .charts-docked-panel__tab[data-active='true'] {
    background: #1d4ed8;
    color: #ffffff;
    border-color: transparent;
    box-shadow: 0 10px 20px rgba(29, 78, 216, 0.24);
  }

  .charts-docked-panel__tab[data-active='true'] .charts-docked-panel__tab-label {
    font-weight: 900;
    color: var(--ui-text);
  }

  .charts-docked-panel__tab[data-utility-kind='order']:not([data-active='true']) {
    border-color: rgba(37, 99, 235, 0.28);
    background: #eff6ff;
  }

  .charts-docked-panel__tab[data-utility-kind='stamp']:not([data-active='true']) {
    border-color: rgba(13, 148, 136, 0.3);
    background: #f0fdfa;
  }

  .charts-docked-panel__tab[data-utility-kind='document']:not([data-active='true']) {
    border-color: rgba(217, 119, 6, 0.32);
    background: #fffbeb;
  }

  .charts-docked-panel__tab[data-utility-kind='imaging']:not([data-active='true']) {
    border-color: rgba(14, 116, 144, 0.3);
    background: #ecfeff;
  }

  .charts-docked-panel__tab[data-utility-kind='order'][data-active='true'] {
    background: #1d4ed8;
    box-shadow: 0 10px 20px rgba(29, 78, 216, 0.24);
  }

  .charts-docked-panel__tab[data-utility-kind='stamp'][data-active='true'] {
    background: #0f766e;
    box-shadow: 0 10px 20px rgba(15, 118, 110, 0.24);
  }

  .charts-docked-panel__tab[data-utility-kind='document'][data-active='true'] {
    background: #b45309;
    box-shadow: 0 10px 20px rgba(180, 83, 9, 0.24);
  }

  .charts-docked-panel__tab[data-utility-kind='imaging'][data-active='true'] {
    background: #0e7490;
    box-shadow: 0 10px 20px rgba(14, 116, 144, 0.24);
  }

  .charts-docked-panel__tab:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    box-shadow: none;
  }

  .charts-docked-panel__tab-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 30px;
    min-height: 1.55rem;
    padding: var(--charts-space-2xs) var(--charts-space-xs);
    border-radius: var(--charts-radius-sm);
    font-size: 0.65rem;
    font-weight: 800;
    background: rgba(148, 163, 184, 0.25);
    color: inherit;
  }

  .charts-docked-panel__tab[data-active='true'] .charts-docked-panel__tab-icon {
    background: rgba(255, 255, 255, 0.22);
  }

  .charts-docked-panel__tab-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .charts-docked-panel__tab-label {
    font-size: 0.84rem;
    line-height: 1.1;
    display: inline-flex;
    align-items: center;
    gap: 0.28rem;
    flex-wrap: wrap;
  }

  .charts-docked-panel__tab-shortcut {
    font-size: 0.68rem;
    color: inherit;
    opacity: 0.78;
  }

  .charts-docked-panel__tab-dirty {
    color: #dc2626;
    font-size: 0.72rem;
    line-height: 1;
  }

  .charts-docked-panel__tab-meta {
    font-size: 0.64rem;
    border-radius: 999px;
    padding: 0.05rem 0.35rem;
    border: 1px solid var(--ui-border);
    background: rgba(255, 255, 255, 0.7);
    color: #1e293b;
  }

  .charts-docked-panel__drawer {
    position: fixed;
    left: auto;
    right: var(--charts-floating-offset-x);
    width: min(var(--charts-utility-drawer-width), calc(100vw - (var(--charts-floating-offset-x) * 2)));
    max-width: calc(100vw - (var(--charts-floating-offset-x) * 2));
    bottom: calc(var(--charts-floating-offset-y) + var(--charts-utility-footer-height));
    border-radius: var(--charts-radius-md);
    border: 1px solid var(--ui-border);
    background: linear-gradient(180deg, rgba(248, 250, 252, 0.88), #ffffff 42%);
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
    max-height: var(--charts-utility-drawer-height);
    overflow: hidden;
    box-shadow: 0 22px 50px rgba(15, 23, 42, 0.24);
    transform: translateY(calc(100% + var(--charts-space-md)));
    opacity: 0;
    pointer-events: none;
    transition: transform 180ms ease, opacity 180ms ease;
    z-index: 31;
  }

  .charts-docked-panel__drawer[data-open='true'] {
    transform: translateY(0);
    opacity: 1;
    pointer-events: auto;
  }

  .charts-docked-panel__drawer[data-utility-kind='order'] {
    border-color: rgba(37, 99, 235, 0.34);
    background: linear-gradient(180deg, rgba(239, 246, 255, 0.82), #ffffff 45%);
  }

  .charts-docked-panel__drawer[data-utility-kind='stamp'] {
    border-color: rgba(13, 148, 136, 0.34);
    background: linear-gradient(180deg, rgba(240, 253, 250, 0.84), #ffffff 45%);
  }

  .charts-docked-panel__drawer[data-utility-kind='document'] {
    border-color: rgba(217, 119, 6, 0.35);
    background: linear-gradient(180deg, rgba(255, 251, 235, 0.84), #ffffff 45%);
  }

  .charts-docked-panel__drawer[data-utility-kind='imaging'] {
    border-color: rgba(14, 116, 144, 0.35);
    background: linear-gradient(180deg, rgba(236, 254, 255, 0.84), #ffffff 45%);
  }

  .charts-docked-panel__drawer--order {
    overflow: hidden;
  }

  .charts-docked-panel__header {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--charts-space-sm);
    padding: var(--charts-space-sm) var(--charts-space-md) var(--charts-space-xs);
    border-bottom: 1px solid var(--ui-border-subtle);
    background: rgba(255, 255, 255, 0.96);
    backdrop-filter: blur(2px);
  }

  .charts-docked-panel__header--draggable {
    cursor: grab;
    user-select: none;
    touch-action: none;
  }

  .charts-docked-panel__header--draggable.is-dragging {
    cursor: grabbing;
  }

  .charts-docked-panel__drag-handle {
    margin-top: var(--charts-space-2xs);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 26px;
    height: 26px;
    border-radius: 8px;
    border: 1px solid var(--ui-border);
    background: #f8fafc;
    color: #64748b;
    font-size: 0.92rem;
    letter-spacing: 1px;
    font-weight: 800;
    cursor: inherit;
    flex-shrink: 0;
  }

  .charts-docked-panel__eyebrow {
    margin: 0;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #64748b;
  }

  .charts-docked-panel__header h2 {
    margin: var(--charts-space-2xs) 0 0;
    font-size: 1.1rem;
    color: #0f172a;
  }

  .charts-docked-panel__desc {
    margin: var(--charts-space-2xs) 0 0;
    font-size: 0.82rem;
    color: #475569;
  }

  .charts-docked-panel__shortcut {
    margin: var(--charts-space-2xs) 0 0;
    font-size: 0.72rem;
    color: #64748b;
  }

  .charts-docked-panel__close {
    border-radius: 999px;
    border: 1px solid var(--ui-border);
    background: #ffffff;
    color: #1e3a8a;
    cursor: pointer;
    font-weight: 800;
    padding: 0.26rem 0.62rem;
  }

  .charts-docked-panel__empty {
    margin: 0;
    color: #64748b;
    font-size: 0.9rem;
    padding: var(--charts-space-sm);
  }

  .charts-docked-panel__drawer > .charts-side-panel__content,
  .charts-docked-panel__drawer > .charts-side-panel__content--order {
    min-height: 0;
    overflow: auto;
    padding: 0 var(--charts-space-sm) var(--charts-space-sm);
  }

  .charts-docked-panel__drawer--order > .charts-side-panel__content--order {
    display: flex;
    flex-direction: column;
  }

  .charts-workbench[data-utility-state='compact'] .charts-docked-panel__mini-label {
    display: inline;
  }

  .charts-workbench[data-utility-state='compact'] .charts-docked-panel__tab-shortcut {
    display: inline;
  }

  .charts-workbench[data-utility-state='compact'] .charts-docked-panel__tab {
    min-width: 112px;
  }

  .charts-workbench[data-utility-state='expanded'] .charts-docked-panel__mini-label,
  .charts-workbench[data-utility-state='expanded'] .charts-docked-panel__tab-shortcut {
    display: inline;
  }

  .charts-docked-panel__resize-handle {
    position: fixed;
    right: calc(var(--charts-floating-offset-x) + 4px);
    bottom: calc(var(--charts-floating-offset-y) + var(--charts-utility-footer-height) + 4px);
    width: 22px;
    height: 22px;
    border: 1px solid var(--ui-border-strong);
    border-radius: 6px;
    background:
      linear-gradient(135deg, transparent 0 52%, rgba(71, 85, 105, 0.42) 52% 57%, transparent 57%),
      linear-gradient(135deg, transparent 0 67%, rgba(71, 85, 105, 0.52) 67% 72%, transparent 72%),
      #f8fafc;
    box-shadow: 0 3px 10px rgba(15, 23, 42, 0.14);
    cursor: nwse-resize;
    z-index: 33;
    opacity: 0.95;
  }

  .charts-docked-panel__resize-handle:hover,
  .charts-docked-panel__resize-handle:focus-visible {
    border-color: rgba(37, 99, 235, 0.5);
    background:
      linear-gradient(135deg, transparent 0 52%, rgba(29, 78, 216, 0.55) 52% 57%, transparent 57%),
      linear-gradient(135deg, transparent 0 67%, rgba(29, 78, 216, 0.65) 67% 72%, transparent 72%),
      #eff6ff;
    outline: none;
  }

  .charts-docked-panel__resize-handle.is-resizing {
    cursor: nwse-resize;
    background:
      linear-gradient(135deg, transparent 0 52%, rgba(29, 78, 216, 0.55) 52% 57%, transparent 57%),
      linear-gradient(135deg, transparent 0 67%, rgba(29, 78, 216, 0.65) 67% 72%, transparent 72%),
      #dbeafe;
  }

  .charts-side-panel__content--order {
    min-height: 0;
    flex: 1;
  }

  .charts-side-panel__message {
    margin: 0;
    color: #475569;
    font-size: 0.9rem;
  }

  .charts-side-panel__actions {
    display: grid;
    gap: var(--charts-space-xs);
  }

  .charts-side-panel__dock-body {
    min-height: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
    padding-bottom: calc(var(--charts-space-lg) + 4.5rem);
  }

  .charts-side-panel__dock-footer {
    position: sticky;
    bottom: 0;
    z-index: 6;
    margin-top: var(--charts-space-sm);
    padding: var(--charts-space-sm);
    border-top: 1px solid var(--ui-border);
    background: linear-gradient(180deg, rgba(248, 250, 252, 0.68), rgba(255, 255, 255, 0.95));
    backdrop-filter: blur(6px);
  }

  .charts-side-panel__actions--footer {
    grid-auto-flow: column;
    grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
    align-items: stretch;
  }

  .charts-side-panel__actions--dialog {
    grid-auto-flow: column;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
  }

  .charts-side-panel__actions button,
  .charts-side-panel__action {
    border-radius: 10px;
    border: 1px solid var(--ui-border-strong);
    background: #ffffff;
    padding: 0.45rem 0.6rem;
    cursor: pointer;
    font-weight: 700;
    color: #334155;
    transition: background 120ms ease, border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
  }

  .charts-side-panel__actions button:hover:not(:disabled),
  .charts-side-panel__action:hover:not(:disabled) {
    box-shadow: 0 6px 14px rgba(15, 23, 42, 0.08);
  }

  .charts-side-panel__actions button:focus-visible,
  .charts-side-panel__action:focus-visible {
    outline: 2px solid rgba(37, 99, 235, 0.55);
    outline-offset: 2px;
  }

  .charts-side-panel__action--search {
    border-color: rgba(37, 99, 235, 0.38);
    background: #eff6ff;
    color: #1d4ed8;
  }

  .charts-side-panel__action--clear {
    border-color: rgba(245, 158, 11, 0.4);
    background: #fff7ed;
    color: #9a3412;
  }

  .charts-side-panel__action--expand {
    border-color: rgba(37, 99, 235, 0.42);
    background: #eff6ff;
    color: #1d4ed8;
  }

  .charts-side-panel__action--expand-continue {
    border-color: rgba(8, 145, 178, 0.42);
    background: #ecfeff;
    color: #155e75;
  }

  .charts-side-panel__action--save {
    border-color: rgba(34, 197, 94, 0.45);
    background: linear-gradient(135deg, #dcfce7, #bbf7d0);
    color: #14532d;
  }

  .charts-side-panel__action--close {
    border-color: var(--ui-border-strong);
    background: #ffffff;
    color: #0f172a;
  }

  .charts-side-panel__confirm-list {
    margin: var(--charts-space-xs) 0 0;
    padding-left: 1.25rem;
    color: #0f172a;
    font-size: 0.85rem;
    line-height: 1.5;
  }

  .charts-side-panel__confirm-list li {
    margin-top: 0.25rem;
  }

  .charts-document-menu {
    display: grid;
    gap: var(--charts-space-sm);
  }

  .charts-document-menu__button {
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border);
    background: #ffffff;
    padding: var(--charts-space-sm) var(--charts-space-md);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--charts-space-2xs);
    cursor: pointer;
    text-align: left;
  }

  .charts-document-menu__button span {
    font-weight: 700;
    color: #0f172a;
  }

  .charts-document-menu__button small {
    color: #64748b;
    font-size: 0.75rem;
  }

  .charts-document-menu__button--active {
    border-color: rgba(37, 99, 235, 0.4);
    background: #eff6ff;
  }

  .charts-side-panel__content {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-md);
  }

  .charts-docked-panel__subtabs {
    display: inline-flex;
    align-items: center;
    gap: var(--charts-space-2xs);
    border: 1px solid var(--ui-border);
    border-radius: 8px;
    padding: 0.2rem;
    background: rgba(255, 255, 255, 0.8);
    width: fit-content;
  }

  .charts-docked-panel__subtab {
    border: none;
    border-radius: 8px;
    background: transparent;
    color: #334155;
    font-size: 0.8rem;
    font-weight: 700;
    padding: 0.3rem 0.6rem;
    min-height: 2.25rem;
    cursor: pointer;
  }

  .charts-docked-panel__subtab[data-active='true'] {
    background: var(--ui-selected-bg);
    color: var(--ui-text);
    border-color: var(--ui-selected-border);
    font-weight: 800;
    box-shadow: inset 3px 0 0 var(--ui-selected-rail);
  }

  .charts-document-editor {
    display: grid;
    grid-template-columns: minmax(320px, 1.05fr) minmax(320px, 0.95fr);
    gap: var(--charts-space-md);
    align-items: start;
  }

  .charts-side-panel__form--document {
    margin: 0;
  }

  .charts-document-paper {
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border);
    background: rgba(255, 255, 255, 0.9);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.65), 0 10px 28px rgba(15, 23, 42, 0.08);
    padding: var(--charts-space-sm);
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
    position: sticky;
    top: 1rem;
  }

  .charts-document-paper__header {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .charts-document-paper__eyebrow {
    margin: 0;
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #64748b;
    font-weight: 800;
  }

  .charts-document-paper__title {
    margin: 0;
    font-size: 1rem;
    color: #0f172a;
  }

  .charts-document-paper__meta {
    margin: 0;
    font-size: 0.75rem;
    color: #475569;
  }

  .charts-document-paper__sheet {
    border-radius: 12px;
    border: 1px solid var(--ui-border);
    background:
      linear-gradient(180deg, transparent 1.58rem, rgba(148, 163, 184, 0.16) 1.59rem, transparent 1.6rem) repeat-y,
      #fffdfa;
    background-size: 100% 1.6rem;
    box-shadow: 0 16px 34px rgba(15, 23, 42, 0.1);
    min-height: 420px;
    padding: 1.2rem 1rem;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
    font-size: 0.84rem;
    line-height: 1.6;
    color: #0f172a;
  }

  .charts-document-paper__sheet[data-type='certificate'] {
    background:
      linear-gradient(180deg, transparent 1.58rem, rgba(245, 158, 11, 0.12) 1.59rem, transparent 1.6rem) repeat-y,
      #fffdfa;
    background-size: 100% 1.6rem;
  }

  .charts-document-paper__sheet[data-type='reply'] {
    background:
      linear-gradient(180deg, transparent 1.58rem, rgba(59, 130, 246, 0.12) 1.59rem, transparent 1.6rem) repeat-y,
      #fffdfa;
    background-size: 100% 1.6rem;
  }

  .charts-document-paper__doc-title {
    margin: 0;
    font-size: 1.08rem;
    font-weight: 900;
    text-align: center;
    letter-spacing: 0.06em;
    border-bottom: 1px solid var(--ui-border);
    padding-bottom: 0.2rem;
  }

  .charts-document-paper__line {
    margin: 0;
    font-weight: 700;
  }

  .charts-document-paper__line--right {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .charts-document-paper__table {
    margin: 0;
    display: grid;
    gap: var(--charts-space-xs);
  }

  .charts-document-paper__table > div {
    display: grid;
    grid-template-columns: minmax(88px, 0.38fr) minmax(0, 1fr);
    gap: var(--charts-space-sm);
    align-items: start;
  }

  .charts-document-paper__table dt {
    margin: 0;
    color: #334155;
    font-weight: 800;
  }

  .charts-document-paper__table dd {
    margin: 0;
    color: #0f172a;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .charts-document-paper__section {
    margin-top: var(--charts-space-xs);
    border-top: 1px dashed var(--ui-border);
    padding-top: var(--charts-space-xs);
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .charts-document-paper__section h6 {
    margin: 0;
    font-size: 0.82rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #334155;
  }

  .charts-document-paper__section p {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }

  @media (max-width: 1180px) {
    .charts-document-editor {
      grid-template-columns: 1fr;
    }

    .charts-document-paper {
      position: static;
    }
  }

  .charts-image-panel {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-md);
  }

  .charts-image-panel__header h3 {
    margin: 0;
    font-size: 1.05rem;
    color: #0f172a;
  }

  .charts-image-panel__eyebrow {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.7rem;
    color: #94a3b8;
  }

  .charts-image-panel__lead {
    margin: var(--charts-space-xs) 0 0;
    color: #475569;
    font-size: 0.85rem;
  }

  .charts-image-panel__meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-xs);
    font-size: 0.75rem;
    color: #64748b;
  }

  .charts-image-panel__status {
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-xs) var(--charts-space-sm);
    font-size: 0.85rem;
    border: 1px solid transparent;
  }

  .charts-image-panel__status--success {
    background: #ecfdf5;
    border-color: #bbf7d0;
    color: #065f46;
  }

  .charts-image-panel__status--error {
    background: #fef2f2;
    border-color: #fecaca;
    color: #991b1b;
  }

  .charts-image-panel__notice {
    border-radius: var(--charts-radius-sm);
    background: #fff7ed;
    border: 1px solid #fed7aa;
    padding: var(--charts-space-xs) var(--charts-space-sm);
    color: #9a3412;
    font-size: 0.85rem;
  }

  .charts-image-panel__error {
    border-radius: var(--charts-radius-sm);
    background: #fef2f2;
    border: 1px solid #fecaca;
    padding: var(--charts-space-xs) var(--charts-space-sm);
    color: #991b1b;
    font-size: 0.85rem;
  }

  .charts-image-panel__upload {
    display: grid;
    gap: var(--charts-space-md);
  }

  .charts-image-dropzone {
    position: relative;
    border: 1.5px dashed rgba(59, 130, 246, 0.4);
    border-radius: var(--charts-radius-md);
    background: #f8fafc;
    padding: var(--charts-space-md);
    overflow: hidden;
  }

  .charts-image-dropzone__body {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
  }

  .charts-image-dropzone__title {
    margin: 0;
    font-weight: 700;
    color: #0f172a;
  }

  .charts-image-dropzone__hint {
    margin: 0;
    color: #64748b;
    font-size: 0.85rem;
  }

  .charts-image-dropzone__button {
    display: inline-flex;
    align-items: center;
    gap: var(--charts-space-xs);
    border-radius: 999px;
    border: 1px solid rgba(59, 130, 246, 0.4);
    padding: 0.4rem 0.8rem;
    background: #ffffff;
    color: #1d4ed8;
    font-weight: 600;
    cursor: pointer;
    width: fit-content;
  }

  .charts-image-dropzone__button input {
    display: none;
  }

  .charts-image-dropzone__meta {
    margin: 0;
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .charts-image-dropzone__overlay {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    opacity: 0;
    transition: opacity 0.2s ease;
    pointer-events: none;
  }

  .charts-image-dropzone[data-active='true'] .charts-image-dropzone__overlay {
    opacity: 1;
    background: rgba(191, 219, 254, 0.35);
  }

  .charts-image-panel__queue {
    border: 1px solid var(--ui-border);
    border-radius: var(--charts-radius-md);
    padding: var(--charts-space-sm);
    background: #ffffff;
  }

  .charts-image-panel__queue h4 {
    margin: 0 0 var(--charts-space-xs);
    font-size: 0.95rem;
    color: #0f172a;
  }


  .charts-image-panel__queue ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--charts-space-sm);
  }

  .charts-image-panel__queue-item {
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr) auto;
    gap: var(--charts-space-sm);
    align-items: center;
  }

  .charts-image-panel__queue-thumb {
    width: 56px;
    height: 56px;
    border-radius: var(--charts-radius-sm);
    background: #f1f5f9;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .charts-image-panel__queue-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .charts-image-panel__queue-name {
    font-weight: 600;
    color: #0f172a;
    font-size: 0.9rem;
  }

  .charts-image-panel__queue-meta {
    display: flex;
    gap: var(--charts-space-xs);
    font-size: 0.75rem;
    color: #64748b;
  }

  .charts-image-panel__queue-error {
    margin: var(--charts-space-2xs) 0 0;
    font-size: 0.75rem;
    color: #b91c1c;
  }

  .charts-image-panel__queue-progress {
    display: flex;
    align-items: center;
    gap: var(--charts-space-xs);
    margin-top: var(--charts-space-2xs);
    font-size: 0.75rem;
    color: #475569;
  }

  .charts-image-panel__queue-progress progress {
    width: 100%;
    height: 6px;
  }

  .charts-image-panel__queue-actions button {
    border-radius: 999px;
    border: 1px solid rgba(239, 68, 68, 0.4);
    background: #fff1f2;
    color: #b91c1c;
    padding: 0.3rem 0.6rem;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
  }

  .charts-image-panel__empty {
    margin: 0;
    font-size: 0.85rem;
    color: #64748b;
  }

  .charts-image-camera {
    border: 1px solid var(--ui-border);
    border-radius: var(--charts-radius-md);
    padding: var(--charts-space-sm);
    background: #f8fafc;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .charts-image-camera__header h3 {
    margin: 0;
    font-size: 0.95rem;
    color: #0f172a;
  }

  .charts-image-camera__header p {
    margin: var(--charts-space-2xs) 0 0;
    font-size: 0.8rem;
    color: #64748b;
  }

  .charts-image-camera__fallback {
    border-radius: var(--charts-radius-sm);
    background: #fff7ed;
    border: 1px solid #fed7aa;
    color: #9a3412;
    padding: var(--charts-space-xs);
    font-size: 0.8rem;
  }

  .charts-image-camera__error {
    border-radius: var(--charts-radius-sm);
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #b91c1c;
    padding: var(--charts-space-xs);
    font-size: 0.8rem;
  }

  .charts-image-camera__body {
    display: grid;
    gap: var(--charts-space-sm);
  }

  .charts-image-camera__preview {
    position: relative;
    border-radius: var(--charts-radius-sm);
    overflow: hidden;
    background: #0f172a;
    aspect-ratio: 16 / 9;
  }

  .charts-image-camera__preview video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .charts-image-camera__placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #e2e8f0;
    font-size: 0.8rem;
  }

  .charts-image-camera__actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-xs);
  }

  .charts-image-camera__actions button {
    border-radius: 999px;
    border: 1px solid rgba(59, 130, 246, 0.4);
    background: #ffffff;
    color: #1d4ed8;
    padding: 0.35rem 0.7rem;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
  }

  .charts-image-panel__gallery {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
  }

  .charts-image-panel__gallery-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .charts-image-panel__gallery-header button {
    border-radius: 999px;
    border: 1px solid rgba(59, 130, 246, 0.4);
    background: #ffffff;
    color: #1d4ed8;
    padding: 0.35rem 0.7rem;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
  }

  .charts-image-panel__grid {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: var(--charts-space-sm);
  }

  .charts-image-panel__card {
    border: 1px solid var(--ui-border);
    border-radius: var(--charts-radius-sm);
    overflow: hidden;
    background: #ffffff;
  }

  .charts-image-panel__thumb {
    height: 96px;
    background: #f1f5f9;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .charts-image-panel__thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .charts-image-panel__card-body {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-2xs);
    padding: var(--charts-space-xs);
    font-size: 0.75rem;
    color: #64748b;
  }

  .charts-image-panel__card-actions {
    display: flex;
    gap: var(--charts-space-2xs);
    padding: 0 var(--charts-space-xs) var(--charts-space-xs);
  }

  .charts-image-panel__card-actions button {
    flex: 1;
    border-radius: 999px;
    border: 1px solid var(--ui-border-strong);
    background: #ffffff;
    color: #334155;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.25rem 0.4rem;
    cursor: pointer;
  }

  .charts-image-panel__card-actions button[data-active='true'] {
    background: rgba(59, 130, 246, 0.12);
    border-color: rgba(59, 130, 246, 0.6);
    color: #1d4ed8;
  }

  .charts-image-panel__target {
    margin-top: var(--charts-space-2xs);
    display: flex;
    justify-content: flex-end;
  }

  .charts-image-panel__target label {
    display: flex;
    align-items: center;
    gap: var(--charts-space-2xs);
    font-size: 0.75rem;
    color: #475569;
  }

  .charts-image-panel__target select {
    border-radius: 999px;
    border: 1px solid var(--ui-border-strong);
    padding: 0.2rem 0.6rem;
    background: #ffffff;
    font-size: 0.75rem;
  }

  .charts-document-attachment__header {
    display: flex;
    align-items: center;
    gap: var(--charts-space-xs);
  }

  .charts-document-attachment__header button {
    margin-left: auto;
    border: none;
    background: transparent;
    color: #1d4ed8;
    cursor: pointer;
    font-size: 0.75rem;
  }

  .charts-document-attachment__list {
    list-style: none;
    padding: 0;
    margin: var(--charts-space-2xs) 0 0;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-2xs);
  }

  .charts-document-attachment__item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--charts-space-xs);
    font-size: 0.75rem;
  }

  .charts-document-attachment__item button {
    border: none;
    background: transparent;
    color: #ef4444;
    cursor: pointer;
    font-size: 0.7rem;
  }

  .charts-side-panel__section {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-md);
    --charts-order-accent-bg: rgba(59, 130, 246, 0.12);
    --charts-order-accent-border: rgba(59, 130, 246, 0.32);
    --charts-order-accent-text: #1e3a8a;
    --charts-order-soft-surface: linear-gradient(135deg, rgba(239, 246, 255, 0.65), rgba(248, 250, 252, 0.96));
  }

  .charts-side-panel__section[data-order-entity='medOrder'] {
    --charts-order-accent-bg: rgba(34, 197, 94, 0.14);
    --charts-order-accent-border: rgba(34, 197, 94, 0.35);
    --charts-order-accent-text: #166534;
    --charts-order-soft-surface: linear-gradient(135deg, rgba(240, 253, 244, 0.78), rgba(248, 250, 252, 0.96));
  }

  .charts-side-panel__section[data-order-entity='injectionOrder'] {
    --charts-order-accent-bg: rgba(245, 158, 11, 0.16);
    --charts-order-accent-border: rgba(245, 158, 11, 0.4);
    --charts-order-accent-text: #9a3412;
    --charts-order-soft-surface: linear-gradient(135deg, rgba(255, 247, 237, 0.82), rgba(248, 250, 252, 0.96));
  }

  .charts-side-panel__section[data-order-entity='testOrder'],
  .charts-side-panel__section[data-order-entity='physiologyOrder'],
  .charts-side-panel__section[data-order-entity='bacteriaOrder'],
  .charts-side-panel__section[data-order-entity='laboTest'],
  .charts-side-panel__section[data-order-entity='radiologyOrder'] {
    --charts-order-accent-bg: rgba(6, 182, 212, 0.14);
    --charts-order-accent-border: rgba(14, 116, 144, 0.35);
    --charts-order-accent-text: #155e75;
    --charts-order-soft-surface: linear-gradient(135deg, rgba(236, 254, 255, 0.8), rgba(248, 250, 252, 0.96));
  }

  .charts-side-panel__section[data-order-entity='baseChargeOrder'],
  .charts-side-panel__section[data-order-entity='instractionChargeOrder'] {
    --charts-order-accent-bg: rgba(71, 85, 105, 0.14);
    --charts-order-accent-border: rgba(71, 85, 105, 0.35);
    --charts-order-accent-text: #334155;
    --charts-order-soft-surface: linear-gradient(135deg, rgba(241, 245, 249, 0.88), rgba(248, 250, 252, 0.96));
  }

  .charts-side-panel__workspace {
    display: grid;
    grid-template-columns: minmax(220px, 0.72fr) minmax(0, 1.72fr);
    gap: var(--charts-space-md);
    min-height: 0;
    align-items: stretch;
  }

  .charts-side-panel__workspace-left,
  .charts-side-panel__workspace-right {
    min-height: 0;
    overflow: visible;
    padding-right: var(--charts-space-xs);
  }

  .charts-side-panel__workspace-left {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .charts-side-panel__workspace-right {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .charts-side-panel__workspace-right--full {
    grid-column: 1 / -1;
  }

  .charts-side-panel__workspace[data-variant='embedded'] {
    grid-template-columns: 1fr;
    gap: var(--charts-space-sm);
  }

  .charts-side-panel__workspace[data-variant='embedded'] .charts-side-panel__workspace-left,
  .charts-side-panel__workspace[data-variant='embedded'] .charts-side-panel__workspace-right {
    max-height: none;
    overflow: visible;
    padding-right: 0;
  }

  .charts-side-panel__workspace[data-variant='embedded'] .charts-side-panel__two-table-scroll {
    max-height: none;
    overflow: visible;
    padding-right: var(--charts-space-sm);
  }

  .charts-side-panel__workspace[data-variant='embedded'] .charts-side-panel__two-table-scroll .charts-side-panel__subheader {
    position: static;
  }

  @media (max-width: 1360px) {
    .charts-side-panel__workspace {
      grid-template-columns: 1fr;
    }

    .charts-side-panel__workspace-left,
    .charts-side-panel__workspace-right {
      max-height: none;
      overflow: visible;
      padding-right: 0;
    }

    .charts-side-panel__two-table-scroll {
      max-height: none;
      overflow: visible;
      padding: 0;
      padding-right: 0;
      border: none;
      background: transparent;
    }

    .charts-side-panel__two-table-scroll .charts-side-panel__subheader {
      position: static;
      padding-bottom: 0;
      margin-bottom: 0;
      border-bottom: none;
      background: transparent;
    }
  }

  .charts-side-panel__section-header {
    display: flex;
    justify-content: space-between;
    gap: var(--charts-space-sm);
    align-items: flex-start;
    border-radius: 12px;
    border: 1px solid var(--charts-order-accent-border);
    background: var(--charts-order-soft-surface);
    padding: var(--charts-space-sm);
  }

  .charts-side-panel__section-header strong {
    color: var(--charts-order-accent-text);
  }

  .charts-side-panel__section-header-main {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-2xs);
  }

  .charts-side-panel__section-header p {
    margin: var(--charts-space-2xs) 0 0;
    color: #475569;
    font-size: 0.85rem;
  }

  .charts-side-panel__master-ref-inline {
    margin-top: var(--charts-space-2xs);
    display: flex;
    align-items: center;
    gap: var(--charts-space-xs);
    flex-wrap: wrap;
  }

  .charts-side-panel__ghost {
    border: 1px solid var(--ui-border);
    background: #ffffff;
    border-radius: 999px;
    padding: var(--charts-space-xs) var(--charts-space-sm);
    font-size: 0.8rem;
    cursor: pointer;
    color: #334155;
    font-weight: 600;
    transition: background 120ms ease, border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
  }

  .charts-side-panel__ghost:hover:not(:disabled) {
    border-color: rgba(59, 130, 246, 0.35);
    background: #f8fafc;
    box-shadow: 0 6px 14px rgba(15, 23, 42, 0.08);
  }

  .charts-side-panel__ghost:focus-visible {
    outline: 2px solid rgba(37, 99, 235, 0.55);
    outline-offset: 2px;
  }

  .charts-side-panel__ghost--info {
    border-color: rgba(59, 130, 246, 0.35);
    color: #1d4ed8;
    background: #eff6ff;
  }

  .charts-side-panel__ghost--reset {
    border-color: rgba(100, 116, 139, 0.38);
    color: #334155;
    background: #f1f5f9;
  }

  .charts-side-panel__ghost--add {
    border-color: rgba(34, 197, 94, 0.35);
    color: #166534;
    background: #ecfdf5;
  }

  .charts-side-panel__notice {
    padding: var(--charts-space-xs) var(--charts-space-sm);
    border-radius: var(--charts-radius-sm);
    font-size: 0.85rem;
    border: 1px solid transparent;
  }

  .charts-side-panel__notice--success {
    background: #ecfdf5;
    border-color: #bbf7d0;
    color: #065f46;
  }

  .charts-side-panel__notice--error {
    background: #fef2f2;
    border-color: #fecaca;
    color: #991b1b;
  }

  .charts-side-panel__notice--info {
    background: #eff6ff;
    border-color: #bfdbfe;
    color: #1e3a8a;
  }

  .charts-side-panel__notice--warning {
    background: #fff7ed;
    border-color: #fed7aa;
    color: #9a3412;
  }

  .charts-side-panel__notice-detail {
    margin-top: var(--charts-space-2xs);
    font-size: 0.8rem;
    color: inherit;
  }

  .charts-side-panel__warning-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--charts-space-xs);
  }

  .charts-side-panel__warning-list {
    list-style: none;
    padding: 0;
    margin: var(--charts-space-2xs) 0 0;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-2xs);
  }

  .charts-side-panel__warning-button {
    width: 100%;
    text-align: left;
    border: 1px solid rgba(154, 52, 18, 0.25);
    background: rgba(255, 237, 213, 0.7);
    color: inherit;
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-2xs) var(--charts-space-xs);
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--charts-space-xs);
    cursor: pointer;
  }

  .charts-side-panel__warning-button:hover:not(:disabled) {
    background: rgba(254, 215, 170, 0.7);
  }

  .charts-side-panel__warning-pos {
    font-weight: 800;
    font-size: 0.78rem;
    white-space: nowrap;
  }

  .charts-side-panel__warning-text {
    font-size: 0.85rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .charts-side-panel__contra-list {
    margin: var(--charts-space-2xs) 0 0;
    padding-left: 1.2rem;
    font-size: 0.8rem;
  }

  .charts-side-panel__notice-action {
    margin-top: var(--charts-space-xs);
    border: 1px solid var(--ui-border-strong);
    background: #ffffff;
    border-radius: 999px;
    padding: var(--charts-space-2xs) var(--charts-space-sm);
    font-size: 0.75rem;
    cursor: pointer;
    color: #0f172a;
    font-weight: 600;
  }

  .charts-side-panel__notice-action--retry {
    border-color: rgba(245, 158, 11, 0.45);
    background: #fff7ed;
    color: #9a3412;
  }

  .charts-side-panel__correction {
    border: 1px dashed var(--ui-border);
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-sm);
    background: #f8fafc;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
  }

  .charts-side-panel__correction-header {
    display: flex;
    justify-content: space-between;
    gap: var(--charts-space-xs);
    color: #475569;
    font-size: 0.8rem;
  }

  .charts-side-panel__search-row--correction {
    background: #fff7ed;
    border-color: #fed7aa;
  }

  .charts-side-panel__form {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
    background: #ffffff;
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-sm);
    border: 1px solid var(--charts-order-accent-border);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.72);
  }

  /*
   * Legacy-like edit flow:
   * 1) bundle name / class switches
   * 2) main item rows
   * 3) usage and supplemental fields
   */
  .charts-side-panel__meta-section {
    order: 50;
  }

  .charts-side-panel__meta-section--bundle {
    order: 10;
  }

  .charts-side-panel__meta-section--rx-class {
    order: 20;
  }

  .charts-side-panel__meta-section--mixing {
    order: 25;
  }

  .charts-side-panel__meta-section--items {
    order: 30;
  }

  .charts-side-panel__meta-section--usage {
    order: 40;
  }

  .charts-side-panel__meta-section--start {
    order: 50;
  }

  .charts-side-panel__meta-section--memo {
    order: 60;
  }

  .charts-side-panel__meta-section--bodypart {
    order: 70;
  }

  .charts-side-panel__meta-section--comments {
    order: 80;
  }

  .charts-side-panel__field-row.charts-side-panel__meta-section--rx-class,
  .charts-side-panel__field-row.charts-side-panel__meta-section--usage {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }

  .charts-side-panel__meta-section--items .charts-side-panel__two-table-layout,
  .charts-side-panel__meta-section--items .charts-side-panel__two-table-fixed {
    gap: var(--charts-space-xs);
  }

  .charts-side-panel__meta-section--items .charts-side-panel__subheader-actions {
    gap: var(--charts-space-2xs);
  }

  .charts-side-panel__meta-section--items .charts-side-panel__help,
  .charts-side-panel__meta-section--usage .charts-side-panel__help,
  .charts-side-panel__meta-section--usage .charts-side-panel__field-error {
    margin-top: 0;
  }

  @media (max-width: 840px) {
    .charts-side-panel__field-row.charts-side-panel__meta-section--rx-class,
    .charts-side-panel__field-row.charts-side-panel__meta-section--usage {
      grid-template-columns: 1fr;
    }
  }

  .charts-side-panel__form input,
  .charts-side-panel__form textarea,
  .charts-side-panel__form select {
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border);
    padding: var(--charts-space-xs) var(--charts-space-sm);
    font-size: 0.9rem;
    background: #ffffff;
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }

  .charts-side-panel__form input:focus-visible,
  .charts-side-panel__form textarea:focus-visible,
  .charts-side-panel__form select:focus-visible {
    outline: none;
    border-color: var(--charts-order-accent-border);
    box-shadow: 0 0 0 2px var(--charts-order-accent-bg);
  }

  .charts-side-panel__form input:disabled,
  .charts-side-panel__form textarea:disabled,
  .charts-side-panel__form select:disabled {
    background: #f1f5f9;
    color: #94a3b8;
    cursor: not-allowed;
  }

  .charts-side-panel__form textarea {
    resize: vertical;
    min-height: 64px;
  }

  .charts-side-panel__field {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-2xs);
  }

  .charts-side-panel__field label {
    font-size: 0.78rem;
    color: #475569;
  }

  .charts-side-panel__help {
    margin: var(--charts-space-2xs) 0 0;
    font-size: 0.75rem;
    color: #64748b;
  }

  .charts-side-panel__field-error {
    margin: var(--charts-space-2xs) 0 0;
    font-size: 0.75rem;
    font-weight: 800;
    color: #b91c1c;
    line-height: 1.45;
  }

  .charts-side-panel__field[data-invalid='true'] input,
  .charts-side-panel__field[data-invalid='true'] textarea,
  .charts-side-panel__field[data-invalid='true'] select {
    border-color: rgba(239, 68, 68, 0.72);
    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.12);
  }

  .charts-side-panel__item-row--invalid input,
  .charts-side-panel__item-row--invalid select,
  .charts-side-panel__item-row[data-invalid='true'] input,
  .charts-side-panel__item-row[data-invalid='true'] select {
    border-color: rgba(239, 68, 68, 0.72);
    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.12);
  }

  .charts-side-panel__template-actions {
    display: flex;
    gap: var(--charts-space-xs);
    flex-wrap: wrap;
  }

  .charts-side-panel__template-actions button,
  .charts-side-panel__chip-button {
    border-radius: 999px;
    border: 1px solid var(--ui-border);
    background: #ffffff;
    color: #334155;
    cursor: pointer;
    padding: var(--charts-space-2xs) var(--charts-space-sm);
    font-size: 0.78rem;
    font-weight: 600;
    transition: background 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
  }

  .charts-side-panel__template-actions button:hover:not(:disabled),
  .charts-side-panel__chip-button:hover:not(:disabled) {
    border-color: rgba(59, 130, 246, 0.35);
    background: #f8fafc;
    box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08);
  }

  .charts-side-panel__chip-button--recommend {
    border-color: rgba(34, 197, 94, 0.35);
    background: #ecfdf5;
    color: #166534;
  }

  .charts-side-panel__chip-button--preset[data-active='true'] {
    border-color: rgba(37, 99, 235, 0.44);
    background: #dbeafe;
    color: #1d4ed8;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.45);
  }

  .charts-side-panel__field-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: var(--charts-space-sm);
  }

  .charts-side-panel__toggle {
    display: flex;
    align-items: center;
    gap: var(--charts-space-xs);
    font-size: 0.85rem;
    color: #334155;
  }

  .charts-side-panel__switch-group {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
    gap: var(--charts-space-xs);
  }

  .charts-side-panel__switch-button {
    border: 1px solid var(--ui-border-strong);
    border-radius: 10px;
    min-height: 38px;
    background: #ffffff;
    color: #334155;
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.01em;
    padding: 0.3rem 0.55rem;
    cursor: pointer;
    transition: border-color 120ms ease, background 120ms ease, box-shadow 120ms ease;
    white-space: nowrap;
  }

  .charts-side-panel__switch-button[data-active='true'] {
    border-color: rgba(37, 99, 235, 0.55);
    background: #dbeafe;
    color: #1d4ed8;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.45);
  }

  .charts-side-panel__switch-button:hover:not(:disabled) {
    border-color: rgba(59, 130, 246, 0.5);
    background: #eff6ff;
  }

  .charts-side-panel__switch-group--compact {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    min-width: 0;
  }

  .charts-side-panel__switch-button--compact {
    min-height: 34px;
    padding: 0.28rem 0.4rem;
    font-size: 0.74rem;
    line-height: 1.25;
  }

  .charts-side-panel__subsection {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
    border-top: 1px dashed var(--ui-border);
    padding-top: var(--charts-space-sm);
  }

  .charts-side-panel__subsection--search {
    gap: var(--charts-space-sm);
  }

  .charts-side-panel__fold {
    border-top: 1px dashed var(--ui-border);
    padding-top: var(--charts-space-sm);
  }

  .charts-side-panel__fold-summary {
    cursor: pointer;
    font-weight: 900;
    color: #0f172a;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--charts-space-sm);
    list-style: none;
  }

  .charts-side-panel__fold-summary::-webkit-details-marker {
    display: none;
  }

  .charts-side-panel__fold-summary::after {
    content: '>';
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    color: #64748b;
    transition: transform 120ms ease;
    flex: 0 0 auto;
  }

  .charts-side-panel__fold[open] > .charts-side-panel__fold-summary::after {
    transform: rotate(90deg);
  }

  .charts-side-panel__fold-meta {
    display: inline-flex;
    align-items: center;
    gap: var(--charts-space-xs);
    flex: 0 0 auto;
  }

  .charts-side-panel__fold-count {
    font-size: 0.75rem;
    font-weight: 900;
    color: #475569;
  }

  .charts-side-panel__fold-badge {
    border-radius: 999px;
    padding: 0.15rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 900;
    border: 1px solid var(--ui-border);
    background: rgba(248, 250, 252, 0.95);
    color: #0f172a;
  }

  .charts-side-panel__fold-badge--error {
    border-color: rgba(239, 68, 68, 0.4);
    background: rgba(254, 242, 242, 0.9);
    color: #991b1b;
  }

  .charts-side-panel__fold-content {
    padding-top: var(--charts-space-sm);
  }

  .charts-side-panel__fold-content .charts-side-panel__subsection {
    border-top: none;
    padding-top: 0;
  }

  .charts-side-panel__two-table-layout {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: var(--charts-space-sm);
    min-height: 0;
  }

  .charts-side-panel__two-table-fixed {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
    min-height: 0;
  }

  .charts-side-panel__two-table-scroll {
    min-height: 0;
    max-height: min(62vh, 760px);
    overflow: auto;
    padding: var(--charts-space-sm);
    padding-right: var(--charts-space-xs);
    scrollbar-gutter: stable both-edges;
    border: 1px solid var(--ui-border-subtle);
    border-radius: var(--charts-radius-sm);
    background: #ffffff;
  }

  .charts-side-panel__two-table-scroll .charts-side-panel__subheader {
    position: sticky;
    top: 0;
    z-index: 2;
    background: #ffffff;
    padding-bottom: var(--charts-space-sm);
    margin-bottom: var(--charts-space-sm);
    border-bottom: 1px solid var(--ui-border-subtle);
  }

  .charts-side-panel__subheader {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .charts-side-panel__subheader strong {
    color: var(--charts-order-accent-text);
  }

  .charts-side-panel__subheader-actions {
    display: flex;
    gap: var(--charts-space-xs);
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .charts-side-panel__pager {
    display: inline-flex;
    align-items: center;
    gap: var(--charts-space-2xs);
  }

  .charts-side-panel__pager-index {
    min-width: 3.8rem;
    text-align: center;
    font-size: 0.78rem;
    color: #475569;
    font-variant-numeric: tabular-nums;
  }

  .charts-side-panel__pager .charts-side-panel__ghost {
    padding: 0.18rem 0.52rem;
  }

  .charts-side-panel__status {
    font-size: 0.78rem;
    padding: var(--charts-space-2xs) var(--charts-space-sm);
    border-radius: 999px;
    border: 1px solid var(--ui-border);
    color: #475569;
    background: #f1f5f9;
  }

  .charts-side-panel__status--ok {
    border-color: rgba(34, 197, 94, 0.4);
    color: #166534;
    background: #dcfce7;
  }

  .charts-side-panel__status--warn {
    border-color: rgba(234, 179, 8, 0.45);
    color: #92400e;
    background: #fef9c3;
  }

  .charts-side-panel__status--error {
    border-color: rgba(239, 68, 68, 0.4);
    color: #991b1b;
    background: #fee2e2;
  }

  .charts-side-panel__master-ref-panel {
    border: 1px solid var(--ui-border);
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-sm);
    background: #ffffff;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
  }

  .charts-side-panel__master-ref-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--charts-space-xs);
  }

  .charts-side-panel__master-ref-list {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
  }

  .charts-side-panel__master-ref-item {
    border: 1px solid var(--ui-border-subtle);
    border-radius: var(--charts-radius-sm);
    background: #f8fafc;
    padding: var(--charts-space-xs);
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-2xs);
  }

  .charts-side-panel__master-ref-item-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--charts-space-xs);
  }

  .charts-side-panel__master-ref-item-meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-xs);
    font-size: 0.75rem;
    color: #475569;
  }

  .charts-side-panel__master-ref-item-error {
    font-size: 0.78rem;
    color: #b91c1c;
    font-weight: 700;
  }

  .charts-side-panel__search-count {
    font-size: 0.78rem;
    color: #64748b;
  }

  .charts-side-panel__item-row {
    display: grid;
    grid-template-columns: 32px minmax(0, 1.4fr) minmax(0, 0.8fr) minmax(0, 0.6fr) 32px;
    gap: var(--charts-space-xs);
    align-items: center;
    padding: var(--charts-space-2xs);
    border-radius: var(--charts-radius-sm);
  }

  .charts-side-panel__item-row--med {
    grid-template-columns: 32px minmax(0, 1.45fr) minmax(82px, 0.72fr) minmax(72px, 0.58fr) minmax(160px, 1.05fr) 32px;
  }

  .charts-side-panel__item-row--inactive {
    border: 1px dashed rgba(100, 116, 139, 0.62);
    background: linear-gradient(180deg, rgba(248, 250, 252, 0.94) 0%, rgba(241, 245, 249, 0.96) 100%);
  }

  .charts-side-panel__item-row--inactive input,
  .charts-side-panel__item-row--inactive select {
    background: rgba(255, 255, 255, 0.84);
  }

  .charts-side-panel__item-row--comment {
    grid-template-columns: 0.7fr 1.6fr 0.6fr 0.6fr auto;
  }

  .charts-side-panel__item-row input,
  .charts-side-panel__item-row select {
    min-width: 0;
    width: 100%;
  }

  .charts-side-panel__item-row .charts-side-panel__switch-group {
    min-width: 0;
  }

  .charts-side-panel__med-item-meta {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .charts-side-panel__med-item-meta input {
    min-width: 0;
    width: 100%;
  }

  .charts-side-panel__item-row--drag-over {
    background: rgba(59, 130, 246, 0.08);
    outline: 1px dashed rgba(59, 130, 246, 0.45);
  }

  .charts-side-panel__item-row--dragging {
    opacity: 0.7;
  }

  .charts-side-panel__item-row--selected {
    background: rgba(59, 130, 246, 0.12);
    outline: 1px solid rgba(59, 130, 246, 0.5);
  }

  .charts-side-panel__item-row--orca-warning {
    background: rgba(254, 226, 226, 0.6);
    outline: 1px solid rgba(220, 38, 38, 0.55);
  }

  .charts-side-panel__form input[data-orca-warning='true'],
  .charts-side-panel__form select[data-orca-warning='true'],
  .charts-side-panel__form textarea[data-orca-warning='true'] {
    outline: 2px solid rgba(220, 38, 38, 0.6);
    background: #fff1f2;
  }

  .charts-side-panel__drag-handle {
    border: 1px solid var(--ui-border-strong);
    background: #f8fafc;
    color: #475569;
    border-radius: var(--charts-radius-sm);
    width: 32px;
    height: 32px;
    cursor: grab;
    font-weight: 700;
  }

  .charts-side-panel__drag-handle:active {
    cursor: grabbing;
  }

  .charts-side-panel__drag-handle:hover:not(:disabled) {
    border-color: rgba(37, 99, 235, 0.34);
    background: #eff6ff;
    color: #1d4ed8;
  }

  .charts-side-panel__icon {
    border: 1px solid rgba(239, 68, 68, 0.45);
    background: #fee2e2;
    color: #b91c1c;
    border-radius: 999px;
    width: 32px;
    height: 32px;
    cursor: pointer;
    font-weight: 700;
  }

  .charts-side-panel__icon:hover:not(:disabled) {
    background: #fecaca;
    border-color: rgba(220, 38, 38, 0.52);
  }

  .charts-side-panel__row-delete {
    border: 1px solid rgba(239, 68, 68, 0.45);
    background: #fef2f2;
    color: #b91c1c;
    border-radius: 999px;
    padding: var(--charts-space-2xs) var(--charts-space-sm);
    cursor: pointer;
    font-weight: 700;
    font-size: 0.78rem;
  }

  .charts-side-panel__row-delete:hover:not(:disabled) {
    background: #fee2e2;
    border-color: rgba(220, 38, 38, 0.52);
  }

  .charts-side-panel__ghost--danger {
    border-color: rgba(239, 68, 68, 0.45);
    color: #b91c1c;
    background: #fff1f2;
  }

  .charts-side-panel__ghost:disabled,
  .charts-side-panel__actions button:disabled,
  .charts-side-panel__action:disabled,
  .charts-side-panel__chip-button:disabled,
  .charts-side-panel__switch-button:disabled,
  .charts-side-panel__item-actions button:disabled,
  .charts-side-panel__row-delete:disabled,
  .charts-side-panel__drag-handle:disabled,
  .charts-side-panel__icon:disabled {
    background: repeating-linear-gradient(
      -45deg,
      #f8fafc,
      #f8fafc 8px,
      #f1f5f9 8px,
      #f1f5f9 16px
    );
    border-color: rgba(203, 213, 225, 0.95);
    color: #94a3b8;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
  }

  .charts-side-panel__list {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .charts-side-panel__search-table {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
    border: 1px solid var(--ui-border-subtle);
    border-radius: var(--charts-radius-sm);
    overflow: hidden;
    background: #f8fafc;
  }

  .charts-side-panel__search-header {
    display: grid;
    grid-template-columns: 1.2fr 2.2fr 0.9fr 1fr 1.4fr;
    gap: var(--charts-space-xs);
    padding: var(--charts-space-xs) var(--charts-space-sm);
    font-size: 0.75rem;
    color: #475569;
    background: #eef2ff;
    font-weight: 600;
  }

  .charts-side-panel__search-row {
    display: grid;
    grid-template-columns: 1.2fr 2.2fr 0.9fr 1fr 1.4fr;
    gap: var(--charts-space-xs);
    padding: var(--charts-space-sm);
    border: none;
    border-left: 3px solid transparent;
    background: #ffffff;
    cursor: pointer;
    text-align: left;
    font-size: 0.82rem;
    color: #1f2937;
    transition: background 120ms ease, border-color 120ms ease;
  }

  .charts-side-panel__search-header--usage,
  .charts-side-panel__search-row--usage {
    grid-template-columns: 1fr 2fr 1fr 1fr 0.8fr 1.8fr;
  }

  .charts-side-panel__search-row:nth-of-type(even) {
    background: #f9fafb;
  }

  .charts-side-panel__search-row:hover:not(:disabled) {
    background: #eff6ff;
    border-left-color: var(--charts-order-accent-border);
  }

  .charts-side-panel__search-row[data-active='true']:not(:disabled) {
    background: #dbeafe;
    border-left-color: var(--charts-order-accent-border);
  }

  .charts-side-panel__search-row:disabled {
    background: #e2e8f0;
    color: #94a3b8;
    cursor: not-allowed;
  }

  .charts-side-panel__search-row span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .charts-side-panel__list-header {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    color: #64748b;
  }

  .charts-side-panel__items {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .charts-side-panel__items li {
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-sm);
    border: 1px solid var(--ui-border-subtle);
    background: #ffffff;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
  }

  .charts-diagnosis__lead {
    margin: var(--charts-space-2xs) 0 0;
    font-size: 0.82rem;
    color: #64748b;
  }

  .charts-diagnosis__header-actions {
    display: flex;
    gap: var(--charts-space-xs);
    align-items: center;
  }

  .charts-diagnosis__unblock {
    margin: var(--charts-space-xs) 0 0;
    padding-left: 1.1rem;
    font-size: 0.78rem;
    color: inherit;
  }

  .charts-diagnosis__notes {
    display: grid;
    gap: var(--charts-space-xs);
  }

  .charts-side-panel__items.charts-diagnosis__items {
    gap: var(--charts-space-xs);
  }

  .charts-diagnosis__list-scroll {
    max-height: clamp(132px, 22vh, 280px);
    overflow-y: auto;
    padding-right: var(--charts-space-2xs);
    scrollbar-gutter: stable both-edges;
  }

  .charts-diagnosis__item.charts-side-panel__items li,
  .charts-side-panel__items .charts-diagnosis__item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: var(--charts-space-xs);
    padding: var(--charts-space-xs) var(--charts-space-sm);
  }

  .charts-diagnosis__item-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .charts-diagnosis__title {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-xs);
    align-items: baseline;
    min-width: 0;
  }

  .charts-diagnosis__name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: block;
    color: #0f172a;
  }

  .charts-diagnosis__code {
    font-size: 0.75rem;
    color: #64748b;
  }

  .charts-diagnosis__meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-xs);
    align-items: center;
    font-size: 0.75rem;
    color: #64748b;
  }

  .charts-diagnosis__badges {
    display: inline-flex;
    gap: 4px;
    align-items: center;
  }

  .charts-diagnosis__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 1px 6px;
    border-radius: 999px;
    border: 1px solid var(--ui-border);
    background: #f1f5f9;
    color: #475569;
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .charts-diagnosis__badge--main {
    border-color: rgba(34, 197, 94, 0.35);
    background: rgba(34, 197, 94, 0.16);
    color: #166534;
  }

  .charts-diagnosis__badge--sub {
    border-color: rgba(99, 102, 241, 0.3);
    background: rgba(99, 102, 241, 0.12);
    color: #3730a3;
  }

  .charts-diagnosis__badge--suspected {
    border-color: rgba(234, 88, 12, 0.35);
    background: rgba(234, 88, 12, 0.12);
    color: #9a3412;
  }

  .charts-diagnosis__dates {
    font-variant-numeric: tabular-nums;
    display: flex;
    flex-wrap: wrap;
    gap: 0.42rem;
    align-items: center;
  }

  .charts-diagnosis__code-state {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 1px 6px;
    font-size: 0.68rem;
    font-weight: 800;
    line-height: 1.2;
  }

  .charts-diagnosis__code-state--ok {
    border: 1px solid rgba(34, 197, 94, 0.42);
    background: rgba(34, 197, 94, 0.12);
    color: #166534;
  }

  .charts-diagnosis__code-state--warn {
    border: 1px solid rgba(234, 88, 12, 0.45);
    background: rgba(255, 237, 213, 0.85);
    color: #9a3412;
  }

  .charts-side-panel__item-actions.charts-diagnosis__item-actions button {
    padding: 2px var(--charts-space-sm);
    font-size: 0.75rem;
  }

  .charts-diagnosis__ended {
    margin-top: var(--charts-space-xs);
    border-radius: var(--charts-radius-sm);
    border: 1px dashed var(--ui-border);
    background: #f8fafc;
    padding: var(--charts-space-xs);
  }

  .charts-diagnosis__ended-summary {
    cursor: pointer;
    color: #475569;
    font-size: 0.78rem;
    font-weight: 700;
  }

  .charts-diagnosis__ended-summary::-webkit-details-marker {
    display: none;
  }

  .charts-diagnosis__ended-summary::after {
    content: '>';
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    color: #64748b;
    float: right;
    transition: transform 120ms ease;
  }

  .charts-diagnosis__ended[open] > .charts-diagnosis__ended-summary::after {
    transform: rotate(90deg);
  }

  .charts-diagnosis__editor {
    gap: var(--charts-space-sm);
  }

  .charts-diagnosis__name-row {
    display: grid;
    grid-template-columns: minmax(88px, 0.8fr) minmax(180px, 1.8fr) minmax(88px, 0.8fr);
    gap: var(--charts-space-sm);
    align-items: end;
  }

  @media (max-width: 720px) {
    .charts-diagnosis__name-row {
      grid-template-columns: 1fr;
    }
  }

  .charts-diagnosis__advanced {
    border-radius: var(--charts-radius-sm);
    border: 1px dashed var(--ui-border);
    background: #f8fafc;
    padding: var(--charts-space-xs) var(--charts-space-sm);
  }

  .charts-diagnosis__advanced-summary {
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 800;
    color: #475569;
  }

  .charts-diagnosis__editor-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--charts-space-xs);
    flex-wrap: wrap;
  }

  .charts-diagnosis__editor-actions button {
    border-radius: 999px;
    border: 1px solid rgba(59, 130, 246, 0.35);
    background: #ffffff;
    padding: 0.45rem 0.7rem;
    cursor: pointer;
    font-weight: 800;
    color: #1d4ed8;
    font-size: 0.82rem;
  }

  .charts-diagnosis__editor-actions button.charts-side-panel__ghost {
    border-color: var(--ui-border);
    color: #475569;
    background: #f8fafc;
  }

  .charts-diagnosis__editor-actions button:disabled {
    background: #e2e8f0;
    border-color: var(--ui-border);
    color: #94a3b8;
    cursor: not-allowed;
  }

  .charts-diagnosis__hint {
    display: block;
    font-size: 0.75rem;
    color: #64748b;
  }

  .charts-diagnosis__quick-add {
    border: 1px solid var(--ui-border);
    border-radius: var(--charts-radius-sm);
    background: #f8fafc;
    padding: var(--charts-space-sm);
    display: grid;
    gap: var(--charts-space-sm);
  }

  .charts-diagnosis__quick-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--charts-space-sm);
    align-items: end;
  }

  .charts-diagnosis__quick-candidates {
    display: grid;
    gap: 4px;
  }

  .charts-diagnosis__quick-candidate-help {
    margin: 0;
    font-size: 0.74rem;
  }

  .charts-diagnosis__quick-candidate-help--warn {
    color: #b45309;
  }

  .charts-diagnosis__quick-actions {
    display: flex;
    justify-content: flex-end;
  }

  .charts-diagnosis__quick-actions button {
    border-radius: 999px;
    border: 1px solid rgba(37, 99, 235, 0.4);
    background: #eff6ff;
    color: #1d4ed8;
    padding: 0.35rem 0.8rem;
    font-weight: 800;
    cursor: pointer;
  }

  .charts-document-list {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .charts-document-list__header {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    color: #475569;
  }

  .charts-document-list__filters {
    display: grid;
    grid-template-columns: minmax(160px, 1.2fr) minmax(120px, 0.6fr) minmax(140px, 0.8fr) minmax(140px, 0.7fr) auto;
    gap: var(--charts-space-xs);
    align-items: center;
  }

  .charts-document-list__filters input,
  .charts-document-list__filters select {
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border);
    padding: var(--charts-space-xs) var(--charts-space-sm);
    font-size: 0.8rem;
    background: #ffffff;
    color: #0f172a;
  }

  .charts-document-list__clear {
    border-radius: 999px;
    border: 1px solid var(--ui-border);
    background: #f1f5f9;
    color: #475569;
    padding: var(--charts-space-2xs) var(--charts-space-md);
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
  }

  @media (max-width: 900px) {
    .charts-document-list__filters {
      grid-template-columns: 1fr;
    }
  }

  .charts-document-list__items {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--charts-space-xs);
  }

  .charts-document-list__items li {
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border-subtle);
    background: #ffffff;
    padding: var(--charts-space-sm);
    display: grid;
    gap: var(--charts-space-2xs);
    box-shadow: var(--charts-shadow-none);
  }

  .charts-document-list__row {
    display: flex;
    justify-content: space-between;
    gap: var(--charts-space-sm);
    font-size: 0.85rem;
  }

  .charts-document-list__meta {
    display: flex;
    justify-content: space-between;
    color: #64748b;
    font-size: 0.78rem;
  }

  .charts-document-list__status {
    display: inline-flex;
    align-items: center;
    gap: var(--charts-space-2xs);
    padding: 2px var(--charts-space-sm);
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    background: #e2e8f0;
    color: #475569;
  }

  .charts-document-list__status--success {
    background: rgba(16, 185, 129, 0.15);
    color: #047857;
  }

  .charts-document-list__status--failed {
    background: rgba(239, 68, 68, 0.15);
    color: #b91c1c;
  }

  .charts-document-list__status--pending {
    background: rgba(59, 130, 246, 0.15);
    color: #1d4ed8;
  }

  .charts-document-list__status--none {
    background: #e2e8f0;
    color: #475569;
  }

  .charts-document-list__items li strong {
    color: #1e3a8a;
  }

  .charts-document-list__items li small {
    color: #64748b;
  }

  .charts-document-list__actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--charts-space-xs);
  }

  .charts-document-list__actions button {
    border-radius: 999px;
    border: 1px solid rgba(37, 99, 235, 0.3);
    background: #eff6ff;
    color: #1d4ed8;
    cursor: pointer;
    padding: var(--charts-space-2xs) var(--charts-space-sm);
    font-size: 0.78rem;
    font-weight: 600;
  }

  .charts-document-list__actions button:disabled {
    background: #e2e8f0;
    color: #94a3b8;
    border-color: var(--ui-border);
    cursor: not-allowed;
  }

  .charts-document-list__guard {
    font-size: 0.75rem;
    color: #b91c1c;
  }

  .charts-document-list__recovery {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-xs);
    align-items: center;
    font-size: 0.75rem;
  }

  .charts-document-list__recovery button,
  .charts-document-list__recovery a {
    border-radius: 999px;
    border: 1px solid var(--ui-border);
    background: #f8fafc;
    color: #334155;
    padding: var(--charts-space-2xs) var(--charts-space-sm);
    font-size: 0.75rem;
    font-weight: 600;
    text-decoration: none;
  }

  .charts-side-panel__bundle-items {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-xs) var(--charts-space-sm);
    color: #475569;
    font-size: 0.85rem;
  }

  .charts-side-panel__bundle-item--document {
    border-radius: 999px;
    border: 1px solid rgba(14, 116, 144, 0.35);
    background: #ecfeff;
    color: #155e75;
    padding: 2px 8px;
    font-size: 0.76rem;
    font-weight: 700;
    cursor: pointer;
  }

  .charts-side-panel__bundle-item--document:hover:not(:disabled) {
    border-color: rgba(8, 145, 178, 0.45);
    background: #cffafe;
  }

  .charts-side-panel__item-actions {
    display: flex;
    gap: var(--charts-space-xs);
  }

  .charts-side-panel__item-actions button {
    border-radius: 999px;
    border: 1px solid var(--ui-border);
    background: #ffffff;
    color: #334155;
    cursor: pointer;
    padding: var(--charts-space-2xs) var(--charts-space-sm);
    font-size: 0.78rem;
    font-weight: 700;
    transition: background 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
  }

  .charts-side-panel__item-actions button:hover:not(:disabled) {
    box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08);
  }

  .charts-side-panel__history-action--copy {
    border-color: rgba(13, 148, 136, 0.35);
    background: #f0fdfa;
    color: #0f766e;
  }

  .charts-side-panel__history-action--edit {
    border-color: rgba(37, 99, 235, 0.35);
    background: #eff6ff;
    color: #1d4ed8;
  }

  .charts-side-panel__history-action--delete {
    border-color: rgba(239, 68, 68, 0.35);
    color: #b91c1c;
    background: #fef2f2;
  }

  .charts-side-panel__empty {
    margin: 0;
    color: #94a3b8;
    font-size: 0.85rem;
  }

  .charts-card {
    background: #ffffff;
    border-radius: var(--charts-radius-md);
    padding: var(--charts-card-padding);
    border: var(--charts-card-border);
    box-shadow: var(--charts-card-shadow);
  }

  .charts-card--actions {
    position: relative;
    overflow: hidden;
  }

  .charts-actions {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .charts-actions--locked {
    padding-left: calc(var(--charts-space-xs) - 3px);
    border-left: 3px solid #f59e0b;
  }

  .charts-actions__header {
    display: flex;
    justify-content: space-between;
    gap: var(--charts-space-md);
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .charts-actions__header-main {
    display: grid;
    gap: var(--charts-space-2xs);
    min-width: 0;
  }

  .charts-actions__header h2 {
    margin: var(--charts-space-2xs) 0 var(--charts-space-2xs);
    font-size: 1.08rem;
  }

  .charts-actions__kicker {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.78rem;
    color: #64748b;
  }

  .charts-actions__status {
    margin: 0.15rem 0 0;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.4rem 0.68rem;
    border-radius: var(--ui-radius-md);
    border: 1px solid var(--ui-border-subtle);
    color: #0f172a;
    font-weight: 600;
    background: rgba(248, 250, 252, 0.88);
  }

  .charts-actions__status--ready {
    background: #ecfdf5;
    border-color: rgba(34, 197, 94, 0.45);
    color: #166534;
  }

  .charts-actions__status--busy {
    background: #eff6ff;
    border-color: rgba(59, 130, 246, 0.45);
    color: #1d4ed8;
  }

  .charts-actions__status--guarded {
    background: #fff7ed;
    border-color: rgba(245, 158, 11, 0.5);
    color: #9a3412;
  }

  .charts-actions__status--locked {
    background: #fff1f2;
    border-color: rgba(244, 63, 94, 0.4);
    color: #9f1239;
  }

  .charts-actions__toggle {
    margin-top: var(--charts-space-xs);
    border: 1px solid var(--ui-border);
    background: #ffffff;
    border-radius: 999px;
    padding: 0.35rem 0.75rem;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    color: #0f172a;
  }

  .charts-actions__toggle:hover {
    background: #f8fafc;
  }

  .charts-actions__toggle:focus-visible {
    outline: 2px solid rgba(59, 130, 246, 0.6);
    outline-offset: 2px;
  }

  .charts-actions__quick-controls {
    margin-top: var(--charts-space-xs);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--charts-space-xs);
  }

  .charts-actions__meta {
    display: flex;
    gap: var(--charts-space-sm);
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .charts-actions__header-meta {
    align-items: flex-start;
  }

  .charts-actions[data-compact-collapsed='1'] .charts-actions__meta {
    display: none;
  }

  .charts-actions[data-compact-collapsed='1'] .charts-actions__status {
    display: none;
  }

  .charts-actions__meta--compact {
    justify-content: flex-start;
    gap: var(--charts-space-xs);
  }

  .charts-actions__meta-details {
    border: 1px solid var(--ui-border);
    border-radius: 999px;
    padding: 0.35rem 0.6rem;
    background: #f8fafc;
  }

  .charts-actions__meta-summary {
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 700;
    color: #0f172a;
    list-style: none;
  }

  .charts-actions__meta-summary::-webkit-details-marker {
    display: none;
  }

  .charts-actions__meta-details-grid {
    margin-top: var(--charts-space-xs);
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-xs);
    justify-content: flex-start;
  }

  .charts-actions__pill {
    font-size: 0.85rem;
  }

  .charts-actions__controls {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .charts-actions__group {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
    gap: var(--charts-space-xs);
    padding: var(--charts-space-xs);
    border-radius: var(--ui-radius-md);
    border: 1px solid var(--ui-border-subtle);
    background: rgba(248, 250, 252, 0.78);
  }

  .charts-actions__group[data-group='encounter'] {
    border-color: rgba(34, 197, 94, 0.18);
    background: rgba(240, 253, 244, 0.8);
  }

  .charts-actions__group[data-group='send'] {
    border-color: rgba(37, 99, 235, 0.18);
    background: rgba(239, 246, 255, 0.84);
  }

  .charts-actions__group[data-group='support'] {
    border-color: rgba(245, 158, 11, 0.16);
    background: rgba(255, 251, 235, 0.82);
  }

  .charts-actions__button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.42rem;
    border-radius: var(--ui-radius-md);
    border: 1px solid var(--ui-border);
    background: #ffffff;
    padding: 0.7rem 0.8rem;
    font-weight: 700;
    cursor: pointer;
    color: #0f172a;
    box-shadow: none;
    transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
  }

  .charts-actions__button:hover:not(:disabled) {
    background: rgba(248, 250, 252, 0.96);
  }

  .charts-actions__button:focus-visible {
    outline: 2px solid rgba(37, 99, 235, 0.55);
    outline-offset: 2px;
  }

  .charts-actions__button--compact {
    border-radius: var(--ui-radius-sm);
    padding: 0.45rem 0.65rem;
    font-size: 0.9rem;
  }

  .charts-actions__button:disabled {
    cursor: not-allowed;
    opacity: 1;
    color: #94a3b8;
    border-color: rgba(203, 213, 225, 0.95);
    background: repeating-linear-gradient(
      -45deg,
      #f8fafc,
      #f8fafc 8px,
      #f1f5f9 8px,
      #f1f5f9 16px
    );
    box-shadow: none;
  }

  .charts-actions__button--encounter-start {
    background: rgba(220, 252, 231, 0.88);
    color: #14532d;
    border-color: rgba(34, 197, 94, 0.45);
  }

  .charts-actions__button--encounter-pause {
    background: #fff7ed;
    border-color: rgba(245, 158, 11, 0.4);
    color: #9a3412;
  }

  .charts-actions__button--encounter-finish,
  .charts-actions__button--reload {
    background: #eff6ff;
    border-color: rgba(59, 130, 246, 0.4);
    color: #1e3a8a;
  }

  .charts-actions__button--send,
  .charts-actions__button--primary {
    background: #1d4ed8;
    color: #ffffff;
    border-color: transparent;
    box-shadow: var(--ui-shadow-soft);
  }

  .charts-actions__button--draft {
    background: #f1f5f9;
    border-color: rgba(100, 116, 139, 0.45);
    color: #334155;
  }

  .charts-actions__button--print {
    background: #ecfeff;
    border-color: rgba(14, 116, 144, 0.4);
    color: #155e75;
  }

  .charts-actions__button--ghost {
    background: #f8fafc;
    border-color: var(--ui-border-strong);
    color: #334155;
  }

  .charts-actions__button--cancel,
  .charts-actions__button--danger {
    background: #fef2f2;
    border-color: rgba(239, 68, 68, 0.45);
    color: #991b1b;
  }

  .charts-actions__button--unlock {
    background: #fefce8;
    border-color: rgba(202, 138, 4, 0.45);
    color: #854d0e;
  }

  .charts-actions__button--takeover {
    background: #fff7ed;
    border-color: rgba(234, 88, 12, 0.4);
    color: #9a3412;
  }

  .charts-actions__button--primary-route {
    border-color: var(--ui-selected-border);
    background: var(--ui-selected-bg);
    color: #1e3a8a;
    box-shadow: inset 3px 0 0 var(--ui-selected-rail);
  }

  .charts-actions__button .clinical-icon {
    width: 1.2em;
    height: 1.2em;
    margin-inline-end: 0;
  }

  .charts-actions__more {
    border: 1px solid var(--ui-border);
    border-radius: var(--charts-radius-sm);
    background: rgba(248, 250, 252, 0.9);
    padding: var(--charts-space-xs) var(--charts-space-sm);
  }

  .charts-actions__more-summary {
    cursor: pointer;
    font-weight: 700;
    color: #334155;
    list-style: none;
  }

  .charts-actions__more-summary::-webkit-details-marker {
    display: none;
  }

  .charts-actions__more-actions {
    margin-top: var(--charts-space-xs);
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
    gap: var(--charts-space-xs);
  }

  .charts-actions--embedded {
    gap: var(--charts-space-xs);
  }

  .charts-actions--embedded .charts-actions__header {
    gap: var(--charts-space-xs);
  }

  .charts-actions--embedded .charts-actions__header h2 {
    margin: 0 0 var(--charts-space-2xs);
    font-size: 0.95rem;
  }

  .charts-actions--embedded .charts-actions__kicker {
    font-size: 0.7rem;
  }

  .charts-actions--embedded .charts-actions__status {
    margin: 0;
    font-size: 0.84rem;
  }

  .charts-actions--embedded .charts-actions__controls {
    gap: var(--charts-space-xs);
  }

  .charts-actions--embedded .charts-actions__group {
    grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
    gap: 5px;
    padding: 5px;
    background: rgba(248, 250, 252, 0.64);
  }

  .charts-actions--embedded .charts-actions__button {
    padding: 0.48rem 0.58rem;
    font-size: 0.82rem;
    border-radius: var(--ui-radius-sm);
  }

  .charts-actions--embedded .charts-actions__button--send,
  .charts-actions--embedded .charts-actions__button--primary {
    box-shadow: none;
  }

  .charts-do-copy {
    display: grid;
    gap: var(--charts-space-sm);
  }

  .charts-do-copy__section-selector {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-xs);
    padding: var(--charts-space-xs);
    border-radius: 10px;
    border: 1px solid var(--ui-border);
    background: #f8fafc;
  }

  .charts-do-copy__section-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.82rem;
    color: #334155;
  }

  .charts-do-copy__section-list {
    display: grid;
    gap: var(--charts-space-sm);
    max-height: min(52vh, 560px);
    overflow: auto;
    padding-right: var(--charts-space-2xs);
  }

  .charts-do-copy__section-row {
    border: 1px solid var(--ui-border);
    border-radius: 12px;
    padding: var(--charts-space-xs);
    background: #ffffff;
    display: grid;
    gap: var(--charts-space-xs);
  }

  .charts-do-copy__section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--charts-space-sm);
  }

  .charts-do-copy__section-panels {
    display: grid;
    gap: var(--charts-space-xs);
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  .charts-do-copy__panel {
    display: grid;
    gap: var(--charts-space-2xs);
  }

  .charts-do-copy__label {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--charts-space-sm);
    flex-wrap: wrap;
  }

  .charts-do-copy__meta {
    color: #64748b;
    font-size: 0.8rem;
  }

  .charts-do-copy textarea {
    width: 100%;
    border-radius: 12px;
    border: 1px solid var(--ui-border);
    padding: 0.6rem 0.75rem;
    background: #f8fafc;
    color: #0f172a;
    font-size: 0.9rem;
    line-height: 1.35;
    resize: vertical;
  }

  .charts-do-copy__actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-sm);
    justify-content: flex-end;
    margin-top: var(--charts-space-xs);
  }

  .charts-do-copy__primary,
  .charts-do-copy__ghost {
    border-radius: 999px;
    border: 1px solid rgba(59, 130, 246, 0.35);
    background: #eff6ff;
    padding: 0.45rem 0.85rem;
    font-weight: 800;
    cursor: pointer;
    color: #0f172a;
  }

  .charts-do-copy__primary {
    background: linear-gradient(135deg, #2563eb, #4f46e5);
    border-color: transparent;
    color: #ffffff;
  }

  .charts-do-copy__ghost {
    background: #ffffff;
  }

  .charts-do-copy__empty {
    margin: 0;
    color: #64748b;
    font-size: 0.84rem;
  }

  .charts-actions__skeleton {
    background: #f8fafc;
    border: 1px dashed var(--ui-border-strong);
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-md);
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
    animation: chartsPulse 1.4s ease-in-out infinite;
  }

  .charts-actions__skeleton-bar {
    height: 12px;
    background: linear-gradient(90deg, #e2e8f0 0%, #cbd5f5 50%, #e2e8f0 100%);
    border-radius: 999px;
  }

  .charts-actions__skeleton-bar--short {
    width: 55%;
  }

  @keyframes chartsPulse {
    0% {
      opacity: 0.7;
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0.7;
    }
  }

  .charts-actions__toast {
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-sm) var(--charts-space-md);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--charts-space-sm);
  }

  .charts-actions__toast p {
    margin: var(--charts-space-2xs) 0 0;
  }

  .charts-actions__toast--success {
    background: #ecfdf3;
    border: 1px solid #22c55e;
    color: #065f46;
  }

  .charts-actions__toast--warning {
    background: #fffbeb;
    border: 1px solid #fbbf24;
    color: #92400e;
  }

  .charts-actions__toast--error {
    background: #fef2f2;
    border: 1px solid #ef4444;
    color: #991b1b;
  }

  .charts-actions__conflict {
    background: #fffbeb;
    border: 1px solid rgba(245, 158, 11, 0.6);
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-md);
    color: #92400e;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .charts-actions__conflict-title {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--charts-space-md);
  }

  .charts-actions__conflict-meta {
    font-size: 0.85rem;
    color: rgba(146, 64, 14, 0.85);
  }

  .charts-actions__conflict-message {
    margin: 0;
    line-height: 1.5;
    font-weight: 600;
  }

  .charts-actions__conflict-actions {
    display: flex;
    gap: var(--charts-space-sm);
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .charts-actions__toast--info {
    background: #eff6ff;
    border: 1px solid #60a5fa;
    color: #1d4ed8;
  }

  .charts-actions__retry {
    border: none;
    background: #1d4ed8;
    color: #fff;
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-xs) var(--charts-space-sm);
    cursor: pointer;
  }

  .charts-actions__guard-summary {
    background: #fff7ed;
    border: 1px solid rgba(251, 146, 60, 0.5);
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-sm) var(--charts-space-md);
    color: #9a3412;
    display: grid;
    gap: var(--charts-space-xs);
    font-weight: 500;
    line-height: 1.6;
  }

  .charts-actions__guard-summary ul {
    margin: 0;
    padding-left: 1.2rem;
    display: grid;
    gap: var(--charts-space-2xs);
    font-weight: 500;
    line-height: 1.6;
  }

  .charts-actions__guard {
    margin: 0;
    color: #b45309;
    font-weight: 700;
    border: 1px solid rgba(251, 146, 60, 0.5);
    background: rgba(255, 247, 237, 0.88);
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-sm);
  }

  .charts-actions__guard-title {
    display: block;
    margin-bottom: var(--charts-space-xs);
  }

  .charts-actions__guard-list {
    margin: 0;
    padding-left: 1rem;
    display: grid;
    gap: 2px;
    font-size: 0.82rem;
    line-height: 1.4;
  }

  .charts-actions__send-confirm {
    display: grid;
    gap: var(--charts-space-sm);
  }

  .charts-actions__send-confirm-section {
    border: 1px solid var(--ui-border);
    border-radius: var(--charts-radius-sm);
    background: #f8fafc;
    padding: var(--charts-space-sm);
    display: grid;
    gap: var(--charts-space-xs);
  }

  .charts-actions__send-confirm-section h3 {
    margin: 0;
    font-size: 0.92rem;
    color: #334155;
  }

  .charts-actions__send-confirm-identity {
    margin: 0;
    color: #0f172a;
  }

  .charts-actions__send-confirm-list {
    margin: 0;
    display: grid;
    gap: 4px;
  }

  .charts-actions__send-confirm-list > div {
    display: grid;
    grid-template-columns: minmax(90px, 120px) 1fr;
    gap: var(--charts-space-sm);
    align-items: baseline;
    font-size: 0.84rem;
  }

  .charts-actions__send-confirm-list dt {
    margin: 0;
    color: #64748b;
    font-weight: 700;
  }

  .charts-actions__send-confirm-list dd {
    margin: 0;
    color: #0f172a;
    font-variant-numeric: tabular-nums;
  }

  .charts-actions__print-dialog {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .charts-actions__print-field {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-2xs);
    font-size: 0.9rem;
    color: #0f172a;
  }

  .charts-actions__print-field input,
  .charts-actions__print-field select {
    border-radius: 10px;
    border: 1px solid var(--ui-border-strong);
    padding: 0.45rem 0.6rem;
    font-size: 0.95rem;
  }

  .charts-actions__print-note {
    margin: 0;
    font-size: 0.85rem;
    color: #475569;
  }

  .charts-actions__print-note--error {
    color: #b91c1c;
  }

  .charts-actions__print-errors {
    background: #fff7ed;
    border: 1px solid rgba(251, 146, 60, 0.6);
    border-radius: 10px;
    padding: var(--charts-space-xs) var(--charts-space-sm);
    color: #9a3412;
    display: grid;
    gap: 0.2rem;
  }

  .charts-actions__print-errors p {
    margin: 0;
  }

  .charts-actions__print-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--charts-space-sm);
  }

  .auth-service-controls {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .auth-service-controls__description {
    margin: 0;
    color: #475569;
    line-height: 1.5;
  }

  .auth-service-controls__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--charts-space-sm);
  }

  .auth-service-controls__toggle {
    padding: var(--charts-space-sm);
    border-radius: var(--charts-radius-sm);
    border: 1px solid rgba(37, 99, 235, 0.35);
    background: #eff6ff;
    color: #0f172a;
    font-weight: 700;
    cursor: pointer;
  }

  .auth-service-controls__select {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-2xs);
    font-size: 0.9rem;
    color: #475569;
  }

  .auth-service-controls__select input,
  .auth-service-controls__select select {
    border-radius: var(--charts-radius-sm);
    border: 1px solid #cbd5f5;
    padding: var(--charts-space-sm) var(--charts-space-md);
    font-family: inherit;
  }

  .soap-note {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-md);
    --soap-right-drawer-reserved: min(640px, 56vw);
    --soap-right-drawer-minimized-handle: 56px;
    --soap-right-drawer-resize-handle-size: 40px;
  }

  .revision-drawer {
    position: absolute;
    top: 0;
    right: 0;
    height: 100%;
    width: min(420px, 92vw);
    background: #ffffff;
    border-left: 1px solid var(--ui-border);
    box-shadow: -12px 0 30px rgba(15, 23, 42, 0.12);
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-md);
    overflow: auto;
    transform: translateX(110%);
    opacity: 0;
    pointer-events: none;
    transition:
      transform 160ms ease,
      opacity 160ms ease;
    z-index: 10;
  }

  .revision-drawer[data-open='true'] {
    transform: translateX(0);
    opacity: 1;
    pointer-events: auto;
  }

  .revision-drawer__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--charts-space-md);
  }

  .revision-drawer__eyebrow {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #64748b;
  }

  .revision-drawer__title {
    margin: var(--charts-space-xs) 0 0;
    font-size: 1.1rem;
    color: #0f172a;
  }

  .revision-drawer__desc {
    margin: var(--charts-space-xs) 0 0;
    color: #475569;
    font-size: 0.9rem;
  }

  .revision-drawer__close {
    border: 0;
    background: transparent;
    font-size: 1.2rem;
    line-height: 1;
    cursor: pointer;
    color: #475569;
    padding: var(--charts-space-xs);
  }

  .revision-drawer__meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-sm);
    margin-top: var(--charts-space-sm);
    padding: var(--charts-space-xs) var(--charts-space-sm);
    border-radius: 999px;
    background: rgba(226, 232, 240, 0.6);
    color: #334155;
    font-size: 0.85rem;
  }

  .revision-drawer__empty {
    margin: var(--charts-space-md) 0 0;
    color: #64748b;
  }

  .revision-drawer__status {
    margin: var(--charts-space-sm) 0 0;
    padding: var(--charts-space-xs) var(--charts-space-sm);
    border-radius: var(--charts-radius-sm);
    font-size: 0.9rem;
    border: 1px solid var(--ui-border);
  }

  .revision-drawer__status--info {
    background: rgba(219, 234, 254, 0.55);
    color: #1e3a8a;
  }

  .revision-drawer__status--success {
    background: rgba(220, 252, 231, 0.55);
    color: #14532d;
  }

  .revision-drawer__status--warning {
    background: rgba(254, 249, 195, 0.65);
    color: #713f12;
  }

  .revision-drawer__status--error {
    background: rgba(254, 226, 226, 0.7);
    color: #7f1d1d;
  }

  .revision-drawer__refresh {
    margin-left: var(--charts-space-xs);
    border-radius: 999px;
    border: 1px solid var(--ui-border-strong);
    background: #ffffff;
    padding: 2px 8px;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .revision-drawer__refresh:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .revision-drawer__list {
    list-style: none;
    padding: 0;
    margin: var(--charts-space-md) 0 0;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .revision-drawer__item {
    border: 1px solid var(--ui-border);
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-sm);
    background: rgba(248, 250, 252, 0.7);
  }

  .revision-drawer__item-head {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .revision-drawer__rev {
    font-size: 0.9rem;
    color: #0f172a;
  }

  .revision-drawer__parent {
    font-size: 0.85rem;
    color: #64748b;
  }

  .revision-drawer__item-meta,
  .revision-drawer__item-summary,
  .revision-drawer__item-changes,
  .revision-drawer__item-delta {
    margin-top: var(--charts-space-xs);
    font-size: 0.85rem;
    color: #334155;
  }

  .revision-drawer__actions {
    display: flex;
    gap: var(--charts-space-sm);
    margin-top: var(--charts-space-sm);
    flex-wrap: wrap;
  }

  .revision-drawer__actions button {
    border-radius: 999px;
    border: 1px solid var(--ui-border-strong);
    background: #ffffff;
    padding: 4px 10px;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .revision-drawer__actions button:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }

  .revision-drawer__action--revise {
    border-color: rgba(59, 130, 246, 0.5);
    background: rgba(219, 234, 254, 0.45);
    color: #1d4ed8;
  }

  .revision-drawer__action--restore {
    border-color: rgba(16, 185, 129, 0.5);
    background: rgba(209, 250, 229, 0.5);
    color: #047857;
  }

  .revision-drawer__action--conflict {
    border-color: rgba(245, 158, 11, 0.65);
    background: rgba(254, 243, 199, 0.7);
    color: #b45309;
  }

  .soap-note__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--charts-space-md);
    flex-wrap: wrap;
    padding-bottom: var(--charts-space-sm);
    border-bottom: 1px solid var(--ui-border-subtle);
  }

  .soap-note__header-main {
    display: grid;
    gap: var(--charts-space-2xs);
    min-width: 0;
  }

  .soap-note__eyebrow {
    margin: 0;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #64748b;
  }

  .soap-note__title-row {
    display: flex;
    align-items: center;
    gap: var(--charts-space-sm);
    flex-wrap: wrap;
  }

  .soap-note__header h2 {
    margin: 0;
    font-size: 1.4rem;
    color: #0f172a;
  }

  .soap-note__subtitle {
    margin: var(--charts-space-xs) 0 0;
    color: #475569;
    font-size: 0.9rem;
  }

  .soap-note__subtitle--meta {
    margin-top: var(--charts-space-2xs);
    font-size: 0.8rem;
    color: #64748b;
  }

  .soap-note__sync {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--charts-space-xs);
  }

  .soap-note__sync-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border-radius: var(--ui-radius-md);
    border: 1px solid var(--ui-border-subtle);
    background: rgba(248, 250, 252, 0.92);
    color: #475569;
    padding: 0.35rem 0.7rem;
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.02em;
  }

  .soap-note__sync-badge--synced {
    border-color: rgba(34, 197, 94, 0.35);
    background: rgba(220, 252, 231, 0.65);
    color: #166534;
  }

  .soap-note__sync-badge--local {
    border-color: rgba(245, 158, 11, 0.45);
    background: rgba(255, 247, 237, 0.85);
    color: #9a3412;
  }

  .soap-note__sync-badge--error {
    border-color: rgba(239, 68, 68, 0.45);
    background: rgba(254, 242, 242, 0.88);
    color: #991b1b;
  }

  .soap-note__sync-meta {
    font-size: 0.76rem;
    color: #64748b;
    font-variant-numeric: tabular-nums;
  }

  .soap-note__actions {
    display: flex;
    gap: var(--charts-space-sm);
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
  }

  .soap-note__primary,
  .soap-note__ghost {
    border-radius: var(--ui-radius-md);
    border: 1px solid var(--ui-border-subtle);
    padding: var(--charts-space-xs) var(--charts-space-md);
    font-weight: 700;
    cursor: pointer;
  }

  .soap-note__primary {
    background: #1d4ed8;
    color: #ffffff;
    border-color: transparent;
  }

  .soap-note__ghost {
    background: rgba(248, 250, 252, 0.92);
    color: #334155;
  }

  .soap-note__primary:disabled,
  .soap-note__ghost:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .soap-note__menu {
    position: relative;
  }

  .soap-note__menu > summary {
    list-style: none;
  }

  .soap-note__menu > summary::-webkit-details-marker {
    display: none;
  }

  .soap-note__menu-items {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    z-index: 4;
    min-width: 132px;
    display: grid;
    gap: var(--charts-space-2xs);
    border: 1px solid var(--ui-border);
    border-radius: var(--charts-radius-sm);
    background: #ffffff;
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.14);
    padding: var(--charts-space-xs);
  }

  .soap-note__guard {
    margin: 0;
    color: #b45309;
    font-size: 0.9rem;
  }

  .soap-note__feedback {
    margin: 0;
    color: #2563eb;
    font-size: 0.9rem;
  }

  .soap-note__body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(180px, 19vw) 72px;
    gap: var(--charts-space-md);
    align-items: start;
    padding: 0.15rem;
    border-radius: var(--ui-radius-lg);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(239, 246, 255, 0.34));
  }

  @media (min-width: 1024px) {
    .soap-note[data-right-drawer-open='1'][data-right-drawer-mode='dock'] .soap-note__body,
    .soap-note[data-right-drawer-open='true'][data-right-drawer-mode='dock'] .soap-note__body {
      padding-right: var(--soap-right-drawer-reserved);
      grid-template-columns: minmax(0, 1fr);
    }

    .soap-note[data-right-drawer-open='1'][data-right-drawer-mode='dock'] .soap-note__center-panel-only,
    .soap-note[data-right-drawer-open='1'][data-right-drawer-mode='dock'] .soap-note__right-dock-area,
    .soap-note[data-right-drawer-open='true'][data-right-drawer-mode='dock'] .soap-note__center-panel-only,
    .soap-note[data-right-drawer-open='true'][data-right-drawer-mode='dock'] .soap-note__right-dock-area {
      display: none;
    }
  }

  .soap-note__editor {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-md);
  }

  .soap-note__center-panel-only {
    grid-column: 2 / 4;
    min-width: 0;
  }

  .soap-note__right-dock {
    grid-column: 3;
    width: 72px;
    min-width: 72px;
    align-self: start;
    position: sticky;
    top: var(--charts-space-sm);
    max-height: calc(100vh - (var(--charts-space-sm) * 2));
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
    z-index: 3;
  }

  .soap-note__right-dock-label {
    margin: 0;
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #64748b;
    text-align: center;
  }

  .soap-note__right-dock-scroll {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
    min-height: 0;
    max-height: min(72vh, 680px);
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    padding-right: 2px;
    scrollbar-width: thin;
  }

  .soap-note__right-dock-button {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.2rem;
    min-width: 36px;
    min-height: 52px;
    border-radius: var(--ui-radius-md);
    border: 1px solid var(--ui-border-subtle);
    background: rgba(255, 255, 255, 0.98);
    color: #1e293b;
    font-size: 0.74rem;
    font-weight: 800;
    line-height: 1.2;
    letter-spacing: 0.04em;
    cursor: pointer;
    padding: var(--charts-space-xs);
    transition: background 120ms ease, border-color 120ms ease, color 120ms ease, box-shadow 120ms ease;
  }

  .soap-note__right-dock-button:hover {
    background: rgba(239, 246, 255, 0.9);
    border-color: var(--ui-selected-border);
    color: #1d4ed8;
  }

  .soap-note__right-dock-button[data-active='true'] {
    background: var(--ui-selected-bg);
    border-color: var(--ui-selected-border);
    color: #1e40af;
    box-shadow: inset 3px 0 0 var(--ui-selected-rail);
  }

  .soap-note__right-dock-button-text {
    display: block;
    text-align: center;
  }

  .soap-note__right-dock-button .clinical-icon {
    width: 1.7rem;
    height: 1.7rem;
    margin-inline-end: 0;
  }

  .soap-note__right-dock-button:focus-visible {
    outline: 2px solid rgba(37, 99, 235, 0.52);
    outline-offset: 2px;
  }

  .soap-note__right-dock-area {
    grid-column: 3;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
    align-self: start;
    position: sticky;
    top: var(--charts-space-sm);
    min-width: 72px;
    min-height: 0;
    max-height: calc(100vh - (var(--charts-space-sm) * 2));
    overflow: hidden;
  }

  .soap-note__right-drawer {
    --soap-right-drawer-width: var(--soap-right-drawer-reserved);
    position: fixed;
    top: clamp(72px, 8vh, 126px);
    right: clamp(8px, 1.7vw, 24px);
    bottom: clamp(10px, 1.8vh, 24px);
    width: var(--soap-right-drawer-width);
    max-width: min(var(--soap-right-drawer-width), calc(100vw - 92px));
    border-radius: var(--charts-radius-lg);
    border: 1px solid var(--ui-border);
    background: #ffffff;
    box-shadow: var(--ui-shadow-overlay);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    z-index: 52;
    transform: translateX(16px);
    opacity: 0;
    pointer-events: none;
    transition:
      transform 180ms ease,
      opacity 180ms ease;
    will-change: transform, opacity;
  }

  .soap-note__right-drawer[data-open='true'] {
    transform: translateX(0);
    opacity: 1;
    pointer-events: auto;
  }

  .soap-note__right-drawer[data-mode='dock'] {
    right: max(8px, env(safe-area-inset-right));
  }

  .soap-note__right-drawer[data-open='true'][data-minimized='true'] {
    transform: translateX(0);
    opacity: 1;
    pointer-events: auto;
  }

  .soap-note__right-drawer-restore-handle {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: var(--soap-right-drawer-minimized-handle, 56px);
    border: 0;
    border-right: 1px solid var(--ui-border);
    background: linear-gradient(180deg, rgba(248, 250, 252, 0.98), rgba(241, 245, 249, 0.94));
    cursor: pointer;
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 3;
    transition: background-color 120ms ease;
  }

  .soap-note__right-drawer-restore-handle:hover {
    background: linear-gradient(180deg, rgba(241, 245, 249, 0.98), rgba(226, 232, 240, 0.94));
  }

  .soap-note__right-drawer-restore-handle:focus-visible {
    outline: 2px solid rgba(37, 99, 235, 0.45);
    outline-offset: -2px;
  }

  .soap-note__right-drawer-restore-icon {
    position: relative;
    width: 12px;
    height: 18px;
    display: inline-block;
  }

  .soap-note__right-drawer-restore-icon::before,
  .soap-note__right-drawer-restore-icon::after {
    content: '';
    position: absolute;
    width: 6px;
    height: 6px;
    border-left: 2px solid rgba(71, 85, 105, 0.9);
    border-bottom: 2px solid rgba(71, 85, 105, 0.9);
    transform: rotate(45deg);
    left: 2px;
  }

  .soap-note__right-drawer-restore-icon::before {
    top: 2px;
  }

  .soap-note__right-drawer-restore-icon::after {
    top: 9px;
  }

  .soap-note__right-drawer[data-minimized='true'] .soap-note__right-drawer-restore-handle {
    display: flex;
  }

  .soap-note__right-drawer[data-minimized='true'] .soap-note__right-drawer-resize-handle {
    opacity: 0;
    pointer-events: none;
  }

  .soap-note__right-drawer[data-minimized='true'] .soap-note__right-drawer-content {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    user-select: none;
  }

  .soap-note__right-drawer-resize-handle,
  .soap-note__right-drawer [data-role='right-drawer-resize-handle'] {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: var(--soap-right-drawer-resize-handle-size, 40px);
    cursor: col-resize;
    touch-action: none;
    z-index: 4;
    opacity: 1;
    border: 0;
    padding: 0;
    background: transparent;
    transition:
      opacity 120ms ease,
      background-color 120ms ease,
      box-shadow 120ms ease;
  }

  .soap-note__right-drawer-resize-handle::before,
  .soap-note__right-drawer [data-role='right-drawer-resize-handle']::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 0;
    opacity: 0;
    pointer-events: none;
    background: linear-gradient(
      90deg,
      rgba(71, 85, 105, 0.46) 0%,
      rgba(100, 116, 139, 0.28) 22%,
      rgba(148, 163, 184, 0.14) 56%,
      rgba(148, 163, 184, 0.04) 100%
    );
    transition:
      width 120ms ease,
      opacity 120ms ease;
  }

  .soap-note__right-drawer-resize-handle:hover,
  .soap-note__right-drawer [data-role='right-drawer-resize-handle']:hover,
  .soap-note__right-drawer-resize-handle:focus-visible,
  .soap-note__right-drawer [data-role='right-drawer-resize-handle']:focus-visible {
    opacity: 1;
    background: transparent;
    box-shadow: none;
  }

  .soap-note__right-drawer-resize-handle:hover::before,
  .soap-note__right-drawer [data-role='right-drawer-resize-handle']:hover::before,
  .soap-note__right-drawer-resize-handle:focus-visible::before,
  .soap-note__right-drawer [data-role='right-drawer-resize-handle']:focus-visible::before {
    width: calc(var(--soap-right-drawer-resize-handle-size, 40px) * 0.6667);
    opacity: 1;
  }

  .soap-note__right-drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--charts-space-sm);
    padding: var(--charts-space-sm) var(--charts-space-md);
    border-bottom: 1px solid var(--ui-border);
    background: linear-gradient(180deg, rgba(248, 250, 252, 0.92), #ffffff 70%);
  }

  .soap-note__right-drawer-header strong {
    min-width: 0;
    color: #0f172a;
  }

  .soap-note__right-drawer-mode-switch {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px;
    border-radius: 999px;
    border: 1px solid var(--ui-border);
    background: rgba(248, 250, 252, 0.9);
  }

  .soap-note__right-drawer-header-controls,
  .soap-note__right-drawer-header [data-role='drawer-controls'] {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: var(--charts-space-2xs);
  }

  .soap-note__right-drawer-category-tabs,
  .soap-note__right-drawer-header [data-role='drawer-category-tabs'] {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px;
    border-radius: 999px;
    border: 1px solid var(--ui-border);
    background: rgba(248, 250, 252, 0.9);
  }

  .soap-note__right-drawer-category-tab,
  .soap-note__right-drawer-header [data-role='drawer-category-tab'],
  .soap-note__right-drawer-header [role='tab'][data-drawer-category] {
    border: 1px solid rgba(100, 116, 139, 0.42);
    background: #ffffff;
    color: #334155;
    border-radius: 999px;
    min-height: 30px;
    padding: 0.2rem 0.58rem;
    font-size: 0.74rem;
    font-weight: 800;
    line-height: 1.2;
    white-space: nowrap;
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
  }

  .soap-note__right-drawer-category-tab[data-active='true'],
  .soap-note__right-drawer-header [data-role='drawer-category-tab'][data-active='true'],
  .soap-note__right-drawer-header [role='tab'][data-drawer-category][aria-selected='true'] {
    border-color: rgba(29, 78, 216, 0.65);
    background: rgba(219, 234, 254, 0.92);
    color: #1e40af;
  }

  .soap-note__right-drawer-category-tab:focus-visible,
  .soap-note__right-drawer-header [data-role='drawer-category-tab']:focus-visible,
  .soap-note__right-drawer-header [role='tab'][data-drawer-category]:focus-visible {
    outline: 2px solid rgba(37, 99, 235, 0.56);
    outline-offset: 2px;
  }

  .soap-note__right-drawer-header-control,
  .soap-note__right-drawer-header [data-role='drawer-control'],
  .soap-note__right-drawer-peek-button,
  .soap-note__right-drawer-header button[data-action='peek'] {
    border: 1px solid rgba(100, 116, 139, 0.5);
    background: #ffffff;
    color: #1e293b;
    border-radius: 999px;
    min-height: 32px;
    padding: 0.2rem 0.62rem;
    font-size: 0.74rem;
    font-weight: 800;
    cursor: pointer;
    white-space: nowrap;
    transition: background 120ms ease, border-color 120ms ease;
  }

  .soap-note__right-drawer-header-control:hover,
  .soap-note__right-drawer-header [data-role='drawer-control']:hover,
  .soap-note__right-drawer-peek-button:hover,
  .soap-note__right-drawer-header button[data-action='peek']:hover {
    background: #eff6ff;
    border-color: rgba(37, 99, 235, 0.52);
  }

  .soap-note__right-drawer-header-control:focus-visible,
  .soap-note__right-drawer-header [data-role='drawer-control']:focus-visible,
  .soap-note__right-drawer-peek-button:focus-visible,
  .soap-note__right-drawer-header button[data-action='peek']:focus-visible {
    outline: 2px solid rgba(37, 99, 235, 0.56);
    outline-offset: 2px;
  }

  .soap-note__right-drawer-mode-switch .soap-note__right-drawer-header-control[data-active='true'] {
    border-color: rgba(29, 78, 216, 0.64);
    background: rgba(219, 234, 254, 0.95);
    color: #1e40af;
  }

  .soap-note__right-drawer-tool-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: var(--charts-space-xs) var(--charts-space-md);
    border-bottom: 1px solid var(--ui-border-subtle);
    background: rgba(248, 250, 252, 0.58);
  }

  .soap-note__right-drawer-tool-tabs .soap-note__right-drawer-category-tab {
    min-height: 32px;
  }

  .soap-note__right-drawer-content {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;
    position: relative;
    padding: var(--charts-space-sm) var(--charts-space-md) var(--charts-space-md);
  }

  .soap-note__right-drawer-panel {
    display: none;
    min-height: 0;
    opacity: 0;
    transform: translateY(14px);
    pointer-events: none;
  }

  .soap-note__right-drawer-panel[data-active='true'] {
    display: block;
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }

  .soap-note__right-drawer-switch {
    min-height: 0;
    animation: soapRightDrawerContentSwitch 180ms ease;
  }

  .soap-note__right-drawer-order-layout {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
    align-items: stretch;
    min-height: 0;
  }

  .soap-note__right-drawer[data-order-layout='split'] .soap-note__right-drawer-order-layout {
    flex-direction: row;
    gap: var(--charts-space-md);
    align-items: stretch;
  }

  .soap-note__right-drawer-order-editor {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .soap-note__right-drawer[data-order-layout='split'] .soap-note__right-drawer-order-editor {
    flex: 0 0 60%;
  }

  .soap-note__right-drawer-order-preview {
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
    width: 100%;
    padding-top: var(--charts-space-xs);
    border-top: 1px solid var(--ui-border-subtle);
  }

  .soap-note__right-drawer[data-order-layout='split'] .soap-note__right-drawer-order-preview {
    flex: 0 0 40%;
    max-width: 40%;
    padding-top: 0;
    padding-left: var(--charts-space-sm);
    border-top: 0;
    border-left: 1px solid var(--ui-border-subtle);
  }

  .soap-note__right-drawer-order-preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--charts-space-xs);
  }

  .soap-note__right-drawer-order-preview-header strong {
    color: #0f172a;
    font-size: 0.82rem;
  }

  .soap-note__right-drawer-order-preview-list {
    min-height: 0;
    max-height: min(48vh, 540px);
    overflow: auto;
    padding-right: 2px;
    display: grid;
    gap: var(--charts-space-sm);
  }

  .soap-note__right-drawer-order-preview-item {
    border: 1px solid rgba(100, 116, 139, 0.45);
    border-radius: 0.7rem;
    background: #f8fafc;
    padding: var(--charts-space-xs) var(--charts-space-sm);
  }

  .soap-note__right-drawer-order-preview-item[data-active='true'] {
    border-color: rgba(29, 78, 216, 0.62);
    box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.18);
  }

  .soap-note__right-drawer-order-preview-item-header {
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    gap: var(--charts-space-xs);
  }

  .soap-note__right-drawer-order-preview-item-header > div {
    flex: 1;
    min-width: 0;
  }

  .soap-note__right-drawer-order-preview-item-body {
    padding-top: var(--charts-space-xs);
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-2xs);
    color: #1e293b;
  }

  .soap-note__right-drawer-order-preview-item-title {
    margin: 0;
    font-size: 0.76rem;
    color: #334155;
    font-weight: 800;
  }

  .soap-note__right-drawer-order-preview-item-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-2xs);
  }

  .soap-note__right-drawer-order-preview-item-line {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.78rem;
  }

  .soap-note__right-drawer-order-preview-item-primary {
    color: #0f172a;
    font-weight: 700;
  }

  .soap-note__right-drawer-order-preview-item-note {
    color: #1d4ed8;
    font-size: 0.74rem;
    font-weight: 700;
  }

  .soap-note__right-drawer-order-preview-item-secondary {
    color: #334155;
    font-size: 0.74rem;
  }

  .soap-note__right-drawer-order-preview-item-more,
  .soap-note__right-drawer-order-preview-item-detail {
    margin: 0;
    color: #334155;
    font-size: 0.74rem;
    line-height: 1.4;
  }

  .soap-note__right-drawer-order-preview-item-warning {
    margin: 0;
    color: #b91c1c;
    font-size: 0.74rem;
    line-height: 1.4;
    font-weight: 700;
  }

  .soap-note__right-drawer-panel--center {
    grid-column: 2;
    min-width: 0;
  }

  @keyframes soapRightDrawerContentSwitch {
    from {
      opacity: 0;
      transform: translateY(14px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .soap-note__history-mode {
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border);
    background: #f8fafc;
    padding: var(--charts-space-md);
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .soap-note__history-hint,
  .soap-note__history-empty,
  .soap-note__history-nochange {
    margin: 0;
    color: #64748b;
    font-size: 0.85rem;
    line-height: 1.4;
  }

  .soap-note__history-timeline {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .soap-note__history-step {
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border-subtle);
    background: #ffffff;
    padding: var(--charts-space-sm);
  }

  .soap-note__history-step-head {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-xs) var(--charts-space-sm);
    align-items: baseline;
    color: #475569;
    font-size: 0.75rem;
  }

  .soap-note__history-step-head strong {
    color: #0f172a;
    font-size: 0.85rem;
  }

  .soap-note__history-diffs {
    margin-top: var(--charts-space-xs);
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .soap-note__history-diff {
    border-top: 1px dashed var(--ui-border);
    padding-top: var(--charts-space-xs);
  }

  .soap-note__history-diff-title {
    font-weight: 900;
    font-size: 0.8rem;
    color: #0f172a;
  }

  .soap-note__history-lines {
    margin: var(--charts-space-2xs) 0 0;
    padding-left: 1.15rem;
    font-size: 0.82rem;
    line-height: 1.35;
    color: #0f172a;
  }

  .soap-note__history-lines--removed {
    color: #b91c1c;
  }

  .soap-note__history-lines--added {
    color: #166534;
  }

  .soap-note__history-added {
    font-weight: 700;
  }

  .soap-note__grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--charts-space-md);
  }

  .soap-note__section {
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border-subtle);
    background: rgba(248, 250, 252, 0.84);
    padding: var(--charts-space-md);
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
    box-shadow: var(--charts-shadow-none);
  }

  .soap-note__section-header {
    display: grid;
    gap: var(--charts-space-xs);
  }

  .soap-note__section-title-row {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    min-width: 0;
  }

  .soap-note__section-code {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.9rem;
    min-width: 1.9rem;
    min-height: 1.9rem;
    border-radius: var(--ui-radius-sm);
    border: 1px solid rgba(37, 99, 235, 0.16);
    background: rgba(239, 246, 255, 0.88);
    color: #1d4ed8;
    font-size: 0.82rem;
    font-weight: 800;
  }

  .soap-note__section-header label {
    color: #0f172a;
    font-size: 0.96rem;
    font-weight: 800;
  }

  .soap-note__section-support {
    margin: 0;
    color: #475569;
    font-size: 0.82rem;
    line-height: 1.45;
  }

  .soap-note__section-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--charts-space-xs);
  }

  .soap-note__section-header span {
    color: #64748b;
    font-size: 0.8rem;
  }

  .soap-note__section textarea {
    border-radius: var(--ui-radius-md);
    border: 1px solid var(--ui-border);
    padding: var(--charts-space-sm) var(--charts-space-sm);
    font-family: inherit;
    resize: vertical;
    background: #ffffff;
    color: #0f172a;
    line-height: 1.55;
  }

  .soap-note__section[data-section='free'] {
    grid-column: 1 / -1;
  }

  .soap-note__section[data-section='free'] textarea {
    min-height: clamp(8rem, 22vh, 14rem);
  }

  .soap-note__section:not([data-section='free']) textarea {
    min-height: clamp(4.75rem, 10vh, 8rem);
  }

  .soap-note__section-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-sm);
    align-items: center;
  }

  .soap-note__section-actions label {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-2xs);
    font-size: 0.85rem;
    color: #475569;
  }

  .soap-note__section-actions select {
    border-radius: var(--charts-radius-sm);
    border: 1px solid #cbd5f5;
    padding: var(--charts-space-xs) var(--charts-space-xs);
    font-family: inherit;
  }

  .soap-note__template-dialog-fields {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--charts-space-sm);
    margin-bottom: var(--charts-space-sm);
  }

  .soap-note__template-dialog-fields label {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-2xs);
    font-size: 0.85rem;
    color: #475569;
  }

  .soap-note__template-dialog-fields select {
    border-radius: var(--charts-radius-sm);
    border: 1px solid #cbd5f5;
    padding: var(--charts-space-xs) var(--charts-space-xs);
    font-family: inherit;
  }

  .soap-note__template-dialog-actions {
    margin-top: var(--charts-space-sm);
  }

  .soap-note__template-tag {
    font-size: 0.8rem;
    color: #1d4ed8;
    background: #e0e7ff;
    border-radius: 999px;
    padding: var(--charts-space-2xs) var(--charts-space-xs);
  }

  .soap-note__history {
    border-top: 1px solid var(--ui-border-subtle);
    padding-top: var(--charts-space-sm);
  }

  .soap-note__history-summary {
    cursor: pointer;
    font-weight: 800;
    color: #1d4ed8;
    font-size: 0.85rem;
  }

  .soap-note__history-summary::-webkit-details-marker {
    display: none;
  }

  .soap-note__history-list {
    margin-top: var(--charts-space-sm);
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
    max-height: 240px;
    overflow-y: auto;
    padding-right: var(--charts-space-xs);
  }

  .soap-note__history-card {
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border-subtle);
    background: #ffffff;
    padding: var(--charts-space-sm);
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-2xs);
  }

  .soap-note__history-meta {
    font-size: 0.75rem;
    color: #64748b;
  }

  .soap-note__history-body {
    white-space: pre-wrap;
    font-size: 0.85rem;
    color: #0f172a;
  }

  .soap-note__subjectives-fold {
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border);
    background: #f8fafc;
    overflow: hidden;
  }

  .soap-note__subjectives-summary {
    cursor: pointer;
    font-weight: 800;
    color: #0f172a;
    padding: var(--charts-space-sm) var(--charts-space-md);
    display: flex;
    align-items: center;
    justify-content: space-between;
    list-style: none;
  }

  .soap-note__subjectives-summary::-webkit-details-marker {
    display: none;
  }

  .soap-note__subjectives-summary::after {
    content: '>';
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    color: #64748b;
    transition: transform 120ms ease;
  }

  .soap-note__subjectives-fold[open] > .soap-note__subjectives-summary::after {
    transform: rotate(90deg);
  }

  .soap-note__subjectives-content {
    padding: var(--charts-space-sm) var(--charts-space-md);
    border-top: 1px solid var(--ui-border-subtle);
  }

  .soap-note__paper {
    position: sticky;
    top: 1rem;
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border);
    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    padding: var(--charts-space-sm);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.6);
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
    min-width: 0;
    max-height: none;
    overflow: visible;
  }

  .order-dock {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
    min-width: 0;
  }

  .order-dock__header {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 0;
  }

  .order-dock__header strong {
    display: block;
    font-size: 0.95rem;
    color: #0f172a;
  }

  .order-dock__meta {
    display: block;
    font-size: 0.75rem;
    color: #64748b;
  }

  .order-dock__context {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    border-radius: var(--charts-radius-sm);
    border: 1px solid rgba(59, 130, 246, 0.2);
    background: rgba(239, 246, 255, 0.55);
    padding: 0.28rem 0.5rem;
  }

  .order-dock__context-mode {
    border-radius: 999px;
    border: 1px solid rgba(59, 130, 246, 0.28);
    background: rgba(255, 255, 255, 0.9);
    color: #1d4ed8;
    font-size: 0.7rem;
    font-weight: 900;
    padding: 0.1rem 0.45rem;
  }

  .order-dock__context-current {
    font-size: 0.75rem;
    color: #1e293b;
    font-weight: 800;
  }

  .order-dock__search {
    display: grid;
    gap: var(--charts-space-2xs);
  }

  .order-dock__search-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: var(--charts-space-xs);
    align-items: center;
  }

  .order-dock__search-row label {
    font-size: 0.78rem;
    font-weight: 700;
    color: #334155;
    white-space: nowrap;
  }

  .order-dock__search-row input,
  .order-dock__search-row select {
    border-radius: 999px;
    border: 1px solid var(--ui-border-strong);
    padding: 0.25rem 0.65rem;
    font-size: 0.78rem;
    background: #ffffff;
    color: #0f172a;
  }

  .order-dock__search-results {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--charts-space-2xs);
  }

  .order-dock__search-result {
    width: 100%;
    text-align: left;
    border: 1px solid var(--ui-border);
    border-radius: var(--charts-radius-sm);
    background: #ffffff;
    padding: var(--charts-space-xs) var(--charts-space-sm);
    display: flex;
    flex-direction: column;
    gap: 2px;
    cursor: pointer;
    color: #0f172a;
  }

  .order-dock__search-result span {
    font-size: 0.72rem;
    color: #64748b;
  }

  .order-dock__search-empty {
    margin: 0;
    font-size: 0.75rem;
    color: #64748b;
  }

  .order-dock--editing {
    gap: var(--charts-space-md);
  }

  .order-dock__edit-header {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--charts-space-sm);
    padding-bottom: var(--charts-space-xs);
    border-bottom: 1px solid var(--ui-border-subtle);
  }

  .order-dock__edit-title {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .order-dock__edit-title strong {
    font-size: 0.95rem;
    color: #0f172a;
  }

  .order-dock__edit-back,
  .order-dock__edit-close {
    border-radius: 999px;
    border: 1px solid var(--ui-border);
    background: #ffffff;
    color: #0f172a;
    cursor: pointer;
    font-weight: 900;
    padding: 0.3rem 0.65rem;
    font-size: 0.78rem;
    white-space: nowrap;
  }

  .order-dock__editor.order-dock__editor--full {
    border-top: none;
    padding-top: 0;
  }

  .order-dock__today-fold {
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border);
    background: #f8fafc;
    overflow: hidden;
  }

  .order-dock__today-summary {
    cursor: pointer;
    font-weight: 800;
    color: #0f172a;
    padding: var(--charts-space-sm);
    display: flex;
    align-items: center;
    justify-content: space-between;
    list-style: none;
  }

  .order-dock__today-summary::-webkit-details-marker {
    display: none;
  }

  .order-dock__today-summary::after {
    content: '>';
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    color: #64748b;
    transition: transform 120ms ease;
  }

  .order-dock__today-fold[open] > .order-dock__today-summary::after {
    transform: rotate(90deg);
  }

  .order-dock__today-fold .order-dock__groups {
    padding: var(--charts-space-sm);
  }

  .order-dock button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .order-dock__header-action {
    border-radius: 999px;
    border: 1px solid rgba(34, 197, 94, 0.35);
    background: #ecfdf5;
    color: #166534;
    cursor: pointer;
    font-weight: 800;
    padding: var(--charts-space-2xs) var(--charts-space-sm);
    white-space: nowrap;
  }

  .order-dock__notice {
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-xs) var(--charts-space-sm);
    font-size: 0.85rem;
    border: 1px solid var(--ui-border-subtle);
    background: #ffffff;
  }

  .order-dock__notice--success {
    border-color: rgba(34, 197, 94, 0.25);
    background: #ecfdf5;
    color: #166534;
  }

  .order-dock__notice--error {
    border-color: rgba(239, 68, 68, 0.25);
    background: #fef2f2;
    color: #991b1b;
  }

  .order-dock__notice--info {
    border-color: rgba(59, 130, 246, 0.25);
    background: #eff6ff;
    color: #1d4ed8;
  }

  .order-dock__quick-add {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-2xs);
  }

  .order-dock__quick-add-mode {
    font-size: 0.75rem;
    font-weight: 900;
    color: #1e3a8a;
    align-self: center;
  }

  .order-dock__mini-add {
    border-radius: 999px;
    border: 1px solid rgba(100, 116, 139, 0.5);
    background: #ffffff;
    color: #1e293b;
    cursor: pointer;
    font-weight: 800;
    padding: var(--charts-space-2xs) var(--charts-space-sm);
    font-size: 0.78rem;
    white-space: nowrap;
    min-width: 36px;
    min-height: 36px;
  }

  .order-dock__mini-secondary {
    border-radius: 999px;
    border: 1px solid rgba(21, 128, 61, 0.55);
    background: #ecfdf5;
    color: #14532d;
    cursor: pointer;
    font-weight: 800;
    padding: var(--charts-space-2xs) var(--charts-space-sm);
    font-size: 0.78rem;
    white-space: nowrap;
    min-width: 36px;
    min-height: 36px;
  }

  .order-dock__mini-add:focus-visible,
  .order-dock__mini-secondary:focus-visible {
    outline: 2px solid rgba(37, 99, 235, 0.62);
    outline-offset: 2px;
  }

  .order-dock__groups {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
    min-width: 0;
  }

  .order-dock__group {
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border-subtle);
    background: #ffffff;
    min-width: 0;
    overflow: hidden;
  }

  .order-dock__group[data-group='prescription'],
  .order-dock__group[data-group='injection'] {
    border-color: rgba(59, 130, 246, 0.25);
    background: linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(248, 250, 252, 0.92) 100%);
  }

  .order-dock__group-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: var(--charts-space-xs);
    padding: var(--charts-space-xs);
    min-width: 0;
  }

  .order-dock__group-title {
    display: flex;
    align-items: baseline;
    gap: var(--charts-space-xs);
    min-width: 0;
  }

  .order-dock__group-title strong {
    color: #0f172a;
  }

  .order-dock__group-count {
    font-size: 0.75rem;
    color: #64748b;
    font-weight: 800;
    white-space: nowrap;
  }

  .order-dock__group-mode {
    font-size: 0.74rem;
    color: #1d4ed8;
    font-weight: 900;
    white-space: nowrap;
  }

  .order-dock__group-toggle {
    border-radius: 999px;
    border: 1px solid rgba(100, 116, 139, 0.52);
    background: #ffffff;
    color: #1e293b;
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 800;
    padding: 0.24rem 0.7rem;
    white-space: nowrap;
    min-width: 36px;
    min-height: 36px;
  }

  .order-dock__group-toggle--expanded {
    border-color: rgba(37, 99, 235, 0.4);
    background: rgba(239, 246, 255, 0.92);
    color: #1d4ed8;
  }

  .order-dock__group-body {
    display: grid;
    gap: var(--charts-space-sm);
    padding: 0 var(--charts-space-xs) var(--charts-space-xs);
  }

  .order-dock__group-action {
    border-radius: 999px;
    border: 1px solid rgba(37, 99, 235, 0.5);
    background: #eff6ff;
    color: #1e40af;
    cursor: pointer;
    font-weight: 800;
    padding: var(--charts-space-2xs) var(--charts-space-sm);
    font-size: 0.8rem;
    white-space: nowrap;
    min-width: 36px;
    min-height: 36px;
  }

  .order-dock__group-action--add {
    border-color: rgba(100, 116, 139, 0.52);
    background: #ffffff;
    color: #1e293b;
  }

  .order-dock__subtype {
    display: flex;
    align-items: center;
    gap: var(--charts-space-xs);
  }

  .order-dock__subtype label {
    font-size: 0.75rem;
    font-weight: 800;
    color: #475569;
    white-space: nowrap;
  }

  .order-dock__subtype select {
    flex: 1;
    min-width: 0;
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border);
    padding: 0.25rem 0.45rem;
    background: #ffffff;
    color: #0f172a;
  }

  .order-dock__subtype-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }

  .order-dock__subtype-tab {
    border-radius: 999px;
    border: 1px solid rgba(100, 116, 139, 0.48);
    background: #f8fafc;
    color: #1e293b;
    cursor: pointer;
    font-weight: 900;
    font-size: 0.8rem;
    padding: 0.24rem 0.7rem;
    white-space: nowrap;
    transition: background 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
  }

  .order-dock__subtype-tabs .order-dock__subtype-tab {
    min-width: 36px;
    min-height: 36px;
  }

  .order-dock__subtype-tab[data-active='true'] {
    border-color: rgba(29, 78, 216, 0.64);
    background: rgba(239, 246, 255, 0.95);
    color: #1e40af;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.18);
  }

  .order-dock__subtype-tab:focus-visible,
  .order-dock__group-action:focus-visible,
  .order-dock__group-toggle:focus-visible {
    outline: 2px solid rgba(37, 99, 235, 0.62);
    outline-offset: 2px;
  }

  .order-dock__inline-editor {
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border-subtle);
    background: linear-gradient(180deg, rgba(248, 250, 252, 0.88) 0%, rgba(255, 255, 255, 0.96) 100%);
    padding: var(--charts-space-xs);
  }

  .order-dock__bundle-list {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
    min-width: 0;
  }

  .order-dock__bundle {
    border-radius: 14px;
    border: 1px solid var(--ui-border-subtle);
    background: rgba(248, 250, 252, 0.85);
    padding: var(--charts-space-xs) var(--charts-space-sm);
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--charts-space-sm);
    align-items: start;
  }

  .order-dock__bundle-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .order-dock__bundle-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--charts-space-xs);
    min-width: 0;
  }

  .order-dock__bundle-badges {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: flex-end;
    flex: 0 0 auto;
  }

  .order-dock__badge {
    border-radius: 999px;
    border: 1px solid var(--ui-border);
    background: rgba(255, 255, 255, 0.95);
    padding: 0.1rem 0.45rem;
    font-size: 0.72rem;
    font-weight: 900;
    color: #0f172a;
    white-space: nowrap;
  }

  .order-dock__badge--entity {
    border-color: var(--ui-border);
    background: rgba(241, 245, 249, 0.95);
    color: #334155;
  }

  .order-dock__badge--warn {
    border-color: rgba(245, 158, 11, 0.42);
    background: rgba(255, 247, 237, 0.95);
    color: #9a3412;
  }

  .order-dock__badge--contra {
    border-color: rgba(239, 68, 68, 0.42);
    background: rgba(254, 242, 242, 0.95);
    color: #991b1b;
  }

  .order-dock__badge--required {
    border-color: rgba(239, 68, 68, 0.4);
    background: rgba(254, 242, 242, 0.95);
    color: #b91c1c;
  }

  .order-dock__bundle-name {
    font-size: 0.88rem;
    color: #0f172a;
  }

  .order-dock__bundle-meta {
    font-size: 0.75rem;
    color: #475569;
    line-height: 1.35;
  }

  .order-dock__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 2px;
  }

  .order-dock__chip {
    border-radius: 999px;
    border: 1px solid var(--ui-border);
    background: rgba(255, 255, 255, 0.92);
    padding: 0.1rem 0.45rem;
    font-size: 0.72rem;
    font-weight: 800;
    color: #0f172a;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .order-dock__chip--more {
    background: rgba(241, 245, 249, 0.95);
    color: #475569;
  }

  .order-dock__chip--comment {
    border-color: rgba(59, 130, 246, 0.28);
    background: rgba(239, 246, 255, 0.92);
    color: #1e3a8a;
  }

  .order-dock__bundle-items {
    font-size: 0.75rem;
    color: #475569;
    line-height: 1.35;
    word-break: break-word;
  }

  .order-dock__bundle-required {
    display: block;
    margin-top: 2px;
    font-size: 0.72rem;
    line-height: 1.35;
    color: #b91c1c;
    font-weight: 800;
  }

  .order-dock__bundle-actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .order-dock__bundle-action {
    border-radius: 999px;
    border: 1px solid rgba(100, 116, 139, 0.52);
    background: #ffffff;
    color: #1e293b;
    cursor: pointer;
    font-weight: 800;
    font-size: 0.78rem;
    padding: 0.3rem 0.66rem;
    white-space: nowrap;
    min-width: 36px;
    min-height: 36px;
  }

  .order-dock__bundle-action:hover:not(:disabled) {
    background: #eff6ff;
    border-color: rgba(37, 99, 235, 0.5);
  }

  .order-dock__bundle-action--danger {
    border-color: rgba(220, 38, 38, 0.5);
    background: rgba(254, 242, 242, 0.9);
    color: #7f1d1d;
  }

  .order-dock__bundle-action:focus-visible {
    outline: 2px solid rgba(37, 99, 235, 0.62);
    outline-offset: 2px;
  }

  .order-dock__editor {
    border-top: 1px dashed var(--ui-border);
    padding-top: var(--charts-space-sm);
  }

  .order-dock__rx {
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border);
    background: #f8fafc;
    overflow: hidden;
  }

  .order-dock__rx-summary {
    cursor: pointer;
    font-weight: 800;
    color: #0f172a;
    padding: var(--charts-space-sm);
    display: flex;
    align-items: center;
    justify-content: space-between;
    list-style: none;
  }

  .order-dock__rx-summary::-webkit-details-marker {
    display: none;
  }

  .order-dock__rx-summary::after {
    content: '>';
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    color: #64748b;
    transition: transform 120ms ease;
  }

  .order-dock__rx[open] > .order-dock__rx-summary::after {
    transform: rotate(90deg);
  }

  .order-dock__rx-meta {
    margin: 0;
    padding: 0 var(--charts-space-sm);
    font-size: 0.75rem;
    color: #64748b;
  }

  .order-dock__rx-list {
    margin: var(--charts-space-xs) 0 0;
    padding: 0 var(--charts-space-sm) var(--charts-space-sm);
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
  }

  .order-dock__rx-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.8rem;
    color: #0f172a;
  }

  .order-dock__rx-sub {
    font-size: 0.75rem;
    color: #475569;
  }

  .order-dock__rx-memo {
    margin: 0;
    padding: 0 var(--charts-space-sm) var(--charts-space-sm);
    font-size: 0.8rem;
    color: #475569;
  }

  .order-dock__rx-actions {
    padding: 0 var(--charts-space-sm) var(--charts-space-sm);
    display: flex;
    justify-content: flex-end;
    gap: var(--charts-space-xs);
    flex-wrap: wrap;
  }

  .order-dock__rx-action {
    border-radius: 999px;
    border: 1px solid rgba(59, 130, 246, 0.28);
    background: #eff6ff;
    color: #1d4ed8;
    cursor: pointer;
    font-weight: 800;
    padding: var(--charts-space-2xs) var(--charts-space-sm);
    white-space: nowrap;
  }

  .order-recommend-modal {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .order-recommend-modal__toolbar {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: var(--charts-space-sm);
    align-items: end;
  }

  .order-recommend-modal__scope {
    display: flex;
    gap: var(--charts-space-xs);
  }

  .order-recommend-modal__scope-button {
    border-radius: 999px;
    border: 1px solid var(--ui-border);
    background: #f8fafc;
    color: #0f172a;
    cursor: pointer;
    font-weight: 800;
    padding: 0.3rem 0.75rem;
    white-space: nowrap;
  }

  .order-recommend-modal__scope-button[data-active='1'] {
    border-color: rgba(37, 99, 235, 0.44);
    background: #dbeafe;
    color: #1d4ed8;
  }

  .order-recommend-modal__scope-button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .order-recommend-modal__search {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .order-recommend-modal__search label {
    font-size: 0.75rem;
    font-weight: 800;
    color: #475569;
  }

  .order-recommend-modal__search input {
    width: 100%;
    border-radius: 12px;
    border: 1px solid var(--ui-border);
    padding: 0.45rem 0.6rem;
    color: #0f172a;
  }

  .order-recommend-modal__meta {
    font-size: 0.8rem;
    color: #64748b;
    font-weight: 800;
    text-align: right;
    white-space: nowrap;
  }

  .order-recommend-modal__empty {
    margin: 0;
    color: #64748b;
    font-size: 0.9rem;
  }

  .order-recommend-modal__groups {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-md);
  }

  .order-recommend-modal__group + .order-recommend-modal__group {
    border-top: 1px solid var(--ui-border-subtle);
    padding-top: var(--charts-space-sm);
  }

  .order-recommend-modal__group-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--charts-space-sm);
    margin-bottom: var(--charts-space-sm);
    color: #0f172a;
  }

  .order-recommend-modal__candidate-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--charts-space-xs);
  }

  .order-recommend-modal__candidate {
    text-align: left;
    border-radius: 16px;
    border: 1px solid var(--ui-border-subtle);
    background: #ffffff;
    padding: 0.7rem 0.75rem;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 4px;
    transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
  }

  .order-recommend-modal__candidate:hover:not(:disabled) {
    border-color: rgba(59, 130, 246, 0.35);
    box-shadow: 0 10px 26px rgba(15, 23, 42, 0.12);
  }

  .order-recommend-modal__candidate:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .order-recommend-modal__candidate-label {
    font-weight: 800;
    color: #0f172a;
    line-height: 1.25;
  }

  .order-recommend-modal__candidate-meta {
    font-size: 0.75rem;
    color: #64748b;
  }

  @media (max-width: 560px) {
    .order-recommend-modal__toolbar {
      grid-template-columns: 1fr;
      align-items: stretch;
    }

    .order-recommend-modal__meta {
      text-align: left;
    }
  }

  .soap-note__paper-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--charts-space-sm);
  }

  .soap-note__paper-header strong {
    display: block;
    font-size: 0.95rem;
    color: #0f172a;
  }

  .soap-note__paper-meta {
    display: block;
    margin-top: 2px;
    font-size: 0.75rem;
    color: #64748b;
  }

  .soap-note__paper-action {
    border-radius: 999px;
    border: 1px solid rgba(59, 130, 246, 0.28);
    background: #eff6ff;
    color: #1d4ed8;
    cursor: pointer;
    font-weight: 800;
    padding: var(--charts-space-2xs) var(--charts-space-sm);
    white-space: nowrap;
  }

  .soap-note__paper-action:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .soap-note__paper-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
  }

  .soap-note__paper-item {
    padding-bottom: var(--charts-space-xs);
    border-bottom: 1px dashed var(--ui-border);
  }

  .soap-note__paper-item:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .soap-note__paper-drug {
    display: block;
    font-size: 0.9rem;
    color: #0f172a;
  }

  .soap-note__paper-dose {
    display: block;
    margin-top: 2px;
    font-size: 0.8rem;
    color: #1f2937;
  }

  .soap-note__paper-sub {
    display: block;
    margin-top: 2px;
    font-size: 0.75rem;
    color: #475569;
  }

  .soap-note__paper-empty {
    margin: var(--charts-space-xs) 0 0;
    color: #64748b;
    font-size: 0.85rem;
  }

  .soap-note__order-groups {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
    min-width: 0;
  }

  .soap-note__order-group {
    position: relative;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
    padding-right: 0;
  }

  .soap-note__order-group + .soap-note__order-group {
    border-top: 1px solid var(--ui-border-subtle);
    padding-top: var(--charts-space-sm);
  }

  .soap-note__order-group[data-active='true'] .soap-note__order-group-header strong {
    color: #1d4ed8;
  }

  .soap-note__order-group-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--charts-space-sm);
  }

  button.soap-note__order-group-rail {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    width: 72px;
    min-width: 72px;
    z-index: 2;
    display: grid;
    place-items: center;
  }

  button.soap-note__order-group-rail[data-empty='true'] {
    border-style: dashed;
  }

  button.soap-note__order-group-rail[data-empty='true']::after {
    content: '＋';
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.95rem;
    font-weight: 900;
    line-height: 1;
  }

  .soap-note__order-group-meta {
    margin-left: var(--charts-space-xs);
    color: #64748b;
    font-size: 0.75rem;
    font-weight: 800;
    white-space: nowrap;
  }

  .soap-note__order-group-submeta {
    margin: 0;
    color: #64748b;
    font-size: 0.78rem;
    line-height: 1.4;
  }

  .soap-note__order-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
  }

  .soap-note__order-item {
    padding: 0;
    border: none;
  }

  .soap-note__order-item:last-child {
    padding: 0;
  }

  .soap-note__summary-card {
    width: 100%;
    text-align: left;
    border-radius: 12px;
    border: 1px solid var(--ui-border);
    background: #ffffff;
    padding: var(--charts-space-sm);
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-2xs);
    min-width: 0;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
  }

  button.soap-note__summary-card {
    cursor: pointer;
    transition: border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
  }

  button.soap-note__summary-card:hover {
    border-color: rgba(37, 99, 235, 0.42);
    box-shadow: 0 8px 20px rgba(37, 99, 235, 0.14);
  }

  button.soap-note__summary-card:focus-visible {
    outline: 2px solid rgba(37, 99, 235, 0.42);
    outline-offset: 2px;
  }

  .soap-note__summary-card--empty {
    background: #f8fafc;
    border-style: dashed;
    box-shadow: none;
  }

  .soap-note__order-group[data-active='true'] .soap-note__summary-card {
    border-color: rgba(37, 99, 235, 0.4);
    box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.1);
  }

  .soap-note__summary-meta {
    margin: 0;
    font-size: 0.72rem;
    color: #475569;
    line-height: 1.45;
    word-break: break-word;
  }

  .soap-note__section-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    border: 1px solid rgba(148, 163, 184, 0.45);
    border-radius: var(--ui-radius-sm);
    padding: 0.1rem 0.5rem;
    background: #f8fafc;
    color: #334155;
    font-size: 0.72rem;
    font-weight: 700;
    line-height: 1.2;
  }

  .soap-note__meta-details {
    margin-top: var(--charts-space-2xs);
  }

  .soap-note__meta-details > summary {
    cursor: pointer;
    list-style: none;
  }

  .soap-note__meta-details > summary::-webkit-details-marker {
    display: none;
  }

  .soap-note__meta-details .soap-note__subtitle {
    margin-top: var(--charts-space-2xs);
    font-size: 0.8rem;
    color: #64748b;
  }

  .soap-note__summary-body {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .soap-note__summary-detail {
    margin: 0;
    font-size: 0.75rem;
    color: #334155;
    line-height: 1.4;
    word-break: break-word;
  }

  .soap-note__summary-detail--heading {
    font-weight: 700;
    color: #0f172a;
  }

  .soap-note__summary-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .soap-note__summary-list-item {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .soap-note__summary-card .soap-note__summary-item-name {
    display: block;
    font-size: 0.8rem;
    color: #0f172a;
    line-height: 1.35;
    word-break: break-word;
  }

  .soap-note__summary-card .soap-note__summary-item-sub {
    display: block;
    font-size: 0.72rem;
    color: #475569;
    line-height: 1.35;
    word-break: break-word;
    padding-left: 0.2rem;
  }

  .soap-note__order-bundle {
    display: block;
    font-size: 0.85rem;
    color: #0f172a;
  }

  .soap-note__order-items {
    display: block;
    font-size: 0.75rem;
    color: #475569;
    line-height: 1.35;
    word-break: break-word;
  }

  .soap-note__rx-history {
    border-top: 1px solid var(--ui-border-subtle);
    padding-top: var(--charts-space-sm);
    margin-top: var(--charts-space-xs);
  }

  .soap-note__paper-memo {
    margin: 0;
    font-size: 0.8rem;
    color: #475569;
    border-top: 1px solid var(--ui-border-subtle);
    padding-top: var(--charts-space-xs);
  }

  @media (max-width: 1280px) {
    .soap-note__body {
      grid-template-columns: minmax(0, 1fr) 72px;
      align-items: start;
    }

    .soap-note__editor {
      grid-column: 1 / -1;
    }

    .soap-note__center-panel-only {
      grid-column: 1 / -1;
    }

    .soap-note__right-dock-area {
      grid-column: 2 / 3;
    }

    .soap-note__grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .soap-note__paper {
      position: static;
    }
  }

  @media (max-width: 1023px) {
    .soap-note__body {
      grid-template-columns: 1fr;
      gap: var(--charts-space-sm);
    }

    .soap-note__editor,
    .soap-note__center-panel-only,
    .soap-note__right-dock-area {
      grid-column: 1;
    }

    .soap-note__order-group {
      padding-right: 0;
    }

    button.soap-note__order-group-rail {
      position: relative;
      top: auto;
      bottom: auto;
      right: auto;
      width: 100%;
      min-width: 0;
    }

    button.soap-note__order-group-rail[data-empty='true']::after {
      top: 50%;
      left: 14px;
      transform: translateY(-50%);
    }

    .soap-note__right-dock-area {
      position: static;
      top: auto;
      min-width: 0;
      max-height: none;
      overflow: visible;
    }

    .soap-note__right-dock {
      width: 100%;
      min-width: 0;
      position: static;
      top: auto;
      max-height: none;
      overflow: visible;
    }

    .soap-note__right-dock-scroll {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      max-height: none;
      overflow: visible;
      padding-right: 0;
    }

    .soap-note__right-dock-button {
      writing-mode: horizontal-tb;
      text-orientation: mixed;
      min-height: 42px;
      padding: var(--charts-space-xs) var(--charts-space-sm);
      letter-spacing: 0.02em;
    }

    .soap-note__right-drawer {
      top: calc(env(safe-area-inset-top) + 62px);
      right: 8px;
      left: 8px;
      width: auto;
      max-width: none;
      bottom: max(8px, env(safe-area-inset-bottom));
    }

    .soap-note__right-drawer[data-mode='dock'],
    .soap-note__right-drawer[data-mode='overlay'] {
      right: 8px;
      left: 8px;
      width: auto;
      max-width: none;
    }

    .soap-note__right-drawer[data-open='true'][data-minimized='true'] {
      transform: translateX(0);
    }

    .soap-note__right-drawer[data-minimized='true'] .soap-note__right-drawer-content {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
      user-select: auto;
    }

    .soap-note__right-drawer-order-layout {
      align-items: stretch;
    }

    .soap-note__right-drawer[data-order-layout='split'] .soap-note__right-drawer-order-layout {
      flex-direction: column;
      gap: var(--charts-space-sm);
    }

    .soap-note__right-drawer[data-order-layout='split'] .soap-note__right-drawer-order-editor,
    .soap-note__right-drawer[data-order-layout='split'] .soap-note__right-drawer-order-preview {
      flex: 1 1 auto;
      max-width: none;
    }

    .soap-note__right-drawer-order-preview {
      padding-top: var(--charts-space-sm);
      border-top-color: var(--ui-border-subtle);
    }

    .soap-note__right-drawer[data-order-layout='split'] .soap-note__right-drawer-order-preview {
      padding-top: var(--charts-space-sm);
      padding-left: 0;
      border-left: 0;
      border-top: 1px solid var(--ui-border-subtle);
    }

    .soap-note__right-drawer-order-preview-list {
      max-height: min(36vh, 360px);
    }
  }

  @media (max-width: 760px) {
    .soap-note__grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .soap-note__right-dock-scroll {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .soap-note__summary-card {
      padding: var(--charts-space-xs);
      border-radius: 10px;
    }

    .soap-note__summary-meta {
      font-size: 0.7rem;
    }

    .soap-note__summary-card .soap-note__summary-item-name {
      font-size: 0.77rem;
    }
  }

  @media (max-height: 900px) {
    .soap-note__body {
      gap: var(--charts-space-sm);
    }

    .soap-note__grid {
      gap: var(--charts-space-sm);
    }

    .soap-note__section {
      padding: var(--charts-space-sm);
    }

    .soap-note__paper {
      position: static;
      max-height: none;
    }
  }

  .soap-note__tabs {
    display: flex;
    gap: var(--charts-space-xs);
  }

  .soap-note__tabs:has(> .soap-note__tab:only-child) {
    display: none;
  }

  .soap-note__tab {
    border: 1px solid var(--ui-border);
    background: #f8fafc;
    color: #475569;
    padding: var(--charts-space-2xs) var(--charts-space-sm);
    border-radius: 999px;
    font-size: 0.8rem;
    cursor: pointer;
    font-weight: 600;
  }

  .soap-note__tab--active {
    background: #ffffff;
    color: #0f172a;
    border-color: rgba(15, 23, 42, 0.35);
  }

  .soap-note__subjectives {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .soap-note__subjectives-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--charts-space-sm);
  }

  .soap-note__subjectives-header p {
    margin: var(--charts-space-2xs) 0 0;
    color: #475569;
    font-size: 0.85rem;
  }

  .soap-note__subjectives-header button {
    border: 1px solid rgba(59, 130, 246, 0.25);
    background: #ffffff;
    border-radius: 999px;
    padding: var(--charts-space-2xs) var(--charts-space-sm);
    font-size: 0.8rem;
    cursor: pointer;
    color: #1d4ed8;
    font-weight: 600;
  }

  .soap-note__subjectives-list {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
  }

  .soap-note__subjectives-row {
    display: flex;
    justify-content: space-between;
    gap: var(--charts-space-sm);
    align-items: center;
    border: 1px solid var(--ui-border-subtle);
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-xs) var(--charts-space-sm);
    background: #ffffff;
  }

  .soap-note__subjectives-row span {
    color: #64748b;
    font-size: 0.8rem;
  }

  .soap-note__subjectives-tag {
    font-size: 0.75rem;
    font-weight: 700;
    color: #0f172a;
    background: #f1f5f9;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
  }

  .soap-note__subjectives-form {
    border: 1px solid var(--ui-border);
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-sm);
    background: #f8fafc;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .soap-note__subjectives-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: var(--charts-space-sm);
  }

  .soap-note__subjectives-grid label {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-2xs);
    font-size: 0.85rem;
    color: #334155;
  }

  .soap-note__subjectives-grid input,
  .soap-note__subjectives-textarea textarea {
    border-radius: var(--charts-radius-sm);
    border: 1px solid #cbd5f5;
    padding: var(--charts-space-2xs) var(--charts-space-xs);
    font-size: 0.85rem;
  }

  .soap-note__subjectives-textarea {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-2xs);
    font-size: 0.85rem;
    color: #334155;
  }

  .soap-note__subjectives-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-xs);
  }

  .soap-note__subjectives-actions button {
    border: 1px solid var(--ui-border-strong);
    background: #ffffff;
    border-radius: 999px;
    padding: var(--charts-space-2xs) var(--charts-space-sm);
    font-size: 0.8rem;
    cursor: pointer;
    color: #0f172a;
    font-weight: 600;
  }

  .document-timeline {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-md);
  }

  .document-timeline__header {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .document-timeline__header h2 {
    margin: 0;
    font-size: 1.25rem;
    color: #0f172a;
  }

  .document-timeline__meta-bar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-xs);
    padding: var(--charts-space-xs) var(--charts-space-sm);
    border-radius: var(--charts-radius-sm);
    background: #0f172a;
    color: #f8fafc;
    font-size: 0.85rem;
    font-weight: 700;
  }

  .document-timeline__meta-bar span {
    padding: var(--charts-space-2xs) var(--charts-space-xs);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
  }

  .document-timeline__alert {
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-sm) var(--charts-space-md);
    border: 1px solid #e2e8f0;
    background: #fff7ed;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
  }

  .document-timeline__alert--warning {
    background: #fff7ed;
    border-color: #fdba74;
    color: #7c2d12;
  }

  .document-timeline__alert--error {
    background: #fef2f2;
    border-color: #fecdd3;
    color: #7f1d1d;
  }

  .document-timeline__alert-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--charts-space-sm);
    flex-wrap: wrap;
    color: #0f172a;
  }

  .document-timeline__alert-header span {
    font-size: 0.85rem;
    color: #64748b;
    font-weight: 500;
  }

  .document-timeline__alert-list {
    margin: 0;
    padding-left: 1.1rem;
    display: grid;
    gap: 0.35rem;
    font-size: 0.9rem;
    color: #0f172a;
  }

  .document-timeline__alert-note {
    font-size: 0.85rem;
    color: #475569;
  }

  .document-timeline__content {
    display: grid;
    grid-template-columns: minmax(0, 1.6fr) minmax(0, 0.9fr);
    gap: var(--charts-space-md);
    align-items: start;
  }

  .document-timeline__timeline {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .document-timeline__section-logs {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .document-timeline__section-logs-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    color: #0f172a;
  }

  .document-timeline__section-logs-header span {
    font-size: 0.85rem;
    color: #64748b;
  }

  .document-timeline__section-logs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--charts-space-sm);
  }

  .document-timeline__section-log {
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-sm);
    background: #ffffff;
    border: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
  }

  .document-timeline__section-log header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--charts-space-xs);
    color: #0f172a;
  }

  .document-timeline__section-log header span {
    font-size: 0.8rem;
    color: #64748b;
  }

  .document-timeline__section-log p {
    margin: 0;
    color: #334155;
    line-height: 1.5;
  }

  .document-timeline__soap-history {
    margin-top: var(--charts-space-sm);
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .document-timeline__soap-history-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--charts-space-sm);
    flex-wrap: wrap;
  }

  .document-timeline__soap-history-header h3 {
    margin: 0;
    font-size: 1rem;
    color: #0f172a;
  }

  .document-timeline__soap-history-header span {
    color: #64748b;
    font-size: 0.85rem;
  }

  .document-timeline__soap-empty {
    margin: 0;
    color: #64748b;
    font-size: 0.9rem;
  }

  .document-timeline__soap-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .document-timeline__soap-entry {
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border);
    background: #ffffff;
    padding: var(--charts-space-sm);
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
  }

  .document-timeline__soap-entry header {
    display: flex;
    gap: var(--charts-space-sm);
    flex-wrap: wrap;
    align-items: baseline;
  }

  .document-timeline__soap-action {
    font-size: 0.85rem;
    font-weight: 700;
    color: #1d4ed8;
  }

  .document-timeline__soap-time {
    font-size: 0.85rem;
    color: #475569;
  }

  .document-timeline__soap-entry p {
    margin: 0;
    color: #0f172a;
    font-size: 0.9rem;
    white-space: pre-wrap;
  }

  .document-timeline__soap-meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-sm);
    font-size: 0.85rem;
    color: #64748b;
  }

  .document-timeline__section-log--warning {
    background: #fff7ed;
    border-color: #fdba74;
  }

  .document-timeline__section-log--error {
    background: #fef2f2;
    border-color: #fca5a5;
  }

  .document-timeline__section-log--info {
    background: #eff6ff;
    border-color: #bfdbfe;
  }

  .document-timeline__timeline-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    color: #0f172a;
  }

  .document-timeline__timeline-header span {
    font-size: 0.85rem;
    color: #64748b;
  }

  .document-timeline__controls {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-sm);
    align-items: center;
  }

  .document-timeline__control-group {
    display: inline-flex;
    gap: var(--charts-space-xs);
    align-items: center;
    background: #f8fafc;
    border: 1px solid var(--ui-border);
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-xs) var(--charts-space-sm);
  }

  .document-timeline__pager {
    border: 1px solid rgba(59, 130, 246, 0.35);
    background: #fff;
    color: #1d4ed8;
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-2xs) var(--charts-space-sm);
    cursor: pointer;
  }

  .document-timeline__pager:hover {
    background: #eff6ff;
  }

  .document-timeline__window-meta {
    color: #334155;
    font-size: 0.9rem;
    margin-left: var(--charts-space-xs);
  }

  .document-timeline__control-group input[type="number"] {
    width: 76px;
    border: 1px solid #cbd5f5;
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-2xs) var(--charts-space-xs);
  }

  .document-timeline__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--charts-space-sm);
    font-size: 0.9rem;
    color: #475569;
  }

  .document-timeline__list {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .document-timeline__section {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
    border: 1px solid #e2e8f0;
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-sm);
    background: #ffffff;
  }

  .document-timeline__section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-weight: 700;
    color: #0f172a;
  }

  .document-timeline__section-labels {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-2xs);
  }

  .document-timeline__section-badge {
    padding: var(--charts-space-2xs) var(--charts-space-sm);
    background: #e0e7ff;
    color: #1d4ed8;
    border-radius: 999px;
    font-weight: 700;
  }

  .document-timeline__section-count {
    color: #475569;
    font-size: 0.9rem;
  }

  .document-timeline__virtual {
    position: relative;
    overflow-y: auto;
    border-top: 1px dashed #e2e8f0;
    padding-top: var(--charts-space-sm);
  }

  .document-timeline__entry {
    background: #f8fafc;
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-sm) var(--charts-space-md);
    border: 1px solid var(--ui-border);
  }

  .document-timeline__entry--warning {
    border-color: #f59e0b;
    box-shadow: var(--charts-shadow-none);
    background: #fffbeb;
  }

  .document-timeline__entry--selected {
    border-color: #2563eb;
  }

  .document-timeline__entry header {
    display: flex;
    align-items: center;
    gap: var(--charts-space-xs);
    margin-bottom: var(--charts-space-xs);
  }

  .document-timeline__entry-title {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-2xs);
  }

  .document-timeline__entry-meta {
    color: #475569;
    font-size: 0.9rem;
  }

  .document-timeline__badge-warning,
  .document-timeline__badge-error,
  .document-timeline__badge-info,
  .document-timeline__badge-success {
    border-radius: 999px;
    padding: var(--charts-space-2xs) var(--charts-space-xs);
    font-size: 0.85rem;
    font-weight: 700;
  }

  .document-timeline__badge-warning {
    background: #fffbeb;
    color: #b45309;
    border: 1px solid #f59e0b;
  }

  .document-timeline__badge-error {
    background: #fef2f2;
    color: #b91c1c;
    border: 1px solid #ef4444;
  }

  .document-timeline__badge-info {
    background: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #60a5fa;
  }

  .document-timeline__badge-success {
    background: #ecfdf3;
    color: #065f46;
    border: 1px solid #34d399;
  }

  .document-timeline__steps {
    display: grid;
    grid-template-columns: repeat(3, minmax(80px, 1fr));
    gap: var(--charts-space-xs);
    margin: var(--charts-space-2xs) 0;
  }

  .document-timeline__step {
    padding: var(--charts-space-xs) var(--charts-space-sm);
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border);
    background: #fff;
    text-align: center;
    font-weight: 700;
    font-size: 0.9rem;
  }

  .document-timeline__step--done {
    background: #ecfdf3;
    border-color: #34d399;
    color: #065f46;
  }

  .document-timeline__step--active {
    background: #eff6ff;
    border-color: #3b82f6;
    color: #1d4ed8;
  }

  .document-timeline__step--blocked {
    background: #fef2f2;
    border-color: #ef4444;
    color: #b91c1c;
  }

  .document-timeline__step--pending {
    background: #f8fafc;
    border-color: var(--ui-border-strong);
    color: #475569;
  }

  .document-timeline__entry-note {
    margin: var(--charts-space-2xs) 0;
    color: #0f172a;
  }

  .document-timeline__actions {
    display: flex;
    gap: var(--charts-space-xs);
    align-items: baseline;
    color: #0f172a;
  }

  .document-timeline__entry-time {
    font-weight: 700;
    color: #1d4ed8;
  }

  .document-timeline__entry-status {
    color: #0f172a;
    font-size: 0.95rem;
    font-weight: 600;
  }

  .document-timeline__entry-body {
    margin: 0 0 var(--charts-space-xs);
    color: #334155;
    line-height: 1.5;
  }

  .document-timeline__next-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-xs);
    margin-top: var(--charts-space-2xs);
  }

  .document-timeline__cta {
    border: 1px solid #2563eb;
    background: #2563eb;
    color: #ffffff;
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-xs) var(--charts-space-sm);
    cursor: pointer;
    font-weight: 700;
    font-size: 0.9rem;
  }

  .document-timeline__cta--warning {
    background: #f59e0b;
    border-color: #f59e0b;
    color: #1f2937;
  }

  .document-timeline__cta--error {
    background: #dc2626;
    border-color: #dc2626;
  }

  .document-timeline__cta--primary {
    background: #2563eb;
    border-color: #2563eb;
  }

  .document-timeline__cta:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  .document-timeline__queue-row {
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-sm) var(--charts-space-md);
    border: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    gap: var(--charts-space-sm);
  }

  .document-timeline__queue-row--info {
    background: #eff6ff;
    border-color: #bfdbfe;
  }

  .document-timeline__queue-row--warning {
    background: #fff7ed;
    border-color: #fdba74;
  }

  .document-timeline__queue-row--success {
    background: #ecfdf5;
    border-color: #34d399;
  }

  .document-timeline__queue-row--error {
    background: #fef2f2;
    border-color: #fecdd3;
  }

  .document-timeline__queue-main {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
  }

  .document-timeline__queue-phase {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-xs);
    align-items: center;
  }

  .document-timeline__queue-label {
    font-weight: 700;
    color: #0f172a;
  }

  .document-timeline__pill {
    display: inline-flex;
    align-items: center;
    gap: var(--charts-space-2xs);
    padding: var(--charts-space-2xs) var(--charts-space-xs);
    border-radius: 999px;
    background: #e2e8f0;
    color: #0f172a;
    font-size: 0.85rem;
  }

  .document-timeline__queue-detail {
    margin: 0;
    color: #9a3412;
    font-size: 0.95rem;
  }

  .document-timeline__queue-actions {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
    align-items: flex-end;
    min-width: 160px;
  }

  .document-timeline__cta-link {
    color: #1d4ed8;
    font-weight: 700;
    text-decoration: none;
  }

  .document-timeline__skeleton {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .document-timeline__skeleton-row {
    height: 72px;
    border-radius: var(--charts-radius-sm);
    background: linear-gradient(90deg, #e2e8f0, #f8fafc, #e2e8f0);
    background-size: 200% 100%;
    animation: shimmer 1.2s infinite;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  .document-timeline__fallback,
  .document-timeline__retry {
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-sm) var(--charts-space-md);
    background: #fff7ed;
    border: 1px solid #fdba74;
    color: #7c2d12;
  }

  .document-timeline__retry-button {
    margin-top: var(--charts-space-xs);
    background: #2563eb;
    border: 1px solid #2563eb;
    color: #fff;
    padding: var(--charts-space-xs) var(--charts-space-md);
    border-radius: var(--charts-radius-sm);
    cursor: pointer;
  }

  .document-timeline__insights {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .document-timeline__transition {
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-sm);
    border: 1px solid var(--ui-border);
    background: #fff7ed;
  }

  .document-timeline__transition--info {
    background: #eff6ff;
    border-color: #bfdbfe;
  }

  .document-timeline__transition--success {
    background: #ecfdf5;
    border-color: #34d399;
  }

  .document-timeline__audit {
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-sm);
    background: #fef9c3;
    border: 1px solid #f59e0b;
    color: #92400e;
  }

  .document-timeline__audit-text {
    margin: var(--charts-space-2xs) 0 0;
    line-height: 1.5;
  }

  .document-timeline__queue {
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-md);
    background: #f0f9ff;
    border: 1px solid rgba(59, 130, 246, 0.25);
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
  }

  .document-timeline__queue-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #0f172a;
  }

  .document-timeline__queue-runid {
    color: #1d4ed8;
    font-size: 0.9rem;
  }

  .document-timeline__queue-badges {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-sm);
  }

  .document-timeline__queue-meta {
    margin: 0;
    color: #475569;
    font-size: 0.9rem;
  }

  .orca-summary {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .orca-summary__headline {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-xs);
    align-items: center;
    padding: var(--charts-space-xs) var(--charts-space-sm);
    border-radius: var(--charts-radius-sm);
    border: 1px solid rgba(14, 116, 144, 0.28);
    background: #ecfeff;
    color: #155e75;
    font-size: 0.82rem;
    font-weight: 700;
  }

  .orca-summary__recovery {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-xs);
    align-items: center;
    padding: var(--charts-space-xs) var(--charts-space-sm);
    border-radius: var(--charts-radius-sm);
    border: 1px solid rgba(245, 158, 11, 0.34);
    background: #fff7ed;
    color: #9a3412;
    font-size: 0.78rem;
  }

  .orca-summary__recovery button {
    border-radius: 999px;
    border: 1px solid rgba(59, 130, 246, 0.35);
    background: #ffffff;
    color: #1d4ed8;
    font-size: 0.75rem;
    font-weight: 800;
    padding: 0.24rem 0.62rem;
    cursor: pointer;
  }

  .orca-summary__details-fold {
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border);
    background: #f8fafc;
    overflow: hidden;
  }

  .orca-summary__details-summary {
    cursor: pointer;
    list-style: none;
    font-weight: 800;
    color: #0f172a;
    padding: var(--charts-space-sm);
  }

  .orca-summary__details-summary::-webkit-details-marker {
    display: none;
  }

  .orca-summary__details-body {
    padding: var(--charts-space-sm);
    border-top: 1px solid var(--ui-border-subtle);
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .orca-summary__details {
    display: grid;
    grid-template-columns: minmax(220px, 0.9fr) minmax(220px, 1fr);
    gap: var(--charts-space-sm);
  }

  .orca-summary__cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--charts-space-sm);
  }

  .orca-summary__card {
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border-subtle);
    padding: var(--charts-space-sm);
    background: #ffffff;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
  }

  .orca-summary__card header {
    display: flex;
    justify-content: space-between;
    gap: var(--charts-space-xs);
    align-items: baseline;
  }

  .orca-summary__card-meta {
    color: #64748b;
    font-size: 0.8rem;
  }

  .orca-summary__card--warning {
    border-color: rgba(239, 68, 68, 0.28);
    background: rgba(254, 242, 242, 0.7);
  }

  .orca-summary__warning {
    margin: 0;
    padding: var(--charts-space-xs);
    border-radius: var(--charts-radius-sm);
    border: 1px solid rgba(239, 68, 68, 0.28);
    background: #fff1f2;
    color: #7f1d1d;
    font-size: 0.85rem;
  }

  .orca-summary__warning-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-2xs);
  }

  .orca-summary__warning-button {
    width: 100%;
    text-align: left;
    border: 1px solid rgba(239, 68, 68, 0.28);
    background: #fff1f2;
    color: #7f1d1d;
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-xs);
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--charts-space-xs);
    cursor: pointer;
  }

  .orca-summary__warning-button:hover:not(:disabled) {
    background: #ffe4e6;
  }

  .orca-summary__warning-pos {
    font-weight: 800;
    font-size: 0.78rem;
    white-space: nowrap;
  }

  .orca-summary__warning-text {
    font-size: 0.85rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .orca-summary__help {
    margin: 0;
    color: #64748b;
    font-size: 0.8rem;
  }

  .orca-summary__income-highlight,
  .orca-summary__income-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: var(--charts-space-sm);
    padding: var(--charts-space-xs);
    background: #f8fafc;
    border-radius: var(--charts-radius-sm);
  }

  .orca-summary__label {
    display: block;
    color: #64748b;
    font-size: 0.75rem;
    margin-bottom: var(--charts-space-2xs);
  }

  .orca-summary__meta {
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-md);
    background: #f8fafc;
    border: 1px solid var(--ui-border);
  }

  .orca-summary__badges {
    display: flex;
    gap: var(--charts-space-sm);
    flex-wrap: wrap;
  }

  .medical-record {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .medical-record__header {
    display: flex;
    justify-content: space-between;
    gap: var(--charts-space-sm);
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .medical-record__title {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-2xs);
  }

  .medical-record__meta {
    color: #475569;
    font-size: 0.9rem;
  }

  .medical-record__badges {
    display: flex;
    gap: var(--charts-space-sm);
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .medical-record__empty {
    margin: 0;
    padding: var(--charts-space-md);
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border);
    background: #f8fafc;
    color: #475569;
  }

  .medical-record__sections {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .medical-record__section {
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border);
    background: #ffffff;
    overflow: hidden;
  }

  .medical-record__section-summary {
    padding: var(--charts-space-sm) var(--charts-space-md);
    display: flex;
    justify-content: space-between;
    gap: var(--charts-space-sm);
    align-items: baseline;
    background: #f8fafc;
  }

  .medical-record__section-title {
    margin: 0;
    font-weight: 800;
    color: #0f172a;
  }

  .medical-record__section-meta {
    color: #475569;
    font-size: 0.9rem;
    text-align: right;
  }

  .medical-record__section-empty {
    margin: 0;
    padding: var(--charts-space-md);
    color: #475569;
  }

  .medical-record__section-list {
    margin: 0;
    padding: var(--charts-space-md);
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .medical-record__item-headline {
    font-weight: 700;
    color: #0f172a;
  }

  .medical-record__item-sub {
    color: #475569;
    font-size: 0.9rem;
    line-height: 1.35;
  }

  .charts-patient-panel__actions {
    display: flex;
    gap: var(--charts-space-xs);
    justify-content: flex-end;
    flex-wrap: wrap;
    margin-bottom: var(--charts-space-sm);
  }

  .charts-patient-panel__actions button {
    border-radius: 999px;
    border: 1px solid var(--ui-border);
    background: #ffffff;
    padding: 0.35rem 0.75rem;
    font-weight: 800;
    cursor: pointer;
    color: #0f172a;
  }

  .charts-patient-panel__actions button:hover {
    background: #f8fafc;
  }

  .patients-tab {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-md);
  }

  .charts-past-hub {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .charts-past-hub__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--charts-space-sm);
    flex-wrap: wrap;
  }

  .charts-past-hub__desc {
    margin: var(--charts-space-2xs) 0 0;
    font-size: 0.82rem;
    color: #475569;
    line-height: 1.35;
  }

  .charts-past-hub__tabs {
    display: flex;
    gap: var(--charts-space-xs);
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .charts-past-hub__content {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
    min-width: 0;
  }

  .charts-past-hub__feedback {
    margin: 0;
    padding: var(--charts-space-xs) var(--charts-space-sm);
    border-radius: var(--charts-radius-sm);
    border: 1px solid rgba(14, 116, 144, 0.3);
    background: #ecfeff;
    color: #155e75;
    font-size: 0.82rem;
    font-weight: 700;
  }

  .charts-past-hub__days {
    max-height: clamp(260px, 44vh, 620px);
    overflow: auto;
    padding-right: 2px;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
  }

  .charts-past-hub__day {
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border);
    background: #ffffff;
    overflow: hidden;
  }

  .charts-past-hub__day[data-active='1'] {
    border-color: rgba(37, 99, 235, 0.35);
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.08);
  }

  .charts-past-hub__day-summary {
    cursor: pointer;
    list-style: none;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    gap: var(--charts-space-xs) var(--charts-space-sm);
    align-items: center;
    padding: var(--charts-space-xs) var(--charts-space-sm);
    font-weight: 800;
    color: #0f172a;
    background: linear-gradient(90deg, rgba(239, 246, 255, 0.45), rgba(248, 250, 252, 0.9));
  }

  .charts-past-hub__day-summary::-webkit-details-marker {
    display: none;
  }

  .charts-past-hub__day-summary::after {
    content: '>';
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    color: #64748b;
    transition: transform 120ms ease;
  }

  .charts-past-hub__day[open] > .charts-past-hub__day-summary::after {
    transform: rotate(90deg);
  }

  .charts-past-hub__day-date {
    font-weight: 900;
    font-size: 0.9rem;
  }

  .charts-past-hub__day-meta {
    color: #64748b;
    font-size: 0.78rem;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .charts-past-hub__day-count {
    color: #475569;
    font-size: 0.78rem;
    font-weight: 800;
    white-space: nowrap;
  }

  .charts-past-hub__day-active {
    justify-self: end;
    font-size: 0.72rem;
    font-weight: 900;
    color: #1d4ed8;
    background: rgba(219, 234, 254, 0.9);
    border: 1px solid rgba(37, 99, 235, 0.25);
    padding: 0.1rem 0.45rem;
    border-radius: 999px;
    white-space: nowrap;
  }

  .charts-past-hub__day-content {
    padding: var(--charts-space-sm);
    border-top: 1px solid var(--ui-border-subtle);
    background: #f8fafc;
  }

  .charts-past-hub__columns {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--charts-space-sm);
    align-items: start;
  }

  @media (max-width: 720px) {
    .charts-past-hub__columns {
      grid-template-columns: 1fr;
    }
  }

  .charts-past-hub__col {
    min-width: 0;
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border-subtle);
    background: #ffffff;
    padding: var(--charts-space-sm);
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .charts-past-hub__col-header {
    display: flex;
    justify-content: space-between;
    gap: var(--charts-space-sm);
    flex-wrap: wrap;
    align-items: baseline;
  }

  .charts-past-hub__col-meta {
    color: #64748b;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .charts-past-hub__encounters {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-2xs);
  }

  .charts-past-hub__encounter {
    padding-bottom: var(--charts-space-2xs);
    border-bottom: 1px dashed var(--ui-border);
    display: flex;
    justify-content: space-between;
    gap: var(--charts-space-sm);
    align-items: flex-start;
  }

  .charts-past-hub__encounter:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .charts-past-hub__encounter[data-active='1'] {
    border-radius: var(--charts-radius-sm);
    background: rgba(239, 246, 255, 0.7);
    border-bottom: none;
    padding: var(--charts-space-xs);
  }

  .charts-past-hub__encounter[data-active='1'] + .charts-past-hub__encounter {
    border-top: 1px dashed var(--ui-border);
    padding-top: var(--charts-space-2xs);
  }

  .charts-past-hub__notes-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--charts-space-xs);
  }

  .charts-past-hub__note {
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border-subtle);
    background: #f8fafc;
    padding: var(--charts-space-sm);
  }

  .charts-past-hub__note-head {
    display: flex;
    justify-content: space-between;
    gap: var(--charts-space-sm);
    flex-wrap: wrap;
    align-items: baseline;
  }

  .charts-past-hub__note-meta {
    color: #64748b;
    font-size: 0.75rem;
  }

  .charts-past-hub__note-body {
    margin: var(--charts-space-xs) 0 0;
    font-size: 0.82rem;
    color: #0f172a;
    line-height: 1.35;
    word-break: break-word;
  }

  .charts-past-hub__order-groups {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .charts-past-hub__order-items {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-2xs);
  }

  .charts-past-hub__order-item {
    padding-bottom: var(--charts-space-2xs);
    border-bottom: 1px dashed var(--ui-border);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--charts-space-sm);
  }

  .charts-past-hub__order-item:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .charts-past-hub__order-label {
    min-width: 0;
    color: #0f172a;
    font-size: 0.82rem;
    line-height: 1.35;
    word-break: break-word;
  }

  .charts-past-hub__guard {
    margin: 0;
    padding: var(--charts-space-xs) var(--charts-space-sm);
    border-radius: var(--charts-radius-sm);
    border: 1px solid rgba(59, 130, 246, 0.25);
    background: #eff6ff;
    color: #0f172a;
    font-size: 0.85rem;
  }

  .charts-past-hub__list {
    max-height: clamp(260px, 46vh, 560px);
    overflow: auto;
    padding-right: 2px;
  }

  .charts-past-hub__items {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--charts-space-2xs);
  }

  .charts-past-hub__item {
    min-width: 0;
  }

  .charts-past-hub__headline {
    font-weight: 800;
    color: #0f172a;
    font-size: 0.92rem;
    line-height: 1.25;
  }

  .charts-past-hub__sub {
    margin-top: 2px;
    color: #475569;
    font-size: 0.82rem;
    line-height: 1.25;
    word-break: break-word;
  }

  .charts-past-hub__actions {
    margin-top: var(--charts-space-xs);
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-xs);
  }

  .charts-past-hub__do {
    border-radius: 999px;
    border: 1px solid rgba(59, 130, 246, 0.35);
    background: #eff6ff;
    padding: 0.3rem 0.6rem;
    font-weight: 800;
    cursor: pointer;
    color: #0f172a;
  }

  .charts-past-hub__do:disabled {
    cursor: not-allowed;
    opacity: 0.55;
    background: #e2e8f0;
  }

  .charts-past-hub__do--batch {
    border-color: rgba(14, 116, 144, 0.42);
    background: #ecfeff;
    color: #0f766e;
    font-size: 0.76rem;
    padding: 0.22rem 0.58rem;
  }

  .charts-past-hub__hint {
    color: #64748b;
    font-size: 0.75rem;
  }

  .charts-past-hub__group + .charts-past-hub__group {
    margin-top: var(--charts-space-sm);
    padding-top: var(--charts-space-sm);
    border-top: 1px solid var(--ui-border);
  }

  .charts-past-hub__group-header {
    display: flex;
    justify-content: space-between;
    gap: var(--charts-space-sm);
    flex-wrap: wrap;
    align-items: baseline;
    margin-bottom: var(--charts-space-xs);
  }

  .charts-past-hub__group-meta {
    color: #64748b;
    font-size: 0.75rem;
  }

  .patients-tab__important {
    display: flex;
    gap: var(--charts-space-sm);
    align-items: stretch;
    justify-content: space-between;
    padding: var(--charts-space-sm) var(--charts-space-md);
    border-radius: var(--charts-radius-md);
    border: 1px solid var(--ui-border);
    background: linear-gradient(135deg, #eef2ff, #ffffff);
  }

  .patients-tab__important-main {
    flex: 1;
    text-align: left;
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    color: inherit;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-2xs);
  }

  .patients-tab__important-title {
    font-size: 1.05rem;
    color: #0f172a;
  }

  .patients-tab__important-sub {
    font-size: 0.9rem;
    color: #475569;
    line-height: 1.35;
  }

  .patients-tab__important-actions {
    display: flex;
    gap: var(--charts-space-sm);
    align-items: center;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .patients-tab__primary,
  .patients-tab__ghost {
    border-radius: 12px;
    border: 1px solid rgba(59, 130, 246, 0.35);
    background: #eff6ff;
    padding: 0.55rem 0.75rem;
    font-weight: 700;
    cursor: pointer;
    color: #0f172a;
  }

  .patients-tab__primary {
    background: linear-gradient(135deg, #2563eb, #4f46e5);
    border-color: transparent;
    color: #ffffff;
    box-shadow: 0 10px 24px rgba(79, 70, 229, 0.22);
  }

  .patients-tab__ghost {
    background: #f8fafc;
    border-color: var(--ui-border);
    color: #0f172a;
  }

  .patients-tab__primary:disabled,
  .patients-tab__ghost:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    box-shadow: none;
  }

  .patients-tab__meta {
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border);
    background: #ffffff;
    padding: var(--charts-space-xs) var(--charts-space-sm);
  }

  .patients-tab__meta-summary {
    cursor: pointer;
    list-style: none;
    font-weight: 900;
    color: #0f172a;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--charts-space-sm);
  }

  .patients-tab__meta-summary::-webkit-details-marker {
    display: none;
  }

  .patients-tab__meta-summary::after {
    content: '>';
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    color: #64748b;
    transition: transform 120ms ease;
  }

  .patients-tab__meta[open] > .patients-tab__meta-summary::after {
    transform: rotate(90deg);
  }

  .patients-tab__meta-body {
    margin-top: var(--charts-space-xs);
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .patients-tab__meta-transition {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .patients-tab__meta-label {
    margin: 0;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #64748b;
  }

  .patients-tab__meta-desc {
    margin: 0;
    color: #475569;
    line-height: 1.35;
  }

  .patients-tab__list-controls {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .patients-tab__list-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--charts-space-sm);
    flex-wrap: wrap;
  }

  .patients-tab__list-meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-sm);
    align-items: baseline;
    color: #475569;
    font-size: 0.88rem;
  }

  .patients-tab__list-meta strong {
    color: #0f172a;
    font-weight: 900;
  }

  .patients-tab__list-actions {
    display: flex;
    gap: var(--charts-space-xs);
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .patients-tab__filters {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .patients-tab__filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-sm);
    align-items: flex-end;
  }

  .patients-tab__chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-xs);
    align-items: center;
  }

  .patients-tab__chip {
    border-radius: 999px;
    border: 1px solid var(--ui-border);
    background: #f8fafc;
    padding: 0.32rem 0.65rem;
    font-weight: 800;
    cursor: pointer;
    color: #0f172a;
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
    white-space: nowrap;
  }

  .patients-tab__chip:hover {
    background: #ffffff;
  }

  .patients-tab__chip.is-active {
    background: #1d4ed8;
    border-color: transparent;
    color: #ffffff;
  }

  .patients-tab__chip-count {
    font-size: 0.78rem;
    font-weight: 900;
    color: inherit;
    opacity: 0.85;
  }

  .patients-tab__select {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-2xs);
    font-size: 0.88rem;
    color: #475569;
    min-width: 160px;
  }

  .patients-tab__select select {
    border-radius: var(--charts-radius-sm);
    border: 1px solid #cbd5f5;
    padding: 0.45rem 0.6rem;
    background: #ffffff;
    font-family: inherit;
  }

  .patients-tab__clear {
    white-space: nowrap;
  }

  .patients-tab__filter-notice {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--charts-space-sm);
    flex-wrap: wrap;
    padding: var(--charts-space-xs) var(--charts-space-sm);
    border-radius: var(--charts-radius-sm);
    border: 1px solid rgba(59, 130, 246, 0.25);
    background: #eff6ff;
    color: #0f172a;
  }

  .patients-tab__controls {
    display: flex;
    justify-content: space-between;
    gap: var(--charts-space-md);
    flex-wrap: wrap;
    align-items: center;
  }

  .patients-tab__search {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-2xs);
    font-size: 0.9rem;
    color: #475569;
  }

  .patients-tab__search input {
    border-radius: var(--charts-radius-sm);
    border: 1px solid #cbd5f5;
    padding: var(--charts-space-sm) var(--charts-space-md);
    min-width: 240px;
  }

  .patients-tab__edit-guard {
    padding: var(--charts-space-xs) var(--charts-space-sm);
    background: #f0f9ff;
    border: 1px solid rgba(59, 130, 246, 0.25);
    border-radius: var(--charts-radius-sm);
    color: #0f172a;
  }

  .patients-tab__draft-dialog {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .patients-tab__draft-summary {
    display: grid;
    gap: var(--charts-space-xs);
    padding: var(--charts-space-xs);
    border-radius: var(--charts-radius-sm);
    background: #f8fafc;
    border: 1px solid var(--ui-border);
  }

  .patients-tab__draft-summary strong {
    font-size: 0.95rem;
    color: #0f172a;
  }

  .patients-tab__draft-label {
    display: block;
    font-size: 0.75rem;
    color: #64748b;
  }

  .patients-tab__draft-reason {
    margin: 0;
    font-size: 0.9rem;
    color: #475569;
  }

  .patients-tab__draft-reasons {
    margin: 0;
    padding-left: 1.1rem;
    color: #0f172a;
    font-size: 0.9rem;
    display: grid;
    gap: 2px;
  }

  .patients-tab__draft-reasons li {
    line-height: 1.35;
  }

  .patients-tab__draft-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-xs);
    justify-content: flex-end;
  }

  .patients-tab__draft-actions button {
    border-radius: 10px;
    border: 1px solid rgba(59, 130, 246, 0.3);
    padding: 0.5rem 0.8rem;
    cursor: pointer;
    background: #f8fafc;
    font-weight: 700;
    color: #0f172a;
  }

  .patients-tab__draft-actions button:last-child {
    background: #fee2e2;
    border-color: rgba(248, 113, 113, 0.5);
  }

  .patients-tab__switch-dialog {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .patients-tab__switch-summary {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--charts-space-sm);
    padding: var(--charts-space-xs);
    border-radius: var(--charts-radius-sm);
    background: #f8fafc;
    border: 1px solid var(--ui-border);
  }

  .patients-tab__switch-title {
    font-size: 0.95rem;
    color: #0f172a;
  }

  .patients-tab__switch-lines {
    margin-top: 4px;
    display: grid;
    gap: 2px;
    color: #475569;
    font-size: 0.88rem;
    line-height: 1.35;
  }

  .patients-tab__switch-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--charts-space-xs);
    flex-wrap: wrap;
  }

  .patients-tab__header {
    display: flex;
    justify-content: space-between;
    gap: var(--charts-space-md);
    align-items: flex-start;
  }

  .patients-tab__badges {
    display: flex;
    gap: var(--charts-space-sm);
    flex-wrap: wrap;
    align-items: center;
  }

  .patients-tab__badge {
    font-size: 0.85rem;
  }

  .patients-tab__table {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
    max-height: clamp(260px, 55vh, 720px);
    overflow: auto;
    padding-right: 2px;
  }

  .patients-tab__body {
    display: grid;
    grid-template-columns: minmax(240px, 0.9fr) minmax(260px, 1fr);
    gap: var(--charts-space-md);
  }

  .patients-tab__row {
    padding: var(--charts-space-md);
    border-radius: var(--charts-radius-sm);
    background: #f8fafc;
    border: 1px solid var(--ui-border);
    text-align: left;
    width: 100%;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
  }

  .patients-tab__row--selected {
    border-color: #1d4ed8;
    box-shadow: var(--charts-shadow-none);
  }

  .patients-tab__row:focus-visible {
    outline: 2px solid #1d4ed8;
    outline-offset: 2px;
  }

  .patients-tab__row-meta {
    display: flex;
    justify-content: space-between;
    gap: var(--charts-space-sm);
    align-items: center;
  }

  .patients-tab__row-id {
    font-size: 0.82rem;
    color: #475569;
  }

  .patients-tab__row-id .patient-meta-row__line {
    gap: 0.2rem 0.45rem;
  }

  .patients-tab__row-id .patient-meta-row__value {
    font-weight: 700;
    color: #0f172a;
  }

  .patients-tab__row-detail {
    margin: var(--charts-space-xs) 0 var(--charts-space-2xs);
    color: #475569;
  }

  .patients-tab__row-status {
    font-size: 0.9rem;
    color: #1d4ed8;
  }

  .patients-tab__row-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--charts-space-sm);
    flex-wrap: wrap;
  }

  .patients-tab__row-time {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    min-width: 86px;
  }

  .patients-tab__row-time-label {
    font-size: 0.75rem;
    font-weight: 900;
    color: #64748b;
    letter-spacing: 0.06em;
  }

  .patients-tab__row-time-value {
    font-size: 1rem;
    font-weight: 900;
    color: #0f172a;
  }

  .patients-tab__row-time-missing {
    font-size: 0.92rem;
    font-weight: 800;
    color: #64748b;
  }

  .patients-tab__row-pills {
    display: flex;
    gap: var(--charts-space-xs);
    flex-wrap: wrap;
    align-items: center;
  }

  .patients-tab__row-pill {
    font-size: 0.82rem;
  }

  .patients-tab__row-pill--current {
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12);
  }

  .patients-tab__row-main {
    display: flex;
    align-items: baseline;
    gap: var(--charts-space-xs);
    flex-wrap: wrap;
  }

  .patients-tab__row-name {
    font-size: 1rem;
    font-weight: 900;
    color: #0f172a;
  }

  .patients-tab__row-patientid {
    font-size: 0.82rem;
    font-weight: 900;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    color: #0f172a;
    background: rgba(219, 234, 254, 0.8);
    border: 1px solid rgba(37, 99, 235, 0.25);
    border-radius: 999px;
    padding: 0.08rem 0.5rem;
    white-space: nowrap;
  }

  .patients-tab__row-sub {
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-xs) var(--charts-space-sm);
    color: #475569;
    font-size: 0.85rem;
    line-height: 1.35;
  }

  .patients-tab__row-subitem {
    font-weight: 800;
    color: #334155;
    white-space: nowrap;
  }

  .patients-tab__row-memo {
    flex: 1 1 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #475569;
  }

  .patients-tab__row-memo.is-empty {
    color: #94a3b8;
  }

  .patients-tab__detail {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .patients-tab__card {
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border);
    background: #f8fafc;
    padding: var(--charts-space-sm);
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
    box-shadow: var(--charts-shadow-none);
  }

  .patients-tab__card-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--charts-space-sm);
    flex-wrap: wrap;
  }

  .patients-tab__card-header h3 {
    margin: 0;
    font-size: 1.05rem;
    color: #0f172a;
  }

  .patients-tab__card-actions {
    display: flex;
    gap: var(--charts-space-xs);
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .patients-tab__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--charts-space-xs) var(--charts-space-sm);
  }

  .patients-tab__kv {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-2xs);
    min-width: 0;
  }

  .patients-tab__kv span {
    font-size: 0.85rem;
    color: #64748b;
  }

  .patients-tab__kv strong {
    color: #0f172a;
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  .patients-tab__memo {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
  }

  .patients-tab__memo-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--charts-space-sm);
    flex-wrap: wrap;
  }

  .patients-tab__memo-header h4 {
    margin: 0;
    font-size: 0.95rem;
    color: #0f172a;
  }

  .patients-tab__memo-actions {
    display: flex;
    gap: var(--charts-space-xs);
    flex-wrap: wrap;
  }

  .patients-tab__memo textarea {
    border-radius: var(--charts-radius-sm);
    border: 1px solid #cbd5f5;
    padding: var(--charts-space-sm) var(--charts-space-sm);
    font-family: inherit;
    resize: vertical;
    background: #ffffff;
  }

  .patients-tab__detail-empty {
    margin: 0;
    color: #475569;
  }

  .patients-tab__detail-guard {
    color: #b45309;
  }

  .patients-tab__detail-actions {
    display: flex;
    gap: var(--charts-space-xs);
    flex-wrap: wrap;
    align-items: center;
  }

  .patients-tab__tab {
    border-radius: 999px;
    border: 1px solid rgba(59, 130, 246, 0.25);
    background: #eff6ff;
    color: #1d4ed8;
    padding: 0.35rem 0.75rem;
    font-weight: 800;
    cursor: pointer;
  }

  .patients-tab__tab.is-active {
    background: #1d4ed8;
    color: #ffffff;
    border-color: transparent;
  }

  .patients-tab__history-filters {
    display: grid;
    grid-template-columns: 1.4fr 0.8fr 0.8fr;
    gap: var(--charts-space-sm);
    align-items: end;
  }

  .patients-tab__history-filters label {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-2xs);
    color: #475569;
    font-size: 0.9rem;
  }

  .patients-tab__history-filters input {
    border-radius: var(--charts-radius-sm);
    border: 1px solid #cbd5f5;
    padding: var(--charts-space-sm) var(--charts-space-sm);
    font-family: inherit;
  }

  .patients-tab__history {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
  }

  .patients-tab__history-row {
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border);
    background: #ffffff;
    padding: var(--charts-space-sm);
    text-align: left;
    cursor: pointer;
  }

  .patients-tab__history-row.is-active {
    border-color: #1d4ed8;
    box-shadow: var(--charts-shadow-none);
  }

  .patients-tab__history-main {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--charts-space-sm);
  }

  .patients-tab__history-badge {
    background: #eef2ff;
    border: 1px solid rgba(37, 99, 235, 0.25);
    border-radius: 999px;
    padding: var(--charts-space-2xs) var(--charts-space-xs);
    font-size: 0.85rem;
    font-weight: 800;
    color: #1d4ed8;
    white-space: nowrap;
  }

  .patients-tab__history-sub {
    margin-top: var(--charts-space-2xs);
    display: flex;
    gap: var(--charts-space-sm);
    flex-wrap: wrap;
    color: #475569;
    font-size: 0.9rem;
  }

  .patients-tab__diff {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-2xs);
  }

  .patients-tab__diff-head {
    display: grid;
    grid-template-columns: 0.9fr 1fr 1.2fr;
    gap: var(--charts-space-sm);
    color: #64748b;
    font-size: 0.85rem;
    font-weight: 800;
    padding-bottom: var(--charts-space-2xs);
    border-bottom: 1px dashed var(--ui-border-strong);
  }

  .patients-tab__diff-row {
    display: grid;
    grid-template-columns: 0.9fr 1fr 1.2fr;
    gap: var(--charts-space-sm);
    border-radius: var(--charts-radius-sm);
    padding: var(--charts-space-xs) var(--charts-space-sm);
    background: #ffffff;
    border: 1px solid var(--ui-border-subtle);
    align-items: start;
  }

  .patients-tab__diff-row.is-changed {
    border-color: rgba(245, 158, 11, 0.55);
    background: #fffbeb;
  }

  .patients-tab__diff-row.is-highlighted {
    box-shadow: var(--charts-shadow-none);
    outline: 2px solid rgba(29, 78, 216, 0.35);
    outline-offset: 0;
  }

  .patients-tab__diff-label {
    font-weight: 800;
    color: #0f172a;
  }

  .patients-tab__diff-before,
  .patients-tab__diff-after {
    overflow-wrap: anywhere;
    color: #0f172a;
  }

  .patients-tab__audit {
    margin-top: var(--charts-space-2xs);
    padding: var(--charts-space-sm);
    border-radius: var(--charts-radius-sm);
    background: #fff7ed;
    border: 1px solid #f59e0b;
    color: #92400e;
  }

  .patients-tab__modal {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 50;
  }

  .patients-tab__modal-card {
    width: min(860px, 100%);
    background: #ffffff;
    border-radius: var(--charts-radius-lg);
    border: 1px solid var(--ui-border);
    box-shadow: var(--charts-shadow-2);
    padding: var(--charts-space-md);
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .patients-tab__modal-header {
    display: flex;
    justify-content: space-between;
    gap: var(--charts-space-sm);
    align-items: baseline;
  }

  .patients-tab__modal-header h3 {
    margin: 0;
    font-size: 1.1rem;
    color: #0f172a;
  }

  .patients-tab__modal-sub {
    margin: 0;
    color: #475569;
    font-size: 0.9rem;
  }

  .patients-tab__modal-list {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .patients-tab__modal-row {
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border);
    background: #f8fafc;
    padding: var(--charts-space-sm) var(--charts-space-md);
    text-align: left;
    cursor: pointer;
  }

  .patients-tab__modal-row-main {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--charts-space-sm);
  }

  .patients-tab__modal-pill {
    border-radius: 999px;
    background: #eef2ff;
    border: 1px solid rgba(37, 99, 235, 0.25);
    color: #1d4ed8;
    padding: var(--charts-space-2xs) var(--charts-space-sm);
    font-weight: 800;
    font-size: 0.85rem;
    white-space: nowrap;
  }

  .patients-tab__modal-row-sub {
    margin-top: var(--charts-space-2xs);
    color: #475569;
    font-size: 0.88rem;
    display: flex;
    flex-wrap: wrap;
    gap: var(--charts-space-sm);
  }

  .patients-tab__modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--charts-space-sm);
    flex-wrap: wrap;
  }

  .patient-form__alert {
    border-radius: var(--charts-radius-sm);
    border: 1px solid rgba(239, 68, 68, 0.35);
    background: #fef2f2;
    padding: var(--charts-space-sm) var(--charts-space-md);
    color: #991b1b;
  }

  .patient-form__alert-title {
    margin: 0;
    font-weight: 900;
    color: #7f1d1d;
  }

  .patient-form__alert-list {
    margin: var(--charts-space-xs) 0 0;
    padding-left: var(--charts-space-xl);
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-2xs);
  }

  .patient-form__alert-link {
    border: none;
    padding: 0;
    background: transparent;
    cursor: pointer;
    color: inherit;
    text-decoration: underline;
    font: inherit;
    text-align: left;
  }

  .patient-edit__notice {
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border);
    background: #f8fafc;
    padding: var(--charts-space-sm) var(--charts-space-md);
    color: #0f172a;
  }

  .patient-edit__notice--success {
    border-color: rgba(34, 197, 94, 0.35);
    background: #f0fdf4;
  }

  .patient-edit__notice--error {
    border-color: rgba(239, 68, 68, 0.35);
    background: #fef2f2;
  }

  .patient-edit__notice--info {
    border-color: rgba(59, 130, 246, 0.25);
    background: #eff6ff;
  }

  .patient-edit__notice-title {
    margin: 0;
    font-weight: 900;
  }

  .patient-edit__notice-detail {
    margin: var(--charts-space-xs) 0 0;
    color: #475569;
  }

  .patient-edit__meta {
    display: flex;
    gap: var(--charts-space-sm);
    flex-wrap: wrap;
    color: #64748b;
    font-size: 0.85rem;
  }

  .patient-edit__form {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .patient-edit__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--charts-space-sm) var(--charts-space-sm);
  }

  .patient-edit__field {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-2xs);
    color: #475569;
    font-size: 0.9rem;
  }

  .patient-edit__field--wide {
    grid-column: 1 / -1;
  }

  .patient-edit__field input,
  .patient-edit__field select {
    border-radius: var(--charts-radius-sm);
    border: 1px solid #cbd5f5;
    padding: var(--charts-space-sm) var(--charts-space-sm);
    font-family: inherit;
    background: #ffffff;
  }

  .patient-edit__field input[aria-readonly='true'] {
    background: #f1f5f9;
    color: #475569;
  }

  .patient-edit__field-error {
    color: #b91c1c;
  }

  .patient-edit__actions {
    display: flex;
    gap: var(--charts-space-sm);
    flex-wrap: wrap;
    align-items: center;
  }

  .patient-edit__actions-spacer {
    flex: 1;
  }

  .patient-edit__review-title {
    margin: 0;
    font-weight: 900;
    color: #0f172a;
  }

  .patient-edit__diff {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
  }

  .patient-edit__diff-header {
    display: grid;
    grid-template-columns: 0.8fr 1fr 1fr;
    gap: var(--charts-space-sm);
    color: #64748b;
    font-weight: 900;
    font-size: 0.85rem;
    padding-bottom: var(--charts-space-2xs);
    border-bottom: 1px dashed var(--ui-border-strong);
  }

  .patient-edit__diff-row {
    display: grid;
    grid-template-columns: 0.8fr 1fr 1fr;
    gap: var(--charts-space-sm);
    padding: var(--charts-space-xs) var(--charts-space-sm);
    border-radius: var(--charts-radius-sm);
    border: 1px solid var(--ui-border-subtle);
    background: #ffffff;
    align-items: start;
  }

  .patient-edit__diff-row.is-changed {
    border-color: rgba(245, 158, 11, 0.55);
    background: #fffbeb;
  }

  .patient-edit__diff-label {
    font-weight: 900;
    color: #0f172a;
  }

  .patient-edit__diff-before,
  .patient-edit__diff-after {
    overflow-wrap: anywhere;
    color: #0f172a;
  }

  .patient-edit__confirm {
    display: flex;
    gap: var(--charts-space-sm);
    align-items: center;
    color: #0f172a;
    font-weight: 800;
  }

  .patient-edit__blocked {
    padding: var(--charts-space-md);
    border-radius: var(--charts-radius-md);
    background: #fef2f2;
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #991b1b;
  }

  .patient-edit__blocked p {
    margin: var(--charts-space-xs) 0;
  }

  .telemetry-panel {
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-sm);
  }

  .telemetry-panel__meta {
    margin: 0;
    color: #475569;
  }

  .telemetry-panel__list {
    margin: 0;
    padding-left: var(--charts-space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--charts-space-xs);
    color: #0f172a;
  }

  @media (max-width: 1280px) {
    .charts-workbench__layout {
      grid-template-columns: 1fr;
    }

    .charts-workbench__body {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .charts-workbench__sticky-grid {
      grid-template-columns: 1fr;
    }

    .charts-workbench__sticky-side {
      display: none;
    }

    .charts-workbench__column--right {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 1023px) {
    .charts-workbench {
      --charts-floating-offset-x: 8px;
      --charts-floating-offset-y: max(8px, env(safe-area-inset-bottom));
      --charts-floating-compact-width: calc(100vw - 16px);
      --charts-utility-footer-width: calc(100vw - 16px);
      --charts-utility-drawer-width: calc(100vw - 16px);
      --charts-utility-footer-height: clamp(72px, 13vh, 104px);
      --charts-utility-drawer-height: min(76vh, calc(100dvh - 120px - env(safe-area-inset-top)));
    }

    .charts-workbench__layout {
      grid-template-columns: 1fr;
    }

    .charts-workbench__body {
      grid-template-columns: 1fr;
    }

    .charts-workbench__sticky,
    .charts-workbench__sticky-grid,
    .document-timeline__content,
    .orca-summary__details,
    .charts-page__grid {
      grid-template-columns: 1fr;
    }

    .charts-workbench__side {
      left: var(--charts-floating-offset-x);
      right: var(--charts-floating-offset-x);
      width: auto;
      min-width: 0;
      max-width: none;
    }

    .charts-docked-panel {
      border-radius: var(--charts-radius-lg);
    }

    .charts-docked-panel__tab {
      min-width: 94px;
    }

    .charts-docked-panel__drawer {
      bottom: calc(var(--charts-floating-offset-y) + var(--charts-utility-footer-height));
      max-height: var(--charts-utility-drawer-height);
    }
  }

  @media (max-width: 920px) {
    .charts-workbench__sticky,
    .document-timeline__content,
    .orca-summary__details,
    .charts-page__grid {
      grid-template-columns: 1fr;
    }

    .patients-tab__header {
      flex-direction: column;
    }

    .patients-tab__list-head {
      flex-direction: column;
      align-items: flex-start;
    }

    .patients-tab__filter-row {
      align-items: stretch;
    }

    .patients-tab__search input {
      min-width: 0;
      width: 100%;
    }

    .patients-tab__select {
      min-width: 0;
      flex: 1 1 220px;
    }

    .patients-tab__switch-summary {
      grid-template-columns: 1fr;
    }

    .patients-tab__body {
      grid-template-columns: 1fr;
    }

    .patients-tab__grid {
      grid-template-columns: 1fr;
    }

    .patients-tab__history-filters {
      grid-template-columns: 1fr;
    }
  }
`;
