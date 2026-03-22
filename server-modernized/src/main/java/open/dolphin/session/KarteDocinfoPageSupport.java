package open.dolphin.session;

import jakarta.persistence.EntityManager;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.function.Function;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.KarteBean;

final class KarteDocinfoPageSupport {

    static final int DEFAULT_DOCINFO_PAGE_SIZE = 50;
    static final int MAX_DOCINFO_PAGE_SIZE = 200;

    private static final String PATIENT_PK = "patientPk";
    private static final String KARTE_ID = "karteId";
    private static final String QUERY_KARTE =
            "select k from KarteBean k join fetch k.patient p where p.id=:patientPk";
    private static final String QUERY_PAGED_DOC_IDS =
            "select d.id from DocumentModel d where d.karte.id=:karteId and (d.status='F' or d.status='T') "
                    + "order by d.started desc, d.id desc";

    private final EntityManager em;
    private final Function<List<Long>, List<DocumentModel>> revisionLightLoader;

    KarteDocinfoPageSupport(EntityManager em, Function<List<Long>, List<DocumentModel>> revisionLightLoader) {
        this.em = em;
        this.revisionLightLoader = revisionLightLoader;
    }

    List<DocumentModel> loadAllDocuments(long patientPk, int offset, int limit) {
        DocinfoPageRequest pageRequest = new DocinfoPageRequest(
                patientPk,
                normalizeOffset(offset),
                normalizePageSize(limit));
        KarteBean karte = findPrimaryKarte(pageRequest.patientPk());
        if (karte == null) {
            return new ArrayList<>();
        }
        List<Long> docIds = findPagedDocumentIds(karte.getId(), pageRequest.offset(), pageRequest.limit());
        return revisionLightLoader.apply(docIds);
    }

    static int normalizeOffset(int offset) {
        return Math.max(offset, 0);
    }

    static int normalizePageSize(int limit) {
        if (limit <= 0) {
            return DEFAULT_DOCINFO_PAGE_SIZE;
        }
        return Math.min(limit, MAX_DOCINFO_PAGE_SIZE);
    }

    private KarteBean findPrimaryKarte(long patientPk) {
        List<KarteBean> kartes = em.createQuery(QUERY_KARTE, KarteBean.class)
                .setParameter(PATIENT_PK, patientPk)
                .setMaxResults(1)
                .getResultList();
        if (kartes == null || kartes.isEmpty()) {
            return null;
        }
        return kartes.get(0);
    }

    private List<Long> findPagedDocumentIds(long karteId, int offset, int limit) {
        if (karteId <= 0) {
            return Collections.emptyList();
        }
        return em.createQuery(QUERY_PAGED_DOC_IDS, Long.class)
                .setParameter(KARTE_ID, karteId)
                .setFirstResult(offset)
                .setMaxResults(limit)
                .getResultList();
    }

    private record DocinfoPageRequest(long patientPk, int offset, int limit) {
    }
}
