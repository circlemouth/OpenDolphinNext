package open.dolphin.orca.sync;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.SimpleAddressModel;
import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.orca.service.OrcaWrapperService;
import open.dolphin.rest.dto.orca.PatientBatchRequest;
import open.dolphin.rest.dto.orca.PatientBatchResponse;
import open.dolphin.rest.dto.orca.PatientDetail;
import open.dolphin.rest.dto.orca.PatientIdListRequest;
import open.dolphin.rest.dto.orca.PatientIdListResponse;
import open.dolphin.rest.dto.orca.PatientImportRequest;
import open.dolphin.rest.dto.orca.PatientImportResponse;
import open.dolphin.rest.dto.orca.PatientImportResponse.ImportError;
import open.dolphin.rest.dto.orca.PatientSummary;
import open.dolphin.rest.dto.orca.PatientSyncRequest;
import open.dolphin.session.PatientServiceBean;

/**
 * Imports/synchronizes ORCA patients into the local OpenDolphin patient table (d_patient),
 * using facilityId + ORCA patientId (Patient_ID) as the business key.
 */
@ApplicationScoped
public class OrcaPatientSyncService {
    private static final int ORCA_PATIENT_BATCH_LIMIT = 100;
    private static final int ORCA_PATIENT_ID_LIST_LIMIT = 1000;

    private OrcaWrapperService wrapperService;
    private PatientServiceBean patientServiceBean;
    private OrcaPatientSyncStateStore stateStore;

    public OrcaPatientSyncService() {
        // CDI
    }

    public OrcaPatientSyncService(OrcaWrapperService wrapperService,
            PatientServiceBean patientServiceBean,
            OrcaPatientSyncStateStore stateStore) {
        this.wrapperService = wrapperService;
        this.patientServiceBean = patientServiceBean;
        this.stateStore = stateStore;
    }

    @Inject
    void setWrapperService(OrcaWrapperService wrapperService) {
        this.wrapperService = wrapperService;
    }

    @Inject
    void setPatientServiceBean(PatientServiceBean patientServiceBean) {
        this.patientServiceBean = patientServiceBean;
    }

    @Inject
    void setStateStore(OrcaPatientSyncStateStore stateStore) {
        this.stateStore = stateStore;
    }

    public PatientImportResponse importPatients(String facilityId, PatientImportRequest request, String runId) {
        requireFacilityId(facilityId);
        Objects.requireNonNull(request, "request");
        ensureDependencies();

        List<String> normalizedIds = normalizePatientIds(request.getPatientIds());
        PatientImportResponse response = new PatientImportResponse();
        response.setFacilityId(facilityId);
        response.setRunId(runId);
        response.setApiResult("00");
        response.setApiResultMessage("OK");
        response.setRequestedCount(normalizedIds.size());

        if (normalizedIds.isEmpty()) {
            response.setApiResult("01");
            response.setApiResultMessage("patientIds is required");
            response.setSkippedCount(0);
            return response;
        }

        int created = 0;
        int updated = 0;
        int fetched = 0;
        int skipped = 0;

        for (int offset = 0; offset < normalizedIds.size(); offset += ORCA_PATIENT_BATCH_LIMIT) {
            List<String> chunk = normalizedIds.subList(offset, Math.min(offset + ORCA_PATIENT_BATCH_LIMIT, normalizedIds.size()));
            PatientBatchRequest batchRequest = new PatientBatchRequest();
            batchRequest.getPatientIds().addAll(chunk);
            batchRequest.setIncludeInsurance(request.isIncludeInsurance());

            PatientBatchResponse batchResponse = wrapperService.getPatientBatch(batchRequest);
            if (batchResponse == null || batchResponse.getPatients() == null) {
                skipped += chunk.size();
                ImportError err = new ImportError();
                err.setMessage("ORCA patient batch response is empty");
                response.getErrors().add(err);
                continue;
            }

            List<PatientDetail> details = batchResponse.getPatients();
            fetched += details.size();
            List<PatientModel> modelsToUpsert = new ArrayList<>();
            for (PatientDetail detail : details) {
                try {
                    modelsToUpsert.add(toPatientModel(facilityId, detail));
                } catch (RuntimeException ex) {
                    String pid = safePatientId(detail);
                    ImportError err = new ImportError();
                    err.setPatientId(pid);
                    err.setMessage(ex.getMessage() != null ? ex.getMessage() : "Import failed");
                    response.getErrors().add(err);
                    skipped++;
                }
            }
            if (modelsToUpsert.isEmpty()) {
                continue;
            }
            PatientServiceBean.SyncPatientUpsertResult result = patientServiceBean.upsertPatientsForSync(facilityId, modelsToUpsert);
            created += result.createdCount();
            updated += result.updatedCount();
        }

        response.setFetchedCount(fetched);
        response.setCreatedCount(created);
        response.setUpdatedCount(updated);
        response.setSkippedCount(skipped);
        response.setRecordsReturned(fetched);
        if (!response.getErrors().isEmpty()) {
            response.setApiResult("10");
            response.setApiResultMessage("PARTIAL");
        }
        return response;
    }

