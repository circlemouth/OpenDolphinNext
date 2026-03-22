package open.dolphin.session;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.logging.Level;
import java.util.logging.Logger;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.transaction.Status;
import jakarta.transaction.Synchronization;
import jakarta.transaction.TransactionSynchronizationRegistry;
import open.dolphin.infomodel.ChartEventModel;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.HealthInsuranceModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.PatientVisitModel;

final class PatientServiceBeanSupport {

    private static final Logger LOGGER = Logger.getLogger(PatientServiceBeanSupport.class.getName());

    private static final String QUERY_PATIENT_BY_PVTDATE
            = "from PatientVisitModel p where p.facilityId = :fid and p.pvtDate >= :fromDate and p.pvtDate < :toDate and p.status!=64";
    private static final String QUERY_PATIENT_BY_FID_PID_PREFIX =
            "from PatientModel p where p.facilityId=:fid and p.patientId like :pid";
    private static final String QUERY_PATIENT_BY_FID_PID_EXACT =
            "from PatientModel p where p.facilityId=:fid and p.patientId=:pid";
    private static final String QUERY_ALL_PATIENTS_BY_FACILITY =
            "from PatientModel p where p.facilityId=:fid order by p.patientId, p.id";
    private static final String QUERY_PATIENT_IDS_BY_FACILITY_AND_IDS =
            "select p.patientId from PatientModel p where p.facilityId = :fid and p.patientId in (:ids)";
    private static final String QUERY_PATIENTS_BY_FACILITY_AND_IDS =
            "from PatientModel p where p.facilityId = :fid and p.patientId in (:ids)";
    private static final String QUERY_KARTE_BY_PATIENT_IDS =
            "from KarteBean k where k.patient.id in (:patientIds)";
    private static final String QUERY_INSURANCE_BY_PATIENT_PK = "from HealthInsuranceModel h where h.patient.id=:pk";
    private static final String QUERY_KARTE_BY_PATIENT_PK = "from KarteBean k where k.patient.id = :patientPk";

    private static final String PK = "pk";
    private static final String FID = "fid";
    private static final String PID = "pid";
    private static final String FROM_DATE = "fromDate";
    private static final String TO_DATE = "toDate";
    private static final String PERCENT = "%";

    int countPatients(EntityManager em, String facilityId) {
        Long count = (Long) em.createQuery("select count(*) from PatientModel p where p.facilityId=:fid")
                .setParameter(FID, facilityId)
                .getSingleResult();
        return count.intValue();
    }

    List<String> getAllPatientsWithKana(EntityManager em, String facilityId, int firstResult, int maxResult) {
        return em.createQuery(
                        "select p.kanaName from PatientModel p where p.facilityId=:fid order by p.kanaName")
                .setParameter(FID, facilityId)
                .setFirstResult(firstResult)
                .setMaxResults(maxResult)
                .getResultList();
    }

    List<PatientModel> getTmpKarte(EntityManager em, String facilityId) {
        List<PatientModel> ret = new ArrayList<>();
        List<DocumentModel> list = (List<DocumentModel>) em.createQuery(
                        "from DocumentModel d where d.karte.patient.facilityId=:fid and d.status='T'")
                .setParameter(FID, facilityId)
                .getResultList();
        HashMap<String, String> map = new HashMap<>(10, 0.75f);
        for (DocumentModel dm : list) {
            if (dm.getFirstConfirmed().after(dm.getConfirmed())) {
                continue;
            }
            KarteBean kb = dm.getKarte();
            PatientModel pm = kb.getPatient();
            if (map.get(pm.getPatientId()) != null) {
                continue;
            }
            map.put(pm.getPatientId(), "pid");
            ret.add(pm);
        }
        setHealthInsurances(em, ret);
        return ret;
    }

    long addPatient(EntityManager em, PatientModel patient) {
        em.persist(patient);
        em.flush();
        ensureKarte(em, patient);
        em.flush();
        return patient.getId();
    }

