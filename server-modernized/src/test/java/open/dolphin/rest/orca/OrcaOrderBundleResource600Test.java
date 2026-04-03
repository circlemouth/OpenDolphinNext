package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
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
import open.dolphin.infomodel.ModuleInfoBean;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.rest.dto.orca.OrderBundleFetchResponse;
import open.dolphin.rest.dto.orca.OrderBundleMutationRequest;
import open.dolphin.rest.dto.orca.OrderBundleMutationResponse;
import open.dolphin.rest.dto.orca.OrcaOrderInputSetDetailResponse;
import open.dolphin.rest.dto.orca.OrcaOrderInputSetListResponse;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.PatientServiceBean;
import open.dolphin.session.UserServiceBean;
import open.dolphin.testsupport.RuntimeDelegateTestSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OrcaOrderBundleResource600Test extends RuntimeDelegateTestSupport {

    private OrcaOrderBundleResource resource;
    private RecordingSessionAuditDispatcher auditDispatcher;
    private BasicKarteServiceBean karteServiceBean;
    private HttpServletRequest servletRequest;

    @BeforeEach
    void setUp() throws Exception {
        auditDispatcher = new RecordingSessionAuditDispatcher();
        karteServiceBean = new BasicKarteServiceBean(List.of());
        resource = buildResource(new OrcaOrderBundleResource(), karteServiceBean);
        servletRequest = buildServletRequest();
    }

    @Test
    void postBundlesRejectsBacteriaWithoutSubtype() {
        OrderBundleMutationRequest payload = new OrderBundleMutationRequest();
        payload.setPatientId("00001");

        OrderBundleMutationRequest.BundleOperation op = new OrderBundleMutationRequest.BundleOperation();
        op.setOperation("create");
        op.setEntity(IInfoModel.ENTITY_BACTERIA_ORDER);
        op.setBundleName("bacteria-main");
        op.setClassCode("600");
        op.setClassCodeSystem("Claim007");
        op.setStartDate("2025-01-01");

        OrderBundleMutationRequest.BundleItem item = new OrderBundleMutationRequest.BundleItem();
        item.setCode("160000010");
        item.setName("culture-main");
        op.setItems(List.of(item));
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
        assertEquals("subtype", body.get("field"));
        assertEquals("subtype is required for bacteriaOrder", body.get("message"));
    }

    @Test
    void postBundlesRejectsBodyPartForTestOrder() {
        OrderBundleMutationRequest payload = new OrderBundleMutationRequest();
        payload.setPatientId("00001");

        OrderBundleMutationRequest.BundleOperation op = new OrderBundleMutationRequest.BundleOperation();
        op.setOperation("create");
        op.setEntity("testOrder");
        op.setBundleName("specimen-main");
        op.setClassCode("600");
        op.setClassCodeSystem("Claim007");
        op.setStartDate("2025-01-01");

        OrderBundleMutationRequest.BundleItem bodyPart = new OrderBundleMutationRequest.BundleItem();
        bodyPart.setCode("002001");
        bodyPart.setName("invalid-body-part");
        op.setBodyPart(bodyPart);

        OrderBundleMutationRequest.BundleItem item = new OrderBundleMutationRequest.BundleItem();
        item.setCode("160000010");
        item.setName("specimen-main");
        op.setItems(List.of(item));
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
        assertEquals("bodyPart", body.get("field"));
        assertEquals("bodyPart is incompatible with entity", body.get("message"));
    }

    @Test
    void postBundlesRejectsNon8CodeForOtherOrder() {
        OrderBundleMutationRequest payload = new OrderBundleMutationRequest();
        payload.setPatientId("00001");

        OrderBundleMutationRequest.BundleOperation op = new OrderBundleMutationRequest.BundleOperation();
        op.setOperation("create");
        op.setEntity(IInfoModel.ENTITY_OTHER_ORDER);
        op.setBundleName("other-main");
        op.setClassCode("800");
        op.setClassCodeSystem("Claim007");
        op.setStartDate("2025-01-01");

        OrderBundleMutationRequest.BundleItem item = new OrderBundleMutationRequest.BundleItem();
        item.setCode("700000001");
        item.setName("invalid-material");
        op.setItems(List.of(item));
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
        assertEquals("items", body.get("field"));
        assertEquals("otherOrder items must use code family 8", body.get("message"));
    }

    @Test
    void postBundlesRejectsOtherOrderWithWrongClassCodeFamily() {
        OrderBundleMutationRequest payload = new OrderBundleMutationRequest();
        payload.setPatientId("00001");

        OrderBundleMutationRequest.BundleOperation op = new OrderBundleMutationRequest.BundleOperation();
        op.setOperation("create");
        op.setEntity(IInfoModel.ENTITY_OTHER_ORDER);
        op.setBundleName("other-main");
        op.setClassCode("700");
        op.setClassCodeSystem("Claim007");
        op.setStartDate("2025-01-01");

        OrderBundleMutationRequest.BundleItem item = new OrderBundleMutationRequest.BundleItem();
        item.setCode("180000210");
        item.setName("other-main");
        op.setItems(List.of(item));
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
        assertEquals("classCode", body.get("field"));
        assertEquals("classCode is incompatible with entity", body.get("message"));
    }

    @Test
    void postBundlesRejectsBodyPartForOtherOrder() {
        OrderBundleMutationRequest payload = new OrderBundleMutationRequest();
        payload.setPatientId("00001");

        OrderBundleMutationRequest.BundleOperation op = new OrderBundleMutationRequest.BundleOperation();
        op.setOperation("create");
        op.setEntity(IInfoModel.ENTITY_OTHER_ORDER);
        op.setBundleName("other-main");
        op.setClassCode("800");
        op.setClassCodeSystem("Claim007");
        op.setStartDate("2025-01-01");

        OrderBundleMutationRequest.BundleItem bodyPart = new OrderBundleMutationRequest.BundleItem();
        bodyPart.setCode("002001");
        bodyPart.setName("invalid-body-part");
        op.setBodyPart(bodyPart);

        OrderBundleMutationRequest.BundleItem item = new OrderBundleMutationRequest.BundleItem();
        item.setCode("800000001");
        item.setName("other-main");
        op.setItems(List.of(item));
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
        assertEquals("bodyPart", body.get("field"));
        assertEquals("bodyPart is incompatible with entity", body.get("message"));
    }

    @Test
    void postBundlesAcceptsOtherOrder18FamilyCode() {
        OrderBundleMutationRequest payload = new OrderBundleMutationRequest();
        payload.setPatientId("00001");

        OrderBundleMutationRequest.BundleOperation op = new OrderBundleMutationRequest.BundleOperation();
        op.setOperation("create");
        op.setEntity(IInfoModel.ENTITY_OTHER_ORDER);
        op.setBundleName("other-main");
        op.setClassCode("800");
        op.setClassCodeSystem("Claim007");
        op.setStartDate("2025-01-01");

        OrderBundleMutationRequest.BundleItem item = new OrderBundleMutationRequest.BundleItem();
        item.setCode("180000210");
        item.setName("other-main");
        op.setItems(List.of(item));
        payload.setOperations(List.of(op));

        OrderBundleMutationResponse response = resource.postBundles(servletRequest, payload);

        assertNotNull(response);
        assertEquals(1, response.getCreatedDocumentIds().size());
    }

    @Test
    void getBundlesReturnsStored600Subtype() throws Exception {
        karteServiceBean = new BasicKarteServiceBean(List.of(buildStored600Document(
                16001L,
                IInfoModel.ENTITY_BACTERIA_ORDER,
                "culture",
                "160000010",
                "culture-main")));
        resource = buildResource(new OrcaOrderBundleResource(), karteServiceBean);

        OrderBundleFetchResponse response = resource.getBundles(
                servletRequest,
                "00001",
                IInfoModel.ENTITY_BACTERIA_ORDER,
                "2025-01-01");

        assertNotNull(response);
        assertEquals(1, response.getBundles().size());
        OrderBundleFetchResponse.OrderBundleEntry entry = response.getBundles().get(0);
        assertEquals(IInfoModel.ENTITY_BACTERIA_ORDER, entry.getEntity());
        assertEquals("culture", entry.getSubtype());
        assertEquals("600", entry.getClassCode());
        assertEquals(1, entry.getItems().size());
        assertEquals("160000010", entry.getItems().get(0).getCode());
    }

    @Test
    void postBundlesPersistsBacteriaSubtypeAndFetchReturnsIt() throws Exception {
        karteServiceBean = new BasicKarteServiceBean(List.of());
        resource = buildResource(new OrcaOrderBundleResource(), karteServiceBean);

        OrderBundleMutationRequest payload = new OrderBundleMutationRequest();
        payload.setPatientId("00001");

        OrderBundleMutationRequest.BundleOperation op = new OrderBundleMutationRequest.BundleOperation();
        op.setOperation("create");
        op.setEntity(IInfoModel.ENTITY_BACTERIA_ORDER);
        op.setSubtype("culture");
        op.setBundleName("culture-main");
        op.setClassCode("600");
        op.setClassCodeSystem("Claim007");
        op.setStartDate("2025-01-01");

        OrderBundleMutationRequest.BundleItem item = new OrderBundleMutationRequest.BundleItem();
        item.setCode("160000010");
        item.setName("culture-main");
        op.setItems(List.of(item));
        payload.setOperations(List.of(op));

        OrderBundleMutationResponse mutationResponse = resource.postBundles(servletRequest, payload);

        assertNotNull(mutationResponse);
        OrderBundleFetchResponse fetched = resource.getBundles(
                servletRequest,
                "00001",
                IInfoModel.ENTITY_BACTERIA_ORDER,
                "2025-01-01");

        assertNotNull(fetched);
        assertEquals(1, fetched.getBundles().size());
        OrderBundleFetchResponse.OrderBundleEntry entry = fetched.getBundles().get(0);
        assertEquals(IInfoModel.ENTITY_BACTERIA_ORDER, entry.getEntity());
        assertEquals("culture", entry.getSubtype());
        assertEquals("600", entry.getClassCode());
        assertEquals("culture-main", entry.getBundleName());
    }

    @Test
    void getInputSetsAllowsPhysiologyAndBacteriaToReuseCanonical600Rows() throws Exception {
        OrcaOrderBundleResource inputSetResource = buildResource(new OrcaOrderBundleResource() {
            @Override
            protected List<OrcaOrderInputSetListResponse.Item> loadInputSetSummaries(String keyword, String effective) {
                OrcaOrderInputSetListResponse.Item canonical = new OrcaOrderInputSetListResponse.Item();
                canonical.setSetCode("P60001");
                canonical.setName("class600-set");
                canonical.setEntity("testOrder");
                canonical.setClassCode("600");
                canonical.setClassCodeSystem("Claim007");
                return List.of(canonical);
            }
        }, new BasicKarteServiceBean(List.of()));

        OrcaOrderInputSetListResponse physiology = inputSetResource.getInputSets(
                servletRequest, "set", IInfoModel.ENTITY_PHYSIOLOGY_ORDER, "20260309", 1, 20);
        OrcaOrderInputSetListResponse bacteria = inputSetResource.getInputSets(
                servletRequest, "set", IInfoModel.ENTITY_BACTERIA_ORDER, "20260309", 1, 20);

        assertEquals(1, physiology.getItems().size());
        assertEquals("testOrder", physiology.getItems().get(0).getEntity());
        assertEquals(1, bacteria.getItems().size());
        assertEquals("testOrder", bacteria.getItems().get(0).getEntity());
    }

    @Test
    void getInputSetDetailAllowsPhysiologyAndBacteriaRequestsForCanonical600Set() throws Exception {
        OrcaOrderBundleResource physiologyResource = buildResource(new OrcaOrderBundleResource() {
            @Override
            protected OrcaOrderInputSetDetailResponse.Bundle loadInputSetDetailData(
                    String setCode, String effective, String requestedName) {
                return buildInputSetBundle("testOrder", null, "160000010", "specimen-main");
            }
        }, new BasicKarteServiceBean(List.of()));
        OrcaOrderBundleResource bacteriaResource = buildResource(new OrcaOrderBundleResource() {
            @Override
            protected OrcaOrderInputSetDetailResponse.Bundle loadInputSetDetailData(
                    String setCode, String effective, String requestedName) {
                return buildInputSetBundle("testOrder", "culture", "160000010", "culture-main");
            }
        }, new BasicKarteServiceBean(List.of()));

        OrcaOrderInputSetDetailResponse physiology = physiologyResource.getInputSetDetail(
                servletRequest, "P60001", "20260309", IInfoModel.ENTITY_PHYSIOLOGY_ORDER, null);
        OrcaOrderInputSetDetailResponse bacteria = bacteriaResource.getInputSetDetail(
                servletRequest, "P60002", "20260309", IInfoModel.ENTITY_BACTERIA_ORDER, null);

        assertNotNull(physiology.getBundle());
        assertEquals("testOrder", physiology.getBundle().getEntity());
        assertEquals("physiology", physiology.getBundle().getSubtype());
        assertNotNull(bacteria.getBundle());
        assertEquals("testOrder", bacteria.getBundle().getEntity());
        assertEquals("culture", bacteria.getBundle().getSubtype());
    }

    private OrcaOrderBundleResource buildResource(OrcaOrderBundleResource target, KarteServiceBean karte) throws Exception {
        injectField(target, "sessionAuditDispatcher", auditDispatcher);
        injectField(target, "patientServiceBean", new FakePatientServiceBean());
        injectField(target, "karteServiceBean", karte);
        injectField(target, "userServiceBean", new FakeUserServiceBean());
        return target;
    }

    private static OrcaOrderInputSetDetailResponse.Bundle buildInputSetBundle(
            String entity, String subtype, String code, String name) {
        OrcaOrderInputSetDetailResponse.Bundle bundle = new OrcaOrderInputSetDetailResponse.Bundle();
        bundle.setEntity(entity);
        bundle.setSubtype(subtype);
        bundle.setBundleName(name);
        bundle.setBundleNumber("1");
        bundle.setClassCode("600");
        bundle.setClassCodeSystem("Claim007");
        bundle.setClassName("Test");
        bundle.setStarted("2026-03-09");

        OrcaOrderInputSetDetailResponse.Item item = new OrcaOrderInputSetDetailResponse.Item();
        item.setCode(code);
        item.setName(name);
        item.setQuantity("1");
        item.setUnit("count");
        item.setMemo("");
        bundle.setItems(List.of(item));
        return bundle;
    }

    private static DocumentModel buildStored600Document(
            long documentId, String entity, String subtype, String code, String name) {
        DocumentModel document = new DocumentModel();
        document.setId(documentId);
        document.setStarted(new Date(1735603200000L));

        UserModel documentUser = new UserModel();
        documentUser.setUserId("document-user-" + documentId);
        documentUser.setCommonName("document-user");
        LicenseModel documentLicense = new LicenseModel();
        documentLicense.setLicense("doctor");
        documentUser.setLicenseModel(documentLicense);
        document.setUserModel(documentUser);

        ModuleInfoBean info = new ModuleInfoBean();
        info.setStampName(name);
        info.setStampRole(IInfoModel.ROLE_P);
        info.setStampNumber(0);
        info.setEntity(entity);
        info.setStampMemo(OrcaOrderBundle600SubtypeSupport.updateStampMemo(null, entity, subtype));

        ClaimItem claimItem = new ClaimItem();
        claimItem.setCode(code);
        claimItem.setName(name);
        claimItem.setNumber("1");
        claimItem.setUnit("count");

        BundleDolphin bundle = new BundleDolphin();
        bundle.setOrderName(name);
        bundle.setBundleNumber("1");
        bundle.setClassCode("600");
        bundle.setClassCodeSystem("Claim007");
        bundle.setClassName("Test");
        bundle.setClaimItem(new ClaimItem[]{claimItem});

        ModuleModel module = new ModuleModel();
        module.setModuleInfoBean(info);
        module.setModel(bundle);
        document.setModules(List.of(module));
        return document;
    }

    private static HttpServletRequest buildServletRequest() {
        return (HttpServletRequest) Proxy.newProxyInstance(
                OrcaOrderBundleResource600Test.class.getClassLoader(),
                new Class[]{HttpServletRequest.class},
                (proxy, method, args) -> {
                    String name = method.getName();
                    if ("getRemoteUser".equals(name)) return "F001:doctor01";
                    if ("getRemoteAddr".equals(name)) return "127.0.0.1";
                    if ("getRequestURI".equals(name)) return "/api/orca/order/bundles";
                    if ("getHeader".equals(name) && args != null && args.length == 1) {
                        String header = String.valueOf(args[0]);
                        return switch (header) {
                            case "X-Request-Id" -> "req-order-bundle-600";
                            case "X-Trace-Id" -> "trace-order-bundle-600";
                            case "User-Agent" -> "JUnit";
                            default -> null;
                        };
                    }
                    return null;
                });
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
            patient.setFullName("test-patient");
            patient.setKanaName("test");
            patient.setBirthday(LocalDate.parse("1990-01-01"));
            patient.setGender("F");
            return patient;
        }
    }

    private static final class FakeUserServiceBean extends UserServiceBean {
        @Override
        public UserModel getUser(String userId) {
            UserModel user = new UserModel();
            user.setUserId(userId);
            user.setCommonName("test-user");
            return user;
        }
    }

    private static final class BasicKarteServiceBean extends KarteServiceBean {
        private final List<DocumentModel> documents;
        private long nextDocumentId = 9000L;

        private BasicKarteServiceBean(List<DocumentModel> documents) {
            this.documents = new java.util.ArrayList<>(documents);
        }

        @Override
        public KarteBean getKarte(String facilityId, String patientId, Date fromDate) {
            KarteBean karte = new KarteBean();
            karte.setId(20L);
            return karte;
        }

        @Override
        public List<DocInfoModel> getDocumentList(long karteId, Date fromDate, boolean includeModifid) {
            return documents.stream().map(document -> {
                DocInfoModel info = new DocInfoModel();
                info.setDocPk(document.getId());
                return info;
            }).toList();
        }

        @Override
        public List<DocumentModel> getDocuments(List<Long> ids) {
            return documents.stream().filter(document -> ids.contains(document.getId())).toList();
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
            documents.add(document);
            return document.getId();
        }

        @Override
        public long updateDocument(DocumentModel document) {
            return document.getId();
        }

        @Override
        public void flush() {
            // no-op
        }
    }
}
