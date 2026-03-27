package open.dolphin.orca.sync;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.SimpleAddressModel;
import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.orca.service.OrcaLiveGateway;
import open.dolphin.rest.dto.orca.PatientBatchRequest;
import open.dolphin.rest.dto.orca.PatientBatchResponse;
import open.dolphin.rest.dto.orca.PatientDetail;
import open.dolphin.rest.dto.orca.PatientImportRequest;
import open.dolphin.rest.dto.orca.PatientImportResponse;
import open.dolphin.rest.dto.orca.PatientImportResponse.ImportError;
import open.dolphin.rest.dto.orca.PatientSummary;
import open.dolphin.session.PatientServiceBean;

@ApplicationScoped
public class OrcaPatientImportService {
    static final int ORCA_PATIENT_BATCH_LIMIT = 100;

    private OrcaLiveGateway liveGateway;
    private PatientServiceBean patientServiceBean;

    public OrcaPatientImportService() {
        // CDI
    }

    @Inject
    void setLiveGateway(OrcaLiveGateway liveGateway) {
        this.liveGateway = liveGateway;
    }

    @Inject
    void setPatientServiceBean(PatientServiceBean patientServiceBean) {
        this.patientServiceBean = patientServiceBean;
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

            PatientBatchResponse batchResponse = liveGateway.getPatientBatch(facilityId, batchRequest);
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
            if (parts.length > 0) {
                model.setFamilyName(parts[0]);
            }
            if (parts.length > 1) {
                model.setGivenName(parts[1]);
            }
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
        if (liveGateway == null) {
            throw new IllegalStateException("OrcaLiveGateway is not available");
        }
        if (patientServiceBean == null) {
            throw new IllegalStateException("PatientServiceBean is not available");
        }
    }
}
