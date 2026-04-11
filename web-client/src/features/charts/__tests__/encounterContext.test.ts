import { beforeEach, describe, expect, it } from 'vitest';

import {
  buildChartsEncounterSearch,
  clearChartsEncounterContext,
  hasEncounterContext,
  hasHandoffEncounterKey,
  loadChartsEncounterContext,
  normalizeEncounterContext,
  parseChartsEncounterContext,
  parseChartsNavigationMeta,
  parseReceptionCarryoverParams,
  storeChartsEncounterContext,
  normalizeRunId,
} from '../encounterContext';

describe('charts encounterContext', () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearChartsEncounterContext();
  });

  it('parse/build: empty -> empty', () => {
    expect(parseChartsEncounterContext('')).toEqual({
      patientId: undefined,
      appointmentId: undefined,
      receptionId: undefined,
      scheduleKey: undefined,
      encounterKey: undefined,
      visitDate: undefined,
    });
    expect(buildChartsEncounterSearch({})).toBe('');
  });

  it('parse/build: visitDate は YYYY-MM-DD のみ採用', () => {
    const parsed = parseChartsEncounterContext('?patientId=0001&receptionId=R-9&visitDate=2025-12-18');
    expect(parsed).toEqual({
      patientId: '0001',
      appointmentId: undefined,
      receptionId: 'R-9',
      scheduleKey: undefined,
      encounterKey: undefined,
      visitDate: '2025-12-18',
    });

    const carryover = parseReceptionCarryoverParams('?kw=tanaka&dept=D1&sort=time&date=2025-12-27&pay=insurance');
    const rebuilt = buildChartsEncounterSearch(parsed, carryover);
    expect(rebuilt).not.toContain('patientId=');
    expect(rebuilt).not.toContain('receptionId=');
    expect(rebuilt).not.toContain('visitDate=');
    expect(rebuilt).not.toContain('kw=');
    expect(rebuilt).toContain('dept=D1');
    expect(rebuilt).toContain('pay=insurance');
    expect(rebuilt).toContain('sort=time');
    expect(rebuilt).toContain('date=2025-12-27');

    expect(parseChartsEncounterContext('?visitDate=20251218').visitDate).toBeUndefined();
  });

  it('normalizeEncounterContext: ID の前後空白を除去し、不正 visitDate を破棄する', () => {
    expect(
      normalizeEncounterContext({
        patientId: ' 0001 ',
        appointmentId: ' A-1 ',
        receptionId: ' R-1 ',
        scheduleKey: ' F001:S100 ',
        encounterKey: ' F001:E100 ',
        visitDate: '20260225',
      }),
    ).toEqual({
      patientId: '0001',
      appointmentId: 'A-1',
      receptionId: 'R-1',
      scheduleKey: 'F001:S100',
      encounterKey: 'F001:E100',
      visitDate: undefined,
    });
  });

  it('hasEncounterContext: 空白のみのIDは未指定として扱う', () => {
    expect(
      hasEncounterContext({
        patientId: '   ',
        appointmentId: undefined,
        receptionId: undefined,
        visitDate: undefined,
      }),
    ).toBe(false);
  });

  it('buildChartsEncounterSearch: ID をトリムしてクエリ生成する', () => {
    const search = buildChartsEncounterSearch({
      patientId: ' 0001 ',
      appointmentId: ' A-1 ',
      receptionId: ' R-1 ',
      visitDate: '2026-02-25',
    });
    expect(search).toBe('');
  });

  it('hasEncounterContext / hasHandoffEncounterKey は scheduleKey / encounterKey のみでも true になる', () => {
    expect(
      hasEncounterContext({
        scheduleKey: 'F001:S100',
        encounterKey: undefined,
      }),
    ).toBe(true);
    expect(
      hasHandoffEncounterKey({
        scheduleKey: 'F001:S100',
        encounterKey: undefined,
      }),
    ).toBe(true);
  });

  it('store/load: volatile memory round-trip only', () => {
    storeChartsEncounterContext({
      patientId: 'PX-1',
      appointmentId: 'A-1',
      receptionId: 'R-1',
      scheduleKey: 'F001:S100',
      encounterKey: 'F001:E100',
      visitDate: '2025-12-18',
    });
    expect(sessionStorage.length).toBe(0);
    expect(loadChartsEncounterContext()).toEqual({
      patientId: 'PX-1',
      appointmentId: 'A-1',
      receptionId: 'R-1',
      scheduleKey: 'F001:S100',
      encounterKey: 'F001:E100',
      visitDate: '2025-12-18',
    });
  });

  it('runId normalize: 空/スペース/フォーマット外は無効', () => {
    expect(normalizeRunId('')).toBeUndefined();
    expect(normalizeRunId('   ')).toBeUndefined();
    expect(normalizeRunId('20251227T133020')).toBeUndefined();
    expect(normalizeRunId('2025-12-27T133020Z')).toBeUndefined();
    expect(normalizeRunId('RUN-123')).toBeUndefined();
  });

  it('runId parse/build: valid のみ反映される', () => {
    const validRunId = '20251227T133020Z';
    expect(normalizeRunId(` ${validRunId} `)).toBe(validRunId);
    expect(parseChartsNavigationMeta(`?runId=${validRunId}`)).toEqual({ runId: validRunId });
    expect(buildChartsEncounterSearch({ patientId: 'PX-9' }, {}, { runId: validRunId })).toContain(`runId=${validRunId}`);

    const invalidRunId = '20251227T133020';
    expect(parseChartsNavigationMeta(`?runId=${invalidRunId}`)).toEqual({ runId: undefined });
    const search = buildChartsEncounterSearch({ patientId: 'PX-9' }, {}, { runId: invalidRunId });
    expect(search).not.toContain('runId=');
  });

  it('parseChartsEncounterContext: runId は取り込まず無視する', () => {
    const parsed = parseChartsEncounterContext('?patientId=PX-1&runId=20251227T133020Z');
    expect(parsed).toEqual({
      patientId: 'PX-1',
      appointmentId: undefined,
      receptionId: undefined,
      scheduleKey: undefined,
      encounterKey: undefined,
      visitDate: undefined,
    });
    expect(parsed).not.toHaveProperty('runId');
  });

  it('load does not restore legacy sessionStorage payloads', () => {
    sessionStorage.setItem(
      'opendolphin:web-client:charts:encounter-context:v1',
      JSON.stringify({ patientId: 'legacy-patient', visitDate: '2026-03-01' }),
    );

    expect(loadChartsEncounterContext()).toBeNull();
    expect(sessionStorage.getItem('opendolphin:web-client:charts:encounter-context:v1')).toBeNull();
  });
});
