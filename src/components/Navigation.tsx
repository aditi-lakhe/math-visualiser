import React, { useState } from "react";
import { registry } from "../visualizers/registry";
import "./Navigation.css";

interface NavigationProps {
  activeId: string;
  onSelect: (id: string) => void;
}

export function Navigation({ activeId, onSelect }: NavigationProps): React.ReactElement {
  const [collapsed, setCollapsed] = useState<boolean>(false);

  return (
    <nav className={`nav-sidebar ${collapsed ? "collapsed" : ""}`}>
      <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
        {collapsed ? "☰" : "✕"}
      </button>

      {!collapsed && (
        <div className="nav-content">
          <h2 className="nav-title">Math Visualizer</h2>
          <div className="nav-list">
            {registry.map((mod) => (
              <button
                key={mod.id}
                className={`nav-item ${mod.id === activeId ? "active" : ""}`}
                onClick={() => onSelect(mod.id)}
              >
                <div className="nav-item-title">{mod.title}</div>
                <div className="nav-item-desc">{mod.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navigation;