package open.dolphin.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import open.dolphin.infomodel.AttachmentModel;
import open.dolphin.infomodel.BundleDolphin;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.ModuleInfoBean;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.SchemaModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.security.integrity.DocumentIntegrityService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class KarteServiceBeanGetDocumentsBulkFetchTest {

    private static final String QUERY_KARTE =
            "select k from KarteBean k join fetch k.patient p where p.id=:patientPk";
    private static final String QUERY_ALL_DOC_IDS =
            "select d.id from DocumentModel d where d.karte.id=:karteId and (d.status='F' or d.status='T') order by d.started desc, d.id desc";
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
    private static final String QUERY_SCHEMA_METADATA_BY_DOC_IDS =
            "select i.id, i.confirmed, i.started, i.ended, i.recorded, i.linkId, i.linkRelation, i.status, "
                    + "i.creator, i.karte, i.document.id, i.extRef, i.uri, i.digest "
                    + "from SchemaModel i where i.document.id in :ids order by i.document.id, i.id";
    private static final String QUERY_ATTACHMENT_METADATA_BY_DOC_IDS =
            "select a.id, a.confirmed, a.started, a.ended, a.recorded, a.linkId, a.linkRelation, a.status, "
                    + "a.creator, a.karte, a.document.id, a.fileName, a.contentType, a.contentSize, a.lastModified, "
                    + "a.digest, a.title, a.uri, a.extension, a.memo "
                    + "from AttachmentModel a where a.document.id in :ids order by a.document.id, a.id";

    private KarteServiceBean service;
    private EntityManager em;
    private DocumentIntegrityService documentIntegrityService;

    @BeforeEach
    void setUp() throws Exception {
        service = new KarteServiceBean();
        em = mock(EntityManager.class);
        documentIntegrityService = mock(DocumentIntegrityService.class);
        setField(service, "em", em);
        setField(service, "documentIntegrityService", documentIntegrityService);
    }

    @Test
    void getDocumentsUsesConstantQueriesAndPreservesRequestedOrder() {
        List<Long> requestedIds = new ArrayList<>(100);
        for (long id = 1; id <= 100; id++) {
            requestedIds.add(id);
        }

        List<DocumentModel> documents = new ArrayList<>(requestedIds.size());
        List<ModuleModel> modules = new ArrayList<>(requestedIds.size());
        List<SchemaModel> schemas = new ArrayList<>(requestedIds.size());
        List<AttachmentModel> attachments = new ArrayList<>(requestedIds.size());

        for (int index = requestedIds.size() - 1; index >= 0; index--) {
            long id = requestedIds.get(index);
            DocumentModel document = document(id);
            documents.add(document);
            modules.add(module(document, id));
            schemas.add(schema(document, id));
            attachments.add(attachment(document, id));
        }

        TypedQuery<DocumentModel> documentQuery = typedQuery(documents);
        TypedQuery<ModuleModel> moduleQuery = typedQuery(modules);
        TypedQuery<SchemaModel> schemaQuery = typedQuery(schemas);
        TypedQuery<AttachmentModel> attachmentQuery = typedQuery(attachments);

        when(em.createQuery(QUERY_DOCUMENT_BY_IDS, DocumentModel.class)).thenReturn(documentQuery);
        when(em.createQuery(QUERY_MODULES_BY_DOC_IDS, ModuleModel.class)).thenReturn(moduleQuery);
        when(em.createQuery(QUERY_SCHEMAS_BY_DOC_IDS, SchemaModel.class)).thenReturn(schemaQuery);
        when(em.createQuery(QUERY_ATTACHMENTS_BY_DOC_IDS, AttachmentModel.class)).thenReturn(attachmentQuery);

        List<DocumentModel> result = service.getDocuments(requestedIds);

        assertThat(result).hasSize(100);
        assertThat(result).extracting(DocumentModel::getId).containsExactlyElementsOf(requestedIds);
        assertThat(result.get(0).getModules()).hasSize(1);
        assertThat(result.get(0).getSchema()).hasSize(1);
        assertThat(result.get(0).getAttachment()).hasSize(1);
        assertThat(result.get(99).getModules()).hasSize(1);

        verify(em, times(1)).createQuery(QUERY_DOCUMENT_BY_IDS, DocumentModel.class);
        verify(em, times(1)).createQuery(QUERY_MODULES_BY_DOC_IDS, ModuleModel.class);
        verify(em, times(1)).createQuery(QUERY_SCHEMAS_BY_DOC_IDS, SchemaModel.class);
        verify(em, times(1)).createQuery(QUERY_ATTACHMENTS_BY_DOC_IDS, AttachmentModel.class);
        verify(documentQuery).setParameter("ids", requestedIds);
        verify(moduleQuery).setParameter("ids", requestedIds);
        verify(schemaQuery).setParameter("ids", requestedIds);
        verify(attachmentQuery).setParameter("ids", requestedIds);
        verify(documentIntegrityService, times(100)).verifyDocumentOnRead(any(DocumentModel.class));
    }

    @Test
    void getDocumentsAttachmentLightLoadsMetadataWithoutModuleQuery() {
        List<Long> requestedIds = List.of(10L, 20L);
        List<DocumentModel> documents = List.of(document(20L), document(10L));
        TypedQuery<DocumentModel> documentQuery = typedQuery(documents);
        TypedQuery<SchemaModel> schemaQuery = typedQuery(List.of(
                schema(documents.get(1), 1001L),
                schema(documents.get(0), 2001L)));
        TypedQuery<Object[]> attachmentMetadataQuery = typedQuery(List.of(
                attachmentMetadataRow(documents.get(1), 3001L),
                attachmentMetadataRow(documents.get(0), 4001L)));

        when(em.createQuery(QUERY_DOCUMENT_BY_IDS, DocumentModel.class)).thenReturn(documentQuery);
        when(em.createQuery(QUERY_SCHEMAS_BY_DOC_IDS, SchemaModel.class)).thenReturn(schemaQuery);
        when(em.createQuery(QUERY_ATTACHMENT_METADATA_BY_DOC_IDS, Object[].class)).thenReturn(attachmentMetadataQuery);

        List<DocumentModel> result = service.getDocumentsAttachmentLight(requestedIds);

        assertThat(result).extracting(DocumentModel::getId).containsExactlyElementsOf(requestedIds);
        assertThat(result.get(0).getModules()).isEmpty();
        assertThat(result.get(0).getSchema()).hasSize(1);
        assertThat(result.get(0).getAttachment()).hasSize(1);
        assertThat(result.get(0).getAttachment().get(0).getContentBytes()).isNull();

        verify(em).createQuery(QUERY_DOCUMENT_BY_IDS, DocumentModel.class);
        verify(em).createQuery(QUERY_SCHEMAS_BY_DOC_IDS, SchemaModel.class);
        verify(em).createQuery(QUERY_ATTACHMENT_METADATA_BY_DOC_IDS, Object[].class);
        verify(em, never()).createQuery(QUERY_MODULES_BY_DOC_IDS, ModuleModel.class);
        verify(em, never()).createQuery(QUERY_SCHEMA_METADATA_BY_DOC_IDS, Object[].class);
        verify(schemaQuery).setParameter("ids", requestedIds);
        verify(attachmentMetadataQuery).setParameter("ids", requestedIds);
        verify(documentIntegrityService, times(2)).verifyDocumentOnRead(any(DocumentModel.class));
    }

    @Test
    void getAllDocumentAppliesPagingAndSkipsBinaryPayloads() {
        KarteBean karte = karte(500L);
        TypedQuery<KarteBean> karteQuery = typedQuery(List.of(karte));
        TypedQuery<Long> docIdQuery = typedLongQuery(List.of(20L, 10L));

        List<DocumentModel> documents = List.of(document(20L), document(10L));
        TypedQuery<DocumentModel> documentQuery = typedQuery(documents);
        TypedQuery<Object[]> schemaMetadataQuery = typedQuery(List.of(
                schemaMetadataRow(documents.get(1), 1001L),
                schemaMetadataRow(documents.get(0), 2001L)));
        TypedQuery<Object[]> attachmentMetadataQuery = typedQuery(List.of(
                attachmentMetadataRow(documents.get(1), 3001L),
                attachmentMetadataRow(documents.get(0), 4001L)));

        when(em.createQuery(QUERY_KARTE, KarteBean.class)).thenReturn(karteQuery);
        when(em.createQuery(QUERY_ALL_DOC_IDS, Long.class)).thenReturn(docIdQuery);
        when(em.createQuery(QUERY_DOCUMENT_BY_IDS, DocumentModel.class)).thenReturn(documentQuery);
        when(em.createQuery(QUERY_SCHEMA_METADATA_BY_DOC_IDS, Object[].class)).thenReturn(schemaMetadataQuery);
        when(em.createQuery(QUERY_ATTACHMENT_METADATA_BY_DOC_IDS, Object[].class)).thenReturn(attachmentMetadataQuery);

        List<DocumentModel> result = service.getAllDocument(42L, 5, 2);

        assertThat(result).extracting(DocumentModel::getId).containsExactly(20L, 10L);
        assertThat(result.get(0).getModules()).isEmpty();
        assertThat(result.get(0).getSchema()).hasSize(1);
        assertThat(result.get(0).getSchema().get(0).getImageBytes()).isNull();
        assertThat(result.get(0).getAttachment()).hasSize(1);
        assertThat(result.get(0).getAttachment().get(0).getContentBytes()).isNull();

        verify(karteQuery).setParameter("patientPk", 42L);
        verify(karteQuery).setMaxResults(1);
        verify(docIdQuery).setParameter("karteId", karte.getId());
        verify(docIdQuery).setFirstResult(5);
        verify(docIdQuery).setMaxResults(2);
        verify(em, never()).createQuery(QUERY_MODULES_BY_DOC_IDS, ModuleModel.class);
        verify(em, never()).createQuery(QUERY_SCHEMAS_BY_DOC_IDS, SchemaModel.class);
        verify(em, never()).createQuery(QUERY_ATTACHMENTS_BY_DOC_IDS, AttachmentModel.class);
        verify(documentIntegrityService, never()).verifyDocumentOnRead(any(DocumentModel.class));
    }

    private static DocumentModel document(long id) {
        DocumentModel document = new DocumentModel();
        document.setId(id);
        document.setKarteBean(karte(id));
        document.setUserModel(user(id));
        return document;
    }

    private static ModuleModel module(DocumentModel document, long id) {
        ModuleModel module = new ModuleModel();
        module.setId(id * 10);
        module.setDocumentModel(document);
        module.setKarteBean(document.getKarteBean());
        module.setUserModel(document.getUserModel());
        module.setModel(new BundleDolphin());
        ModuleInfoBean info = new ModuleInfoBean();
        info.setEntity("medOrder");
        info.setStampName("stamp-" + id);
        module.setModuleInfoBean(info);
        module.setBeanJson("{\"@class\":\"open.dolphin.infomodel.BundleDolphin\"}");
        return module;
    }

    private static SchemaModel schema(DocumentModel document, long id) {
        SchemaModel schema = new SchemaModel();
        schema.setId(id * 100);
        schema.setDocumentModel(document);
        schema.setKarteBean(document.getKarteBean());
        schema.setUserModel(document.getUserModel());
        schema.setUri("s3://bucket/images/" + id + ".png");
        schema.setDigest("sha256:image-" + id);
        return schema;
    }

    private static AttachmentModel attachment(DocumentModel document, long id) {
        AttachmentModel attachment = new AttachmentModel();
        attachment.setId(id * 1000);
        attachment.setDocumentModel(document);
        attachment.setKarteBean(document.getKarteBean());
        attachment.setUserModel(document.getUserModel());
        return attachment;
    }

    private static Object[] attachmentMetadataRow(DocumentModel document, long id) {
        Date timestamp = new Date(1_709_251_200_000L + id);
        return new Object[] {
                id,
                timestamp,
                timestamp,
                timestamp,
                timestamp,
                0L,
                null,
                "F",
                document.getUserModel(),
                document.getKarteBean(),
                document.getId(),
                "attachment-" + id + ".pdf",
                "application/pdf",
                1024L,
                1_773_139_620_000L,
                "sha256:attachment-" + id,
                "title-" + id,
                "s3://bucket/attachments/" + id + ".pdf",
                ".pdf",
                "memo-" + id
        };
    }

    private static Object[] schemaMetadataRow(DocumentModel document, long id) {
        Date timestamp = new Date(1_709_251_200_000L + id);
        return new Object[] {
                id,
                timestamp,
                timestamp,
                timestamp,
                timestamp,
                0L,
                null,
                "F",
                document.getUserModel(),
                document.getKarteBean(),
                document.getId(),
                null,
                "s3://bucket/images/" + id + ".png",
                "sha256:image-" + id
        };
    }

    private static KarteBean karte(long id) {
        KarteBean karte = new KarteBean();
        karte.setId(id + 10_000);
        return karte;
    }

    private static UserModel user(long id) {
        UserModel user = new UserModel();
        user.setId(id + 20_000);
        return user;
    }

    @SuppressWarnings("unchecked")
    private static <T> TypedQuery<T> typedQuery(List<T> results) {
        TypedQuery<T> query = mock(TypedQuery.class);
        when(query.setParameter(anyString(), any())).thenReturn(query);
        when(query.setFirstResult(anyInt())).thenReturn(query);
        when(query.setMaxResults(anyInt())).thenReturn(query);
        when(query.getResultList()).thenReturn(new ArrayList<>(results));
        return query;
    }

    @SuppressWarnings("unchecked")
    private static TypedQuery<Long> typedLongQuery(List<Long> results) {
        TypedQuery<Long> query = mock(TypedQuery.class);
        when(query.setParameter(eq("karteId"), any())).thenReturn(query);
        when(query.setFirstResult(any(Integer.class))).thenReturn(query);
        when(query.setMaxResults(any(Integer.class))).thenReturn(query);
        when(query.getResultList()).thenReturn(new ArrayList<>(results));
        return query;
    }

    private static void setField(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }
}
