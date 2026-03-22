package open.dolphin.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.TypedQuery;
import java.util.Date;
import java.util.List;
import open.dolphin.infomodel.DocInfoModel;
import open.dolphin.storage.attachment.AttachmentStorageManager;
import open.dolphin.storage.image.ImageStorageManager;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

class KarteLegacyArtifactSupportTest {

    private static final String QUERY_DOCUMENT_HEADERS =
            "select d.id, d.linkId, d.confirmed, d.started, d.status, d.docInfo "
                    + "from DocumentModel d where d.karte.id=:karteId and d.started >= :fromDate and (d.status='F' or d.status='T') "
                    + "order by d.started desc, d.id desc";
    private static final String QUERY_FACILITY_BY_DOC_ID =
            "select d.karte.patient.facilityId from DocumentModel d where d.id=:id";

    @Test
    void getDocumentListMapsMetadataRowsAndSkipsBrokenRows() {
        EntityManager em = mock(EntityManager.class);
        KarteLegacyArtifactSupport support = support(em);

        DocInfoModel info = new DocInfoModel();
        Date confirmed = new Date(1_710_000_000_000L);
        Date started = new Date(1_710_000_100_000L);
        TypedQuery<Object[]> query = typedQuery(List.of(
                new Object[]{10L, 5L, confirmed, started, "F", info},
                new Object[]{"broken"}));
        when(em.createQuery(QUERY_DOCUMENT_HEADERS, Object[].class)).thenReturn(query);

        List<DocInfoModel> result = support.getDocumentList(99L, confirmed, false);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getDocPk()).isEqualTo(10L);
        assertThat(result.get(0).getParentPk()).isEqualTo(5L);
        assertThat(result.get(0).getConfirmDate()).isEqualTo(confirmed);
        assertThat(result.get(0).getFirstConfirmDate()).isEqualTo(started);
        assertThat(result.get(0).getStatus()).isEqualTo("F");
    }

    @Test
    void findFacilityIdByDocIdReturnsNullWhenRecordIsMissing() {
        EntityManager em = mock(EntityManager.class);
        KarteLegacyArtifactSupport support = support(em);
        TypedQuery<String> query = mock(TypedQuery.class);

        when(em.createQuery(QUERY_FACILITY_BY_DOC_ID, String.class)).thenReturn(query);
        when(query.setParameter(anyString(), any())).thenReturn(query);
        when(query.getSingleResult()).thenThrow(new NoResultException());

        assertThat(support.findFacilityIdByDocId(100L)).isNull();
        assertThat(support.findFacilityIdByDocId(0L)).isNull();
    }

    @SuppressWarnings("unchecked")
    private static <T> TypedQuery<T> typedQuery(List<T> results) {
        TypedQuery<T> query = mock(TypedQuery.class);
        when(query.setParameter(anyString(), any())).thenReturn(query);
        when(query.setFirstResult(anyInt())).thenReturn(query);
        when(query.setMaxResults(anyInt())).thenReturn(query);
        when(query.getResultList()).thenReturn(results);
        return query;
    }

    private static KarteLegacyArtifactSupport support(EntityManager em) {
        return new KarteLegacyArtifactSupport(
                em,
                mock(AttachmentStorageManager.class),
                mock(ImageStorageManager.class),
                modules -> {},
                LoggerFactory.getLogger(KarteLegacyArtifactSupportTest.class));
    }
}
