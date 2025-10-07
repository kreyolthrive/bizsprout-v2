// Lightweight, safe rule evaluator (constrained)
import type { RuleDefinition, RuleAction, RuleEnginePort, RuleEvaluationContext } from './ports';

// Extremely small expression parser: supports identifiers, literals, ==, !=, <, <=, >, >=, &&, ||, parentheses
// Disallows function calls and member assignments. This is intentionally minimal to avoid executing untrusted code.

function evalExpr(expr: string, ctx: Record<string, unknown>): boolean {
  // Replace known identifiers with JSON literals; reject unsafe tokens
  const unsafe = /[^\w\d_\s\(\)\!<>=&|'.:\-]/g; // blocks backticks, quotes other than single, semicolons, etc.
  if (unsafe.test(expr)) throw new Error('unsafe-expression');

  const replaced = expr.replace(/[a-zA-Z_][\w\.]*/g, (id) => {
    // dot access: a.b.c
    const parts = id.split('.');
    let val: unknown = ctx;
    for (const p of parts) {
      if (val && typeof val === 'object' && Object.prototype.hasOwnProperty.call(val as object, p)) {
        val = (val as Record<string, unknown>)[p];
      } else {
        val = undefined;
        break;
      }
    }
    return JSON.stringify(val);
  });

  const fn = new Function(`return (${replaced}) ? true : false;`);
  return Boolean(fn());
}

export class InMemoryRuleEngine implements RuleEnginePort {
  private rules: RuleDefinition[] = [];

  async list(): Promise<RuleDefinition[]> {
    return this.rules.filter(r => r.enabled !== false);
  }

  async upsert(rule: RuleDefinition): Promise<void> {
    const idx = this.rules.findIndex(r => r.id === rule.id);
    if (idx >= 0) this.rules[idx] = rule; else this.rules.push(rule);
  }

  async evaluate(rules: RuleDefinition[], ctx: RuleEvaluationContext): Promise<RuleAction[]> {
    const actions: RuleAction[] = [];
    for (const r of rules) {
      if (r.enabled === false) continue;
      try {
        if (evalExpr(r.when, ctx)) actions.push(...r.then);
      } catch {
        // ignore bad rules in runtime; could log in EventPort
        continue;
      }
    }
    return actions;
  }
}
