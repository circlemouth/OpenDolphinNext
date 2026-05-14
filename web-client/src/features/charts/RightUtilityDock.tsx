import {
  RIGHT_UTILITY_TOOLS,
  resolveRightUtilityToolLabel,
  type RightUtilityTool,
} from './rightUtilityTools';
import { ClinicalIcon, type ClinicalIconKey } from '../shared/ClinicalIcon';

type RightUtilityDockProps = {
  activeTool: RightUtilityTool;
  onSelectTool: (tool: RightUtilityTool) => void;
  utilityRailItems?: RightUtilityDockUtilityItem[];
  activeUtilityAction?: RightUtilityDockUtilityAction | null;
  onUtilityRailActionSelect?: (action: RightUtilityDockUtilityAction, trigger: HTMLButtonElement) => void;
  onShortcutDialogOpen?: () => void;
  shortcutsOpen?: boolean;
};

export type RightUtilityDockUtilityAction = 'order-set' | 'document' | 'imaging';

export type RightUtilityDockUtilityItem = {
  id: RightUtilityDockUtilityAction;
  label: string;
  shortLabel: string;
  shortcut: string;
  disabled?: boolean;
  title?: string;
  dirty?: boolean;
  meta?: string | null;
  kind?: string;
};

const rightUtilityIconByTool: Record<RightUtilityTool, ClinicalIconKey> = {
  prescription: 'prescription',
  injection: 'injection',
  treatment: 'treatment',
  test: 'test',
  charge: 'charge',
};

export function RightUtilityDock({
  activeTool,
  onSelectTool,
  utilityRailItems = [],
  activeUtilityAction = null,
  onUtilityRailActionSelect,
  onShortcutDialogOpen,
  shortcutsOpen = false,
}: RightUtilityDockProps) {
  return (
    <aside className="soap-note__right-dock" aria-label="右ドック">
      <div className="soap-note__right-dock-scroll">
        <div className="soap-note__right-dock-group" aria-label="候補カテゴリ">
          <p className="soap-note__right-dock-label">候補</p>
          {RIGHT_UTILITY_TOOLS.map((item) => {
            const isActive = item.tool === activeTool;
            return (
              <button
                key={`right-dock-${item.tool}`}
                type="button"
                className="soap-note__right-dock-button order-dock__subtype-tab"
                data-tool={item.tool}
                data-active={isActive ? 'true' : 'false'}
                aria-pressed={isActive}
                aria-label={`${resolveRightUtilityToolLabel(item.tool)}候補を開く`}
                title={`${resolveRightUtilityToolLabel(item.tool)}候補を開く`}
                onClick={() => onSelectTool(item.tool)}
              >
                <ClinicalIcon icon={rightUtilityIconByTool[item.tool]} />
                <span className="soap-note__right-dock-button-text">{item.label}</span>
              </button>
            );
          })}
        </div>
        {utilityRailItems.length > 0 || onShortcutDialogOpen ? (
          <div className="soap-note__right-dock-group" aria-label="ユーティリティ">
            <p className="soap-note__right-dock-label">操作</p>
            {utilityRailItems.map((item) => {
              const isActive = item.id === activeUtilityAction;
              const meta = item.meta ? `（${item.meta}）` : '';
              return (
                <button
                  key={`utility-rail-${item.id}`}
                  id={`charts-docked-tab-${item.id}`}
                  type="button"
                  className="soap-note__right-dock-button soap-note__right-dock-button--utility"
                  data-utility-action={item.id}
                  data-utility-kind={item.kind}
                  data-active={isActive ? 'true' : 'false'}
                  aria-pressed={isActive}
                  aria-controls="charts-docked-panel"
                  aria-expanded={isActive}
                  aria-label={`${item.label}${meta}`}
                  title={item.disabled ? item.title : item.shortcut}
                  disabled={item.disabled}
                  onClick={(event) => onUtilityRailActionSelect?.(item.id, event.currentTarget)}
                >
                  <span className="soap-note__right-dock-utility-icon" aria-hidden="true">
                    {item.shortLabel}
                  </span>
                  <span className="soap-note__right-dock-button-text">
                    {item.label}
                    {item.dirty ? <span className="soap-note__right-dock-dirty" aria-hidden="true">●</span> : null}
                    {item.meta ? <span className="soap-note__right-dock-meta">{item.meta}</span> : null}
                  </span>
                </button>
              );
            })}
            {onShortcutDialogOpen ? (
              <button
                type="button"
                className="soap-note__right-dock-button soap-note__right-dock-button--utility"
                data-utility-action="shortcuts"
                aria-haspopup="dialog"
                aria-expanded={shortcutsOpen}
                aria-label="ショートカット一覧"
                title="ショートカット一覧"
                onClick={onShortcutDialogOpen}
              >
                <span className="soap-note__right-dock-utility-icon" aria-hidden="true">?</span>
                <span className="soap-note__right-dock-button-text">ショートカット</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
