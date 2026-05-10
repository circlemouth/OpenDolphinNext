package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Date;
import java.util.List;
import open.dolphin.infomodel.RegisteredDiagnosisModel;
import open.dolphin.orca.service.DiseaseProjectionService;
import open.dolphin.rest.dto.orca.DiseaseImportResponse;
import org.junit.jupiter.api.Test;

class OrcaDiseaseMirrorSyncSupportTest {

    @Test
    void buildImportResponse_marksMirrorEntriesReadOnlyWithoutDefaultManualResolution() {
        RegisteredDiagnosisModel diagnosis = new RegisteredDiagnosisModel();
        diagnosis.setId(91L);
        diagnosis.setDiagnosis("高血圧症");
        diagnosis.setDiagnosisCode("I10");
        diagnosis.setStartDate("2026-04-01");
        diagnosis.setStarted(Date.from(LocalDate.of(2026, 4, 1).atStartOfDay(ZoneId.systemDefault()).toInstant()));
        diagnosis.setStatus("ORCA_MIRROR");

        DiseaseImportResponse response = new DiseaseProjectionService().buildImportResponse(
                List.of(diagnosis),
                "RUN-MIRROR",
                "00001",
                diagnosis.getStarted(),
                diagnosis.getStarted());

        assertEquals(1, response.getDiseases().size());
        DiseaseImportResponse.DiseaseEntry entry = response.getDiseases().get(0);
        assertEquals("orca-mirror", entry.getLayer());
        assertEquals("none", entry.getSyncState());
        assertTrue(Boolean.TRUE.equals(entry.getReadOnly()));
        assertTrue(Boolean.FALSE.equals(entry.getCandidateOnly()));
        assertEquals(null, entry.getNote());
    }
}
