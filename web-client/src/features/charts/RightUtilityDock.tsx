import {
  RIGHT_UTILITY_TOOLS,
  resolveRightUtilityToolLabel,
  type RightUtilityTool,
} from './rightUtilityTools';

type RightUtilityDockProps = {
  activeTool: RightUtilityTool;
  onSelectTool: (tool: RightUtilityTool) => void;
};

export function RightUtilityDock({ activeTool, onSelectTool }: RightUtilityDockProps) {
  return (
    <aside className="soap-note__right-dock" aria-label="右ドック">
      <p className="soap-note__right-dock-label">補助</p>
      <div className="soap-note__right-dock-scroll">
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
              aria-label={`${resolveRightUtilityToolLabel(item.tool)}を開く`}
              title={`${resolveRightUtilityToolLabel(item.tool)}を開く`}
              onClick={() => onSelectTool(item.tool)}
            >
              <span className="soap-note__right-dock-button-text">{item.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