    PatientServiceBean.SyncPatientUpsertResult upsertPatientsForSync(
            EntityManager em, String fid, List<PatientModel> patients) {
        if (fid == null || fid.isBlank() || patients == null || patients.isEmpty()) {
            return new PatientServiceBean.SyncPatientUpsertResult(0, 0);
        }
        List<PatientModel> normalizedPatients = normalizeSyncPatients(fid, patients);
        if (normalizedPatients.isEmpty()) {
            return new PatientServiceBean.SyncPatientUpsertResult(0, 0);
        }
        List<String> patientIds = normalizedPatients.stream()
                .map(PatientModel::getPatientId)
                .filter(Objects::nonNull)
                .toList();
        Set<String> existingIds = new LinkedHashSet<>(em.createQuery(
                        QUERY_PATIENT_IDS_BY_FACILITY_AND_IDS, String.class)
                .setParameter(FID, fid)
                .setParameter("ids", patientIds)
                .getResultList());
        executeSyncPatientUpsert(em, normalizedPatients);
        List<PatientModel> affectedPatients = em.createQuery(
                        QUERY_PATIENTS_BY_FACILITY_AND_IDS, PatientModel.class)
                .setParameter(FID, fid)
                .setParameter("ids", patientIds)
                .getResultList();
        ensureKarteForPatients(em, affectedPatients);
        updatePvtList(em, null, null, affectedPatients);
        int created = 0;
        int updated = 0;
        for (PatientModel patient : normalizedPatients) {
            if (existingIds.contains(patient.getPatientId())) {
                updated++;
            } else {
                created++;
            }
        }
        return new PatientServiceBean.SyncPatientUpsertResult(created, updated);
    }

    int updateForFacility(EntityManager em, String fid, PatientModel patient, java.util.function.Function<PatientModel, Integer> pvtUpdater) {
        if (fid == null || fid.isBlank() || patient == null || patient.getId() <= 0) {
            return 0;
        }
        PatientModel existing = em.find(PatientModel.class, patient.getId());
        if (existing == null || existing.getFacilityId() == null || !existing.getFacilityId().equals(fid)) {
            return 0;
        }
        patient.setFacilityId(existing.getFacilityId());
        PatientModel merged = em.merge(patient);
        ensureKarte(em, merged);
        if (pvtUpdater != null) {
            pvtUpdater.apply(merged);
        }
        return 1;
    }

    KarteBean ensureKarte(EntityManager em, PatientModel patient) {
        if (patient == null || patient.getId() == 0) {
            return null;
        }
        List<KarteBean> hits = em.createQuery(QUERY_KARTE_BY_PATIENT_PK, KarteBean.class)
                .setParameter("patientPk", patient.getId())
                .setMaxResults(1)
                .getResultList();
        if (!hits.isEmpty()) {
            return hits.get(0);
        }
        KarteBean karte = new KarteBean();
        karte.setPatientModel(patient);
        karte.setCreated(new Date());
        em.persist(karte);
        return karte;
    }

    KarteBean ensureKarteByPatientPk(EntityManager em, long patientPk) {
        if (patientPk <= 0) {
            return null;
        }
        PatientModel managed = em.find(PatientModel.class, patientPk);
        if (managed == null) {
            return null;
        }
        return ensureKarte(em, managed);
    }

    List<PatientModel> normalizeSyncPatients(String fid, List<PatientModel> patients) {
        LinkedHashMap<String, PatientModel> indexed = new LinkedHashMap<>();
        for (PatientModel patient : patients) {
            if (patient == null || patient.getPatientId() == null || patient.getPatientId().isBlank()) {
                continue;
            }
            patient.setFacilityId(fid);
            indexed.put(patient.getPatientId(), patient);
        }
        return new ArrayList<>(indexed.values());
    }

