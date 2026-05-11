package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import open.dolphin.rest.dto.orca.ChartSupportMedicalModV2Request;
import open.dolphin.rest.dto.orca.OrcaMedicalCandidateResponse;
import org.junit.jupiter.api.Test;

class OrcaMedicalCandidateRepositoryTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper().findAndRegisterModules();

    @Test
    void candidateSnapshotPersistsSourceHashWithoutPatientOrEncounterAuthorityFields() {
        ChartSupportMedicalModV2Request.MedicalInformation information =
                new ChartSupportMedicalModV2Request.MedicalInformation();
        information.setRpSequence(1);
        information.setMedicalClass("211");
        information.setUsageCode("001000");

        OrcaMedicalCandidateResponse candidate = new OrcaMedicalCandidateResponse();
        candidate.setNonAuthoritative(true);
        candidate.setCandidateStatus("READY_TO_SEND");
        candidate.setSendable(true);
        candidate.setPatientId("00001");
        candidate.setEncounterId("ENC-001");
        candidate.setPrescriptionContentHash("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
        candidate.setMedicalInformation(List.of(information));

        Map<String, Object> snapshot = new OrcaMedicalCandidateRepository().candidateSnapshot(candidate);

        assertEquals(Boolean.TRUE, snapshot.get("nonAuthoritative"));
        assertEquals("READY_TO_SEND", snapshot.get("candidateStatus"));
        assertEquals(Boolean.TRUE, snapshot.get("sendable"));
        assertEquals("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                snapshot.get("prescriptionContentHash"));
        assertSame(candidate.getMedicalInformation(), snapshot.get("medicalInformation"));
        assertFalse(snapshot.containsKey("patientId"));
        assertFalse(snapshot.containsKey("encounterId"));
        assertTrue(snapshot.keySet().stream().noneMatch(key -> key.toLowerCase().contains("voucher")));
        assertTrue(snapshot.keySet().stream().noneMatch(key -> key.toLowerCase().contains("sequential")));
        assertTrue(snapshot.keySet().stream().noneMatch(key -> key.toLowerCase().contains("insurance")));
    }

    @Test
    void toResponseRebuildsLatestCandidateFromSanitizedSnapshotAndDbAuthority() throws Exception {
        ChartSupportMedicalModV2Request.Medication medication =
                new ChartSupportMedicalModV2Request.Medication();
        medication.setItemSequence(1);
        medication.setCode("620000001");
        medication.setNumber("1");

        ChartSupportMedicalModV2Request.MedicalInformation information =
                new ChartSupportMedicalModV2Request.MedicalInformation();
        information.setEntity("medOrder");
        information.setRpSequence(1);
        information.setMedicalClass("211");
        information.setUsageCode("001000");
        information.setMedications(List.of(medication));

        OrcaMedicalCandidateResponse candidate = new OrcaMedicalCandidateResponse();
        candidate.setNonAuthoritative(true);
        candidate.setCandidateStatus("READY_TO_SEND");
        candidate.setSendable(true);
        candidate.setPatientId("CLIENT-PATIENT-IGNORED");
        candidate.setEncounterId("CLIENT-ENCOUNTER-IGNORED");
        candidate.setPrescriptionContentHash("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
        candidate.setMedicalInformation(List.of(information));

        OrcaMedicalCandidateResponse.Issue issue = new OrcaMedicalCandidateResponse.Issue();
        issue.setCode("prescription_content_hash_missing");
        issue.setMessage("prescription content hash is required");

        OrcaMedicalCandidateRepository repository = new OrcaMedicalCandidateRepository();
        OrcaMedicalCandidateRepository.LatestCandidateRecord record =
                new OrcaMedicalCandidateRepository.LatestCandidateRecord(
                        301L,
                        101L,
                        201L,
                        "DB-PATIENT",
                        "DB-ENCOUNTER",
                        "NEEDS_REVIEW",
                        false,
                        OBJECT_MAPPER.writeValueAsString(repository.candidateSnapshot(candidate)),
                        OBJECT_MAPPER.writeValueAsString(List.of(issue)),
                        101L,
                        201L,
                        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");

        OrcaMedicalCandidateResponse response = repository.toResponse("CHART-REV-001", record);

        assertEquals(301L, response.getCandidateId());
        assertTrue(response.isNonAuthoritative());
        assertFalse(response.isSendable());
        assertEquals("NEEDS_REVIEW", response.getCandidateStatus());
        assertEquals("DB-PATIENT", response.getPatientId());
        assertEquals("DB-ENCOUNTER", response.getEncounterId());
        assertEquals("CHART-REV-001", response.getChartRevisionId());
        assertEquals(101L, response.getPrescriptionId());
        assertEquals(201L, response.getPrescriptionRevisionId());
        assertEquals("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                response.getPrescriptionContentHash());
        assertEquals(1, response.getMedicalInformation().size());
        assertEquals(1, response.getMedicalInformation().get(0).getRpSequence());
        assertEquals("620000001", response.getMedicalInformation().get(0).getMedications().get(0).getCode());
        assertEquals("prescription_content_hash_missing", response.getIssues().get(0).getCode());
    }

    @Test
    void toResponseMarksLatestCandidateNeedsReviewWhenCurrentPrescriptionHashChanged() throws Exception {
        ChartSupportMedicalModV2Request.MedicalInformation information =
                new ChartSupportMedicalModV2Request.MedicalInformation();
        information.setRpSequence(1);
        information.setMedicalClass("211");

        OrcaMedicalCandidateResponse candidate = new OrcaMedicalCandidateResponse();
        candidate.setNonAuthoritative(true);
        candidate.setCandidateStatus("READY_TO_SEND");
        candidate.setSendable(true);
        candidate.setPrescriptionContentHash("cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc");
        candidate.setMedicalInformation(List.of(information));

        OrcaMedicalCandidateRepository repository = new OrcaMedicalCandidateRepository();
        OrcaMedicalCandidateRepository.LatestCandidateRecord record =
                new OrcaMedicalCandidateRepository.LatestCandidateRecord(
                        301L,
                        101L,
                        201L,
                        "DB-PATIENT",
                        "DB-ENCOUNTER",
                        "READY_TO_SEND",
                        true,
                        OBJECT_MAPPER.writeValueAsString(repository.candidateSnapshot(candidate)),
                        "[]",
                        101L,
                        201L,
                        "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd");

        OrcaMedicalCandidateResponse response = repository.toResponse("CHART-REV-001", record);

        assertEquals("NEEDS_REVIEW", response.getCandidateStatus());
        assertFalse(response.isSendable());
        assertTrue(response.getIssues().stream()
                .anyMatch(issue -> "prescription_candidate_source_stale".equals(issue.getCode())));
    }

    @Test
    void toResponseMarksLatestCandidateNeedsReviewWhenCurrentPrescriptionRevisionChanged() throws Exception {
        ChartSupportMedicalModV2Request.MedicalInformation information =
                new ChartSupportMedicalModV2Request.MedicalInformation();
        information.setRpSequence(1);
        information.setMedicalClass("211");

        OrcaMedicalCandidateResponse candidate = new OrcaMedicalCandidateResponse();
        candidate.setNonAuthoritative(true);
        candidate.setCandidateStatus("READY_TO_SEND");
        candidate.setSendable(true);
        candidate.setPrescriptionContentHash("eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
        candidate.setMedicalInformation(List.of(information));

        OrcaMedicalCandidateRepository repository = new OrcaMedicalCandidateRepository();
        OrcaMedicalCandidateRepository.LatestCandidateRecord record =
                new OrcaMedicalCandidateRepository.LatestCandidateRecord(
                        301L,
                        101L,
                        201L,
                        "DB-PATIENT",
                        "DB-ENCOUNTER",
                        "READY_TO_SEND",
                        true,
                        OBJECT_MAPPER.writeValueAsString(repository.candidateSnapshot(candidate)),
                        "[]",
                        101L,
                        202L,
                        "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");

        OrcaMedicalCandidateResponse response = repository.toResponse("CHART-REV-001", record);

        assertEquals("NEEDS_REVIEW", response.getCandidateStatus());
        assertFalse(response.isSendable());
        assertTrue(response.getIssues().stream()
                .anyMatch(issue -> "prescription_candidate_source_stale".equals(issue.getCode())));
    }

    @Test
    void toResponseMarksLatestCandidateNeedsReviewWhenCurrentPrescriptionOrderChanged() throws Exception {
        ChartSupportMedicalModV2Request.MedicalInformation information =
                new ChartSupportMedicalModV2Request.MedicalInformation();
        information.setRpSequence(1);
        information.setMedicalClass("211");

        OrcaMedicalCandidateResponse candidate = new OrcaMedicalCandidateResponse();
        candidate.setNonAuthoritative(true);
        candidate.setCandidateStatus("READY_TO_SEND");
        candidate.setSendable(true);
        candidate.setPrescriptionContentHash("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
        candidate.setMedicalInformation(List.of(information));

        OrcaMedicalCandidateRepository repository = new OrcaMedicalCandidateRepository();
        OrcaMedicalCandidateRepository.LatestCandidateRecord record =
                new OrcaMedicalCandidateRepository.LatestCandidateRecord(
                        301L,
                        101L,
                        201L,
                        "DB-PATIENT",
                        "DB-ENCOUNTER",
                        "READY_TO_SEND",
                        true,
                        OBJECT_MAPPER.writeValueAsString(repository.candidateSnapshot(candidate)),
                        "[]",
                        102L,
                        201L,
                        "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

        OrcaMedicalCandidateResponse response = repository.toResponse("CHART-REV-001", record);

        assertEquals("NEEDS_REVIEW", response.getCandidateStatus());
        assertFalse(response.isSendable());
        assertTrue(response.getIssues().stream()
                .anyMatch(issue -> "prescription_candidate_source_stale".equals(issue.getCode())));
    }
}
