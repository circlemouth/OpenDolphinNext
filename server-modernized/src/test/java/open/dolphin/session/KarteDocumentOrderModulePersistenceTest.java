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
        Query nativeQuery = mock(Query.class);
        when(em.createNativeQuery(any(String.class))).thenReturn(nativeQuery);
        when(nativeQuery.executeUpdate()).thenReturn(1);
    }

    // Local chart/document persistence only; this does not execute ORCA medicalmodv2 live mutations.
    @Test
    void addDocumentLocalChartPersistenceEncodesCanonicalOrderModulesBindsParentsAndSealsIntegrity() {
        DocumentModel document = buildOrderDocument(0L, "DOC-ORDER-001", 0L);
        doAnswer(invocation -> {
            DocumentModel persisted = invocation.getArgument(0);
            persisted.setId(1001L);
            for (int i = 0; i < persisted.getModules().size(); i++) {
                persisted.getModules().get(i).setId(2001L + i);
            }
            return null;
        }).when(em).persist(any(DocumentModel.class));

        long createdId = writeService.addDocument(document);

        assertThat(createdId).isEqualTo(1001L);
        assertThat(document.getDocInfoModel().getDocPk()).isEqualTo(1001L);
        assertThat(document.getModules()).hasSize(3);
        assertOrderModule(document, 0, IInfoModel.ENTITY_MED_ORDER, "テスト処方", 1,
                "TEST-DRUG-001", "テスト薬剤セット", "テスト薬剤");
        assertOrderModule(document, 1, IInfoModel.ENTITY_TREATMENT, "テスト処置", 2,
                "TEST-TREAT-001", "テスト処置セット", "テスト創傷処置");
        assertOrderModule(document, 2, IInfoModel.ENTITY_RADIOLOGY_ORDER, "テスト放射線", 3,
                "TEST-RAD-001", "テスト放射線セット", "テストX線撮影");

        verify(em).persist(document);
        verify(documentIntegrityService).sealDocument(document);
    }

    @Test
    void detailBulkReadbackLocalChartDocumentPreservesOrderModulesPayloadsMetadataAndParents() {
        DocumentModel document = buildPersistedOrderDocument(1001L, "DOC-ORDER-001", 0L);
        for (int i = 0; i < document.getModules().size(); i++) {
            document.getModules().get(i).setId(2001L + i);
        }
        List<ModuleModel> persistedModules = new ArrayList<>(document.getModules());
        document.setModules(null);

        TypedQuery<DocumentModel> documentQuery = typedQuery(List.of(document));
        TypedQuery<ModuleModel> moduleQuery = typedQuery(persistedModules);
        TypedQuery<open.dolphin.infomodel.SchemaModel> schemaQuery = typedQuery(List.of());
        TypedQuery<open.dolphin.infomodel.AttachmentModel> attachmentQuery = typedQuery(List.of());
        when(em.createQuery(QUERY_DOCUMENT_BY_IDS, DocumentModel.class)).thenReturn(documentQuery);
        when(em.createQuery(QUERY_MODULES_BY_DOC_IDS, ModuleModel.class)).thenReturn(moduleQuery);
        when(em.createQuery(QUERY_SCHEMAS_BY_DOC_IDS, open.dolphin.infomodel.SchemaModel.class)).thenReturn(schemaQuery);
        when(em.createQuery(QUERY_ATTACHMENTS_BY_DOC_IDS, open.dolphin.infomodel.AttachmentModel.class)).thenReturn(attachmentQuery);

        List<Collection<ModuleModel>> decodedBatches = new ArrayList<>();
        KarteDocumentBulkFetchSupport support = new KarteDocumentBulkFetchSupport(em, moduleBatch -> {
            for (ModuleModel candidate : moduleBatch) {
                candidate.setModel((open.dolphin.infomodel.IInfoModel) ModelUtils.decodeModule(candidate));
            }
            decodedBatches.add(new ArrayList<>(moduleBatch));
        });

        List<DocumentModel> result = support.loadDocuments(List.of(1001L),
                KarteDocumentBulkFetchSupport.DocumentLoadMode.DETAIL);

        assertThat(result).hasSize(1);
        DocumentModel readback = result.get(0);
        assertThat(readback.getId()).isEqualTo(1001L);
        assertThat(readback.getDocInfoModel().getDocId()).isEqualTo("DOC-ORDER-001");
        assertThat(readback.getModules()).hasSize(3);
        assertOrderModule(readback, 0, IInfoModel.ENTITY_MED_ORDER, "テスト処方", 1,
                "TEST-DRUG-001", "テスト薬剤セット", "テスト薬剤");
        assertOrderModule(readback, 1, IInfoModel.ENTITY_TREATMENT, "テスト処置", 2,
                "TEST-TREAT-001", "テスト処置セット", "テスト創傷処置");
        assertOrderModule(readback, 2, IInfoModel.ENTITY_RADIOLOGY_ORDER, "テスト放射線", 3,
                "TEST-RAD-001", "テスト放射線セット", "テストX線撮影");
        assertThat(decodedBatches).hasSize(1);
        assertThat(decodedBatches.get(0)).hasSize(3);
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

        document.addModule(buildOrderModule(IInfoModel.ENTITY_MED_ORDER, "テスト処方", 1,
                buildOrderBundle("テスト薬剤セット", "212", "処方", "1日1回",
                        "TEST-DRUG-001", "テスト薬剤", "錠", "テスト医師コメント")));
        document.addModule(buildOrderModule(IInfoModel.ENTITY_TREATMENT, "テスト処置", 2,
                buildOrderBundle("テスト処置セット", "400", "処置", null,
                        "TEST-TREAT-001", "テスト創傷処置", "回", "テスト処置コメント")));
        document.addModule(buildOrderModule(IInfoModel.ENTITY_RADIOLOGY_ORDER, "テスト放射線", 3,
                buildOrderBundle("テスト放射線セット", "700", "放射線", null,
                        "TEST-RAD-001", "テストX線撮影", "回", "テスト放射線コメント")));
        return document;
    }

    private static DocumentModel buildPersistedOrderDocument(long id, String docId, long parentPk) {
        DocumentModel document = buildOrderDocument(id, docId, parentPk);
        bindPersistedOrderModules(document);
        return document;
    }

    private static void bindPersistedOrderModules(DocumentModel document) {
        for (ModuleModel module : document.getModules()) {
            module.setDocumentModel(document);
            module.setKarteBean(document.getKarteBean());
            module.setUserModel(document.getUserModel());
            module.setStarted(document.getStarted());
            module.setConfirmed(document.getConfirmed());
            module.setRecorded(document.getRecorded());
            module.setStatus(document.getStatus());
            module.setLinkId(document.getLinkId());
            module.setLinkRelation(document.getLinkRelation());
            module.setBeanJson(ModelUtils.encodeModule(module));
        }
    }

    private static ModuleModel buildOrderModule(String entity, String stampName, int stampNumber, BundleDolphin bundle) {
        ModuleModel module = new ModuleModel();
        ModuleInfoBean moduleInfo = module.getModuleInfoBean();
        moduleInfo.setEntity(entity);
        moduleInfo.setStampName(stampName);
        moduleInfo.setStampRole(IInfoModel.ROLE_P);
        moduleInfo.setStampNumber(stampNumber);
        module.setModel(bundle);
        return module;
    }

    private static BundleDolphin buildOrderBundle(String orderName,
                                                  String classCode,
                                                  String className,
                                                  String admin,
                                                  String itemCode,
                                                  String itemName,
                                                  String unit,
                                                  String memo) {
        BundleDolphin bundle = new BundleDolphin();
        bundle.setOrderName(orderName);
        bundle.setClassCode(classCode);
        bundle.setClassCodeSystem("Claim007");
        bundle.setClassName(className);
        bundle.setAdmin(admin);
        bundle.setAdminCode("TEST-USAGE-001");
        bundle.setAdminCodeSystem("Claim007");
        bundle.setAdminMemo(memo);
        bundle.setBundleNumber("1");
        bundle.setMemo(memo);

        ClaimItem item = new ClaimItem();
        item.setCode(itemCode);
        item.setCodeSystem("Claim007");
        item.setName(itemName);
        item.setNumber("1");
        item.setUnit(unit);
        bundle.setClaimItem(new ClaimItem[]{item});
        return bundle;
    }

    private static void assertOrderModule(DocumentModel document,
                                          int index,
                                          String entity,
                                          String stampName,
                                          int stampNumber,
                                          String itemCode,
                                          String orderName,
                                          String itemName) {
        ModuleModel module = document.getModules().get(index);
        ModuleInfoBean info = module.getModuleInfoBean();

        assertThat(module.getDocumentModel()).isSameAs(document);
        assertThat(module.getKarteBean()).isSameAs(document.getKarteBean());
        assertThat(module.getUserModel()).isSameAs(document.getUserModel());
        assertThat(module.getStarted()).isEqualTo(document.getStarted());
        assertThat(module.getConfirmed()).isEqualTo(document.getConfirmed());
        assertThat(module.getRecorded()).isEqualTo(document.getRecorded());
        assertThat(module.getStatus()).isEqualTo(IInfoModel.STATUS_FINAL);
        assertThat(info.getEntity()).isEqualTo(entity);
        assertThat(info.getStampName()).isEqualTo(stampName);
        assertThat(info.getStampRole()).isEqualTo(IInfoModel.ROLE_P);
        assertThat(info.getStampNumber()).isEqualTo(stampNumber);
        assertThat(module.getBeanJson()).contains(itemCode, orderName, itemName);

        Object decoded = module.getModel() != null ? module.getModel() : ModelUtils.decodeModule(module);
        assertThat(decoded).isInstanceOf(BundleDolphin.class);
        BundleDolphin decodedBundle = (BundleDolphin) decoded;
        assertThat(decodedBundle.getOrderName()).isEqualTo(orderName);
        assertThat(decodedBundle.getClaimItem()).hasSize(1);
        assertThat(decodedBundle.getClaimItem()[0].getCode()).isEqualTo(itemCode);
        assertThat(decodedBundle.getClaimItem()[0].getName()).isEqualTo(itemName);
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
