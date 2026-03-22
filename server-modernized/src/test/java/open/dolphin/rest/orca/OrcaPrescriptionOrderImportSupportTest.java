package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import open.dolphin.rest.dto.orca.PrescriptionDoInputMeta;
import open.dolphin.rest.dto.orca.PrescriptionDrug;
import open.dolphin.rest.dto.orca.PrescriptionOrder;
import open.dolphin.rest.dto.orca.PrescriptionRp;
import org.junit.jupiter.api.Test;

class OrcaPrescriptionOrderImportSupportTest {

    private static final ObjectMapper MAPPER = new ObjectMapper().findAndRegisterModules();

    @Test
    void applyDoImportStampsMetadataAndDropsExpiredImportedDrugs() {
        PrescriptionOrder base = new PrescriptionOrder();
        base.setEncounterId("enc-base");
        base.setEncounterDate("2025-03-20");

        PrescriptionDrug keptBaseDrug = new PrescriptionDrug();
        keptBaseDrug.setCode("BASE");
        PrescriptionRp baseRp = new PrescriptionRp();
        baseRp.setRpNumber("1");
        baseRp.setUsageCode("100");
        baseRp.setDrugs(List.of(keptBaseDrug));
        base.setRps(List.of(baseRp));

        PrescriptionDrug expiredDrug = new PrescriptionDrug();
        expiredDrug.setCode("OLD");
        expiredDrug.setValidTo("2025-03-19");
        PrescriptionDrug activeDrug = new PrescriptionDrug();
        activeDrug.setCode("NEW");
        activeDrug.setValidTo("2025-03-31");
        PrescriptionRp importedRp = new PrescriptionRp();
        importedRp.setRpNumber("2");
        importedRp.setUsageCode("200");
        importedRp.setDrugs(List.of(expiredDrug, activeDrug));
        PrescriptionOrder incoming = new PrescriptionOrder();
        incoming.setPatientId("source-patient");
        incoming.setEncounterId("enc-new");
        incoming.setEncounterDate("2025-03-21");
        incoming.setPerformDate("20250321");
        incoming.setRps(List.of(importedRp));

        List<String> warnings = new ArrayList<>();
        PrescriptionOrder merged = OrcaPrescriptionOrderImportSupport.applyDoImport(
                base,
                incoming,
                "target-patient",
                null,
                LocalDate.parse("2025-03-21"),
                "doctor",
                "run-1",
                Instant.parse("2025-03-21T00:00:00Z"),
                warnings,
                MAPPER);

        assertEquals("target-patient", merged.getPatientId());
        assertEquals("enc-new", merged.getEncounterId());
        assertEquals("2025-03-21", merged.getEncounterDate());
        assertEquals("2025-03-21", merged.getPerformDate());
        assertNotNull(merged.getDoInputMeta());
        assertEquals("source-patient", merged.getDoInputMeta().getSourcePatientId());
        assertEquals("doctor", merged.getDoInputMeta().getImportedBy());
        assertEquals("run-1", merged.getDoInputMeta().getRunId());
        assertEquals(2, merged.getRps().size());
        assertEquals(1, merged.getRps().get(1).getDrugs().size());
        assertEquals(1, warnings.size());

        PrescriptionDoInputMeta drugMeta = merged.getRps().get(1).getDrugs().get(0).getDoInputMeta();
        assertNotNull(drugMeta);
        assertTrue(Boolean.TRUE.equals(drugMeta.getImportedFromDo()));
    }

    @Test
    void hasMissingUsageCodeRequiresDrugRows() {
        PrescriptionRp validRp = new PrescriptionRp();
        validRp.setUsageCode("100");
        validRp.setDrugs(List.of(new PrescriptionDrug()));
        PrescriptionOrder valid = new PrescriptionOrder();
        valid.setRps(List.of(validRp));
        assertFalse(OrcaPrescriptionOrderImportSupport.hasMissingUsageCode(valid));

        PrescriptionRp invalidRp = new PrescriptionRp();
        invalidRp.setDrugs(List.of(new PrescriptionDrug()));
        PrescriptionOrder invalid = new PrescriptionOrder();
        invalid.setRps(List.of(invalidRp));
        assertTrue(OrcaPrescriptionOrderImportSupport.hasMissingUsageCode(invalid));
    }
}
