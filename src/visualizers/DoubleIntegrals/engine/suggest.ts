import type { Region, CoordinateHint } from "./types";
import type { MathNode } from "mathjs";

export function suggestCoordinates(ast: MathNode | null, region: Region): CoordinateHint {
  const reasons: string[] = [];
  let polarScore = 0;
  let cartesianScore = 0;

  if (region.type === "polar") {
    polarScore += 3;
    reasons.push("Region is natively specified in polar coordinates.");
  } else if (region.type === "rectangle") {
    cartesianScore += 2;
    reasons.push("Region is a simple Cartesian rectangle.");
  }

  if (ast) {
    let containsR2 = false;
    (ast as any).traverse((node: any) => {
      if (node.type === "SymbolNode") {
        if (node.name === "r" || node.name === "theta") containsR2 = true;
      }
    });

    if (containsR2) {
      polarScore += 2;
      reasons.push("Integrand explicitly references polar variables (r or theta).");
    }
  }

  if (polarScore > cartesianScore) {
    return { recommendation: "polar", reasons };
  } else if (cartesianScore > polarScore) {
    return { recommendation: "cartesian", reasons };
  }
  return { recommendation: "either", reasons: ["Both Cartesian and Polar formulations are well suited."] };
}
