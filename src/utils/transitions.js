/**
 * Valid status transitions for tasks.
 *
 * Diagram:
 *   TODO → IN_PROGRESS → IN_REVIEW → DONE
 *          ↘            ↘           ↘
 *           BLOCKED    BLOCKED     BLOCKED
 *   (BLOCKED can also transition back to its previous non-blocked state)
 *
 * Design decision: BLOCKED is reachable from any active state.
 * From BLOCKED you can return to IN_PROGRESS or IN_REVIEW (not back to TODO,
 * since work has clearly started). DONE is terminal.
 */

const TRANSITIONS = {
  TODO:        ['IN_PROGRESS', 'BLOCKED'],
  IN_PROGRESS: ['IN_REVIEW', 'BLOCKED'],
  IN_REVIEW:   ['DONE', 'IN_PROGRESS', 'BLOCKED'], // allow push-back
  DONE:        [],                                  // terminal
  BLOCKED:     ['IN_PROGRESS', 'IN_REVIEW'],        // resume from where blocked
};

/**
 * Returns true if transitioning from `from` to `to` is allowed.
 */
const isValidTransition = (from, to) => {
  if (!TRANSITIONS[from]) return false;
  return TRANSITIONS[from].includes(to);
};

const ALL_STATUSES   = Object.keys(TRANSITIONS);
const ALL_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];

module.exports = { TRANSITIONS, isValidTransition, ALL_STATUSES, ALL_PRIORITIES };