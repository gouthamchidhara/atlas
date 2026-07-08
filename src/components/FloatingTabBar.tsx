import type { LucideIcon } from 'lucide-react'

export type TabId = 'home' | 'plan' | 'flights' | 'saved'

type TabBarProps = {
  active: TabId
  onChange: (tab: TabId) => void
  tabs: Array<{ id: TabId; label: string; icon: LucideIcon }>
}

/** Floating glass tab bar — the app's primary navigation, docked over the map. */
export function FloatingTabBar({ active, onChange, tabs }: TabBarProps) {
  return (
    <nav className="tab-bar" aria-label="Primary">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            className={`tab-item${isActive ? ' tab-item--active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onChange(tab.id)}
          >
            <Icon aria-hidden="true" />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
