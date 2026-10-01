import { parse as mathParse } from "mathjs";
import type { ParseResult } from "./types";

const ALLOWED_SYMBOLS = new Set(["x", "y", "r", "theta", "pi", "e"]);
const ALLOWED_FUNCTIONS = new Set([
  "sin", "cos", "tan", "exp", "log", "sqrt", "abs",
  "pow", "min", "max", "atan2", "sinh", "cosh", "tanh"
]);

const DEFAULT_SCOPE = {
  pi: Math.PI,
  e: Math.E,
};

export function parseExpression(expr: string): ParseResult {
  if (!expr || expr.trim() === "") {
    return { ok: false, message: "Expression cannot be empty." };
  }

  try {
    const node = mathParse(expr);
    let invalidMessage: string | null = null;

    node.traverse((n: any) => {
      // mathjs represents `sin(y)` with both FunctionNode and SymbolNode.
      if (
        n.type === "SymbolNode" &&
        !ALLOWED_SYMBOLS.has(n.name) &&
        !ALLOWED_FUNCTIONS.has(n.name)
      ) {
        invalidMessage = `Symbol '${n.name}' is not allowed.`;
      } else if (
        n.type === "FunctionNode" &&
        !ALLOWED_FUNCTIONS.has(n.name)
      ) {
        invalidMessage = `Function '${n.name}' is not allowed.`;
      }
    });

    if (invalidMessage) {
      return { ok: false, message: invalidMessage };
    }

    const compiled = node.compile();

    return {
      ok: true,
      fn: (scope: Record<string, number> = {}): number => {
        const evalScope = { ...DEFAULT_SCOPE, ...scope };
        const result = compiled.evaluate(evalScope);
        return typeof result === "number" ? result : Number(result);
      },
      ast: node,
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err.message || "Invalid expression syntax.",
    };
  }
}