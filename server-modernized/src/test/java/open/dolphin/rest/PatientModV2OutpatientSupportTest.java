package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.WebApplicationException;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import open.dolphin.orca.service.OrcaPatientCacheStore;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.SimpleAddressModel;
import open.dolphin.orca.service.OrcaLiveGateway;
import open.dolphin.orca.sync.OrcaPatientSyncService;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.rest.dto.orca.OfficialPatientAuditMeta;
import open.dolphin.rest.dto.orca.OfficialPatientCreateRequest;
import open.dolphin.rest.dto.orca.OfficialPatientPayload;
import open.dolphin.rest.dto.orca.OfficialPatientUpdateRequest;
import open.dolphin.rest.dto.orca.PatientBatchResponse;
import open.dolphin.rest.dto.orca.PatientDetail;
import open.dolphin.rest.dto.orca.PatientImportResponse;
import open.dolphin.rest.dto.orca.PatientSummary;
import open.dolphin.session.PatientServiceBean;
import org.junit.jupiter.api.Test;

class PatientModV2OutpatientSupportTest {

    @Test
    void toCreatePatchDefaultsPatientIdToAutoAssignAndReadsChangedKeys() {
        OfficialPatientPayload patient = new OfficialPatientPayload();
        patient.setWholeName("山田 太郎");
        patient.setWholeNameKana("ヤマダ タロウ");
        patient.setBirthDate("1980-01-01");
        patient.setSex("1");
        patient.setTelephone("0311112222");
        patient.setZipCode("100-0001");
        patient.setAddressLine("東京都千代田区");
        OfficialPatientAuditMeta auditMeta = new OfficialPatientAuditMeta();
        auditMeta.getChangedKeys().addAll(List.of("name", "zip"));
        OfficialPatientCreateRequest request = new OfficialPatientCreateRequest();
        request.setPatient(patient);
        request.setAuditMeta(auditMeta);

        PatientModV2OutpatientSupport.PatientPatch patch = PatientModV2OutpatientSupport.toCreatePatch(request);

        assertEquals("*", patch.patientId);
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
    void toUpdatePatchRejectsAutoAssignedPatientId() {
        OfficialPatientPayload patient = new OfficialPatientPayload();
        patient.setPatientId("*");
        OfficialPatientUpdateRequest request = new OfficialPatientUpdateRequest();
        request.setPatient(patient);

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> PatientModV2OutpatientSupport.toUpdatePatch(request));

        assertEquals(400, ex.getResponse().getStatus());
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
        OrcaLiveGateway orcaWrapperService = mock(OrcaLiveGateway.class);
        OrcaPatientSyncService orcaPatientSyncService = mock(OrcaPatientSyncService.class);
        RecordingPatientCacheStore patientCacheStore = new RecordingPatientCacheStore();
        PatientModV2OutpatientOrcaCoordinator coordinator = new PatientModV2OutpatientOrcaCoordinator(
                patientServiceBean, orcaTransport, orcaWrapperService, orcaPatientSyncService, patientCacheStore);

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

        when(orcaWrapperService.getPatientBatch(anyString(), any())).thenReturn(batchResponse);
        when(orcaTransport.invoke(anyString(), any(), any())).thenReturn(patientGetResult("00001"));
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
        assertEquals(Boolean.TRUE, result.canonicalRefetched);
        assertEquals(Boolean.TRUE, result.localSynced);
        assertEquals("patientgetv2", result.canonicalSourceApi);
        assertEquals("CURRENT", result.canonicalCacheStatus);
        assertEquals("ORCA_PATIENT_FOUND", result.canonicalBusinessStatus);
        assertEquals("00001", patientCacheStore.command.orcaPatientId());
        verify(orcaTransport).invoke(anyString(), org.mockito.ArgumentMatchers.eq(OrcaEndpoint.PATIENT_GET), any());
    }

