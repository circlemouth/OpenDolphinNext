package open.dolphin.orca.sync;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.orca.service.OrcaLiveGateway;
import open.dolphin.rest.dto.orca.PatientIdListRequest;
import open.dolphin.rest.dto.orca.PatientIdListResponse;
import open.dolphin.rest.dto.orca.PatientImportRequest;
import open.dolphin.rest.dto.orca.PatientImportResponse;
import open.dolphin.rest.dto.orca.PatientSyncRequest;

@ApplicationScoped
public class OrcaPatientSyncRunner {
    private static final int ORCA_PATIENT_ID_LIST_LIMIT = 1000;

    private OrcaLiveGateway liveGateway;
    private OrcaPatientImportService importService;
    private OrcaSyncCursorStore cursorStore;
    private OrcaSyncRunStore runStore;

    public OrcaPatientSyncRunner() {
        // CDI
    }

    public OrcaPatientSyncRunner(OrcaLiveGateway liveGateway,
            OrcaPatientImportService importService,
            OrcaSyncCursorStore cursorStore,
            OrcaSyncRunStore runStore) {
        this.liveGateway = liveGateway;
        this.importService = importService;
        this.cursorStore = cursorStore;
        this.runStore = runStore;
    }

    @Inject
    void setLiveGateway(OrcaLiveGateway liveGateway) {
        this.liveGateway = liveGateway;
    }

    @Inject
    void setImportService(OrcaPatientImportService importService) {
        this.importService = importService;
    }

    @Inject
    void setCursorStore(OrcaSyncCursorStore cursorStore) {
        this.cursorStore = cursorStore;
    }

    @Inject
    void setRunStore(OrcaSyncRunStore runStore) {
        this.runStore = runStore;
    }

    public PatientImportResponse run(String facilityId, PatientSyncRequest request, String trigger, String runId) {
        requireFacilityId(facilityId);
        Objects.requireNonNull(request, "request");
        requireTrigger(trigger);
        ensureDependencies();

        LocalDate start = request.getStartDate();
        LocalDate end = request.getEndDate() != null ? request.getEndDate() : start;
        if (start == null) {
            throw new OrcaGatewayException("startDate is required");
        }
        if (end == null) {
            end = start;
        }
        if (end.isBefore(start)) {
            throw new OrcaGatewayException("endDate must be on or after startDate");
        }

        String effectiveRunId = normalize(runId);
        if (effectiveRunId == null && "scheduler".equals(trigger)) {
            effectiveRunId = OrcaPatientSyncPlanner.generateScheduledRunId(facilityId, Instant.now());
        }
        if (effectiveRunId == null) {
            throw new OrcaGatewayException("runId is required");
        }

        Instant requestedAt = Instant.now();
        runStore.createRequested(effectiveRunId, facilityId, OrcaPatientSyncPlanner.STREAM_KIND, trigger, requestedAt, 0);
        initializeCursorIfMissing(facilityId, start);

        Instant startedAt = Instant.now();
        try {
            List<String> patientIds = fetchPatientIdsWithSplit(
                    facilityId,
                    start,
                    end,
                    request.getClassCode(),
                    request.isIncludeTestPatient());
            PatientImportRequest importRequest = new PatientImportRequest();
            importRequest.getPatientIds().addAll(patientIds);
            importRequest.setIncludeInsurance(request.isIncludeInsurance());

            runStore.markFetching(effectiveRunId, patientIds.size(), startedAt);
            runStore.markApplying(effectiveRunId, patientIds.size(), patientIds.size());

            PatientImportResponse response = importService.importPatients(facilityId, importRequest, effectiveRunId);
            int requestedCount = response.getRequestedCount();
            int fetchedCount = response.getFetchedCount();
            int appliedCount = response.getCreatedCount() + response.getUpdatedCount();
            int failedCount = response.getErrors().size();
            int skippedCount = response.getSkippedCount();
            Instant finishedAt = Instant.now();

            if (failedCount == 0) {
                runStore.markCompleted(effectiveRunId, requestedCount, finishedAt, fetchedCount, appliedCount, skippedCount);
                cursorStore.save(facilityId, OrcaPatientSyncPlanner.STREAM_KIND, "date", end.toString(), effectiveRunId);
            } else {
                runStore.markPartial(
                        effectiveRunId,
                        requestedCount,
                        finishedAt,
                        fetchedCount,
                        appliedCount,
                        failedCount,
                        skippedCount,
                        "partial_apply",
                        summarizeErrors(response));
            }
            return response;
        } catch (RuntimeException ex) {
            runStore.markFailed(effectiveRunId, 0, Instant.now(), 0, 0, "sync_failed", summarizeError(ex));
            throw ex;
        }
    }

