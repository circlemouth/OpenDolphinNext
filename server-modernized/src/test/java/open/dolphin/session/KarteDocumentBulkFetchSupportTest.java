package open.dolphin.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
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
import org.junit.jupiter.api.Test;

class KarteDocumentBulkFetchSupportTest {

    private static final String QUERY_DOCUMENT_BY_IDS =
            "FROM DocumentModel d WHERE d.id IN (:ids) ORDER BY d.id";
    private static final String QUERY_MODULES_BY_DOC_IDS =
            "FROM ModuleModel m JOIN FETCH m.document d WHERE d.id IN (:ids) ORDER BY d.id,m.moduleInfo.stampNumber";
    private static final String QUERY_SCHEMA_METADATA_BY_DOC_IDS =
            "select i.id, i.confirmed, i.started, i.ended, i.recorded, i.linkId, i.linkRelation, i.status, "
                    + "i.creator, i.karte, i.document.id, i.extRef, i.uri, i.digest "
                    + "from SchemaModel i where i.document.id in :ids order by i.document.id, i.id";
    private static final String QUERY_ATTACHMENT_METADATA_BY_DOC_IDS =
            "select a.id, a.confirmed, a.started, a.ended, a.recorded, a.linkId, a.linkRelation, a.status, "
                    + "a.creator, a.karte, a.document.id, a.fileName, a.contentType, a.contentSize, a.lastModified, "
                    + "a.digest, a.title, a.uri, a.extension, a.memo "
                    + "from AttachmentModel a where a.document.id in :ids order by a.document.id, a.id";

    @Test
    void revisionLightNormalizesIdsAndSkipsUnmatchedMetadataRows() {
        EntityManager em = mock(EntityManager.class);
        Collection<ModuleModel> decodedModules = new ArrayList<>();
        KarteDocumentBulkFetchSupport support = new KarteDocumentBulkFetchSupport(em, decodedModules::addAll);

        List<Long> requestedIds = Arrays.asList(20L, null, 10L, 20L, -1L);
        List<DocumentModel> documents = List.of(document(10L), document(20L));
        TypedQuery<DocumentModel> documentQuery = typedQuery(documents);
        TypedQuery<Object[]> schemaMetadataQuery = typedQuery(List.of(
                schemaMetadataRow(documents.get(1), 2001L),
                schemaMetadataRow(document(999L), 9999L)));
        TypedQuery<Object[]> attachmentMetadataQuery = typedQuery(List.of(
                attachmentMetadataRow(documents.get(0), 1001L),
                new Object[]{"broken"}));

        when(em.createQuery(QUERY_DOCUMENT_BY_IDS, DocumentModel.class)).thenReturn(documentQuery);
        when(em.createQuery(QUERY_SCHEMA_METADATA_BY_DOC_IDS, Object[].class)).thenReturn(schemaMetadataQuery);
        when(em.createQuery(QUERY_ATTACHMENT_METADATA_BY_DOC_IDS, Object[].class)).thenReturn(attachmentMetadataQuery);

        List<DocumentModel> result =
                support.loadDocuments(requestedIds, KarteDocumentBulkFetchSupport.DocumentLoadMode.REVISION_LIGHT);

        assertThat(result).extracting(DocumentModel::getId).containsExactly(20L, 10L);
        assertThat(result.get(0).getModules()).isEmpty();
        assertThat(result.get(0).getSchema()).hasSize(1);
        assertThat(result.get(0).getAttachment()).isEmpty();
        assertThat(result.get(1).getSchema()).isEmpty();
        assertThat(result.get(1).getAttachment()).hasSize(1);
        assertThat(result.get(1).getAttachment().get(0).getContentBytes()).isNull();
        assertThat(decodedModules).isEmpty();

        verify(em, never()).createQuery(QUERY_MODULES_BY_DOC_IDS, ModuleModel.class);
        verify(documentQuery).setParameter("ids", List.of(20L, 10L));
        verify(schemaMetadataQuery).setParameter("ids", List.of(20L, 10L));
        verify(attachmentMetadataQuery).setParameter("ids", List.of(20L, 10L));
    }

