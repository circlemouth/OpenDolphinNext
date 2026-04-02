import type { DeliverySection } from './types';
import { DELIVERY_SECTION_ITEMS } from './types';

type DeliverySubNavProps = {
  activeSection: DeliverySection;
  onChange: (section: DeliverySection) => void;
};

export function DeliverySubNav({ activeSection, onChange }: DeliverySubNavProps) {
  const groups = [
    { id: 'settings', label: '設定' },
    { id: 'status', label: '状態確認' },
    { id: 'investigation', label: '調査' },
  ] as const;

  return (
    <nav className="admin-subnav" aria-label="配信・運用サブナビ">
      {groups.map((group) => (
        <div key={group.id} className="admin-subnav__group">
          <p className="admin-subnav__group-label">{group.label}</p>
          {DELIVERY_SECTION_ITEMS.filter((item) => item.group === group.id).map((item) => (
            <button
              key={item.id}
              type="button"
              className={`admin-subnav__item${activeSection === item.id ? ' is-active' : ''}`}
              aria-current={activeSection === item.id ? 'page' : undefined}
              onClick={() => onChange(item.id)}
              title={item.description}
            >
              <span className="admin-subnav__label">{item.label}</span>
              <span className="admin-subnav__desc">{item.description}</span>
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
