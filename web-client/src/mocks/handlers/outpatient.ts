import { http, HttpResponse } from 'msw';

import {
  buildAppointmentFixture,
  buildPatientListFixture,
  buildVisitListFixture,
  getOutpatientScenario,
  selectOutpatientScenario,
  updateOutpatientScenarioFlags,
  type OutpatientScenarioId,
} from '../fixtures/outpatient';
import { applyFaultDelay, parseFaultSpec, type FaultSpec } from '../utils/faultInjection';

const respond = <T extends Record<string, unknown>>(body: T) =>
  HttpResponse.json(body, {
    status: typeof body.status === 'number' ? (body.status as number) : 200,
    headers: {
      'x-run-id': String(body.runId ?? ''),
      'x-trace-id': String((body as any).traceId ?? ''),
      'x-data-source-transition': String(body.dataSourceTransition ?? ''),
      'x-cache-hit': String(body.cacheHit ?? ''),
      'x-missing-master': String(body.missingMaster ?? ''),
      'x-fallback-used': String((body as Record<string, unknown>).fallbackUsed ?? ''),
    },
  });

const applyRequestScenario = (request: Request) => {
  const headerScenario = request.headers.get('x-msw-scenario') as OutpatientScenarioId | null;
  if (headerScenario) {
    selectOutpatientScenario(headerScenario);
    return getOutpatientScenario();
  }

  const url = new URL(request.url);
  const queryScenario = (url.searchParams.get('scenario') as OutpatientScenarioId | null) ?? undefined;
  if (queryScenario) {
    selectOutpatientScenario(queryScenario);
    return getOutpatientScenario();
  }

  const cacheHitHeader = request.headers.get('x-msw-cache-hit');
  const missingMasterHeader = request.headers.get('x-msw-missing-master');
  const transitionHeader = request.headers.get('x-msw-transition');
  const fallbackUsedHeader = request.headers.get('x-msw-fallback-used');
  const runIdHeader = request.headers.get('x-msw-run-id');
  if (cacheHitHeader || missingMasterHeader || transitionHeader || fallbackUsedHeader || runIdHeader) {
    updateOutpatientScenarioFlags({
      cacheHit: cacheHitHeader === '1' || cacheHitHeader === 'true' ? true : cacheHitHeader === '0' ? false : undefined,
      missingMaster:
        missingMasterHeader === '1' || missingMasterHeader === 'true'
          ? true
          : missingMasterHeader === '0'
            ? false
            : undefined,
      dataSourceTransition: (transitionHeader as any) ?? undefined,
      fallbackUsed:
        fallbackUsedHeader === '1' || fallbackUsedHeader === 'true'
          ? true
          : fallbackUsedHeader === '0'
            ? false
            : undefined,
      runId: runIdHeader ? String(runIdHeader) : undefined,
    });
  }

  return getOutpatientScenario();
};

const hasNetworkFault = (fault: FaultSpec) =>
  fault.tokens.has('network') || fault.tokens.has('network-error') || fault.tokens.has('offline');

const resolveHttpFaultStatus = (fault: FaultSpec) => {
  if (fault.tokens.has('http-401') || fault.tokens.has('401')) return 401;
  if (fault.tokens.has('http-403') || fault.tokens.has('403')) return 403;
  if (fault.tokens.has('http-404') || fault.tokens.has('404')) return 404;
  return undefined;
};

