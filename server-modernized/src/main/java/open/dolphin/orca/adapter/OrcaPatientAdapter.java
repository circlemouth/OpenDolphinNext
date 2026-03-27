package open.dolphin.orca.adapter;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Domain-oriented ORCA boundary for patient/reception use cases.
 * Business services must depend on this contract instead of raw XML/HTTP concerns.
 */
public interface OrcaPatientAdapter {

    SearchResult searchPatients(PatientSearchQuery query);

    UpsertResult upsertPatient(PatientUpsertCommand command);

    ReceptionResult registerReception(ReceptionCommand command);

    record PatientSearchQuery(String facilityId,
                              String patientId,
                              String fullName,
                              String kanaName,
                              String birthDate) {
    }

    record PatientUpsertCommand(String facilityId,
                                String patientId,
                                Map<String, Object> patientPayload) {
        public PatientUpsertCommand {
            patientPayload = patientPayload == null
                    ? Collections.emptyMap()
                    : Collections.unmodifiableMap(new LinkedHashMap<>(patientPayload));
        }

        @Override
        public Map<String, Object> patientPayload() {
            return copyMap(patientPayload);
        }
    }

    record ReceptionCommand(String facilityId,
                            String patientId,
                            String departmentCode,
                            String doctorCode,
                            String visitDate,
                            Map<String, Object> payload) {
        public ReceptionCommand {
            payload = payload == null
                    ? Collections.emptyMap()
                    : Collections.unmodifiableMap(new LinkedHashMap<>(payload));
        }

        @Override
        public Map<String, Object> payload() {
            return copyMap(payload);
        }
    }

    record SearchResult(List<Map<String, Object>> patients,
                        String requestId,
                        String runId,
                        String sourceSystem) {
        public SearchResult {
            if (patients == null) {
                patients = List.of();
            } else {
                List<Map<String, Object>> copied = new ArrayList<>(patients.size());
                for (Map<String, Object> patient : patients) {
                    copied.add(patient == null
                            ? Collections.emptyMap()
                            : Collections.unmodifiableMap(new LinkedHashMap<>(patient)));
                }
                patients = Collections.unmodifiableList(copied);
            }
        }

        @Override
        public List<Map<String, Object>> patients() {
            return copyPatientList(patients);
        }
    }

    record UpsertResult(String patientId,
                        String orcaPatientKey,
                        String requestId,
                        String runId,
                        boolean created) {
    }

    record ReceptionResult(String receptionId,
                           String patientId,
                           String requestId,
                           String runId,
                           String status) {
    }

    private static Map<String, Object> copyMap(Map<String, Object> source) {
        if (source.isEmpty()) {
            return Collections.emptyMap();
        }
        return Collections.unmodifiableMap(new LinkedHashMap<>(source));
    }

    private static List<Map<String, Object>> copyPatientList(List<Map<String, Object>> source) {
        if (source.isEmpty()) {
            return List.of();
        }
        List<Map<String, Object>> copied = new ArrayList<>(source.size());
        for (Map<String, Object> patient : source) {
            copied.add(patient == null ? Collections.emptyMap() : copyMap(patient));
        }
        return Collections.unmodifiableList(copied);
    }
}
