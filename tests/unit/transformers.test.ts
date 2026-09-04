import { describe, it, expect } from 'vitest';

describe('Data Transformers & Utility Functions', () => {
  describe('JSON Serialization & Sanitization', () => {
    it('strips non-serializable properties (functions, symbols) cleanly', () => {
      const nodeData = {
        title: 'Test Node',
        count: 10,
        isActive: true,
        onDataFetched: () => {},
        runWorkflow: async () => {},
      };

      const serializable = Object.keys(nodeData).reduce((acc: any, key: string) => {
        if (typeof (nodeData as any)[key] !== 'function') {
          acc[key] = (nodeData as any)[key];
        }
        return acc;
      }, {});

      expect(serializable).toEqual({
        title: 'Test Node',
        count: 10,
        isActive: true,
      });
      expect(JSON.stringify(serializable)).toBe('{"title":"Test Node","count":10,"isActive":true}');
    });

    it('validates and safely parses JSON strings', () => {
      const validJson = '{"name": "Bernie", "version": 2}';
      const invalidJson = '{name: Bernie, trailing,}';

      expect(() => JSON.parse(validJson)).not.toThrow();
      expect(JSON.parse(validJson)).toEqual({ name: 'Bernie', version: 2 });
      expect(() => JSON.parse(invalidJson)).toThrow();
    });
  });

  describe('Math Operation Evaluators', () => {
    function evaluateMath(a: number, b: number, op: string): number {
      switch (op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return b !== 0 ? a / b : 0;
        case '%': return b !== 0 ? a % b : 0;
        case '^': return Math.pow(a, b);
        default: return a;
      }
    }

    it('performs basic arithmetic operations accurately', () => {
      expect(evaluateMath(10, 5, '+')).toBe(15);
      expect(evaluateMath(10, 5, '-')).toBe(5);
      expect(evaluateMath(10, 5, '*')).toBe(50);
      expect(evaluateMath(10, 5, '/')).toBe(2);
      expect(evaluateMath(10, 3, '%')).toBe(1);
      expect(evaluateMath(2, 4, '^')).toBe(16);
    });

    it('safely handles division by zero', () => {
      expect(evaluateMath(100, 0, '/')).toBe(0);
      expect(evaluateMath(100, 0, '%')).toBe(0);
    });
  });

  describe('Array Filter Condition Evaluator', () => {
    function filterCollection(items: any[], key: string, op: string, targetVal: any) {
      return items.filter((item) => {
        const val = item[key];
        if (op === 'equals') return String(val) === String(targetVal);
        if (op === 'not_equals') return String(val) !== String(targetVal);
        if (op === 'contains') return String(val).toLowerCase().includes(String(targetVal).toLowerCase());
        if (op === 'gt') return Number(val) > Number(targetVal);
        if (op === 'lt') return Number(val) < Number(targetVal);
        return val !== undefined && val !== null;
      });
    }

    const testUsers = [
      { id: 1, role: 'admin', age: 34, name: 'Alice Smith' },
      { id: 2, role: 'member', age: 22, name: 'Bob Jones' },
      { id: 3, role: 'admin', age: 45, name: 'Charlie Brown' },
      { id: 4, role: 'guest', age: 19, name: 'Dana White' },
    ];

    it('filters array by exact match', () => {
      const admins = filterCollection(testUsers, 'role', 'equals', 'admin');
      expect(admins).toHaveLength(2);
      expect(admins.map((u) => u.name)).toEqual(['Alice Smith', 'Charlie Brown']);
    });

    it('filters array by substring containment', () => {
      const jones = filterCollection(testUsers, 'name', 'contains', 'jones');
      expect(jones).toHaveLength(1);
      expect(jones[0].name).toBe('Bob Jones');
    });

    it('filters array with numeric comparison', () => {
      const olderThan30 = filterCollection(testUsers, 'age', 'gt', 30);
      expect(olderThan30).toHaveLength(2);
      expect(olderThan30.map((u) => u.name)).toEqual(['Alice Smith', 'Charlie Brown']);
    });
  });

  describe('Template Interpolation Engine', () => {
    function interpolate(template: string, data: Record<string, any>): string {
      return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
        const trimmed = key.trim();
        return data[trimmed] !== undefined ? String(data[trimmed]) : `{{${trimmed}}}`;
      });
    }

    it('replaces single and multiple tokens in text', () => {
      const template = 'Workflow status: {{status}} - Processed {{count}} items in {{time}}ms';
      const result = interpolate(template, { status: 'COMPLETED', count: 150, time: 24 });
      expect(result).toBe('Workflow status: COMPLETED - Processed 150 items in 24ms');
    });

    it('preserves unresolved placeholders when keys are absent', () => {
      const template = 'User {{userId}} has role {{role}}';
      const result = interpolate(template, { userId: 'usr_123' });
      expect(result).toBe('User usr_123 has role {{role}}');
    });
  });
});