export const outpatientHandlers = [
  http.post('/api/orca/appointments/list', async ({ request }) => {
    const fault = parseFaultSpec(request);
    const scenario = applyRequestScenario(request);
    await applyFaultDelay(fault);
    if (hasNetworkFault(fault)) {
      return HttpResponse.error();
    }
    const httpFaultStatus = resolveHttpFaultStatus(fault);
    if (httpFaultStatus) {
      return respond({ ...(buildAppointmentFixture({ ...scenario.flags, status: httpFaultStatus }) as any), status: httpFaultStatus } as any);
    }
    if (fault.tokens.has('timeout')) {
      return respond({ ...(buildAppointmentFixture({ ...scenario.flags, status: 504 }) as any), status: 504 } as any);
    }
    if (fault.tokens.has('http-500') || fault.tokens.has('500')) {
      return respond({ ...(buildAppointmentFixture({ ...scenario.flags, status: 500 }) as any), status: 500 } as any);
    }
    if (fault.tokens.has('schema-mismatch')) {
      const mismatch = {
        runId: scenario.flags.runId,
        traceId: scenario.flags.traceId ?? `trace-${scenario.flags.runId}`,
        cacheHit: scenario.flags.cacheHit,
        missingMaster: scenario.flags.missingMaster,
        dataSourceTransition: scenario.flags.dataSourceTransition,
        fallbackUsed: scenario.flags.fallbackUsed,
        slots: 'schema-mismatch',
        reservations: { not: 'array' },
        apiResult: 'ERROR_SCHEMA_MISMATCH',
        apiResultMessage: 'MSW injected schema mismatch for orca/appointments/list',
        status: 200,
      } as any;
      return respond(mismatch);
    }
    return respond(buildAppointmentFixture(scenario.flags));
  }),
  http.post('/api/orca/visits/list', async ({ request }) => {
    const fault = parseFaultSpec(request);
    const scenario = applyRequestScenario(request);
    await applyFaultDelay(fault);
    if (hasNetworkFault(fault)) {
      return HttpResponse.error();
    }
    const httpFaultStatus = resolveHttpFaultStatus(fault);
    if (httpFaultStatus) {
      return respond({ ...(buildVisitListFixture({ ...scenario.flags, status: httpFaultStatus }) as any), status: httpFaultStatus } as any);
    }
    if (fault.tokens.has('timeout')) {
      return respond({ ...(buildVisitListFixture({ ...scenario.flags, status: 504 }) as any), status: 504 } as any);
    }
    if (fault.tokens.has('http-500') || fault.tokens.has('500')) {
      return respond({ ...(buildVisitListFixture({ ...scenario.flags, status: 500 }) as any), status: 500 } as any);
    }
    if (fault.tokens.has('schema-mismatch')) {
      const mismatch = {
        runId: scenario.flags.runId,
        traceId: scenario.flags.traceId ?? `trace-${scenario.flags.runId}`,
        cacheHit: scenario.flags.cacheHit,
        missingMaster: scenario.flags.missingMaster,
        dataSourceTransition: scenario.flags.dataSourceTransition,
        fallbackUsed: scenario.flags.fallbackUsed,
        visits: 'schema-mismatch',
        apiResult: 'ERROR_SCHEMA_MISMATCH',
        apiResultMessage: 'MSW injected schema mismatch for orca/visits/list',
        status: 200,
      } as any;
      return respond(mismatch);
    }
    return respond(buildVisitListFixture(scenario.flags));
  }),
  http.post('/api/orca/patients/local-search', async ({ request }) => {
    const fault = parseFaultSpec(request);
    const scenario = applyRequestScenario(request);
    await applyFaultDelay(fault);
    if (hasNetworkFault(fault)) {
      return HttpResponse.error();
    }
    const httpFaultStatus = resolveHttpFaultStatus(fault);
    if (httpFaultStatus) {
      const base = buildPatientListFixture({ ...scenario.flags, status: httpFaultStatus }, '/api/orca/patients/local-search');
      if (httpFaultStatus === 404) {
        return respond({
          ...base,
          patients: [],
          recordsReturned: 0,
          auditEvent: base.auditEvent
            ? { ...base.auditEvent, details: { ...(base.auditEvent as any).details, recordsReturned: 0 } }
            : base.auditEvent,
        });
      }
      return respond(base);
    }
    if (fault.tokens.has('timeout')) {
      return respond(buildPatientListFixture({ ...scenario.flags, status: 504 }, '/api/orca/patients/local-search'));
    }
    if (fault.tokens.has('http-500') || fault.tokens.has('500')) {
      return respond(buildPatientListFixture({ ...scenario.flags, status: 500 }, '/api/orca/patients/local-search'));
    }
    if (fault.tokens.has('schema-mismatch')) {
      const mismatch = {
        runId: scenario.flags.runId,
        traceId: scenario.flags.traceId ?? `trace-${scenario.flags.runId}`,
        cacheHit: scenario.flags.cacheHit,
        missingMaster: scenario.flags.missingMaster,
        dataSourceTransition: scenario.flags.dataSourceTransition,
        fallbackUsed: scenario.flags.fallbackUsed,
        patients: 'schema-mismatch',
        apiResult: 'ERROR_SCHEMA_MISMATCH',
        apiResultMessage: 'MSW injected schema mismatch for patients/local-search',
        status: 200,
      } as any;
      return respond(mismatch);
    }
    return respond(buildPatientListFixture(scenario.flags, '/api/orca/patients/local-search'));
  }),
  http.post('/api/orca/patients/import', async ({ request }) => {
    const fault = parseFaultSpec(request);
    const scenario = applyRequestScenario(request);
    await applyFaultDelay(fault);
    if (hasNetworkFault(fault)) {
      return HttpResponse.error();
    }
    const httpFaultStatus = resolveHttpFaultStatus(fault);
    if (httpFaultStatus) {
      return respond({
        apiResult: '99',
        apiResultMessage: `HTTP fault injected (${httpFaultStatus})`,
        runId: scenario.flags.runId,
        traceId: scenario.flags.traceId ?? `trace-${scenario.flags.runId}`,
        requestId: `req-${scenario.flags.runId}`,
        facilityId: 'F-1',
        requestedCount: 0,
        fetchedCount: 0,
        createdCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        errors: [],
        status: httpFaultStatus,
      });
    }
    if (fault.tokens.has('timeout')) {
      return respond({
        apiResult: '99',
        apiResultMessage: 'timeout',
        runId: scenario.flags.runId,
        traceId: scenario.flags.traceId ?? `trace-${scenario.flags.runId}`,
        requestId: `req-${scenario.flags.runId}`,
        facilityId: 'F-1',
        requestedCount: 0,
        fetchedCount: 0,
        createdCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        errors: [],
        status: 504,
      });
    }
    if (fault.tokens.has('http-500') || fault.tokens.has('500')) {
      return respond({
        apiResult: '99',
        apiResultMessage: 'MSW injected 500 for patients/import',
        runId: scenario.flags.runId,
        traceId: scenario.flags.traceId ?? `trace-${scenario.flags.runId}`,
        requestId: `req-${scenario.flags.runId}`,
        facilityId: 'F-1',
        requestedCount: 0,
        fetchedCount: 0,
        createdCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        errors: [],
        status: 500,
      });
    }

    const raw = (await request.json().catch(() => ({}))) as any;
    const patientIds: string[] = Array.isArray(raw?.patientIds) ? raw.patientIds : [];
    return respond({
      apiResult: '00',
      apiResultMessage: 'OK',
      runId: scenario.flags.runId,
      traceId: scenario.flags.traceId ?? `trace-${scenario.flags.runId}`,
      requestId: `req-${scenario.flags.runId}`,
      facilityId: 'F-1',
      requestedCount: patientIds.length,
      fetchedCount: patientIds.length,
      createdCount: patientIds.length,
      updatedCount: 0,
      skippedCount: 0,
      errors: [],
      status: 200,
    });
  }),
  http.post('/api/orca/patient/mutation', async ({ request }) => {
    const fault = parseFaultSpec(request);
    const scenario = applyRequestScenario(request);
    await applyFaultDelay(fault);
    if (hasNetworkFault(fault)) {
      return HttpResponse.error();
    }
    const httpFaultStatus = resolveHttpFaultStatus(fault);
    if (httpFaultStatus) {
      return respond(buildPatientListFixture({ ...scenario.flags, status: httpFaultStatus }));
    }
    if (fault.tokens.has('timeout')) {
      return respond(buildPatientListFixture({ ...scenario.flags, status: 504 }));
    }
    if (fault.tokens.has('http-500') || fault.tokens.has('500')) {
      return respond(buildPatientListFixture({ ...scenario.flags, status: 500 }));
    }
    if (fault.tokens.has('schema-mismatch')) {
      const mismatch = {
        runId: scenario.flags.runId,
        traceId: scenario.flags.traceId ?? `trace-${scenario.flags.runId}`,
        cacheHit: scenario.flags.cacheHit,
        missingMaster: scenario.flags.missingMaster,
        dataSourceTransition: scenario.flags.dataSourceTransition,
        fallbackUsed: scenario.flags.fallbackUsed,
        patients: [{ patientId: 1 }],
        apiResult: 'ERROR_SCHEMA_MISMATCH',
        apiResultMessage: 'MSW injected schema mismatch for patientmodv2/outpatient',
        status: 200,
      } as any;
      return respond(mismatch);
    }
    return respond(buildPatientListFixture(scenario.flags));
  }),
];