    public PatientImportResponse syncPatients(String facilityId, PatientSyncRequest request, String runId) {
        requireFacilityId(facilityId);
        Objects.requireNonNull(request, "request");
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

        try {
            List<String> patientIds = fetchPatientIdsWithSplit(start, end, request.getClassCode(), request.isIncludeTestPatient());
            PatientImportRequest importRequest = new PatientImportRequest();
            importRequest.getPatientIds().addAll(patientIds);
            importRequest.setIncludeInsurance(request.isIncludeInsurance());
            PatientImportResponse response = importPatients(facilityId, importRequest, runId);
            if ("00".equals(response.getApiResult()) || "10".equals(response.getApiResult())) {
                if (stateStore != null) {
                    stateStore.markSuccess(facilityId, end, runId);
                }
            }
            return response;
        } catch (RuntimeException ex) {
            if (stateStore != null) {
                stateStore.markFailure(facilityId, ex.getMessage(), runId);
            }
            throw ex;
        }
    }

    private List<String> fetchPatientIdsWithSplit(LocalDate startDate, LocalDate endDate,
            String classCode, boolean includeTestPatient) {
        PatientIdListResponse response = fetchPatientIdList(startDate, endDate, classCode, includeTestPatient);
        int returned = response != null && response.getPatients() != null ? response.getPatients().size() : 0;
        int target = response != null ? response.getTargetPatientCount() : 0;
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
            List<String> left = fetchPatientIdsWithSplit(startDate, mid, classCode, includeTestPatient);
            List<String> right = rightStart.isAfter(endDate)
                    ? List.of()
                    : fetchPatientIdsWithSplit(rightStart, endDate, classCode, includeTestPatient);
            LinkedHashSet<String> merged = new LinkedHashSet<>();
            merged.addAll(left);
            merged.addAll(right);
            return new ArrayList<>(merged);
        }