    @Test
    void detailLoadsModulesAndDecodesPayloadsOncePerDocumentGroup() {
        EntityManager em = mock(EntityManager.class);
        List<Collection<ModuleModel>> decodedBatches = new ArrayList<>();
        KarteDocumentBulkFetchSupport support = new KarteDocumentBulkFetchSupport(
                em,
                modules -> decodedBatches.add(new ArrayList<>(modules)));

        List<Long> requestedIds = List.of(5L, 4L);
        List<DocumentModel> documents = List.of(document(4L), document(5L));
        List<ModuleModel> modules = List.of(module(documents.get(0), 40L), module(documents.get(1), 50L));
        TypedQuery<DocumentModel> documentQuery = typedQuery(documents);
        TypedQuery<ModuleModel> moduleQuery = typedQuery(modules);
        TypedQuery<SchemaModel> schemaQuery = typedQuery(List.of());
        TypedQuery<AttachmentModel> attachmentQuery = typedQuery(List.of());

        when(em.createQuery(QUERY_DOCUMENT_BY_IDS, DocumentModel.class)).thenReturn(documentQuery);
        when(em.createQuery(QUERY_MODULES_BY_DOC_IDS, ModuleModel.class)).thenReturn(moduleQuery);
        when(em.createQuery(
                "select i from SchemaModel i left join fetch i.karte left join fetch i.creator where i.document.id in :ids order by i.document.id, i.id",
                SchemaModel.class)).thenReturn(schemaQuery);
        when(em.createQuery(
                "select a from AttachmentModel a left join fetch a.karte left join fetch a.creator where a.document.id in :ids order by a.document.id, a.id",
                AttachmentModel.class)).thenReturn(attachmentQuery);

        List<DocumentModel> result = support.loadDocuments(requestedIds, KarteDocumentBulkFetchSupport.DocumentLoadMode.DETAIL);

        assertThat(result).extracting(DocumentModel::getId).containsExactly(5L, 4L);
        assertThat(result.get(0).getModules()).hasSize(1);
        assertThat(result.get(1).getModules()).hasSize(1);
        assertThat(decodedBatches).hasSize(2);
    }

    @SuppressWarnings("unchecked")
    private static <T> TypedQuery<T> typedQuery(List<T> result) {
        TypedQuery<T> query = mock(TypedQuery.class);
        when(query.setParameter(any(String.class), any())).thenReturn(query);
        when(query.getResultList()).thenReturn(result);
        return query;
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
        module.setId(id);
        module.setDocumentModel(document);
        module.setKarteBean(document.getKarteBean());
        module.setUserModel(document.getUserModel());
        module.setModel(new BundleDolphin());
        ModuleInfoBean info = new ModuleInfoBean();
        info.setEntity("medOrder");
        module.setModuleInfoBean(info);
        return module;
    }

    private static Object[] schemaMetadataRow(DocumentModel document, long id) {
        Date timestamp = new Date(1_709_251_200_000L + id);
        return new Object[]{
                id, timestamp, timestamp, null, timestamp, 0L, "related", "F",
                user(id), karte(id), document.getId(), null, "schema:" + id, "sha256:schema-" + id
        };
    }

    private static Object[] attachmentMetadataRow(DocumentModel document, long id) {
        Date timestamp = new Date(1_709_251_200_000L + id);
        return new Object[]{
                id, timestamp, timestamp, null, timestamp, 0L, "related", "F",
                user(id), karte(id), document.getId(), "file-" + id + ".pdf", "application/pdf", 128L, 64L,
                "sha256:attachment-" + id, "title-" + id, "attachment:" + id, "pdf", "memo-" + id
        };
    }

    private static KarteBean karte(long id) {
        KarteBean karte = new KarteBean();
        karte.setId(id * 10);
        return karte;
    }

    private static UserModel user(long id) {
        UserModel user = new UserModel();
        user.setId(id * 100);
        return user;
    }
}
