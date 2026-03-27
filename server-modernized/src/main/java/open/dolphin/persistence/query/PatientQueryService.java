package open.dolphin.persistence.query;

import jakarta.persistence.EntityManager;
import open.dolphin.infomodel.KarteBean;

import java.util.List;
import java.util.function.Supplier;

/**
 * 患者軸の参照クエリを集約する薄い query service。
 */
public class PatientQueryService {

    private static final String QUERY_KARTE_BY_FID_PID =
            "select k from KarteBean k join fetch k.patient p where p.facilityId=:fid and p.patientId=:pid";
    private static final String QUERY_KARTE_BY_PATIENT_PK =
            "select k from KarteBean k join fetch k.patient p where p.id=:patientPk";

    private final Supplier<EntityManager> emProvider;

    public PatientQueryService(Supplier<EntityManager> emProvider) {
        this.emProvider = emProvider;
    }

    public KarteBean findSingleKarteByFacilityAndPatientId(String facilityId, String patientId) {
        List<KarteBean> kartes = emProvider.get().createQuery(QUERY_KARTE_BY_FID_PID, KarteBean.class)
                .setParameter("fid", facilityId)
                .setParameter("pid", patientId)
                .setMaxResults(1)
                .getResultList();
        return kartes == null || kartes.isEmpty() ? null : kartes.get(0);
    }

    public KarteBean findSingleKarteByPatientPk(long patientPk) {
        List<KarteBean> kartes = emProvider.get().createQuery(QUERY_KARTE_BY_PATIENT_PK, KarteBean.class)
                .setParameter("patientPk", patientPk)
                .setMaxResults(1)
                .getResultList();
        return kartes == null || kartes.isEmpty() ? null : kartes.get(0);
    }
}