    @Test
    void createOrcaAndSyncLocalUsesClass01() {
        PatientServiceBean patientServiceBean = mock(PatientServiceBean.class);
        OrcaTransport orcaTransport = mock(OrcaTransport.class);
        OrcaLiveGateway orcaWrapperService = mock(OrcaLiveGateway.class);
        OrcaPatientSyncService orcaPatientSyncService = mock(OrcaPatientSyncService.class);
        RecordingPatientCacheStore patientCacheStore = new RecordingPatientCacheStore();
        PatientModV2OutpatientOrcaCoordinator coordinator = new PatientModV2OutpatientOrcaCoordinator(
                patientServiceBean, orcaTransport, orcaWrapperService, orcaPatientSyncService, patientCacheStore);

        PatientImportResponse importResponse = new PatientImportResponse();
        importResponse.setApiResult("00");
        importResponse.setFetchedCount(1);
        PatientModel synced = buildPatient("facility", "00099");

        when(orcaTransport.invoke(anyString(), any(), any())).thenAnswer(invocation -> {
            OrcaEndpoint endpoint = invocation.getArgument(1);
            OrcaTransportRequest request = invocation.getArgument(2);
            if (endpoint == OrcaEndpoint.PATIENT_MOD) {
                assertTrue(request.getBody().contains("query=class=01"));
                return new OrcaTransportResult(null, "POST", 200,
                        "<xmlio2><patientmodres><Api_Result>00</Api_Result><Api_Result_Message>OK</Api_Result_Message><Patient_ID>00099</Patient_ID></patientmodres></xmlio2>",
                        "application/xml", Map.of());
            }
            assertEquals(OrcaEndpoint.PATIENT_GET, endpoint);
            assertEquals("id=00099&format=json", request.getQuery());
            return patientGetResult("00099");
        });
        when(orcaPatientSyncService.importPatients(any(), any(), any())).thenReturn(importResponse);
        when(patientServiceBean.getPatientById("facility", "00099")).thenReturn(synced);

        PatientModV2OutpatientSupport.PatientPatch patch = new PatientModV2OutpatientSupport.PatientPatch();
        patch.patientId = "*";
        patch.name = "山田 太郎";
        patch.kana = "ヤマダ タロウ";
        patch.birthDate = "1980-01-01";
        patch.sex = "M";

        PatientModV2OutpatientSupport.OrcaMutationResult result =
                coordinator.createOrcaAndSyncLocal("facility", patch, "20260321T221345Z", new LinkedHashMap<>());

        assertEquals("00099", result.patient.getPatientId());
        assertEquals(Boolean.TRUE, result.orcaMutationPrepared);
        assertEquals(Boolean.TRUE, result.orcaMutationSent);
        assertEquals(Boolean.TRUE, result.canonicalRefetched);
        assertEquals(Boolean.TRUE, result.localSynced);
        assertEquals("00099", patientCacheStore.command.orcaPatientId());
    }

    @Test
    void updateOrcaAndSyncLocalUsesClass02() {
        PatientServiceBean patientServiceBean = mock(PatientServiceBean.class);
        OrcaTransport orcaTransport = mock(OrcaTransport.class);
        OrcaLiveGateway orcaWrapperService = mock(OrcaLiveGateway.class);
        OrcaPatientSyncService orcaPatientSyncService = mock(OrcaPatientSyncService.class);
        RecordingPatientCacheStore patientCacheStore = new RecordingPatientCacheStore();
        PatientModV2OutpatientOrcaCoordinator coordinator = new PatientModV2OutpatientOrcaCoordinator(
                patientServiceBean, orcaTransport, orcaWrapperService, orcaPatientSyncService, patientCacheStore);

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
        batchResponse.getPatients().add(detail);

        PatientImportResponse importResponse = new PatientImportResponse();
        importResponse.setApiResult("00");
        importResponse.setFetchedCount(1);
        PatientModel synced = buildPatient("facility", "00001");

        when(orcaWrapperService.getPatientBatch(anyString(), any())).thenReturn(batchResponse);
        when(orcaTransport.invoke(anyString(), any(), any())).thenAnswer(invocation -> {
            OrcaEndpoint endpoint = invocation.getArgument(1);
            OrcaTransportRequest request = invocation.getArgument(2);
            if (endpoint == OrcaEndpoint.PATIENT_MOD) {
                assertTrue(request.getBody().contains("query=class=02"));
                return new OrcaTransportResult(null, "POST", 200,
                        "<xmlio2><patientmodres><Api_Result>00</Api_Result><Api_Result_Message>OK</Api_Result_Message></patientmodres></xmlio2>",
                        "application/xml", Map.of());
            }
            assertEquals(OrcaEndpoint.PATIENT_GET, endpoint);
            assertEquals("id=00001&format=json", request.getQuery());
            return patientGetResult("00001");
        });
        when(orcaPatientSyncService.importPatients(any(), any(), any())).thenReturn(importResponse);
        when(patientServiceBean.getPatientById("facility", "00001")).thenReturn(synced);

        PatientModV2OutpatientSupport.PatientPatch patch = new PatientModV2OutpatientSupport.PatientPatch();
        patch.patientId = "00001";
        patch.name = "山田 次郎";
        patch.kana = "ヤマダ タロウ";
        patch.birthDate = "1980-01-01";
        patch.sex = "M";
        patch.changedKeys = Set.of("name");

        PatientModV2OutpatientSupport.OrcaMutationResult result =
                coordinator.updateOrcaAndSyncLocal("facility", patch, "20260321T221345Z", new LinkedHashMap<>());

        assertEquals("00001", result.patient.getPatientId());
        assertEquals(Boolean.TRUE, result.orcaMutationPrepared);
        assertEquals(Boolean.TRUE, result.orcaMutationSent);
        assertEquals(Boolean.TRUE, result.canonicalRefetched);
        assertEquals(Boolean.TRUE, result.localSynced);
        assertEquals("00001", patientCacheStore.command.orcaPatientId());
    }