    void executeSyncPatientUpsert(EntityManager em, List<PatientModel> patients) {
        StringBuilder sql = new StringBuilder("""
                insert into d_patient (
                    id, facilityid, patientid, fullname, familyname, givenname, kananame,
                    birthday, gender, zipcode, address, telephone, mobilephone
                ) values
                """);
        int parameterIndex = 1;
        for (int i = 0; i < patients.size(); i++) {
            if (i > 0) {
                sql.append(", ");
            }
            sql.append("(nextval('opendolphin.hibernate_sequence')");
            for (int j = 0; j < 12; j++) {
                sql.append(", ?").append(parameterIndex++);
            }
            sql.append(")");
        }
        sql.append("""
                 on conflict (facilityid, patientid) do update set
                     fullname = excluded.fullname,
                     familyname = excluded.familyname,
                     givenname = excluded.givenname,
                     kananame = excluded.kananame,
                     birthday = excluded.birthday,
                     gender = excluded.gender,
                     zipcode = excluded.zipcode,
                     address = excluded.address,
                     telephone = excluded.telephone,
                     mobilephone = excluded.mobilephone
                """);
        jakarta.persistence.Query query = em.createNativeQuery(sql.toString());
        parameterIndex = 1;
        for (PatientModel patient : patients) {
            query.setParameter(parameterIndex++, patient.getFacilityId());
            query.setParameter(parameterIndex++, patient.getPatientId());
            query.setParameter(parameterIndex++, patient.getFullName());
            query.setParameter(parameterIndex++, patient.getFamilyName());
            query.setParameter(parameterIndex++, patient.getGivenName());
            query.setParameter(parameterIndex++, patient.getKanaName());
            query.setParameter(parameterIndex++, patient.getBirthday() != null ? java.sql.Date.valueOf(patient.getBirthday()) : null);
            query.setParameter(parameterIndex++, patient.getGender());
            query.setParameter(parameterIndex++, patient.getAddress() != null ? patient.getAddress().getZipCode() : null);
            query.setParameter(parameterIndex++, patient.getAddress() != null ? patient.getAddress().getAddress() : null);
            query.setParameter(parameterIndex++, patient.getTelephone());
            query.setParameter(parameterIndex++, patient.getMobilePhone());
        }
        query.executeUpdate();
    }

    void ensureKarteForPatients(EntityManager em, Collection<PatientModel> patients) {
        if (patients == null || patients.isEmpty()) {
            return;
        }
        List<Long> patientIds = extractPatientIds(patients);
        if (patientIds.isEmpty()) {
            return;
        }
        Set<Long> existingKartePatientIds = new LinkedHashSet<>();
        List<KarteBean> hits = em.createQuery(QUERY_KARTE_BY_PATIENT_IDS, KarteBean.class)
                .setParameter("patientIds", patientIds)
                .getResultList();
        for (KarteBean hit : hits) {
            if (hit != null && hit.getPatientModel() != null) {
                existingKartePatientIds.add(hit.getPatientModel().getId());
            }
        }
        Date created = new Date();
        for (PatientModel patient : patients) {
            if (patient == null || patient.getId() == 0 || existingKartePatientIds.contains(patient.getId())) {
                continue;
            }
            KarteBean karte = new KarteBean();
            karte.setPatientModel(patient);
            karte.setCreated(created);
            em.persist(karte);
        }
    }

    void updatePvtList(EntityManager em, ChartEventServiceBean eventServiceBean,
            TransactionSynchronizationRegistry registry, Collection<PatientModel> patients) {
        if (patients == null || patients.isEmpty() || eventServiceBean == null) {
            return;
        }
        Map<Long, PatientModel> patientMap = new LinkedHashMap<>();
        String fid = null;
        for (PatientModel patient : patients) {
            if (patient == null || patient.getId() == 0) {
                continue;
            }
            if (fid == null) {
                fid = patient.getFacilityId();
            }
            patientMap.put(patient.getId(), patient);
        }
        if (fid == null || patientMap.isEmpty()) {
            return;
        }
        List<PatientVisitModel> pvtList = eventServiceBean.getPvtList(fid);
        if (pvtList == null || pvtList.isEmpty()) {
            return;
        }
        List<ChartEventModel> deferredEvents = new ArrayList<>();
        for (PatientVisitModel pvt : pvtList) {
            PatientModel pm = pvt != null && pvt.getPatientModel() != null
                    ? patientMap.get(pvt.getPatientModel().getId())
                    : null;
            if (pm != null) {
                List<HealthInsuranceModel> him = pvt.getPatientModel().getHealthInsurances();
                if (pm.getHealthInsurances() == null) {
                    pm.setHealthInsurances(him);
                }
                pvt.setPatientModel(pm);
                String uuid = eventServiceBean.getServerUUID();
                ChartEventModel msg = new ChartEventModel(uuid);
                msg.setPatientModel(pm);
                msg.setFacilityId(fid);
                msg.setEventType(ChartEventModel.PM_MERGE);
                deferredEvents.add(msg);
            }
        }
        dispatchAfterCommit(eventServiceBean, registry, deferredEvents);
    }

