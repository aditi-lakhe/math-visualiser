import { parseExpression } from "./parse";
import type { Region } from "./types";

export interface SetupLaTeX {
  cartesianLaTeX: string;
  polarLaTeX: string;
}

export function generateSetupLaTeX(fExpr: string, region: Region): SetupLaTeX {
  const pFn = parseExpression(fExpr);
  const cleanF = pFn.ok ? fExpr : "f(x,y)";

  let cartesian = "";
  if (region.type === "rectangle") {
    cartesian = `\\int_{${region.xMin}}^{${region.xMax}} \\int_{${region.yMin}}^{${region.yMax}} ${cleanF} \\, dy \\, dx`;
  } else if (region.type === "typeI") {
    cartesian = `\\int_{${region.xMin}}^{${region.xMax}} \\int_{${region.g1}}^{${region.g2}} ${cleanF} \\, dy \\, dx`;
  } else if (region.type === "typeII") {
    cartesian = `\\int_{${region.yMin}}^{${region.yMax}} \\int_{${region.h1}}^{${region.h2}} ${cleanF} \\, dx \\, dy`;
  } else {
    cartesian = `\\iint_{R} ${cleanF} \\, dA`;
  }

  let polarIntegrand = cleanF;
  if (pFn.ok && pFn.ast) {
    try {
      const transformedAst = pFn.ast.transform((node: any) => {
        if (node.type === "SymbolNode" && node.name === "x") {
          return (parseExpression("(r \\cdot \\cos(\\theta))") as any).ast;
        }
        if (node.type === "SymbolNode" && node.name === "y") {
          return (parseExpression("(r \\cdot \\sin(\\theta))") as any).ast;
        }
        return node;
      });
      polarIntegrand = transformedAst.toString();
    } catch {
      polarIntegrand = cleanF;
    }
  }

  let polar = "";
  if (region.type === "polar") {
    polar = `\\int_{${region.thetaMin}}^{${region.thetaMax}} \\int_{${region.r1}}^{${region.r2}} \\left(${polarIntegrand}\\right) \\cdot r \\, dr \\, d\\theta`;
  } else {
    polar = `\\int_{\\alpha}^{\\beta} \\int_{r_1(\\theta)}^{r_2(\\theta)} \\left(${polarIntegrand}\\right) \\cdot r \\, dr \\, d\\theta`;
  }

  return { cartesianLaTeX: cartesian, polarLaTeX: polar };
}