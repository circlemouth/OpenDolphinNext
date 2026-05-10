package open.dolphin.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.lang.reflect.Field;
import java.util.Date;
import open.dolphin.infomodel.DocInfoModel;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.storage.attachment.AttachmentStorageManager;
import open.dolphin.storage.image.ImageStorageManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class KarteServiceBeanRevisionBulkUpdateTest {

    private static final String QUERY_MARK_DOCUMENT_MODIFIED =
            "update DocumentModel d set d.ended=:ended, d.status=:status where d.id=:id";
    private static final String QUERY_MARK_MODULES_MODIFIED =
            "update ModuleModel m set m.ended=:ended, m.status=:status where m.document.id=:id";
    private static final String QUERY_MARK_SCHEMAS_MODIFIED =
            "update SchemaModel s set s.ended=:ended, s.status=:status where s.document.id=:id";
    private static final String QUERY_MARK_ATTACHMENTS_MODIFIED =
            "update AttachmentModel a set a.ended=:ended, a.status=:status where a.document.id=:id";
    private static final String QUERY_MODULE_BY_DOC_ID =
            "from ModuleModel m where m.document.id=:id order by m.id";
    private static final String QUERY_SCHEMA_BY_DOC_ID =
            "from SchemaModel i where i.document.id=:id order by i.id";
    private static final String QUERY_ATTACHMENT_BY_DOC_ID =
            "from AttachmentModel a where a.document.id=:id order by a.id";

    private KarteServiceBean service;
    private EntityManager em;
    private Query documentUpdateQuery;
    private Query moduleUpdateQuery;
    private Query schemaUpdateQuery;
    private Query attachmentUpdateQuery;
    private KarteDocumentWriteService karteDocumentWriteService;

    @BeforeEach
    void setUp() throws Exception {
        service = new KarteServiceBean();
        em = mock(EntityManager.class);
        documentUpdateQuery = bulkQuery();
        moduleUpdateQuery = bulkQuery();
        schemaUpdateQuery = bulkQuery();
        attachmentUpdateQuery = bulkQuery();
        karteDocumentWriteService = new KarteDocumentWriteService();

        setField(service, "em", em);
        AttachmentStorageManager attachmentStorageManager = mock(AttachmentStorageManager.class);
        ImageStorageManager imageStorageManager = mock(ImageStorageManager.class);
        setField(service, "attachmentStorageManager", attachmentStorageManager);
        setField(service, "imageStorageManager", imageStorageManager);
        setField(karteDocumentWriteService, "em", em);
        setField(karteDocumentWriteService, "attachmentStorageManager", attachmentStorageManager);
        setField(karteDocumentWriteService, "imageStorageManager", imageStorageManager);
        setField(service, "karteDocumentWriteService", karteDocumentWriteService);

        when(em.createQuery(QUERY_MARK_DOCUMENT_MODIFIED)).thenReturn(documentUpdateQuery);
        when(em.createQuery(QUERY_MARK_MODULES_MODIFIED)).thenReturn(moduleUpdateQuery);
        when(em.createQuery(QUERY_MARK_SCHEMAS_MODIFIED)).thenReturn(schemaUpdateQuery);
        when(em.createQuery(QUERY_MARK_ATTACHMENTS_MODIFIED)).thenReturn(attachmentUpdateQuery);
        Query nativeQuery = bulkQuery();
        when(em.createNativeQuery(any(String.class))).thenReturn(nativeQuery);

        doAnswer(invocation -> {
            DocumentModel document = invocation.getArgument(0);
            document.setId(200L);
            return null;
        }).when(em).persist(any(DocumentModel.class));
    }

    @Test
    void addDocumentUsesBulkRevisionUpdatesWithoutLoadingOldChildren() {
        Date confirmed = new Date(1_709_251_200_000L);
        DocumentModel document = new DocumentModel();
        document.setConfirmed(confirmed);
        document.setRecorded(confirmed);
        document.setStarted(confirmed);
        document.setStatus(IInfoModel.STATUS_FINAL);
        DocInfoModel info = document.getDocInfoModel();
        info.setParentPk(44L);
        info.setDocId("DOC-200");

        long createdId = service.addDocument(document);

        assertThat(createdId).isEqualTo(200L);
        verify(em, never()).find(DocumentModel.class, 44L);
        verify(em, never()).createQuery(QUERY_MODULE_BY_DOC_ID);
        verify(em, never()).createQuery(QUERY_SCHEMA_BY_DOC_ID);
        verify(em, never()).createQuery(QUERY_ATTACHMENT_BY_DOC_ID);

        verify(documentUpdateQuery).setParameter("ended", confirmed);
        verify(documentUpdateQuery).setParameter("status", IInfoModel.STATUS_MODIFIED);
        verify(documentUpdateQuery).setParameter("id", 44L);
        verify(documentUpdateQuery).executeUpdate();

        verify(moduleUpdateQuery).setParameter("ended", confirmed);
        verify(moduleUpdateQuery).setParameter("status", IInfoModel.STATUS_MODIFIED);
        verify(moduleUpdateQuery).setParameter("id", 44L);
        verify(moduleUpdateQuery).executeUpdate();

        verify(schemaUpdateQuery).setParameter("ended", confirmed);
        verify(schemaUpdateQuery).setParameter("status", IInfoModel.STATUS_MODIFIED);
        verify(schemaUpdateQuery).setParameter("id", 44L);
        verify(schemaUpdateQuery).executeUpdate();

        verify(attachmentUpdateQuery).setParameter("ended", confirmed);
        verify(attachmentUpdateQuery).setParameter("status", IInfoModel.STATUS_MODIFIED);
        verify(attachmentUpdateQuery).setParameter("id", 44L);
        verify(attachmentUpdateQuery).executeUpdate();
    }

    @SuppressWarnings("unchecked")
    private static Query bulkQuery() {
        Query query = mock(Query.class);
        when(query.setParameter(any(String.class), any())).thenReturn(query);
        when(query.executeUpdate()).thenReturn(1);
        return query;
    }

    private static void setField(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }
}