        LinkedHashSet<String> ids = new LinkedHashSet<>();
        if (response != null && response.getPatients() != null) {
            for (PatientIdListResponse.PatientSyncEntry entry : response.getPatients()) {
                String pid = entry != null && entry.getSummary() != null ? normalizePatientId(entry.getSummary().getPatientId()) : null;
                if (pid != null) {
                    ids.add(pid);
                }
            }
        }
        return new ArrayList<>(ids);
    }

    private PatientIdListResponse fetchPatientIdList(LocalDate startDate, LocalDate endDate,
            String classCode, boolean includeTestPatient) {
        PatientIdListRequest request = new PatientIdListRequest();
        request.setStartDate(startDate);
        request.setEndDate(endDate);
        request.setClassCode(classCode);
        request.setIncludeTestPatient(includeTestPatient);
        PatientIdListResponse response = wrapperService.getPatientIdList(request);
        if (response == null) {
            throw new OrcaGatewayException("ORCA patientlst1v2 response is empty");
        }
        return response;
    }

    private boolean containsOverLimitHint(PatientIdListResponse response) {
        if (response == null) {
            return false;
        }
        String message = response.getApiResultMessage();
        if (message == null || message.isBlank()) {
            return false;
        }
        String normalized = message.toLowerCase(Locale.ROOT);
        return normalized.contains("1000") && (normalized.contains("over") || normalized.contains("超") || normalized.contains("上限"));
    }

    private PatientModel toPatientModel(String facilityId, PatientDetail detail) {
        if (detail == null || detail.getSummary() == null) {
            throw new OrcaGatewayException("patient detail is missing");
        }
        PatientSummary summary = detail.getSummary();
        String patientId = normalizePatientId(summary.getPatientId());
        if (patientId == null) {
            throw new OrcaGatewayException("patientId is missing in ORCA payload");
        }
        String fullName = normalizeText(summary.getWholeName());
        if (fullName == null) {
            throw new OrcaGatewayException("wholeName is missing for patientId=" + patientId);
        }
        String kanaName = normalizeText(summary.getWholeNameKana());
        String birthday = normalizeText(summary.getBirthDate());
        String gender = normalizeGender(summary.getSex());
        String zipCode = normalizeZip(detail.getZipCode());
        String address = normalizeText(detail.getAddress());
        String phone1 = normalizeText(detail.getPhoneNumber1());
        String phone2 = normalizeText(detail.getPhoneNumber2());

        PatientModel model = new PatientModel();
        applyPatientFields(model, facilityId, patientId, fullName, kanaName, birthday, gender, zipCode, address, phone1, phone2);
        return model;
    }

    private void applyPatientFields(PatientModel model,
            String facilityId,
            String patientId,
            String fullName,
            String kanaName,
            String birthday,
            String gender,
            String zipCode,
            String address,
            String telephone,
            String mobilePhone) {
        model.setFacilityId(facilityId);
        model.setPatientId(patientId);
        model.setFullName(fullName);
        if (fullName != null && !fullName.isBlank()) {
            String[] parts = fullName.trim().split("\\s+", 2);
            if (parts.length > 0) model.setFamilyName(parts[0]);
            if (parts.length > 1) model.setGivenName(parts[1]);
        }
        model.setKanaName(kanaName);
        model.setBirthday(ModelUtils.parseDate(birthday));
        model.setGender(gender != null ? gender : "U");
        model.setTelephone(telephone);
        model.setMobilePhone(mobilePhone);
        if (zipCode != null || address != null) {
            SimpleAddressModel simple = model.getAddress();
            if (simple == null) {
                simple = new SimpleAddressModel();
                model.setAddress(simple);
            }
            simple.setZipCode(zipCode);
            simple.setAddress(address);
        }
    }

    private List<String> normalizePatientIds(List<String> patientIds) {
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        if (patientIds != null) {
            for (String patientId : patientIds) {
                String normalized = normalizePatientId(patientId);
                if (normalized != null) {
                    unique.add(normalized);
                }
            }
        }
        return new ArrayList<>(unique);
    }

    private static String safePatientId(PatientDetail detail) {
        if (detail == null || detail.getSummary() == null) {
            return null;
        }
        return normalizePatientId(detail.getSummary().getPatientId());
    }

    private static String normalizePatientId(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        return trimmed.matches("\\d+") ? trimmed : null;
    }

    private static String normalizeText(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String normalizeGender(String value) {
        String trimmed = normalizeText(value);
        if (trimmed == null) {
            return "U";
        }
        String normalized = trimmed.toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "1", "M", "MALE" -> "M";
            case "2", "F", "FEMALE" -> "F";
            case "O", "3" -> "O";
            default -> normalized.length() == 1 ? normalized : "U";
        };
    }

    private static String normalizeZip(String value) {
        String trimmed = normalizeText(value);
        if (trimmed == null) {
            return null;
        }
        String digits = trimmed.replaceAll("[^0-9]", "");
        if (digits.length() == 7) {
            return digits.substring(0, 3) + "-" + digits.substring(3);
        }
        return trimmed;
    }

    private void requireFacilityId(String facilityId) {
        if (facilityId == null || facilityId.isBlank()) {
            throw new OrcaGatewayException("facilityId is required");
        }
    }

    private void ensureDependencies() {
        if (wrapperService == null) {
            throw new IllegalStateException("OrcaWrapperService is not available");
        }
        if (patientServiceBean == null) {
            throw new IllegalStateException("PatientServiceBean is not available");
        }
    }
}