    @Test
    void updateDoesNotImportLocalPatientWhenCanonicalRefetchFails() {
        PatientServiceBean patientServiceBean = mock(PatientServiceBean.class);
        OrcaTransport orcaTransport = mock(OrcaTransport.class);
        OrcaLiveGateway orcaWrapperService = mock(OrcaLiveGateway.class);
        OrcaPatientSyncService orcaPatientSyncService = mock(OrcaPatientSyncService.class);
        RecordingPatientCacheStore patientCacheStore = new RecordingPatientCacheStore();
        PatientModV2OutpatientOrcaCoordinator coordinator = new PatientModV2OutpatientOrcaCoordinator(
                patientServiceBean, orcaTransport, orcaWrapperService, orcaPatientSyncService, patientCacheStore);

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
        batchResponse.getPatients().add(detail);

        when(orcaWrapperService.getPatientBatch(anyString(), any())).thenReturn(batchResponse);
        when(orcaTransport.invoke(anyString(), any(), any())).thenAnswer(invocation -> {
            OrcaEndpoint endpoint = invocation.getArgument(1);
            if (endpoint == OrcaEndpoint.PATIENT_MOD) {
                return new OrcaTransportResult(null, "POST", 200,
                        "<xmlio2><patientmodres><Api_Result>00</Api_Result><Api_Result_Message>OK</Api_Result_Message></patientmodres></xmlio2>",
                        "application/xml", Map.of());
            }
            return new OrcaTransportResult(null, "GET", 200,
                    "{\"Api_Result\":\"10\",\"Api_Result_Message\":\"患者がありません\"}",
                    "application/json", Map.of());
        });

        PatientModV2OutpatientSupport.PatientPatch patch = new PatientModV2OutpatientSupport.PatientPatch();
        patch.patientId = "00001";
        patch.name = "山田 次郎";
        patch.kana = "ヤマダ タロウ";
        patch.birthDate = "1980-01-01";
        patch.sex = "M";
        patch.changedKeys = Set.of("name");

        WebApplicationException ex = assertThrows(WebApplicationException.class,
                () -> coordinator.updateOrcaAndSyncLocal("facility", patch, "20260321T221345Z", new LinkedHashMap<>()));

        assertEquals(502, ex.getResponse().getStatus());
        assertEquals("ORCA_PATIENT_NOT_FOUND", patientCacheStore.command.businessStatus());
        verify(orcaPatientSyncService, never()).importPatients(any(), any(), any());
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

    private static OrcaTransportResult patientGetResult(String patientId) {
        return new OrcaTransportResult(null, "GET", 200,
                "{\"Api_Result\":\"00\",\"Api_Result_Message\":\"OK\",\"Patient_Information\":{\"Patient_ID\":\""
                        + patientId
                        + "\",\"WholeName\":\"山田 太郎\",\"WholeName_inKana\":\"ヤマダ タロウ\",\"BirthDate\":\"1980-01-01\",\"Sex\":\"1\"}}",
                "application/json", Map.of());
    }

    private static final class RecordingPatientCacheStore extends OrcaPatientCacheStore {
        private PatientCacheCommand command;

        @Override
        public long save(PatientCacheCommand command) {
            this.command = command;
            return 315L;
        }
    }
}
