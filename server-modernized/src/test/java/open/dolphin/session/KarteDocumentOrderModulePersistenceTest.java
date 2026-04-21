package open.dolphin.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import jakarta.persistence.TypedQuery;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Date;
import java.util.List;
import open.dolphin.infomodel.BundleDolphin;
import open.dolphin.infomodel.ClaimItem;
import open.dolphin.infomodel.DocInfoModel;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.ModuleInfoBean;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.security.integrity.DocumentIntegrityService;
import open.dolphin.storage.attachment.AttachmentStorageManager;
import open.dolphin.storage.image.ImageStorageManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class KarteDocumentOrderModulePersistenceTest {

    private static final String QUERY_DOCUMENT_BY_IDS =
            "FROM DocumentModel d WHERE d.id IN (:ids) ORDER BY d.id";
    private static final String QUERY_MODULES_BY_DOC_IDS =
            "FROM ModuleModel m JOIN FETCH m.document d WHERE d.id IN (:ids) ORDER BY d.id,m.moduleInfo.stampNumber";
    private static final String QUERY_SCHEMAS_BY_DOC_IDS =
            "select i from SchemaModel i left join fetch i.karte left join fetch i.creator "
                    + "where i.document.id in :ids order by i.document.id, i.id";
    private static final String QUERY_ATTACHMENTS_BY_DOC_IDS =
            "select a from AttachmentModel a left join fetch a.karte left join fetch a.creator "
                    + "where a.document.id in :ids order by a.document.id, a.id";
    private static final String QUERY_DOCUMENT_BY_LINK_ID = "from DocumentModel d where d.linkId=:id";
    private static final String QUERY_MODULE_BY_DOC_ID =
            "from ModuleModel m where m.document.id=:id order by m.id";
    private static final String QUERY_SCHEMA_BY_DOC_ID =
            "from SchemaModel i where i.document.id=:id order by i.id";
    private static final String QUERY_ATTACHMENT_BY_DOC_ID =
            "from AttachmentModel a where a.document.id=:id order by a.id";

    private KarteDocumentWriteService writeService;
    private EntityManager em;
    private DocumentIntegrityService documentIntegrityService;

    @BeforeEach
    void setUp() throws Exception {
        writeService = new KarteDocumentWriteService();
        em = mock(EntityManager.class);
        documentIntegrityService = mock(DocumentIntegrityService.class);
        setField(writeService, "em", em);
        setField(writeService, "attachmentStorageManager", mock(AttachmentStorageManager.class));
        setField(writeService, "imageStorageManager", mock(ImageStorageManager.class));
        setField(writeService, "documentIntegrityService", documentIntegrityService);
    }

    @Test
    void addDocumentEncodesOrderModulePayloadBindsParentReferencesAndSealsIntegrity() {
        DocumentModel document = buildOrderDocument(0L, "DOC-ORDER-001", 0L);
        document.getModules().get(0).setBeanJson(null);
        doAnswer(invocation -> {
            DocumentModel persisted = invocation.getArgument(0);
            persisted.setId(1001L);
            persisted.getModules().get(0).setId(2001L);
            return null;
        }).when(em).persist(any(DocumentModel.class));

        long createdId = writeService.addDocument(document);

        ModuleModel module = document.getModules().get(0);
        assertThat(createdId).isEqualTo(1001L);
        assertThat(document.getDocInfoModel().getDocPk()).isEqualTo(1001L);
        assertThat(module.getDocumentModel()).isSameAs(document);
        assertThat(module.getKarteBean()).isSameAs(document.getKarteBean());
        assertThat(module.getUserModel()).isSameAs(document.getUserModel());
        assertThat(module.getStarted()).isEqualTo(document.getStarted());
        assertThat(module.getConfirmed()).isEqualTo(document.getConfirmed());
        assertThat(module.getStatus()).isEqualTo(IInfoModel.STATUS_FINAL);
        assertThat(module.getModuleInfoBean().getEntity()).isEqualTo(IInfoModel.ENTITY_MED_ORDER);
        assertThat(module.getBeanJson()).contains("TEST-DRUG-001", "テスト薬剤", "1日1回");

        Object decoded = ModelUtils.decodeModule(module);
        assertThat(decoded).isInstanceOf(BundleDolphin.class);
        BundleDolphin decodedBundle = (BundleDolphin) decoded;
        assertThat(decodedBundle.getOrderName()).isEqualTo("テスト薬剤セット");
        assertThat(decodedBundle.getClaimItem()).hasSize(1);
        assertThat(decodedBundle.getClaimItem()[0].getCode()).isEqualTo("TEST-DRUG-001");
        assertThat(decodedBundle.getClaimItem()[0].getUnit()).isEqualTo("錠");

        verify(em).persist(document);
        verify(documentIntegrityService).sealDocument(document);
    }

    @Test
    void detailReadbackPreservesOrderModulePayloadModuleInfoAndDocumentParentReference() {
        DocumentModel document = buildOrderDocument(1001L, "DOC-ORDER-001", 0L);
        ModuleModel module = document.getModules().get(0);
        module.setId(2001L);
        module.setBeanJson(ModelUtils.encodeModule(module));
        document.setModules(null);

        TypedQuery<DocumentModel> documentQuery = typedQuery(List.of(document));
        TypedQuery<ModuleModel> moduleQuery = typedQuery(List.of(module));
        TypedQuery<open.dolphin.infomodel.SchemaModel> schemaQuery = typedQuery(List.of());
        TypedQuery<open.dolphin.infomodel.AttachmentModel> attachmentQuery = typedQuery(List.of());
        when(em.createQuery(QUERY_DOCUMENT_BY_IDS, DocumentModel.class)).thenReturn(documentQuery);
        when(em.createQuery(QUERY_MODULES_BY_DOC_IDS, ModuleModel.class)).thenReturn(moduleQuery);
        when(em.createQuery(QUERY_SCHEMAS_BY_DOC_IDS, open.dolphin.infomodel.SchemaModel.class)).thenReturn(schemaQuery);
        when(em.createQuery(QUERY_ATTACHMENTS_BY_DOC_IDS, open.dolphin.infomodel.AttachmentModel.class)).thenReturn(attachmentQuery);

        List<Collection<ModuleModel>> decodedBatches = new ArrayList<>();
        KarteDocumentBulkFetchSupport support = new KarteDocumentBulkFetchSupport(em, modules -> {
            for (ModuleModel candidate : modules) {
                candidate.setModel((open.dolphin.infomodel.IInfoModel) ModelUtils.decodeModule(candidate));
            }
            decodedBatches.add(new ArrayList<>(modules));
        });

        List<DocumentModel> result = support.loadDocuments(List.of(1001L),
                KarteDocumentBulkFetchSupport.DocumentLoadMode.DETAIL);

        assertThat(result).hasSize(1);
        DocumentModel readback = result.get(0);
        assertThat(readback.getId()).isEqualTo(1001L);
        assertThat(readback.getDocInfoModel().getDocId()).isEqualTo("DOC-ORDER-001");
        assertThat(readback.getModules()).hasSize(1);
        ModuleModel readbackModule = readback.getModules().get(0);
        assertThat(readbackModule.getDocumentModel()).isSameAs(readback);
        assertThat(readbackModule.getModuleInfoBean().getEntity()).isEqualTo(IInfoModel.ENTITY_MED_ORDER);
        assertThat(readbackModule.getModuleInfoBean().getStampName()).isEqualTo("テスト処方");
        assertThat(readbackModule.getBeanJson()).contains("TEST-DRUG-001", "テスト医師コメント");
        assertThat(readbackModule.getModel()).isInstanceOf(BundleDolphin.class);
        assertThat(((BundleDolphin) readbackModule.getModel()).getClaimItem()[0].getName()).isEqualTo("テスト薬剤");
        assertThat(decodedBatches).hasSize(1);
    }

    @Test
    void deleteDocumentMarksReferencedOrderRevisionChainAsDeleted() {
        Date now = new Date(1_709_251_200_000L);
        DocumentModel latest = buildOrderDocument(300L, "DOC-300", 200L);
        DocumentModel parent = buildOrderDocument(200L, "DOC-200", 0L);
        latest.setConfirmed(now);
        parent.setConfirmed(now);
        ModuleModel latestModule = latest.getModules().get(0);
        ModuleModel parentModule = parent.getModules().get(0);

        Query refsQuery = query(List.of());
        Query latestModuleQuery = query(List.of(latestModule));
        Query parentModuleQuery = query(List.of(parentModule));
        Query emptySchemaQuery = query(List.of(), List.of());
        Query emptyAttachmentQuery = query(List.of(), List.of());
        when(em.createQuery(QUERY_DOCUMENT_BY_LINK_ID)).thenReturn(refsQuery);
        when(em.createQuery(QUERY_MODULE_BY_DOC_ID)).thenReturn(latestModuleQuery, parentModuleQuery);
        when(em.createQuery(QUERY_SCHEMA_BY_DOC_ID)).thenReturn(emptySchemaQuery);
        when(em.createQuery(QUERY_ATTACHMENT_BY_DOC_ID)).thenReturn(emptyAttachmentQuery);
        when(em.find(DocumentModel.class, 300L)).thenReturn(latest);
        when(em.find(DocumentModel.class, 200L)).thenReturn(parent);
        when(em.find(DocumentModel.class, 0L)).thenReturn(null);

        List<String> deletedDocIds = writeService.deleteDocument(300L);

        assertThat(deletedDocIds).containsExactly("DOC-300", "DOC-200");
        assertThat(latest.getStatus()).isEqualTo(IInfoModel.STATUS_DELETE);
        assertThat(parent.getStatus()).isEqualTo(IInfoModel.STATUS_DELETE);
        assertThat(latest.getEnded()).isNotNull();
        assertThat(parent.getEnded()).isEqualTo(latest.getEnded());
        assertThat(latestModule.getStatus()).isEqualTo(IInfoModel.STATUS_DELETE);
        assertThat(parentModule.getStatus()).isEqualTo(IInfoModel.STATUS_DELETE);
        assertThat(latestModule.getEnded()).isEqualTo(latest.getEnded());
        assertThat(parentModule.getEnded()).isEqualTo(latest.getEnded());
    }

    private static DocumentModel buildOrderDocument(long id, String docId, long parentPk) {
        Date now = new Date(1_709_251_200_000L);

        KarteBean karte = new KarteBean();
        karte.setId(501L);

        UserModel user = new UserModel();
        user.setId(601L);
        user.setUserId("F001:doctor01");
        user.setCommonName("テスト医師");

        DocumentModel document = new DocumentModel();
        document.setId(id);
        document.setKarteBean(karte);
        document.setUserModel(user);
        document.setStarted(now);
        document.setConfirmed(now);
        document.setRecorded(now);
        document.setStatus(IInfoModel.STATUS_FINAL);
        document.setLinkId(parentPk);
        document.setLinkRelation(parentPk > 0L ? "revise" : null);

        DocInfoModel info = document.getDocInfoModel();
        info.setDocPk(id);
        info.setDocId(docId);
        info.setTitle("外来カルテ");
        info.setDocType(IInfoModel.DOCTYPE_KARTE);
        info.setPurpose(IInfoModel.PURPOSE_RECORD);
        info.setStatus(IInfoModel.STATUS_FINAL);
        info.setParentPk(parentPk);
        info.setParentIdRelation(parentPk > 0L ? "revise" : null);
        info.setConfirmDate(now);
        info.setFirstConfirmDate(now);

        ModuleModel module = new ModuleModel();
        module.setDocumentModel(document);
        module.setKarteBean(karte);
        module.setUserModel(user);
        module.setStarted(now);
        module.setConfirmed(now);
        module.setRecorded(now);
        module.setStatus(IInfoModel.STATUS_FINAL);
        module.setLinkId(parentPk);
        module.setLinkRelation(parentPk > 0L ? "revise" : null);
        ModuleInfoBean moduleInfo = module.getModuleInfoBean();
        moduleInfo.setEntity(IInfoModel.ENTITY_MED_ORDER);
        moduleInfo.setStampName("テスト処方");
        moduleInfo.setStampRole(IInfoModel.ROLE_P);
        moduleInfo.setStampNumber(1);
        module.setModel(buildOrderBundle());
        module.setBeanJson(ModelUtils.encodeModule(module));
        document.addModule(module);
        return document;
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
        bundle.setAdminMemo("テスト医師コメント");
        bundle.setBundleNumber("1");
        bundle.setMemo("テスト医師コメント");

        ClaimItem item = new ClaimItem();
        item.setCode("TEST-DRUG-001");
        item.setCodeSystem("Claim007");
        item.setName("テスト薬剤");
        item.setNumber("1");
        item.setUnit("錠");
        bundle.setClaimItem(new ClaimItem[]{item});
        return bundle;
    }

    @SuppressWarnings("unchecked")
    private static <T> TypedQuery<T> typedQuery(List<T> results) {
        TypedQuery<T> query = mock(TypedQuery.class);
        when(query.setParameter(any(String.class), any())).thenReturn(query);
        when(query.getResultList()).thenReturn(results);
        return query;
    }

    private static Query query(List<?> firstResult, List<?>... subsequentResults) {
        Query query = mock(Query.class);
        when(query.setParameter(any(String.class), any())).thenReturn(query);
        if (subsequentResults == null || subsequentResults.length == 0) {
            when(query.getResultList()).thenReturn(firstResult);
        } else {
            when(query.getResultList()).thenReturn(firstResult, subsequentResults);
        }
        return query;
    }

    private static void setField(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }
}
