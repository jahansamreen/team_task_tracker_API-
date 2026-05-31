const { isValidTransition, TRANSITIONS, ALL_STATUSES } = require('../utils/transitions');

describe('Task Status Transitions', () => {
  describe('isValidTransition', () => {
    test('TODO → IN_PROGRESS is valid', () => {
      expect(isValidTransition('TODO', 'IN_PROGRESS')).toBe(true);
    });

    test('IN_PROGRESS → IN_REVIEW is valid', () => {
      expect(isValidTransition('IN_PROGRESS', 'IN_REVIEW')).toBe(true);
    });

    test('IN_REVIEW → DONE is valid', () => {
      expect(isValidTransition('IN_REVIEW', 'DONE')).toBe(true);
    });

    test('TODO → BLOCKED is valid', () => {
      expect(isValidTransition('TODO', 'BLOCKED')).toBe(true);
    });

    test('IN_PROGRESS → BLOCKED is valid', () => {
      expect(isValidTransition('IN_PROGRESS', 'BLOCKED')).toBe(true);
    });

    test('IN_REVIEW → BLOCKED is valid', () => {
      expect(isValidTransition('IN_REVIEW', 'BLOCKED')).toBe(true);
    });

    test('BLOCKED → IN_PROGRESS is valid (resume)', () => {
      expect(isValidTransition('BLOCKED', 'IN_PROGRESS')).toBe(true);
    });

    test('BLOCKED → IN_REVIEW is valid (resume)', () => {
      expect(isValidTransition('BLOCKED', 'IN_REVIEW')).toBe(true);
    });

    test('DONE → anything is invalid (terminal state)', () => {
      ALL_STATUSES.filter(s => s !== 'DONE').forEach(s => {
        expect(isValidTransition('DONE', s)).toBe(false);
      });
    });

    test('TODO → IN_REVIEW is invalid (skip step)', () => {
      expect(isValidTransition('TODO', 'IN_REVIEW')).toBe(false);
    });

    test('TODO → DONE is invalid (skip all steps)', () => {
      expect(isValidTransition('TODO', 'DONE')).toBe(false);
    });

    test('IN_REVIEW → IN_PROGRESS is valid (push-back)', () => {
      expect(isValidTransition('IN_REVIEW', 'IN_PROGRESS')).toBe(true);
    });

    test('returns false for unknown from-status', () => {
      expect(isValidTransition('UNKNOWN_STATUS', 'TODO')).toBe(false);
    });

    test('same-status transition is invalid', () => {
      expect(isValidTransition('TODO', 'TODO')).toBe(false);
      expect(isValidTransition('IN_PROGRESS', 'IN_PROGRESS')).toBe(false);
    });
  });

  describe('TRANSITIONS map completeness', () => {
    test('all statuses are keys in TRANSITIONS', () => {
      ALL_STATUSES.forEach(status => {
        expect(TRANSITIONS).toHaveProperty(status);
        expect(Array.isArray(TRANSITIONS[status])).toBe(true);
      });
    });

    test('all transition targets are valid statuses', () => {
      Object.values(TRANSITIONS).flat().forEach(target => {
        expect(ALL_STATUSES).toContain(target);
      });
    });
  });
});