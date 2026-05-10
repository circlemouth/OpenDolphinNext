package open.dolphin.session;

import java.util.Date;
import java.util.List;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import open.dolphin.infomodel.RegisteredDiagnosisModel;

@ApplicationScoped
@Transactional
public class KarteDiagnosisService {

    private static final String KARTE_ID = "karteId";
    private static final String FROM_DATE = "fromDate";

    private static final String QUERY_DIAGNOSIS_BY_KARTE_DATE =
            "from RegisteredDiagnosisModel r where r.karte.id=:karteId and r.started >= :fromDate";
    private static final String QUERY_DIAGNOSIS_BY_KARTE_DATE_ACTIVEONLY =
            "from RegisteredDiagnosisModel r where r.karte.id=:karteId and r.started >= :fromDate and r.ended is NULL";
    private static final String QUERY_DIAGNOSIS_BY_KARTE =
            "from RegisteredDiagnosisModel r where r.karte.id=:karteId";
    private static final String QUERY_DIAGNOSIS_BY_KARTE_ACTIVEONLY =
            "from RegisteredDiagnosisModel r where r.karte.id=:karteId and r.ended is NULL";
    @PersistenceContext
    private EntityManager em;

    public List<RegisteredDiagnosisModel> getDiagnosis(long karteId, Date fromDate, boolean activeOnly) {
        if (fromDate != null) {
            String query = activeOnly ? QUERY_DIAGNOSIS_BY_KARTE_DATE_ACTIVEONLY : QUERY_DIAGNOSIS_BY_KARTE_DATE;
            return em.createQuery(query, RegisteredDiagnosisModel.class)
                    .setParameter(KARTE_ID, karteId)
                    .setParameter(FROM_DATE, fromDate)
                    .getResultList();
        }

        String query = activeOnly ? QUERY_DIAGNOSIS_BY_KARTE_ACTIVEONLY : QUERY_DIAGNOSIS_BY_KARTE;
        return em.createQuery(query, RegisteredDiagnosisModel.class)
                .setParameter(KARTE_ID, karteId)
                .getResultList();
    }
}
