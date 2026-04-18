import { describe, expect, it } from 'vitest';

import {
  buildRowFailureClassification,
  findMatchingVisibleRow,
  summarizeSmokeEntry,
} from '../qa-lib/runtime-ready-row-locator.mjs';

const smokeEntry = {
  encounterKey: 'FAC:E-001',
  scheduleKey: 'S-001',
  receptionId: 'R-001',
  appointmentId: 'A-001',
  patientId: 'P-001',
  name: 'スモーク 患者',
  status: '受付中',
};

describe('runtime-ready row locator helper', () => {
  it('matches by encounterKey first', () => {
    const result = findMatchingVisibleRow(smokeEntry, [
      { encounterKey: 'FAC:E-001', scheduleKey: 'S-other', patientId: 'P-other', text: '別患者' },
    ]);

    expect(result).toMatchObject({ matched: true, strategy: 'encounterKey' });
  });

  it('matches by scheduleKey when encounterKey is absent', () => {
    const result = findMatchingVisibleRow({ ...smokeEntry, encounterKey: '' }, [
      { scheduleKey: 'S-001', patientId: 'P-other', text: '別患者' },
    ]);

    expect(result).toMatchObject({ matched: true, strategy: 'scheduleKey' });
  });

  it('matches by receptionId when canonical schedule keys are absent', () => {
    const result = findMatchingVisibleRow({ ...smokeEntry, encounterKey: '', scheduleKey: '' }, [
      { receptionId: 'R-001', patientId: 'P-other', text: '別患者' },
    ]);

    expect(result).toMatchObject({ matched: true, strategy: 'receptionId' });
  });

  it('falls back to appointmentId', () => {
    const result = findMatchingVisibleRow({ ...smokeEntry, encounterKey: '', scheduleKey: '', receptionId: '' }, [
      { appointmentId: 'A-001', patientId: 'P-other', text: '別患者' },
    ]);

    expect(result).toMatchObject({ matched: true, strategy: 'appointmentId' });
  });

  it('falls back to patientId plus visible patient name before raw text', () => {
    const result = findMatchingVisibleRow(
      { ...smokeEntry, encounterKey: '', scheduleKey: '', receptionId: '', appointmentId: '' },
      [{ patientId: 'P-001', text: 'P-001 スモーク 患者 09:00' }],
    );

    expect(result).toMatchObject({ matched: true, strategy: 'patientIdentity' });
  });

  it('uses visible text fallback for legacy rows', () => {
    const result = findMatchingVisibleRow(smokeEntry, [{ text: '受付 FAC:E-001 スモーク 患者' }]);

    expect(result).toMatchObject({ matched: true, strategy: 'visibleText' });
  });

  it('classifies no matching row as row absence/read-model mismatch', () => {
    const result = buildRowFailureClassification({
      appointmentEvidence: { queryDate: '2026-04-19', selectionReason: 'preferred_keys' },
      selectedSmokeEntry: smokeEntry,
      visibleRowsSummary: [{ patientId: 'P-999', text: '別患者' }],
      activeStatusTab: '受付中',
      selectedDate: '2026-04-19',
    });

    expect(result.code).toBe('row-absent-or-read-model-mismatch');
  });

  it('classifies an active status mismatch before row absence', () => {
    const result = buildRowFailureClassification({
      appointmentEvidence: { queryDate: '2026-04-19', selectionReason: 'preferred_keys' },
      selectedSmokeEntry: { ...smokeEntry, status: '会計待ち' },
      visibleRowsSummary: [{ patientId: 'P-001', text: 'P-001 スモーク 患者' }],
      activeStatusTab: '受付中',
      selectedDate: '2026-04-19',
    });

    expect(result.code).toBe('active-status-tab-mismatch');
  });

  it('keeps the selected entry summary limited to locator fields', () => {
    expect(summarizeSmokeEntry({ ...smokeEntry, extra: 'ignored' })).toEqual({
      encounterKey: 'FAC:E-001',
      scheduleKey: 'S-001',
      receptionId: 'R-001',
      appointmentId: 'A-001',
      patientId: 'P-001',
      name: 'スモーク 患者',
      status: '受付中',
      source: undefined,
      appointmentTime: undefined,
    });
  });
});
