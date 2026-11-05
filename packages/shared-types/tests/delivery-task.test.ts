import { describe, expect, it } from 'vitest';
import {
  assertDeliveryTaskTransition,
  assertDriverTransition,
  isDeliveryTaskTransitionAllowed,
  isDriverAvailableForAssignment,
} from '../src/delivery/task.js';

describe('delivery task lifecycle', () => {
  it('requires the prescribed task lifecycle stages', () => {
    expect(isDeliveryTaskTransitionAllowed('unassigned', 'offered')).toBe(true);
    expect(isDeliveryTaskTransitionAllowed('assigned', 'accepted')).toBe(true);
    expect(isDeliveryTaskTransitionAllowed('assigned', 'delivered')).toBe(false);
    expect(() => assertDeliveryTaskTransition('assigned', 'delivered')).toThrow();
  });

  it('only allows available drivers to be selected for assignment', () => {
    expect(isDriverAvailableForAssignment('available')).toBe(true);
    expect(isDriverAvailableForAssignment('busy')).toBe(false);
    expect(() => assertDriverTransition('offline', 'busy')).toThrow();
    expect(() => assertDriverTransition('offline', 'available')).not.toThrow();
  });
});