    void dispatchAfterCommit(ChartEventServiceBean eventServiceBean, TransactionSynchronizationRegistry registry,
            List<ChartEventModel> events) {
        if (events == null || events.isEmpty()) {
            return;
        }
        if (registry == null) {
            events.forEach(eventServiceBean::notifyEvent);
            return;
        }
        int txStatus = registry.getTransactionStatus();
        if (txStatus == Status.STATUS_ACTIVE
                || txStatus == Status.STATUS_MARKED_ROLLBACK
                || txStatus == Status.STATUS_PREPARING
                || txStatus == Status.STATUS_PREPARED
                || txStatus == Status.STATUS_COMMITTING
                || txStatus == Status.STATUS_ROLLING_BACK) {
            List<ChartEventModel> snapshot = List.copyOf(events);
            registry.registerInterposedSynchronization(new Synchronization() {
                @Override
                public void beforeCompletion() {
                }

                @Override
                public void afterCompletion(int status) {
                    if (status == Status.STATUS_COMMITTED) {
                        snapshot.forEach(eventServiceBean::notifyEvent);
                    }
                }
            });
            return;
        }
        events.forEach(eventServiceBean::notifyEvent);
    }

    private List<Long> extractPatientIds(Collection<PatientModel> patients) {
        LinkedHashMap<Long, Boolean> ids = new LinkedHashMap<>();
        for (PatientModel patient : patients) {
            if (patient != null && patient.getId() > 0) {
                ids.put(patient.getId(), Boolean.TRUE);
            }
        }
        return new ArrayList<>(ids.keySet());
    }

    public List<PatientModel> getCustom(EntityManager em, String fid, String param) {
        List<PatientModel> ret = new ArrayList<>();
        final String DIAGNOSIS = "[D]";
        if (fid == null || fid.isBlank()) {
            return ret;
        }
        if (param == null || !param.contains(DIAGNOSIS)) {
            return ret;
        }
        try {
            String raw = param.substring(param.indexOf(DIAGNOSIS) + DIAGNOSIS.length());
            String val = toSqlLikePattern(raw);
            ret = em.createQuery(
                    "select distinct k.patient "
                    + "from RegisteredDiagnosisModel d join d.karte k join k.patient p "
                    + "where p.facilityId = :fid and d.status='F' and d.diagnosis like :val",
                    PatientModel.class)
                    .setParameter("fid", fid)
                    .setParameter("val", val)
                    .getResultList();
        } catch (RuntimeException ex) {
            LOGGER.log(Level.WARNING, "getCustom diagnosis search failed", ex);
            ret = new ArrayList<>();
        }
        setHealthInsurances(em, ret);
        return ret;
    }

    List<PatientModel> getPatientList(EntityManager em, String fid, List<String> idList) {
        List<PatientModel> list = (List<PatientModel>) em.createQuery(
                        "from PatientModel p where p.facilityId = :fid and p.patientId in (:ids)")
                .setParameter("fid", fid)
                .setParameter("ids", idList)
                .getResultList();
        setHealthInsurances(em, list);
        return list;
    }

    Long getPatientCount(EntityManager em, String facilityId, String patientId) {
        return (Long) em.createQuery("select count(*) from PatientModel p where p.facilityId=:fid and p.patientId like :pid")
                .setParameter("fid", facilityId)
                .setParameter("pid", patientId + "%")
                .getSingleResult();
    }

    List<PatientModel> getAllPatient(EntityManager em, String fid, int offset, int limit) {
        int safeOffset = normalizePatientPageOffset(offset);
        int safeLimit = normalizePatientPageSize(limit);
        List<PatientModel> ret = em.createQuery(QUERY_ALL_PATIENTS_BY_FACILITY, PatientModel.class)
                .setParameter(FID, fid)
                .setFirstResult(safeOffset)
                .setMaxResults(safeLimit)
                .getResultList();
        populateHealthInsurances(em, ret);
        return ret;
    }

    static int normalizePatientPageOffset(int offset) {
        return Math.max(offset, 0);
    }

    static int normalizePatientPageSize(int limit) {
        if (limit <= 0) {
            return PatientServiceBean.DEFAULT_ALL_PATIENT_PAGE_SIZE;
        }
        return Math.min(limit, PatientServiceBean.MAX_ALL_PATIENT_PAGE_SIZE);
    }

