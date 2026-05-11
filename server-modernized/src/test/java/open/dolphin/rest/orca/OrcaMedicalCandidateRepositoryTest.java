package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import open.dolphin.rest.dto.orca.ChartSupportMedicalModV2Request;
import open.dolphin.rest.dto.orca.OrcaMedicalCandidateResponse;
import org.junit.jupiter.api.Test;

class OrcaMedicalCandidateRepositoryTest {

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
}
