package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.ObjectMapper;
import open.dolphin.rest.dto.orca.DiseaseMutationRequest;
import org.junit.jupiter.api.Test;

class DiseaseMutationRequestContractTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper().findAndRegisterModules();

    @Test
    void dtoCarriesDiseaseV3CompletenessFieldsWithoutClientAuthorityShortcuts() throws Exception {
        DiseaseMutationRequest request = OBJECT_MAPPER.readValue("""
                {
                  "patientId": "00001",
                  "baseMonth": "202605",
                  "performDate": "2026-05-11",
                  "performTime": "103000",
                  "departmentCode": "01",
                  "physicianCode": "10001",
                  "insuranceCombinationNumber": "0001",
                  "operations": [
                    {
                      "operation": "update",
                      "diagnosisId": 12,
                      "diagnosisName": "候補病名",
                      "diagnosisCode": "A001",
                      "karteName": "カルテ表示名",
                      "departmentCode": "01",
                      "physicianCode": "10001",
                      "insuranceCombinationNumber": "0001",
                      "baseMonth": "202605",
                      "performDate": "2026-05-11",
                      "startDate": "2026-05-10",
                      "endDate": "2026-05-31",
                      "outcome": "C",
                      "category": "PD",
                      "diseaseClass": "01",
                      "diseaseReceiptPrint": "1",
                      "diseaseReceiptPrintPeriod": "1",
                      "insuranceDisease": "1",
                      "dischargeCertificate": "0",
                      "mainDiseaseClass": "01",
                      "subDiseaseClass": "05",
                      "suspectedFlag": "0",
                      "components": [{"seq": 1, "componentType": "BODY", "code": "A001", "name": "候補"}],
                      "supplements": [{"seq": 1, "supplementCode": "S001", "supplementName": "補足"}]
                    }
                  ]
                }
                """, DiseaseMutationRequest.class);

        assertEquals("202605", request.getBaseMonth());
        assertEquals("2026-05-11", request.getPerformDate());
        assertEquals("10001", request.getPhysicianCode());
        DiseaseMutationRequest.MutationEntry entry = request.getOperations().get(0);
        assertEquals("カルテ表示名", entry.getKarteName());
        assertEquals("202605", entry.getBaseMonth());
        assertEquals("2026-05-11", entry.getPerformDate());
        assertEquals("01", entry.getDiseaseClass());
        assertEquals("1", entry.getDiseaseReceiptPrint());
        assertEquals("1", entry.getInsuranceDisease());
        assertEquals("01", entry.getMainDiseaseClass());
        assertEquals("05", entry.getSubDiseaseClass());
        assertEquals("A001", entry.getComponents().get(0).getCode());
        assertEquals("S001", entry.getSupplements().get(0).getSupplementCode());
    }
}