    void populateHealthInsurances(EntityManager em, Collection<PatientModel> patients) {
        if (patients == null || patients.isEmpty()) {
            return;
        }
        Map<Long, List<HealthInsuranceModel>> insuranceMap = getHealthInsurancesByPatientIds(em, extractPatientIds(patients));
        for (PatientModel patient : patients) {
            if (patient == null) {
                continue;
            }
            patient.setHealthInsurances(new ArrayList<>(insuranceMap.getOrDefault(patient.getId(), List.of())));
        }
    }

    void setHealthInsurances(EntityManager em, Collection<PatientModel> list) {
        populateHealthInsurances(em, list);
    }

    void setHealthInsurances(EntityManager em, PatientModel pm) {
        if (pm != null) {
            List<HealthInsuranceModel> ins = getHealthInsurances(em, pm.getId());
            pm.setHealthInsurances(ins);
        }
    }

    List<HealthInsuranceModel> getHealthInsurances(EntityManager em, long pk) {
        return em.createQuery(QUERY_INSURANCE_BY_PATIENT_PK)
                .setParameter(PK, pk)
                .getResultList();
    }

    void populatePvtDate(EntityManager em, String fid, Collection<PatientModel> patients) {
        if (fid == null || fid.isBlank() || patients == null || patients.isEmpty()) {
            return;
        }
        Map<Long, LocalDateTime> pvtDateMap = getLatestPvtDates(em, fid, extractPatientIds(patients));
        for (PatientModel patient : patients) {
            if (patient == null) {
                continue;
            }
            patient.setLastVisitAt(pvtDateMap.get(patient.getId()));
        }
    }

    Map<Long, List<HealthInsuranceModel>> getHealthInsurancesByPatientIds(EntityManager em, Collection<Long> patientIds) {
        if (patientIds == null || patientIds.isEmpty()) {
            return Map.of();
        }
        List<HealthInsuranceModel> rows = em.createQuery(
                        "from HealthInsuranceModel h where h.patient.id in (:ids)",
                        HealthInsuranceModel.class)
                .setParameter("ids", patientIds)
                .getResultList();
        Map<Long, List<HealthInsuranceModel>> grouped = new LinkedHashMap<>();
        for (HealthInsuranceModel insurance : rows) {
            if (insurance == null || insurance.getPatient() == null) {
                continue;
            }
            grouped.computeIfAbsent(insurance.getPatient().getId(), ignored -> new ArrayList<>())
                    .add(insurance);
        }
        return grouped;
    }

    Map<Long, LocalDateTime> getLatestPvtDates(EntityManager em, String fid, Collection<Long> patientIds) {
        if (patientIds == null || patientIds.isEmpty()) {
            return Map.of();
        }
        List<Object[]> rows = em.createQuery(
                        "select p.patient.id, p.pvtDate "
                                + "from PatientVisitModel p "
                                + "where p.facilityId = :fid and p.patient.id in (:ids) and p.status != :status "
                                + "order by p.patient.id asc, p.pvtDate desc",
                        Object[].class)
                .setParameter("fid", fid)
                .setParameter("ids", patientIds)
                .setParameter("status", 64)
                .getResultList();
        Map<Long, LocalDateTime> grouped = new LinkedHashMap<>();
        for (Object[] row : rows) {
            if (row == null || row.length < 2 || !(row[0] instanceof Long patientId)) {
                continue;
            }
            if (grouped.containsKey(patientId)) {
                continue;
            }
            grouped.put(patientId, row[1] instanceof LocalDateTime value ? value : null);
        }
        return grouped;
    }

    String toSqlLikePattern(String raw) {
        if (raw == null) {
            return "%";
        }
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) {
            return "%";
        }
        boolean leading = trimmed.startsWith("*");
        boolean trailing = trimmed.endsWith("*");
        String core = trimmed.replaceAll("^\\*+|\\*+$", "");
        if (core.isEmpty()) {
            return "%";
        }
        if (leading && trailing) {
            return "%" + core + "%";
        }
        if (leading) {
            return "%" + core;
        }
        if (trailing) {
            return core + "%";
        }
        return core;
    }
}
