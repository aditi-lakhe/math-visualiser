import React from "react";
import FourierEpicycles from "./FourierEpicycles/FourierEpicycles";
import DoubleIntegrals from "./DoubleIntegrals/DoubleIntegrals";

export interface VisualizerModule {
  id: string;
  title: string;
  description: string;
  Component: React.ComponentType;
}

export const registry: VisualizerModule[] = [
  {
    id: "double-integrals",
    title: "Double Integrals",
    description: "Numerically explore regions, Riemann sums, and integrals.",
    Component: DoubleIntegrals,
  },
  {
    id: "fourier",
    title: "Fourier Epicycles",
    description: "Closed path decomposition using rotating complex epicycles.",
    Component: FourierEpicycles,
  },
];