    private void initializeCursorIfMissing(String facilityId, LocalDate startDate) {
        if (cursorStore.load(facilityId, OrcaPatientSyncPlanner.STREAM_KIND) == null) {
            cursorStore.save(facilityId, OrcaPatientSyncPlanner.STREAM_KIND, "date", startDate.toString(), null);
        }
    }

    private List<String> fetchPatientIdsWithSplit(String facilityId, LocalDate startDate, LocalDate endDate,
            String classCode, boolean includeTestPatient) {
        PatientIdListResponse response = fetchPatientIdList(facilityId, startDate, endDate, classCode, includeTestPatient);
        int returned = response.getPatients() != null ? response.getPatients().size() : 0;
        int target = response.getTargetPatientCount();
        boolean overLimit = target > returned
                || target > ORCA_PATIENT_ID_LIST_LIMIT
                || returned >= ORCA_PATIENT_ID_LIST_LIMIT
                || containsOverLimitHint(response);

        if (overLimit) {
            long days = ChronoUnit.DAYS.between(startDate, endDate);
            if (days <= 0) {
                throw new OrcaGatewayException("ORCA patientlst1v2 returned over-limit result for " + startDate
                        + " (cannot split further)");
            }
            LocalDate mid = startDate.plusDays(days / 2);
            LocalDate rightStart = mid.plusDays(1);
            List<String> left = fetchPatientIdsWithSplit(facilityId, startDate, mid, classCode, includeTestPatient);
            List<String> right = rightStart.isAfter(endDate)
                    ? List.of()
                    : fetchPatientIdsWithSplit(facilityId, rightStart, endDate, classCode, includeTestPatient);
            LinkedHashSet<String> merged = new LinkedHashSet<>();
            merged.addAll(left);
            merged.addAll(right);
            return new ArrayList<>(merged);
        }

        LinkedHashSet<String> ids = new LinkedHashSet<>();
        if (response.getPatients() != null) {
            for (PatientIdListResponse.PatientSyncEntry entry : response.getPatients()) {
                String pid = entry != null && entry.getSummary() != null ? normalize(entry.getSummary().getPatientId()) : null;
                if (pid != null) {
                    ids.add(pid);
                }
            }
        }
        return new ArrayList<>(ids);
    }

    private PatientIdListResponse fetchPatientIdList(String facilityId, LocalDate startDate, LocalDate endDate,
            String classCode, boolean includeTestPatient) {
        PatientIdListRequest request = new PatientIdListRequest();
        request.setStartDate(startDate);
        request.setEndDate(endDate);
        request.setClassCode(classCode);
        request.setIncludeTestPatient(includeTestPatient);
        PatientIdListResponse response = liveGateway.getPatientIdList(facilityId, request);
        if (response == null) {
            throw new OrcaGatewayException("ORCA patientlst1v2 response is empty");
        }
        return response;
    }

    private boolean containsOverLimitHint(PatientIdListResponse response) {
        String message = response.getApiResultMessage();
        if (message == null || message.isBlank()) {
            return false;
        }
        String normalized = message.toLowerCase(Locale.ROOT);
        return normalized.contains("1000") && (normalized.contains("over") || normalized.contains("超") || normalized.contains("上限"));
    }

    private static String summarizeErrors(PatientImportResponse response) {
        if (response == null || response.getErrors().isEmpty()) {
            return null;
        }
        PatientImportResponse.ImportError first = response.getErrors().get(0);
        if (first == null) {
            return "patient import partial failure";
        }
        String patientId = normalize(first.getPatientId());
        String message = normalize(first.getMessage());
        if (patientId != null && message != null) {
            return patientId + ": " + message;
        }
        return message != null ? message : "patient import partial failure";
    }

    private static String summarizeError(RuntimeException ex) {
        if (ex == null || ex.getMessage() == null || ex.getMessage().isBlank()) {
            return "ORCA patient sync failed";
        }
        return ex.getMessage();
    }

    private void requireFacilityId(String facilityId) {
        if (facilityId == null || facilityId.isBlank()) {
            throw new OrcaGatewayException("facilityId is required");
        }
    }

    private void requireTrigger(String trigger) {
        String normalized = normalize(trigger);
        if (!"api".equals(normalized) && !"scheduler".equals(normalized)) {
            throw new IllegalArgumentException("trigger must be api or scheduler");
        }
    }

    private void ensureDependencies() {
        if (liveGateway == null) {
            throw new IllegalStateException("OrcaLiveGateway is not available");
        }
        if (importService == null) {
            throw new IllegalStateException("OrcaPatientImportService is not available");
        }
        if (cursorStore == null) {
            throw new IllegalStateException("OrcaSyncCursorStore is not available");
        }
        if (runStore == null) {
            throw new IllegalStateException("OrcaSyncRunStore is not available");
        }
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
