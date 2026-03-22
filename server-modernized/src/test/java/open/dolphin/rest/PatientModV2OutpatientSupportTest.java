package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.WebApplicationException;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.SimpleAddressModel;
import open.dolphin.orca.service.OrcaWrapperService;
import open.dolphin.orca.sync.OrcaPatientSyncService;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.rest.dto.orca.PatientBatchResponse;
import open.dolphin.rest.dto.orca.PatientDetail;
import open.dolphin.rest.dto.orca.PatientImportResponse;
import open.dolphin.rest.dto.orca.PatientSummary;
import open.dolphin.session.PatientServiceBean;
import org.junit.jupiter.api.Test;

class PatientModV2OutpatientSupportTest {

    @Test
    void toPatientPatchReadsLegacyAliasesAndChangedKeys() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("Patient_ID", "00001");
        payload.put("Patient_Name", "山田 太郎");
        payload.put("Patient_Kana", "ヤマダ タロウ");
        payload.put("Patient_BirthDate", "1980-01-01");
        payload.put("Patient_Sex", "1");
        payload.put("telephone", "0311112222");
        payload.put("postal", "100-0001");
        payload.put("addressLine", "東京都千代田区");
        payload.put("auditEvent", Map.of("changedKeys", List.of("name", "zip")));

        PatientModV2OutpatientSupport.PatientPatch patch = PatientModV2OutpatientSupport.toPatientPatch(payload);

        assertEquals("00001", patch.patientId);
        assertEquals("山田 太郎", patch.name);
        assertEquals("ヤマダ タロウ", patch.kana);
        assertEquals("1980-01-01", patch.birthDate);
        assertEquals("1", patch.sex);
        assertEquals("0311112222", patch.phone);
        assertEquals("100-0001", patch.zip);
        assertEquals("東京都千代田区", patch.address);
        assertEquals(Set.of("name", "zip"), patch.changedKeys);
    }

    @Test
    void buildDesiredRejectsInvalidBirthDate() {
        PatientModV2OutpatientSupport.PatientPatch patch = new PatientModV2OutpatientSupport.PatientPatch();
        patch.birthDate = "1980/01/01";

        PatientModV2OutpatientSupport.OrcaPatientBaseline baseline = new PatientModV2OutpatientSupport.OrcaPatientBaseline();
        baseline.wholeName = "山田 太郎";
        baseline.wholeNameKana = "ヤマダ タロウ";
        baseline.birthDate = "1980-01-01";
        baseline.sex = "1";

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> PatientModV2OutpatientSupport.buildDesired(patch, baseline, Set.of("birthDate")));

        assertEquals(400, ex.getResponse().getStatus());
    }

    @Test
    void updateOrcaAndSyncLocalReimportsWhenNoEditableChanges() {
        PatientServiceBean patientServiceBean = mock(PatientServiceBean.class);
        OrcaTransport orcaTransport = mock(OrcaTransport.class);
        OrcaWrapperService orcaWrapperService = mock(OrcaWrapperService.class);
        OrcaPatientSyncService orcaPatientSyncService = mock(OrcaPatientSyncService.class);
        PatientModV2OutpatientOrcaCoordinator coordinator = new PatientModV2OutpatientOrcaCoordinator(
                patientServiceBean, orcaTransport, orcaWrapperService, orcaPatientSyncService);

        PatientModV2OutpatientSupport.PatientPatch patch = new PatientModV2OutpatientSupport.PatientPatch();
        patch.patientId = "00001";
        patch.name = "山田 太郎";
        patch.kana = "ヤマダ タロウ";
        patch.birthDate = "1980-01-01";
        patch.sex = "M";
        patch.phone = "0311112222";
        patch.zip = "100-0001";
        patch.address = "東京都千代田区";

        PatientBatchResponse batchResponse = new PatientBatchResponse();
        batchResponse.setApiResult("00");
        PatientSummary summary = new PatientSummary();
        summary.setPatientId("00001");
        summary.setWholeName("山田 太郎");
        summary.setWholeNameKana("ヤマダ タロウ");
        summary.setBirthDate("1980-01-01");
        summary.setSex("1");
        PatientDetail detail = new PatientDetail();
        detail.setSummary(summary);
        detail.setZipCode("100-0001");
        detail.setAddress("東京都千代田区");
        detail.setPhoneNumber1("0311112222");
        batchResponse.getPatients().add(detail);

        PatientImportResponse importResponse = new PatientImportResponse();
        importResponse.setApiResult("00");
        importResponse.setFetchedCount(1);

        PatientModel synced = buildPatient("facility", "00001");

        when(orcaWrapperService.getPatientBatch(any())).thenReturn(batchResponse);
        when(orcaPatientSyncService.importPatients(any(), any(), any())).thenReturn(importResponse);
        when(patientServiceBean.getPatientById("facility", "00001")).thenReturn(synced);

        Map<String, Object> details = new LinkedHashMap<>();
        PatientModV2OutpatientSupport.OrcaMutationResult result =
                coordinator.updateOrcaAndSyncLocal("facility", patch, "20260321T221345Z", details);

        assertEquals("00", result.apiResult);
        assertEquals("変更なし（ORCAから再取り込み）", result.apiResultMessage);
        assertSame(synced, result.patient);
        assertEquals(List.of(), details.get("appliedKeys"));
        assertEquals(1, details.get("importFetchedCount"));
        verifyNoInteractions(orcaTransport);
    }

    private static PatientModel buildPatient(String facilityId, String patientId) {
        PatientModel model = new PatientModel();
        model.setFacilityId(facilityId);
        model.setPatientId(patientId);
        model.setFullName("山田 太郎");
        model.setKanaName("ヤマダ タロウ");
        model.setBirthday(LocalDate.parse("1980-01-01"));
        model.setGender("1");
        model.setTelephone("0311112222");
        SimpleAddressModel address = new SimpleAddressModel();
        address.setZipCode("100-0001");
        address.setAddress("東京都千代田区");
        model.setAddress(address);
        return model;
    }
}
