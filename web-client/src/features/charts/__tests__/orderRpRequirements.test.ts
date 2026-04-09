import { describe, expect, it } from 'vitest';

import { hasInvalidInjectionAdminCode, resolveRpRequiredIssue } from '../orderRpRequirements';

describe('orderRpRequirements', () => {
  it('uses canonical entity resolution for prescription aliases', () => {
    const issue = resolveRpRequiredIssue({
      entity: 'prescriptionOrder',
      bundleName: 'RP-1',
      classCode: '212',
      bundleNumber: '',
      items: [],
    });

    expect(issue?.entity).toBe('medOrder');
    expect(issue?.missing).toEqual(['Medical_Class_Number', 'Medication_info']);
  });

  it('infers injectionOrder from classCode when entity is absent', () => {
    const issue = resolveRpRequiredIssue({
      bundleName: 'INJ-1',
      classCode: '310',
      bundleNumber: '',
      items: [],
    });

    expect(issue?.entity).toBe('injectionOrder');
    expect(issue?.missing).toEqual(['Medical_Class_Number', 'Medication_info']);
  });

  it('shares the usage-code predicate for injection adminCode validation', () => {
    expect(hasInvalidInjectionAdminCode('')).toBe(false);
    expect(hasInvalidInjectionAdminCode('001000')).toBe(false);
    expect(hasInvalidInjectionAdminCode('410')).toBe(true);
    expect(hasInvalidInjectionAdminCode('Y100')).toBe(true);
  });
});
