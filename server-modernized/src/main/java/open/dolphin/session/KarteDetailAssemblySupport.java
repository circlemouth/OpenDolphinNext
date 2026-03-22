package open.dolphin.session;

import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import open.dolphin.infomodel.AllergyModel;
import open.dolphin.infomodel.DocInfoModel;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.ObservationModel;
import open.dolphin.infomodel.PatientMemoModel;
import open.dolphin.infomodel.PatientVisitModel;
import open.dolphin.infomodel.PhysicalModel;

final class KarteDetailAssemblySupport {

    private static final String PATIENT_PK = "patientPk";
    private static final String KARTE_ID = "karteId";
    private static final String FROM_DATE = "fromDate";

    private static final String QUERY_RELEVANT_OBSERVATIONS =
            "from ObservationModel o where o.karte.id=:karteId and (o.observation='Allergy' "
                    + "or (o.observation='PhysicalExam' and o.phenomenon in ('bodyHeight','bodyWeight')))";
    private static final String QUERY_PATIENT_VISIT =
            "from PatientVisitModel p where p.patient.id=:patientPk and p.pvtDate >= :fromDate and p.status!=64";
    private static final String QUERY_DOC_INFO =
            "from DocumentModel d where d.karte.id=:karteId and d.started >= :fromDate and (d.status='F' or d.status='T')";
    private static final String QUERY_PATIENT_MEMO = "from PatientMemoModel p where p.karte.id=:karteId";
    private static final String QUERY_LATEST_DOC_STARTED =
            "select d.started from DocumentModel d "
                    + "where d.karte.id = :karteId and (d.status = 'F' or d.status = 'T') "
                    + "order by d.started desc";

    private final EntityManager em;

    KarteDetailAssemblySupport(EntityManager em) {
        this.em = em;
    }

    KarteBean populate(KarteBean karte, Date fromDate) {
        if (karte == null) {
            return null;
        }

        long karteId = karte.getId();
        long patientPk = karte.getPatientModel() != null ? karte.getPatientModel().getId() : 0L;

        List<ObservationModel> observations = em.createQuery(QUERY_RELEVANT_OBSERVATIONS, ObservationModel.class)
                .setParameter(KARTE_ID, karteId)
                .getResultList();
        List<AllergyModel> allergies = mapAllergies(observations);
        if (!allergies.isEmpty()) {
            karte.setAllergies(allergies);
        }
        List<PhysicalModel> heights = mapPhysicals(observations, "bodyHeight");
        if (!heights.isEmpty()) {
            karte.setHeights(heights);
        }
        List<PhysicalModel> weights = mapPhysicals(observations, "bodyWeight");
        if (!weights.isEmpty()) {
            karte.setWeights(weights);
        }

        if (patientPk > 0L) {
            List<PatientVisitModel> latestVisits = em.createQuery(QUERY_PATIENT_VISIT, PatientVisitModel.class)
                    .setParameter(PATIENT_PK, patientPk)
                    .setParameter(FROM_DATE, toLocalDateTime(fromDate))
                    .getResultList();
            if (!latestVisits.isEmpty()) {
                List<String> visits = new ArrayList<>(latestVisits.size());
                for (PatientVisitModel bean : latestVisits) {
                    visits.add(bean.getPvtDate().toString());
                }
                karte.setPatientVisits(visits);
            }
        }

        List<DocumentModel> documents = em.createQuery(QUERY_DOC_INFO, DocumentModel.class)
                .setParameter(KARTE_ID, karteId)
                .setParameter(FROM_DATE, fromDate)
                .getResultList();
        if (!documents.isEmpty()) {
            List<DocInfoModel> docInfo = new ArrayList<>(documents.size());
            for (DocumentModel docBean : documents) {
                docBean.toDetuch();
                docInfo.add(docBean.getDocInfoModel());
            }
            karte.setDocInfoList(docInfo);
        }

        List<PatientMemoModel> memo = em.createQuery(QUERY_PATIENT_MEMO, PatientMemoModel.class)
                .setParameter(KARTE_ID, karteId)
                .getResultList();
        if (!memo.isEmpty()) {
            karte.setMemoList(memo);
        }

        try {
            karte.setLastDocDate(findLatestDocumentStarted(karteId));
        } catch (NoResultException ignored) {
            // keep compatibility with the previous behavior when no final documents exist
        }
        return karte;
    }

    private List<AllergyModel> mapAllergies(List<ObservationModel> observations) {
        if (observations == null || observations.isEmpty()) {
            return Collections.emptyList();
        }
        List<AllergyModel> allergies = new ArrayList<>();
        for (ObservationModel observation : observations) {
            if (observation == null || !"Allergy".equals(observation.getObservation())) {
                continue;
            }
            AllergyModel allergy = new AllergyModel();
            allergy.setObservationId(observation.getId());
            allergy.setFactor(observation.getPhenomenon());
            allergy.setSeverity(observation.getCategoryValue());
            allergy.setIdentifiedDate(observation.confirmDateAsString());
            allergy.setMemo(observation.getMemo());
            allergies.add(allergy);
        }
        return allergies;
    }

    private List<PhysicalModel> mapPhysicals(List<ObservationModel> observations, String phenomenon) {
        if (observations == null || observations.isEmpty()) {
            return Collections.emptyList();
        }
        List<PhysicalModel> physicals = new ArrayList<>();
        for (ObservationModel observation : observations) {
            if (observation == null
                    || !"PhysicalExam".equals(observation.getObservation())
                    || !Objects.equals(phenomenon, observation.getPhenomenon())) {
                continue;
            }
            PhysicalModel physical = new PhysicalModel();
            if ("bodyHeight".equals(phenomenon)) {
                physical.setHeightId(observation.getId());
                physical.setHeight(observation.getValue());
            } else {
                physical.setWeightId(observation.getId());
                physical.setWeight(observation.getValue());
            }
            physical.setIdentifiedDate(observation.confirmDateAsString());
            physical.setMemo(ModelUtils.getDateAsString(observation.getRecorded()));
            physicals.add(physical);
        }
        return physicals;
    }

    private Date findLatestDocumentStarted(long karteId) {
        List<Date> startedDates = em.createQuery(QUERY_LATEST_DOC_STARTED, Date.class)
                .setParameter(KARTE_ID, karteId)
                .setMaxResults(1)
                .getResultList();
        if (startedDates.isEmpty()) {
            throw new NoResultException("Document started date not found for karteId=" + karteId);
        }
        return startedDates.get(0);
    }

    private LocalDateTime toLocalDateTime(Date date) {
        if (date == null) {
            return null;
        }
        return LocalDateTime.ofInstant(date.toInstant(), ZoneId.systemDefault());
    }
}
