import { useState } from "react";
import Navigation from "./components/Navigation";
import { registry } from "./visualizers/registry";
import "./App.css";

function App() {
  const [activeId, setActiveId] = useState("fourier");
  const activeModule = registry.find((module) => module.id === activeId) ?? registry[0];
  const ActiveVisualizer = activeModule.Component;

  return (
    <div className="app-container">
      <Navigation activeId={activeModule.id} onSelect={setActiveId} />
      <ActiveVisualizer />
    </div>
  );
}

export default App;
