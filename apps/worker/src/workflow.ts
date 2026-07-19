import type { CanonicalEvent, WorkflowCondition } from '@nexus/contracts';

function readPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && key in current) return (current as Record<string, unknown>)[key];
    return undefined;
  }, source);
}

export function conditionMatches(event: CanonicalEvent, condition: WorkflowCondition): boolean {
  const actual = readPath(event, condition.field);
  const expected = condition.value;
  switch (condition.operator) {
    case 'equals': return actual === expected;
    case 'notEquals': return actual !== expected;
    case 'greaterThan': return Number(actual) > Number(expected);
    case 'greaterThanOrEqual': return Number(actual) >= Number(expected);
    case 'lessThan': return Number(actual) < Number(expected);
    case 'contains': return String(actual ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase());
    case 'exists': return actual !== undefined && actual !== null;
  }
}

export function workflowMatches(event: CanonicalEvent, conditions: WorkflowCondition[]): boolean {
  return conditions.every((condition) => conditionMatches(event, condition));
}
