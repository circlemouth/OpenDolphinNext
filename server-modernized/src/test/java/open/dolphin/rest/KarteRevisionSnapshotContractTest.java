package open.dolphin.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Calendar;
import java.util.Date;
import open.dolphin.infomodel.AttachmentModel;
import open.dolphin.infomodel.BundleDolphin;
import open.dolphin.infomodel.ClaimItem;
import open.dolphin.infomodel.DocInfoModel;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.ExtRefModel;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.ModuleInfoBean;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.SchemaModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.rest.jackson.LegacyObjectMapperProducer;
import open.dolphin.security.audit.AuditTrailService;
import open.dolphin.session.KarteRevisionServiceBean;
import open.dolphin.session.framework.SessionTraceManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class KarteRevisionSnapshotContractTest {

    private static final ObjectMapper JSON = new LegacyObjectMapperProducer().provideLegacyAwareMapper();

    @Mock
    KarteRevisionServiceBean karteRevisionServiceBean;

    @Mock
    AuditTrailService auditTrailService;

    @Mock
    SessionTraceManager sessionTraceManager;

    @Mock
    HttpServletRequest httpServletRequest;

    @InjectMocks
    KarteRevisionResource resource;

    @Test
    void getRevisionReturnsMappedRevisionDocument() throws Exception {
        DocumentModel resourceDocument = buildDocument();

        when(httpServletRequest.getRemoteUser()).thenReturn("FAC_A:user01");
        when(karteRevisionServiceBean.findFacilityIdByRevisionId(111L)).thenReturn("FAC_A");
        when(karteRevisionServiceBean.getRevisionSnapshotLight(111L)).thenReturn(resourceDocument);

        Object actualResponse = resource.getRevision(111L);
        JsonNode actualNode = JSON.readTree(JSON.writeValueAsString(actualResponse));

        assertThat(actualNode.has("docInfoModel")).isTrue();
        assertThat(actualNode.has("attachment")).isTrue();
        assertThat(actualNode.path("id").asLong()).isEqualTo(111L);
        assertThat(actualNode.path("docInfoModel").path("docId").asText()).isEqualTo("DOC111");
        assertThat(actualNode.path("modules")).hasSize(1);
        assertThat(actualNode.path("schema")).hasSize(1);
        assertThat(actualNode.path("attachment")).hasSize(1);
    }

    @Test
    void getRevisionPreservesOrderModuleEntityMetadataAndBeanJsonInSnapshotResponse() throws Exception {
        DocumentModel resourceDocument = buildDocument();
        replaceFirstModuleWithOrderModule(resourceDocument);

        when(httpServletRequest.getRemoteUser()).thenReturn("FAC_A:user01");
        when(karteRevisionServiceBean.findFacilityIdByRevisionId(111L)).thenReturn("FAC_A");
        when(karteRevisionServiceBean.getRevisionSnapshotLight(111L)).thenReturn(resourceDocument);

        Object actualResponse = resource.getRevision(111L);
        JsonNode actualNode = JSON.readTree(JSON.writeValueAsString(actualResponse));

        JsonNode moduleNode = actualNode.path("modules").get(0);
        assertThat(moduleNode.path("moduleInfoBean").path("entity").asText()).isEqualTo(IInfoModel.ENTITY_MED_ORDER);
        assertThat(moduleNode.path("moduleInfoBean").path("stampName").asText()).isEqualTo("テスト処方");
        assertThat(moduleNode.path("moduleInfoBean").path("stampRole").asText()).isEqualTo(IInfoModel.ROLE_P);
        assertThat(moduleNode.path("moduleInfoBean").path("stampNumber").asInt()).isEqualTo(1);
        assertThat(moduleNode.path("beanJson").asText()).contains("TEST-DRUG-001", "テスト薬剤", "1日1回");
        assertThat(resourceDocument.getModules().get(0).getModel()).isInstanceOf(BundleDolphin.class);
    }

    private static DocumentModel buildDocument() {
        Date now = dateOf(2026, Calendar.MARCH, 5);

        UserModel user = new UserModel();
        user.setId(700L);
        user.setUserId("FAC_A:user01");
        user.setCommonName("User One");

        KarteBean karte = new KarteBean();
        karte.setId(800L);

        DocumentModel document = new DocumentModel();
        document.setId(111L);
        document.setStarted(now);
        document.setConfirmed(now);
        document.setRecorded(now);
        document.setStatus("F");
        document.setLinkId(0L);
        document.setLinkRelation("original");
        document.setUserModel(user);
        document.setKarteBean(karte);

        DocInfoModel docInfo = document.getDocInfoModel();
        docInfo.setDocPk(111L);
        docInfo.setDocId("DOC111");
        docInfo.setTitle("外来カルテ");
        docInfo.setStatus("F");
        docInfo.setFirstConfirmDate(now);
        docInfo.setConfirmDate(now);

        ModuleModel module = new ModuleModel();
        module.setId(301L);
        module.setStarted(now);
        module.setConfirmed(now);
        module.setRecorded(now);
        module.setStatus("F");
        module.setLinkId(0L);
        module.setLinkRelation("original");
        module.setUserModel(user);
        module.setKarteBean(karte);
        module.setDocumentModel(document);
        module.setBeanJson("{\"entity\":\"soap\",\"text\":\"主訴\"}");
        ModuleInfoBean info = new ModuleInfoBean();
        info.setEntity("soap");
        info.setStampName("SOAP");
        module.setModuleInfoBean(info);
        document.addModule(module);

        SchemaModel schema = new SchemaModel();
        schema.setId(401L);
        schema.setStarted(now);
        schema.setConfirmed(now);
        schema.setRecorded(now);
        schema.setStatus("F");
        schema.setLinkId(0L);
        schema.setLinkRelation("original");
        schema.setUserModel(user);
        schema.setKarteBean(karte);
        schema.setDocumentModel(document);
        schema.setUri("schema://401");
        schema.setDigest("schema-digest");
        schema.setImageBytes(new byte[] {9, 8, 7});
        ExtRefModel extRef = new ExtRefModel();
        extRef.setHref("https://example.test/schema/401");
        extRef.setTitle("schema-401");
        extRef.setContentType("image/png");
        schema.setExtRefModel(extRef);
        document.addSchema(schema);

        AttachmentModel attachment = new AttachmentModel();
        attachment.setId(501L);
        attachment.setStarted(now);
        attachment.setConfirmed(now);
        attachment.setRecorded(now);
        attachment.setStatus("F");
        attachment.setLinkId(0L);
        attachment.setLinkRelation("original");
        attachment.setUserModel(user);
        attachment.setKarteBean(karte);
        attachment.setDocumentModel(document);
        attachment.setFileName("report.txt");
        attachment.setContentType("text/plain");
        attachment.setContentSize(12L);
        attachment.setLastModified(now.getTime());
        attachment.setDigest("attachment-digest");
        attachment.setTitle("report");
        attachment.setExtension("txt");
        attachment.setUri("attachment://501");
        attachment.setMemo("memo");
        attachment.setContentBytes(new byte[] {1, 2, 3, 4});
        document.addAttachment(attachment);

        return document;
    }

    private static void replaceFirstModuleWithOrderModule(DocumentModel document) {
        ModuleModel module = document.getModules().get(0);
        ModuleInfoBean info = module.getModuleInfoBean();
        info.setEntity(IInfoModel.ENTITY_MED_ORDER);
        info.setStampName("テスト処方");
        info.setStampRole(IInfoModel.ROLE_P);
        info.setStampNumber(1);
        module.setModel(buildOrderBundle());
        module.setBeanJson(ModelUtils.encodeModule(module));
    }

    private static BundleDolphin buildOrderBundle() {
        BundleDolphin bundle = new BundleDolphin();
        bundle.setOrderName("テスト薬剤セット");
        bundle.setClassCode("212");
        bundle.setClassCodeSystem("Claim007");
        bundle.setClassName("処方");
        bundle.setAdmin("1日1回");
        bundle.setAdminCode("TEST-USAGE-001");
        bundle.setAdminCodeSystem("Claim007");
        bundle.setBundleNumber("1");

        ClaimItem item = new ClaimItem();
        item.setCode("TEST-DRUG-001");
        item.setCodeSystem("Claim007");
        item.setName("テスト薬剤");
        item.setNumber("1");
        item.setUnit("錠");
        bundle.setClaimItem(new ClaimItem[]{item});
        return bundle;
    }

    private static Date dateOf(int year, int month, int dayOfMonth) {
        Calendar calendar = Calendar.getInstance();
        calendar.clear();
        calendar.set(year, month, dayOfMonth, 9, 30, 0);
        return calendar.getTime();
    }
}
