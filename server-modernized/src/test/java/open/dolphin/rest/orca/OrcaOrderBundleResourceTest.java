package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.time.LocalDate;
import java.util.Date;
import java.util.List;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.BundleDolphin;
import open.dolphin.infomodel.ClaimItem;
import open.dolphin.infomodel.DocInfoModel;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.LicenseModel;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.ModuleInfoBean;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.rest.dto.orca.OrderBundleFetchResponse;
import open.dolphin.rest.dto.orca.OrderBundleMutationRequest;
import open.dolphin.rest.dto.orca.OrderBundleMutationResponse;
import open.dolphin.rest.dto.orca.OrderBundleRecommendationResponse;
import open.dolphin.rest.dto.orca.OrcaOrderInputSetDetailResponse;
import open.dolphin.rest.dto.orca.OrcaOrderInputSetListResponse;
import open.dolphin.rest.dto.orca.OrcaOrderInteractionCheckRequest;
import open.dolphin.rest.dto.orca.OrcaOrderInteractionCheckResponse;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.PatientServiceBean;
import open.dolphin.session.UserServiceBean;
import open.dolphin.testsupport.RuntimeDelegateTestSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OrcaOrderBundleResourceTest extends RuntimeDelegateTestSupport {

    private OrcaOrderBundleResource resource;
    private RecordingSessionAuditDispatcher auditDispatcher;
    private FakeKarteServiceBean fakeKarteServiceBean;
    private HttpServletRequest servletRequest;

    @BeforeEach
    void setUp() throws Exception {
        resource = new OrcaOrderBundleResource();
        auditDispatcher = new RecordingSessionAuditDispatcher();
        injectField(resource, "sessionAuditDispatcher", auditDispatcher);
        injectField(resource, "patientServiceBean", new FakePatientServiceBean());
        fakeKarteServiceBean = new FakeKarteServiceBean();
        injectField(resource, "karteServiceBean", fakeKarteServiceBean);
        injectField(resource, "userServiceBean", new FakeUserServiceBean());
        servletRequest = (HttpServletRequest) Proxy.newProxyInstance(
                getClass().getClassLoader(),
                new Class[]{HttpServletRequest.class},
                (proxy, method, args) -> {
                    String name = method.getName();
                    if ("getRemoteUser".equals(name)) return "F001:doctor01";
                    if ("getRemoteAddr".equals(name)) return "127.0.0.1";
                    if ("getRequestURI".equals(name)) return "/api/orca/order/recommendations";
                    if ("getHeader".equals(name) && args != null && args.length == 1) {
                        String header = String.valueOf(args[0]);
                        return switch (header) {
                            case "X-Request-Id" -> "req-order-recommendation";
                            case "X-Trace-Id" -> "trace-order-recommendation";
                            case "User-Agent" -> "JUnit";
                            default -> null;
                        };
                    }
                    return null;
                });
    }

    @Test
    void getRecommendationsRejectsMissingPatientId() {
        WebApplicationException exception = null;
        try {
            resource.getRecommendations(servletRequest, " ", "medOrder", null, false, 8, 0, 100);
        } catch (WebApplicationException ex) {
            exception = ex;
        }
        assertNotNull(exception);
        assertEquals(400, exception.getResponse().getStatus());
        Map<String, Object> body = getErrorBody(exception);
        assertEquals(Boolean.TRUE, body.get("validationError"));
        assertEquals("patientId", body.get("field"));
        assertEquals("patientId is required", body.get("message"));
        assertNotNull(auditDispatcher.payload);
        assertEquals("ORCA_ORDER_RECOMMENDATION_FETCH", auditDispatcher.payload.getAction());
        assertEquals(AuditEventEnvelope.Outcome.FAILURE, auditDispatcher.outcome);
    }

    @Test
    void getRecommendationsRejectsInvalidEntity() {
        WebApplicationException exception = null;
        try {
            resource.getRecommendations(servletRequest, "00001", "invalidEntity", null, false, 8, 0, 100);
        } catch (WebApplicationException ex) {
            exception = ex;
        }

        assertNotNull(exception);
        assertEquals(400, exception.getResponse().getStatus());
        Map<String, Object> body = getErrorBody(exception);
        assertEquals(Boolean.TRUE, body.get("validationError"));
        assertEquals("entity", body.get("field"));
        assertEquals("entity is invalid", body.get("message"));
        assertNotNull(auditDispatcher.payload);
        assertEquals("ORCA_ORDER_RECOMMENDATION_FETCH", auditDispatcher.payload.getAction());
        assertEquals(AuditEventEnvelope.Outcome.FAILURE, auditDispatcher.outcome);
    }

    @Test
    void getRecommendationsReturnsPatientOnlyRowsWhenFacilityDisabled() {
        OrderBundleRecommendationResponse response = resource.getRecommendations(
                servletRequest,
                "00001",
                "medOrder",
                "2025-01-01",
                false,
                8,
                0,
                100);

        assertNotNull(response);
        assertEquals("00001", response.getPatientId());
        assertEquals("medOrder", response.getEntity());
        assertEquals(1, response.getRecordsReturned());
        assertEquals(2, response.getRecordsScanned());
        assertEquals(1, response.getRecommendations().size());
        var entry = response.getRecommendations().get(0);
        assertEquals("medOrder", entry.getEntity());
        assertEquals("patient", entry.getSource());
        assertEquals(2, entry.getCount());
        assertEquals("降圧薬セット", entry.getTemplate().getBundleName());
        assertEquals("out", entry.getTemplate().getPrescriptionLocation());
        assertEquals("regular", entry.getTemplate().getPrescriptionTiming());
        assertNotNull(auditDispatcher.payload);
        assertEquals("ORCA_ORDER_RECOMMENDATION_FETCH", auditDispatcher.payload.getAction());
        assertEquals(AuditEventEnvelope.Outcome.SUCCESS, auditDispatcher.outcome);
    }

    @Test
    void getBundlesReturnsEnteredByNameAndRole() {
        OrderBundleFetchResponse response = resource.getBundles(
                servletRequest,
                "00001",
                "medOrder",
                "2025-01-01");

        assertNotNull(response);
        assertEquals(2, response.getRecordsReturned());
        assertEquals(2, response.getBundles().size());

        var first = response.getBundles().get(0);
        assertEquals("モジュール担当医", first.getEnteredByName());
        assertEquals("薬剤師", first.getEnteredByRole());
        assertEquals("4101", first.getAdminCode());
        assertEquals("Claim007", first.getAdminCodeSystem());
        assertEquals("no", first.getItems().get(0).getGenericFlg());
        assertEquals("食後", first.getItems().get(0).getUserComment());
        assertEquals("レセプトコメント", first.getItems().get(0).getMemo());

        var second = response.getBundles().get(1);
        assertEquals("document-user-1002", second.getEnteredByName());
        assertEquals("doctor", second.getEnteredByRole());
    }

    @Test
    void getBundlesReturnsBodyPartFieldAndStripsLegacyBodyPartItems() {
        OrderBundleFetchResponse response = resource.getBundles(
                servletRequest,
                "00001",
                "medOrder",
                "2025-01-01");

        assertNotNull(response);
        var first = response.getBundles().get(0);
        assertNotNull(first.getBodyPart());
        assertEquals("0021001", first.getBodyPart().getCode());
        assertEquals("胸部", first.getBodyPart().getName());
        assertEquals(1, first.getItems().size());
        assertEquals("100001", first.getItems().get(0).getCode());
    }

    @Test
    void getBundles_readsJsonOnlyModulePayload() throws Exception {
        injectField(resource, "karteServiceBean", new FakeJsonOnlyKarteServiceBean());

        OrderBundleFetchResponse response = resource.getBundles(
                servletRequest,
                "00001",
                "medOrder",
                "2025-01-01");

        assertNotNull(response);
        assertEquals(2, response.getBundles().size());
        assertEquals("降圧薬セット", response.getBundles().get(0).getBundleName());
    }

    @Test
    void postBundlesRejectsInvalidStartDate() {
        OrderBundleMutationRequest payload = new OrderBundleMutationRequest();
        payload.setPatientId("00001");
        OrderBundleMutationRequest.BundleOperation op = new OrderBundleMutationRequest.BundleOperation();
        op.setOperation("create");
        op.setEntity("medOrder");
        op.setBundleName("降圧薬セット");
        op.setStartDate("2025/01/01");
        payload.setOperations(List.of(op));

        WebApplicationException exception = null;
        try {
            resource.postBundles(servletRequest, payload);
        } catch (WebApplicationException ex) {
            exception = ex;
        }

        assertNotNull(exception);
        assertEquals(400, exception.getResponse().getStatus());
        Map<String, Object> body = getErrorBody(exception);
        assertEquals(Boolean.TRUE, body.get("validationError"));
        assertEquals("startDate", body.get("field"));
        assertEquals("startDate must be yyyy-MM-dd", body.get("message"));
        assertNotNull(auditDispatcher.payload);
        assertEquals("ORCA_ORDER_BUNDLE_MUTATION", auditDispatcher.payload.getAction());
        assertEquals(AuditEventEnvelope.Outcome.FAILURE, auditDispatcher.outcome);
    }

    @Test
    void postBundlesRejectsTreatmentBodyPartWithoutCode() {
        OrderBundleMutationRequest payload = new OrderBundleMutationRequest();
        payload.setPatientId("00001");
        OrderBundleMutationRequest.BundleOperation op = new OrderBundleMutationRequest.BundleOperation();
        op.setOperation("create");
        op.setEntity("treatmentOrder");
        op.setBundleName("treatment-body-part-missing-code");
        op.setClassCode("400");
        op.setClassCodeSystem("Claim007");
        op.setStartDate("2025-01-01");

        OrderBundleMutationRequest.BundleItem bodyPart = new OrderBundleMutationRequest.BundleItem();
        bodyPart.setName("missing-code");
        op.setBodyPart(bodyPart);

        OrderBundleMutationRequest.BundleItem procedure = new OrderBundleMutationRequest.BundleItem();
        procedure.setCode("140000610");
        procedure.setName("treatment-main");
        op.setItems(List.of(procedure));
        payload.setOperations(List.of(op));

        WebApplicationException exception = null;
        try {
            resource.postBundles(servletRequest, payload);
        } catch (WebApplicationException ex) {
            exception = ex;
        }

        assertNotNull(exception);
        assertEquals(400, exception.getResponse().getStatus());
        Map<String, Object> body = getErrorBody(exception);
        assertEquals(Boolean.TRUE, body.get("validationError"));
        assertEquals("bodyPart", body.get("field"));
        assertEquals("bodyPart code is required", body.get("message"));
    }

    @Test
    void postBundlesRejectsTreatmentBodyPartOutside002Family() {
        OrderBundleMutationRequest payload = new OrderBundleMutationRequest();
        payload.setPatientId("00001");
        OrderBundleMutationRequest.BundleOperation op = new OrderBundleMutationRequest.BundleOperation();
        op.setOperation("create");
        op.setEntity("treatmentOrder");
        op.setBundleName("treatment-body-part-invalid-code");
        op.setClassCode("400");
        op.setClassCodeSystem("Claim007");
        op.setStartDate("2025-01-01");

        OrderBundleMutationRequest.BundleItem bodyPart = new OrderBundleMutationRequest.BundleItem();
        bodyPart.setCode("001001");
        bodyPart.setName("invalid-code");
        op.setBodyPart(bodyPart);

        OrderBundleMutationRequest.BundleItem procedure = new OrderBundleMutationRequest.BundleItem();
        procedure.setCode("140000610");
        procedure.setName("treatment-main");
        op.setItems(List.of(procedure));
        payload.setOperations(List.of(op));

        WebApplicationException exception = null;
        try {
            resource.postBundles(servletRequest, payload);
        } catch (WebApplicationException ex) {
            exception = ex;
        }

        assertNotNull(exception);
        assertEquals(400, exception.getResponse().getStatus());
        Map<String, Object> body = getErrorBody(exception);
        assertEquals(Boolean.TRUE, body.get("validationError"));
        assertEquals("bodyPart", body.get("field"));
        assertEquals("bodyPart must use code family 002", body.get("message"));
    }

    @Test
    void postBundlesRejectsRadiologyBodyPartWithoutCode() {
        OrderBundleMutationRequest payload = new OrderBundleMutationRequest();
        payload.setPatientId("00001");
        OrderBundleMutationRequest.BundleOperation op = new OrderBundleMutationRequest.BundleOperation();
        op.setOperation("create");
        op.setEntity("radiologyOrder");
        op.setBundleName("radiology-body-part-missing-code");
        op.setClassCode("700");
        op.setClassCodeSystem("Claim007");
        op.setStartDate("2025-01-01");

        OrderBundleMutationRequest.BundleItem bodyPart = new OrderBundleMutationRequest.BundleItem();
        bodyPart.setName("missing-code");
        op.setBodyPart(bodyPart);

        OrderBundleMutationRequest.BundleItem main = new OrderBundleMutationRequest.BundleItem();
        main.setCode("700000001");
        main.setName("radiology-main");
        op.setItems(List.of(main));
        payload.setOperations(List.of(op));

        WebApplicationException exception = null;
        try {
            resource.postBundles(servletRequest, payload);
        } catch (WebApplicationException ex) {
            exception = ex;
        }

        assertNotNull(exception);
        assertEquals(400, exception.getResponse().getStatus());
        Map<String, Object> body = getErrorBody(exception);
        assertEquals(Boolean.TRUE, body.get("validationError"));
        assertEquals("bodyPart", body.get("field"));
        assertEquals("bodyPart code is required", body.get("message"));
    }

    @Test
    void postBundlesRejectsRadiologyBodyPartOutside002Family() {
        OrderBundleMutationRequest payload = new OrderBundleMutationRequest();
        payload.setPatientId("00001");
        OrderBundleMutationRequest.BundleOperation op = new OrderBundleMutationRequest.BundleOperation();
        op.setOperation("create");
        op.setEntity("radiologyOrder");
        op.setBundleName("radiology-body-part-invalid-code");
        op.setClassCode("700");
        op.setClassCodeSystem("Claim007");
        op.setStartDate("2025-01-01");

        OrderBundleMutationRequest.BundleItem bodyPart = new OrderBundleMutationRequest.BundleItem();
        bodyPart.setCode("001001");
        bodyPart.setName("invalid-code");
        op.setBodyPart(bodyPart);

        OrderBundleMutationRequest.BundleItem main = new OrderBundleMutationRequest.BundleItem();
        main.setCode("700000001");
        main.setName("radiology-main");
        op.setItems(List.of(main));
        payload.setOperations(List.of(op));

        WebApplicationException exception = null;
        try {
            resource.postBundles(servletRequest, payload);
        } catch (WebApplicationException ex) {
            exception = ex;
        }

        assertNotNull(exception);
        assertEquals(400, exception.getResponse().getStatus());
        Map<String, Object> body = getErrorBody(exception);
        assertEquals(Boolean.TRUE, body.get("validationError"));
        assertEquals("bodyPart", body.get("field"));
        assertEquals("bodyPart must use code family 002", body.get("message"));
    }

    @Test
    void postBundlesPrioritizesBodyPartFieldOverLegacyItems() {
        OrderBundleMutationRequest payload = new OrderBundleMutationRequest();
        payload.setPatientId("00001");
        OrderBundleMutationRequest.BundleOperation op = new OrderBundleMutationRequest.BundleOperation();
        op.setOperation("create");
        op.setEntity("treatmentOrder");
        op.setBundleName("bodyPart-priority");
        op.setClassCode("400");
        op.setClassCodeSystem("Claim007");
        op.setStartDate("2025-01-01");

        OrderBundleMutationRequest.BundleItem bodyPart = new OrderBundleMutationRequest.BundleItem();
        bodyPart.setCode("002999");
        bodyPart.setName("priority-body-part");
        op.setBodyPart(bodyPart);

        OrderBundleMutationRequest.BundleItem legacyBodyPart = new OrderBundleMutationRequest.BundleItem();
        legacyBodyPart.setCode("002111");
        legacyBodyPart.setName("legacy-body-part");
        OrderBundleMutationRequest.BundleItem procedure = new OrderBundleMutationRequest.BundleItem();
        procedure.setCode("140000610");
        procedure.setName("treatment-main");
        op.setItems(List.of(legacyBodyPart, procedure));
        payload.setOperations(List.of(op));

        OrderBundleMutationResponse response = resource.postBundles(servletRequest, payload);
        assertNotNull(response);
        assertEquals(1, response.getCreatedDocumentIds().size());

        DocumentModel saved = fakeKarteServiceBean.getLastAddedDocument();
        assertNotNull(saved);
        assertNotNull(saved.getModules().get(0).getBeanJson());
        BundleDolphin bundle = (BundleDolphin) saved.getModules().get(0).getModel();
        ClaimItem[] claimItems = bundle.getClaimItem();
        assertNotNull(claimItems);
        assertEquals(2, claimItems.length);
        assertEquals("002999", claimItems[0].getCode());
        assertEquals("priority-body-part", claimItems[0].getName());
        assertEquals("140000610", claimItems[1].getCode());
    }

    @Test
    void postBundlesRejectsTreatmentBodyPartWithNon002Code() {
        OrderBundleMutationRequest payload = new OrderBundleMutationRequest();
        payload.setPatientId("00001");
        OrderBundleMutationRequest.BundleOperation op = new OrderBundleMutationRequest.BundleOperation();
        op.setOperation("create");
        op.setEntity("treatmentOrder");
        op.setBundleName("invalid-body-part-code");
        op.setClassCode("400");
        op.setClassCodeSystem("Claim007");
        op.setStartDate("2025-01-01");

        OrderBundleMutationRequest.BundleItem bodyPart = new OrderBundleMutationRequest.BundleItem();
        bodyPart.setCode("BP001");
        bodyPart.setName("invalid-body-part");
        op.setBodyPart(bodyPart);

        OrderBundleMutationRequest.BundleItem procedure = new OrderBundleMutationRequest.BundleItem();
        procedure.setCode("140000610");
        procedure.setName("treatment-main");
        op.setItems(List.of(procedure));
        payload.setOperations(List.of(op));

        WebApplicationException exception = null;
        try {
            resource.postBundles(servletRequest, payload);
        } catch (WebApplicationException ex) {
            exception = ex;
        }

        assertNotNull(exception);
        assertEquals(400, exception.getResponse().getStatus());
        Map<String, Object> body = getErrorBody(exception);
        assertEquals(Boolean.TRUE, body.get("validationError"));
        assertEquals("bodyPart", body.get("field"));
        assertTrue(String.valueOf(body.get("message")).contains("002"));
    }

    @Test
    void postBundlesRejectsTreatmentMaterialWithNonSendableCode() {
        OrderBundleMutationRequest payload = new OrderBundleMutationRequest();
        payload.setPatientId("00001");
        OrderBundleMutationRequest.BundleOperation op = new OrderBundleMutationRequest.BundleOperation();
        op.setOperation("create");
        op.setEntity("treatmentOrder");
        op.setBundleName("invalid-material-code");
        op.setClassCode("400");
        op.setClassCodeSystem("Claim007");
        op.setStartDate("2025-01-01");

        OrderBundleMutationRequest.BundleItem bodyPart = new OrderBundleMutationRequest.BundleItem();
        bodyPart.setCode("002999");
        bodyPart.setName("priority-body-part");
        op.setBodyPart(bodyPart);

        OrderBundleMutationRequest.BundleItem procedure = new OrderBundleMutationRequest.BundleItem();
        procedure.setCode("140000610");
        procedure.setName("treatment-main");
        procedure.setRowRole("main");

        OrderBundleMutationRequest.BundleItem material = new OrderBundleMutationRequest.BundleItem();
        material.setCode("M001");
        material.setName("invalid-material");
        material.setRowRole("material");

        op.setItems(List.of(procedure, material));
        payload.setOperations(List.of(op));

        WebApplicationException exception = null;
        try {
            resource.postBundles(servletRequest, payload);
        } catch (WebApplicationException ex) {
            exception = ex;
        }

        assertNotNull(exception);
        assertEquals(400, exception.getResponse().getStatus());
        Map<String, Object> body = getErrorBody(exception);
        assertEquals(Boolean.TRUE, body.get("validationError"));
        assertNotNull(body.get("field"));
        assertTrue(String.valueOf(body.get("message")).contains("material")
                || String.valueOf(body.get("message")).contains("9桁")
                || String.valueOf(body.get("message")).contains("sendable"));
    }

    @Test
    void postBundlesFallsBackToLegacyItemsBodyPartWhenBodyPartFieldMissing() {
        OrderBundleMutationRequest payload = new OrderBundleMutationRequest();
        payload.setPatientId("00001");
        OrderBundleMutationRequest.BundleOperation op = new OrderBundleMutationRequest.BundleOperation();
        op.setOperation("create");
        op.setEntity("treatmentOrder");
        op.setBundleName("legacy-body-part-fallback");
        op.setClassCode("400");
        op.setClassCodeSystem("Claim007");
        op.setStartDate("2025-01-01");

        OrderBundleMutationRequest.BundleItem legacyBodyPart = new OrderBundleMutationRequest.BundleItem();
        legacyBodyPart.setCode("002777");
        legacyBodyPart.setName("legacy-body-part");
        OrderBundleMutationRequest.BundleItem procedure = new OrderBundleMutationRequest.BundleItem();
        procedure.setCode("140000610");
        procedure.setName("treatment-main");
        op.setItems(List.of(legacyBodyPart, procedure));
        payload.setOperations(List.of(op));

        OrderBundleMutationResponse response = resource.postBundles(servletRequest, payload);
        assertNotNull(response);
        assertEquals(1, response.getCreatedDocumentIds().size());

        DocumentModel saved = fakeKarteServiceBean.getLastAddedDocument();
        assertNotNull(saved);
        assertNotNull(saved.getModules().get(0).getBeanJson());
        BundleDolphin bundle = (BundleDolphin) saved.getModules().get(0).getModel();
        ClaimItem[] claimItems = bundle.getClaimItem();
        assertNotNull(claimItems);
        assertEquals(2, claimItems.length);
        assertEquals("002777", claimItems[0].getCode());
        assertEquals("legacy-body-part", claimItems[0].getName());
        assertEquals("140000610", claimItems[1].getCode());
    }

    @Test
    void postBundlesRejectsCommentOnlyNonMedBundle() {
        OrderBundleMutationRequest payload = new OrderBundleMutationRequest();
        payload.setPatientId("00001");
        OrderBundleMutationRequest.BundleOperation op = new OrderBundleMutationRequest.BundleOperation();
        op.setOperation("create");
        op.setEntity("treatmentOrder");
        op.setBundleName("comment-only-treatment");
        op.setClassCode("400");
        op.setClassCodeSystem("Claim007");
        op.setStartDate("2025-01-01");

        OrderBundleMutationRequest.BundleItem bodyPart = new OrderBundleMutationRequest.BundleItem();
        bodyPart.setCode("002001");
        bodyPart.setName("body-part-only");
        op.setBodyPart(bodyPart);

        OrderBundleMutationRequest.BundleItem comment = new OrderBundleMutationRequest.BundleItem();
        comment.setCode("0085001");
        comment.setName("comment-only");
        op.setItems(List.of(comment));
        payload.setOperations(List.of(op));

        WebApplicationException exception = null;
        try {
            resource.postBundles(servletRequest, payload);
        } catch (WebApplicationException ex) {
            exception = ex;
        }

        assertNotNull(exception);
        assertEquals(400, exception.getResponse().getStatus());
        Map<String, Object> body = getErrorBody(exception);
        assertEquals(Boolean.TRUE, body.get("validationError"));
        assertEquals("items", body.get("field"));
        assertEquals("items do not contain a sendable main row", body.get("message"));
    }

    @Test
    void postBundlesCanonicalizesChargeClassNameWithoutBundleNameFallback() {
        OrderBundleMutationRequest payload = new OrderBundleMutationRequest();
        payload.setPatientId("00001");

        OrderBundleMutationRequest.BundleOperation op = new OrderBundleMutationRequest.BundleOperation();
        op.setOperation("create");
        op.setEntity(IInfoModel.ENTITY_BASE_CHARGE_ORDER);
        op.setBundleName("charge-bundle-name");
        op.setClassCode("110");
        op.setClassCodeSystem("Claim007");
        op.setClassName("bundleFallback");
        op.setStartDate("2025-01-01");

        OrderBundleMutationRequest.BundleItem item = new OrderBundleMutationRequest.BundleItem();
        item.setCode("110000110");
        item.setName("initial-consultation");
        item.setQuantity("1");
        item.setUnit("times");
        item.setMasterCategory("110");
        op.setItems(List.of(item));
        payload.setOperations(List.of(op));

        OrderBundleMutationResponse response = resource.postBundles(servletRequest, payload);

        assertNotNull(response);
        assertEquals(1, response.getCreatedDocumentIds().size());

        DocumentModel saved = fakeKarteServiceBean.getLastAddedDocument();
        assertNotNull(saved);
        BundleDolphin bundle = (BundleDolphin) saved.getModules().get(0).getModel();
        assertEquals("基本診療料", bundle.getClassName());
        assertEquals("110", bundle.getClassCode());
    }

    @Test
    void getInputSetsReturnsPagedResponse() throws Exception {
        OrcaOrderBundleResource inputSetResource = new OrcaOrderBundleResource() {
            @Override
            protected List<OrcaOrderInputSetListResponse.Item> loadInputSetSummaries(String keyword, String effective) {
                OrcaOrderInputSetListResponse.Item med = new OrcaOrderInputSetListResponse.Item();
                med.setSetCode("P01001");
                med.setName("降圧セット");
                med.setEntity(IInfoModel.ENTITY_MED_ORDER);
                med.setKind("P");
                med.setClassCode("212");
                med.setClassCodeSystem("Claim007");
                med.setItemCount(3);
                med.setValidFrom("20240401");
                med.setValidTo("99991231");

                OrcaOrderInputSetListResponse.Item treatment = new OrcaOrderInputSetListResponse.Item();
                treatment.setSetCode("S02001");
                treatment.setName("処置セット");
                treatment.setEntity(IInfoModel.ENTITY_TREATMENT);
                treatment.setKind("S");
                treatment.setClassCode("400");
                treatment.setClassCodeSystem("Claim007");
                treatment.setItemCount(2);
                treatment.setValidFrom("20240401");
                treatment.setValidTo("99991231");
                return List.of(treatment, med);
            }
        };
        injectField(inputSetResource, "sessionAuditDispatcher", auditDispatcher);
        injectField(inputSetResource, "patientServiceBean", new FakePatientServiceBean());
        injectField(inputSetResource, "karteServiceBean", fakeKarteServiceBean);
        injectField(inputSetResource, "userServiceBean", new FakeUserServiceBean());

        OrcaOrderInputSetListResponse response =
                inputSetResource.getInputSets(servletRequest, "セット", null, "2026-03-09", 1, 20);

        assertNotNull(response);
        assertEquals(2, response.getTotalCount());
        assertEquals(2, response.getItems().size());
        assertEquals("P01001", response.getItems().get(0).getSetCode());
        assertEquals("S02001", response.getItems().get(1).getSetCode());
    }

    @Test
    void getInputSetsCanonicalizesTestEntityFromLegacyAlias() throws Exception {
        OrcaOrderBundleResource inputSetResource = new OrcaOrderBundleResource() {
            @Override
            protected List<OrcaOrderInputSetListResponse.Item> loadInputSetSummaries(String keyword, String effective) {
                OrcaOrderInputSetListResponse.Item test = new OrcaOrderInputSetListResponse.Item();
                test.setSetCode("T60001");
                test.setName("検査セット");
                test.setEntity(IInfoModel.ENTITY_LABO_TEST);
                test.setKind("T");
                test.setClassCode("600");
                test.setClassCodeSystem("Claim007");
                test.setItemCount(3);
                test.setValidFrom("20240401");
                test.setValidTo("99991231");

                OrcaOrderInputSetListResponse.Item med = new OrcaOrderInputSetListResponse.Item();
                med.setSetCode("P01001");
                med.setName("降圧セット");
                med.setEntity(IInfoModel.ENTITY_MED_ORDER);
                med.setKind("P");
                med.setClassCode("212");
                med.setClassCodeSystem("Claim007");
                med.setItemCount(3);
                med.setValidFrom("20240401");
                med.setValidTo("99991231");
                return List.of(test, med);
            }
        };
        injectField(inputSetResource, "sessionAuditDispatcher", auditDispatcher);
        injectField(inputSetResource, "patientServiceBean", new FakePatientServiceBean());
        injectField(inputSetResource, "karteServiceBean", fakeKarteServiceBean);
        injectField(inputSetResource, "userServiceBean", new FakeUserServiceBean());

        OrcaOrderInputSetListResponse response =
                inputSetResource.getInputSets(servletRequest, "セット", "laboTest", "2026-03-09", 1, 20);

        assertNotNull(response);
        assertEquals(1, response.getTotalCount());
        assertEquals(1, response.getItems().size());
        assertEquals("T60001", response.getItems().get(0).getSetCode());
        assertEquals("testOrder", response.getItems().get(0).getEntity());
    }

    @Test
    void getInputSetsDropsUnsupportedMetadataEntity() throws Exception {
        OrcaOrderBundleResource inputSetResource = new OrcaOrderBundleResource() {
            @Override
            protected List<OrcaOrderInputSetListResponse.Item> loadInputSetSummaries(String keyword, String effective) {
                OrcaOrderInputSetListResponse.Item unsupported = new OrcaOrderInputSetListResponse.Item();
                unsupported.setSetCode("X99999");
                unsupported.setName("unsupported");
                unsupported.setEntity(OrcaOrderInputSetMetadataSupport.UNSUPPORTED_ENTITY);
                unsupported.setKind("X");
                unsupported.setClassCode("999");
                unsupported.setClassCodeSystem("Claim007");
                unsupported.setItemCount(1);
                unsupported.setValidFrom("20240401");
                unsupported.setValidTo("99991231");
                return List.of(unsupported);
            }
        };
        injectField(inputSetResource, "sessionAuditDispatcher", auditDispatcher);
        injectField(inputSetResource, "patientServiceBean", new FakePatientServiceBean());
        injectField(inputSetResource, "karteServiceBean", fakeKarteServiceBean);
        injectField(inputSetResource, "userServiceBean", new FakeUserServiceBean());

        OrcaOrderInputSetListResponse response =
                inputSetResource.getInputSets(servletRequest, "セット", null, "2026-03-09", 1, 20);

        assertNotNull(response);
        assertEquals(0, response.getTotalCount());
        assertEquals(0, response.getItems().size());
    }

    @Test
    void getInputSetDetailReturnsBundle() throws Exception {
        OrcaOrderBundleResource inputSetResource = new OrcaOrderBundleResource() {
            @Override
            protected OrcaOrderInputSetDetailResponse.Bundle loadInputSetDetailData(String setCode, String effective, String requestedName) {
                OrcaOrderInputSetDetailResponse.Bundle bundle = new OrcaOrderInputSetDetailResponse.Bundle();
                bundle.setEntity(IInfoModel.ENTITY_MED_ORDER);
                bundle.setSourceSetCode(setCode);
                bundle.setBundleName("降圧セット");
                bundle.setBundleNumber("14");
                bundle.setClassCode("212");
                bundle.setClassCodeSystem("Claim007");
                bundle.setClassName("RP");
                bundle.setAdminMemo("入力セット補足");
                bundle.setMemo("入力セットメモ");
                bundle.setStarted("2026-03-09");
                OrcaOrderInputSetDetailResponse.BodyPart bodyPart = new OrcaOrderInputSetDetailResponse.BodyPart();
                bodyPart.setCode("0021001");
                bodyPart.setName("胸部");
                bodyPart.setQuantity("1");
                bodyPart.setUnit("部位");
                bodyPart.setMemo("");
                bodyPart.setRowRole("bodyPart");
                bundle.setBodyPart(bodyPart);
                OrcaOrderInputSetDetailResponse.Item item = new OrcaOrderInputSetDetailResponse.Item();
                item.setCode("620000001");
                item.setName("アムロジピン");
                item.setQuantity("1");
                item.setUnit("錠");
                item.setMemo("");
                item.setRowRole("main");
                OrcaOrderInputSetDetailResponse.Item comment = new OrcaOrderInputSetDetailResponse.Item();
                comment.setCode("0085001");
                comment.setName("コメント");
                comment.setQuantity("");
                comment.setUnit("");
                comment.setMemo("注意");
                comment.setRowRole("comment");
                bundle.setItems(List.of(item, comment));
                return bundle;
            }
        };
        injectField(inputSetResource, "sessionAuditDispatcher", auditDispatcher);
        injectField(inputSetResource, "patientServiceBean", new FakePatientServiceBean());
        injectField(inputSetResource, "karteServiceBean", fakeKarteServiceBean);
        injectField(inputSetResource, "userServiceBean", new FakeUserServiceBean());

        OrcaOrderInputSetDetailResponse response =
                inputSetResource.getInputSetDetail(servletRequest, "P01001", "20260309", IInfoModel.ENTITY_MED_ORDER, null);

        assertTrue(response.isOk());
        assertEquals("P01001", response.getSetCode());
        assertNotNull(response.getBundle());
        assertEquals("P01001", response.getBundle().getSourceSetCode());
        assertEquals("降圧セット", response.getBundle().getBundleName());
        assertEquals("212", response.getBundle().getClassCode());
        assertEquals("Claim007", response.getBundle().getClassCodeSystem());
        assertEquals("入力セット補足", response.getBundle().getAdminMemo());
        assertEquals("入力セットメモ", response.getBundle().getMemo());
        assertNotNull(response.getBundle().getBodyPart());
        assertEquals("0021001", response.getBundle().getBodyPart().getCode());
        assertEquals("bodyPart", response.getBundle().getBodyPart().getRowRole());
        assertEquals(2, response.getBundle().getItems().size());
        assertEquals("main", response.getBundle().getItems().get(0).getRowRole());
        assertEquals("0085001", response.getBundle().getItems().get(1).getCode());
        assertEquals("注意", response.getBundle().getItems().get(1).getMemo());
        assertEquals("comment", response.getBundle().getItems().get(1).getRowRole());
    }

    @Test
    void getInputSetDetailAcceptsLegacyAliasAndReturnsCanonicalEntity() throws Exception {
        OrcaOrderBundleResource inputSetResource = new OrcaOrderBundleResource() {
            @Override
            protected OrcaOrderInputSetDetailResponse.Bundle loadInputSetDetailData(String setCode, String effective, String requestedName) {
                OrcaOrderInputSetDetailResponse.Bundle bundle = new OrcaOrderInputSetDetailResponse.Bundle();
                bundle.setEntity(IInfoModel.ENTITY_LABO_TEST);
                bundle.setBundleName("検査セット");
                bundle.setBundleNumber("14");
                bundle.setClassCode("600");
                bundle.setClassCodeSystem("Claim007");
                bundle.setClassName("検査");
                bundle.setStarted("2026-03-09");
                OrcaOrderInputSetDetailResponse.Item item = new OrcaOrderInputSetDetailResponse.Item();
                item.setCode("620000001");
                item.setName("アムロジピン");
                item.setQuantity("1");
                item.setUnit("錠");
                item.setMemo("");
                bundle.setItems(List.of(item));
                return bundle;
            }
        };
        injectField(inputSetResource, "sessionAuditDispatcher", auditDispatcher);
        injectField(inputSetResource, "patientServiceBean", new FakePatientServiceBean());
        injectField(inputSetResource, "karteServiceBean", fakeKarteServiceBean);
        injectField(inputSetResource, "userServiceBean", new FakeUserServiceBean());

        OrcaOrderInputSetDetailResponse response =
                inputSetResource.getInputSetDetail(servletRequest, "P01001", "20260309", "laboTest", null);

        assertTrue(response.isOk());
        assertEquals("P01001", response.getSetCode());
        assertNotNull(response.getBundle());
        assertEquals("testOrder", response.getBundle().getEntity());
    }

    @Test
    void getInputSetDetailReturnsCanonicalTreatmentEntity() throws Exception {
        OrcaOrderBundleResource inputSetResource = new OrcaOrderBundleResource() {
            @Override
            protected OrcaOrderInputSetDetailResponse.Bundle loadInputSetDetailData(String setCode, String effective, String requestedName) {
                OrcaOrderInputSetDetailResponse.Bundle bundle = new OrcaOrderInputSetDetailResponse.Bundle();
                bundle.setEntity(IInfoModel.ENTITY_TREATMENT);
                bundle.setBundleName("処置セット");
                bundle.setBundleNumber("14");
                bundle.setClassCode("400");
                bundle.setClassCodeSystem("Claim007");
                bundle.setClassName("処置");
                bundle.setStarted("2026-03-09");
                OrcaOrderInputSetDetailResponse.Item item = new OrcaOrderInputSetDetailResponse.Item();
                item.setCode("400000001");
                item.setName("処置項目");
                item.setQuantity("1");
                item.setUnit("回");
                item.setMemo("");
                bundle.setItems(List.of(item));
                return bundle;
            }
        };
        injectField(inputSetResource, "sessionAuditDispatcher", auditDispatcher);
        injectField(inputSetResource, "patientServiceBean", new FakePatientServiceBean());
        injectField(inputSetResource, "karteServiceBean", fakeKarteServiceBean);
        injectField(inputSetResource, "userServiceBean", new FakeUserServiceBean());

        OrcaOrderInputSetDetailResponse response =
                inputSetResource.getInputSetDetail(servletRequest, "S02001", "20260309", IInfoModel.ENTITY_TREATMENT, null);

        assertTrue(response.isOk());
        assertEquals("S02001", response.getSetCode());
        assertNotNull(response.getBundle());
        assertEquals("treatmentOrder", response.getBundle().getEntity());
    }

    @Test
    void getInputSetDetailReturnsNotFoundForUnsupportedMetadataEntity() throws Exception {
        OrcaOrderBundleResource inputSetResource = new OrcaOrderBundleResource() {
            @Override
            protected OrcaOrderInputSetDetailResponse.Bundle loadInputSetDetailData(String setCode, String effective, String requestedName) {
                OrcaOrderInputSetDetailResponse.Bundle bundle = new OrcaOrderInputSetDetailResponse.Bundle();
                bundle.setEntity(OrcaOrderInputSetMetadataSupport.UNSUPPORTED_ENTITY);
                bundle.setItems(List.of(new OrcaOrderInputSetDetailResponse.Item()));
                return bundle;
            }
        };
        injectField(inputSetResource, "sessionAuditDispatcher", auditDispatcher);
        injectField(inputSetResource, "patientServiceBean", new FakePatientServiceBean());
        injectField(inputSetResource, "karteServiceBean", fakeKarteServiceBean);
        injectField(inputSetResource, "userServiceBean", new FakeUserServiceBean());

        WebApplicationException exception = null;
        try {
            inputSetResource.getInputSetDetail(servletRequest, "X99999", "20260309", IInfoModel.ENTITY_TREATMENT, null);
        } catch (WebApplicationException ex) {
            exception = ex;
        }

        assertNotNull(exception);
        assertEquals(404, exception.getResponse().getStatus());
        Map<String, Object> body = getErrorBody(exception);
        assertEquals("inputset_not_found", body.get("code"));
    }

    @Test
    void getInputSetDetailReturnsNotFoundWhenEntityMismatch() throws Exception {
        OrcaOrderBundleResource inputSetResource = new OrcaOrderBundleResource() {
            @Override
            protected OrcaOrderInputSetDetailResponse.Bundle loadInputSetDetailData(String setCode, String effective, String requestedName) {
                OrcaOrderInputSetDetailResponse.Bundle bundle = new OrcaOrderInputSetDetailResponse.Bundle();
                bundle.setEntity(IInfoModel.ENTITY_MED_ORDER);
                bundle.setItems(List.of(new OrcaOrderInputSetDetailResponse.Item()));
                return bundle;
            }
        };
        injectField(inputSetResource, "sessionAuditDispatcher", auditDispatcher);
        injectField(inputSetResource, "patientServiceBean", new FakePatientServiceBean());
        injectField(inputSetResource, "karteServiceBean", fakeKarteServiceBean);
        injectField(inputSetResource, "userServiceBean", new FakeUserServiceBean());

        WebApplicationException exception = null;
        try {
            inputSetResource.getInputSetDetail(servletRequest, "P01001", "20260309", IInfoModel.ENTITY_TREATMENT, null);
        } catch (WebApplicationException ex) {
            exception = ex;
        }

        assertNotNull(exception);
        assertEquals(404, exception.getResponse().getStatus());
    }

    @Test
    void checkInteractionsReturnsPairsAndDedupes() throws Exception {
        OrcaOrderBundleResource interactionResource = new OrcaOrderBundleResource() {
            @Override
            protected List<OrcaOrderInteractionCheckResponse.Pair> loadInteractionPairs(List<String> codes, List<String> existingCodes) {
                OrcaOrderInteractionCheckResponse.Pair pair = new OrcaOrderInteractionCheckResponse.Pair();
                pair.setCode1("620000001");
                pair.setCode2("620000003");
                pair.setInteractionCode("INT001");
                pair.setInteractionName("併用注意");
                pair.setMessage("相互作用が検出されました");
                return List.of(pair);
            }
        };
        injectField(interactionResource, "sessionAuditDispatcher", auditDispatcher);
        injectField(interactionResource, "patientServiceBean", new FakePatientServiceBean());
        injectField(interactionResource, "karteServiceBean", fakeKarteServiceBean);
        injectField(interactionResource, "userServiceBean", new FakeUserServiceBean());

        OrcaOrderInteractionCheckRequest body = new OrcaOrderInteractionCheckRequest();
        body.setCodes(List.of("620000001", "620000001", "620000002"));
        body.setExistingCodes(List.of("620000003", "620000003", "620000001"));

        OrcaOrderInteractionCheckResponse response = interactionResource.checkInteractions(servletRequest, body);

        assertTrue(response.isOk());
        assertEquals(1, response.getTotalCount());
        assertEquals("620000001", response.getPairs().get(0).getCode1());
        assertEquals("620000003", response.getPairs().get(0).getCode2());
    }

    @Test
    void checkInteractionsRejectsMissingCodes() {
        OrcaOrderInteractionCheckRequest body = new OrcaOrderInteractionCheckRequest();
        body.setCodes(new java.util.ArrayList<>(java.util.Arrays.asList(" ", null)));

        WebApplicationException exception = null;
        try {
            resource.checkInteractions(servletRequest, body);
        } catch (WebApplicationException ex) {
            exception = ex;
        }

        assertNotNull(exception);
        assertEquals(400, exception.getResponse().getStatus());
        Map<String, Object> payload = getErrorBody(exception);
        assertEquals("codes", payload.get("field"));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> getErrorBody(WebApplicationException exception) {
        return (Map<String, Object>) exception.getResponse().getEntity();
    }

    private static void injectField(Object target, String fieldName, Object value) throws Exception {
        Class<?> type = target.getClass();
        Field field = null;
        while (type != null && field == null) {
            try {
                field = type.getDeclaredField(fieldName);
            } catch (NoSuchFieldException ignored) {
                type = type.getSuperclass();
            }
        }
        if (field == null) {
            throw new NoSuchFieldException(fieldName);
        }
        field.setAccessible(true);
        field.set(target, value);
    }

    private static final class RecordingSessionAuditDispatcher extends SessionAuditDispatcher {
        private AuditEventPayload payload;
        private AuditEventEnvelope.Outcome outcome;

        @Override
        public AuditEventEnvelope record(AuditEventPayload payload, AuditEventEnvelope.Outcome overrideOutcome,
                String errorCode, String errorMessage) {
            this.payload = payload;
            this.outcome = overrideOutcome;
            return null;
        }
    }

    private static final class FakePatientServiceBean extends PatientServiceBean {
        @Override
        public PatientModel getPatientById(String fid, String pid) {
            PatientModel patient = new PatientModel();
            patient.setId(100L);
            patient.setFacilityId(fid);
            patient.setPatientId(pid);
            patient.setFullName("テスト患者");
            patient.setKanaName("テスト");
            patient.setBirthday(LocalDate.parse("1990-01-01"));
            patient.setGender("F");
            return patient;
        }
    }

    private static class FakeKarteServiceBean extends KarteServiceBean {
        private long nextDocumentId = 9000L;
        private DocumentModel lastAddedDocument;

        DocumentModel getLastAddedDocument() {
            return lastAddedDocument;
        }

        @Override
        public KarteBean getKarte(String facilityId, String patientId, Date fromDate) {
            KarteBean karte = new KarteBean();
            karte.setId(20L);
            return karte;
        }

        @Override
        public List<DocInfoModel> getDocumentList(long karteId, Date fromDate, boolean includeModifid) {
            DocInfoModel d1 = new DocInfoModel();
            d1.setDocPk(1001L);
            DocInfoModel d2 = new DocInfoModel();
            d2.setDocPk(1002L);
            return List.of(d1, d2);
        }

        @Override
        public List<DocumentModel> getDocuments(List<Long> ids) {
            return ids.stream().map(this::buildDocument).toList();
        }

        @Override
        public List<DocumentModel> getDocumentsWithModules(List<Long> ids) {
            return getDocuments(ids);
        }

        @Override
        public long addDocument(DocumentModel document) {
            if (document.getId() <= 0) {
                nextDocumentId++;
                document.setId(nextDocumentId);
            }
            lastAddedDocument = document;
            return document.getId();
        }

        @Override
        public long updateDocument(DocumentModel document) {
            lastAddedDocument = document;
            return document.getId();
        }

        @Override
        public void flush() {
            // no-op for unit test
        }

        protected DocumentModel buildDocument(Long documentId) {
            DocumentModel document = new DocumentModel();
            document.setId(documentId != null ? documentId : 0L);
            document.setStarted(new Date(1735603200000L)); // 2024-12-31

            UserModel documentUser = new UserModel();
            documentUser.setUserId("document-user-" + document.getId());
            if (document.getId() == 1001L) {
                documentUser.setCommonName("文書担当医");
            } else {
                documentUser.setCommonName(" ");
            }
            LicenseModel documentLicense = new LicenseModel();
            documentLicense.setLicense("doctor");
            documentUser.setLicenseModel(documentLicense);
            document.setUserModel(documentUser);

            ModuleModel module = new ModuleModel();
            module.setStarted(new Date(1735603200000L + ((documentId != null ? documentId : 0L) * 1000L)));

            ModuleInfoBean info = new ModuleInfoBean();
            info.setStampName("降圧薬セット");
            info.setStampRole(IInfoModel.ROLE_P);
            info.setStampNumber(0);
            info.setEntity(IInfoModel.ENTITY_MED_ORDER);
            module.setModuleInfoBean(info);

            BundleDolphin bundle = new BundleDolphin();
            bundle.setOrderName("降圧薬セット");
            bundle.setBundleNumber("14");
            bundle.setAdmin("1日1回 朝食後");
            bundle.setAdminCode("4101");
            bundle.setAdminCodeSystem("Claim007");
            bundle.setClassCode("212");
            ClaimItem item = new ClaimItem();
            item.setCode("100001");
            item.setName("アムロジピン");
            item.setNumber("1");
            item.setUnit("錠");
            item.setMemo("__orca_meta__:{\"genericFlg\":\"no\",\"userComment\":\"食後\"}\nレセプトコメント");
            ClaimItem bodyPart = new ClaimItem();
            bodyPart.setCode("0021001");
            bodyPart.setName("胸部");
            bodyPart.setNumber("1");
            bodyPart.setUnit("部位");
            bundle.setClaimItem(new ClaimItem[]{bodyPart, item});
            module.setModel(bundle);

            if (document.getId() == 1001L) {
                UserModel moduleUser = new UserModel();
                moduleUser.setUserId("module-user-1001");
                moduleUser.setCommonName("モジュール担当医");
                LicenseModel moduleLicense = new LicenseModel();
                moduleLicense.setLicense("doctor");
                moduleLicense.setLicenseDesc("薬剤師");
                moduleUser.setLicenseModel(moduleLicense);
                module.setUserModel(moduleUser);
            }

            document.setModules(List.of(module));
            return document;
        }
    }

    private static final class FakeUserServiceBean extends UserServiceBean {
        @Override
        public UserModel getUser(String userId) {
            UserModel user = new UserModel();
            user.setUserId(userId);
            user.setCommonName("テスト医師");
            return user;
        }
    }

    private static final class FakeJsonOnlyKarteServiceBean extends FakeKarteServiceBean {
        @Override
        public List<DocumentModel> getDocuments(List<Long> ids) {
            return ids.stream().map(id -> {
                DocumentModel document = super.buildDocument(id);
                ModuleModel module = document.getModules().get(0);
                BundleDolphin bundle = (BundleDolphin) module.getModel();
                module.setBeanJson(ModelUtils.jsonEncode(bundle));
                module.setModel(null);
                return document;
            }).toList();
        }

        @Override
        public List<DocumentModel> getDocumentsWithModules(List<Long> ids) {
            return getDocuments(ids);
        }
    }
}
