package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import open.dolphin.rest.dto.orca.PrescriptionDrug;
import open.dolphin.rest.dto.orca.PrescriptionRp;
import org.junit.jupiter.api.Test;

class PrescriptionAuthorityStructuredItemTest {

    @Test
    void mapsFirstClassPrescriptionFieldsIntoStructuredItemColumns() {
        PrescriptionAuthorityRepository repository = new PrescriptionAuthorityRepository();
        PrescriptionRp rp = new PrescriptionRp();
        rp.setMedicalClass("232");
        rp.setMedicalClassNumber("7");
        rp.setDays(7);
        rp.setPrescriptionLocation("OUTSIDE");
        rp.setMedicationRoute("TOPICAL");
        rp.setUsageCode("U001");
        rp.setUsageName("1日2回");
        rp.setDoctorComment("RP comment");

        PrescriptionDrug drug = new PrescriptionDrug();
        drug.setCode("620000001");
        drug.setName("Structured Drug");
        drug.setStandardName("10mg");
        drug.setDosageForm("tablet");
        drug.setQuantity("2");
        drug.setUnit("錠");
        drug.setGeneralNamePrescription(true);
        drug.setDrugComment("Drug comment");

        var row = repository.structuredItemRow(3, 2, rp, drug, "doctor-1");

        assertEquals(3, row.itemSequence());
        assertEquals(2, row.rpSequence());
        assertEquals("620000001", row.drugCode());
        assertEquals("Structured Drug", row.drugName());
        assertEquals("10mg", row.standardName());
        assertEquals("tablet", row.dosageForm());
        assertEquals("U001", row.usageCode());
        assertEquals("1日2回", row.usageName());
        assertEquals("2", row.doseValue());
        assertEquals("錠", row.doseUnit());
        assertEquals(7, row.days());
        assertEquals("OUTSIDE", row.prescriptionLocation());
        assertEquals("TOPICAL", row.medicationRoute());
        assertTrue(row.genericNamePrescription());
        assertEquals("Drug comment", row.doctorComment());
        assertNull(row.unresolvedReason());
        assertTrue(row.itemJson().contains("\"standardName\":\"10mg\""));
        assertTrue(row.itemJson().contains("\"dosageForm\":\"tablet\""));
        assertEquals("doctor-1", row.createdBy());
    }

    @Test
    void derivesLocationRouteAndDaysFromMedicalClassWhenClientSideHintsAreMissing() {
        PrescriptionAuthorityRepository repository = new PrescriptionAuthorityRepository();
        PrescriptionRp rp = new PrescriptionRp();
        rp.setMedicalClass("221");
        rp.setMedicalClassNumber("3");
        rp.setDrugs(List.of());

        PrescriptionDrug drug = new PrescriptionDrug();
        drug.setName("As Needed Drug");

        var row = repository.structuredItemRow(1, 1, rp, drug, "doctor-2");

        assertEquals(3, row.days());
        assertEquals("IN_HOUSE", row.prescriptionLocation());
        assertEquals("AS_NEEDED", row.medicationRoute());
        assertEquals("drug_code_unresolved", row.unresolvedReason());
        assertEquals("doctor-2", row.createdBy());
    }
}
