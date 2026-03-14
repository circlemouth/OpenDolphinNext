package open.dolphin.session;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.logging.Level;
import java.util.logging.Logger;
import jakarta.annotation.Resource;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Status;
import jakarta.transaction.Synchronization;
import jakarta.transaction.Transactional;
import jakarta.transaction.TransactionSynchronizationRegistry;
import open.dolphin.infomodel.ChartEventModel;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.HealthInsuranceModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.PatientVisitModel;
import open.dolphin.session.framework.SessionOperation;

/**
 *
 * @author Kazushi Minagawa, Digital Globe, Inc
 */
@Named
@ApplicationScoped
@Transactional
@SessionOperation
public class PatientServiceBean {

    private static final Logger LOGGER = Logger.getLogger(PatientServiceBean.class.getName());
    public static final int DEFAULT_ALL_PATIENT_PAGE_SIZE = 200;
    public static final int MAX_ALL_PATIENT_PAGE_SIZE = 500;

    // cancel status=64 を where 節へ追加
    private static final String QUERY_PATIENT_BY_PVTDATE
            = "from PatientVisitModel p where p.facilityId = :fid and p.pvtDate >= :fromDate and p.pvtDate < :toDate and p.status!=64";
    private static final String QUERY_PATIENT_BY_NAME = "from PatientModel p where p.facilityId=:fid and p.fullName like :name";
    private static final String QUERY_PATIENT_BY_KANA = "from PatientModel p where p.facilityId=:fid and p.kanaName like :name";
    private static final String QUERY_PATIENT_BY_FID_PID_PREFIX =
            "from PatientModel p where p.facilityId=:fid and p.patientId like :pid";
    private static final String QUERY_PATIENT_BY_FID_PID_EXACT =
            "from PatientModel p where p.facilityId=:fid and p.patientId=:pid";
    private static final String QUERY_PATIENT_BY_TELEPHONE = "from PatientModel p where p.facilityId = :fid and (p.telephone like :number or p.mobilePhone like :number)";
    private static final String QUERY_PATIENT_BY_ZIPCODE = "from PatientModel p where p.facilityId = :fid and p.address.zipCode like :zipCode";
    private static final String QUERY_INSURANCE_BY_PATIENT_PK = "from HealthInsuranceModel h where h.patient.id=:pk";
    private static final String QUERY_KARTE_BY_PATIENT_PK = "from KarteBean k where k.patient.id = :patientPk";
//s.oh^ 2014/08/19 施設患者一括表示機能
    private static final String QUERY_PATIENT_BY_APPMEMO = "from PatientModel p where p.facilityId = :fid and p.appMemo like :appMemo";
    private static final String QUERY_ALL_PATIENTS_BY_FACILITY =
            "from PatientModel p where p.facilityId=:fid order by p.patientId, p.id";
    private static final String QUERY_PATIENT_IDS_BY_FACILITY_AND_IDS =
            "select p.patientId from PatientModel p where p.facilityId = :fid and p.patientId in (:ids)";
    private static final String QUERY_PATIENTS_BY_FACILITY_AND_IDS =
            "from PatientModel p where p.facilityId = :fid and p.patientId in (:ids)";
    private static final String QUERY_KARTE_BY_PATIENT_IDS =
            "from KarteBean k where k.patient.id in (:patientIds)";
//s.oh$

    private static final String PK = "pk";
    private static final String FID = "fid";
    private static final String PID = "pid";
    private static final String NAME = "name";
    private static final String NUMBER = "number";
    private static final String ZIPCODE = "zipCode";
    private static final String FROM_DATE = "fromDate";
    private static final String TO_DATE = "toDate";
    private static final String PERCENT = "%";
//s.oh^ 2014/08/19 施設患者一括表示機能
    private static final String APPMEMO = "appMemo";
//s.oh$

    @PersistenceContext
    private EntityManager em;
    
//masuda^
    @Inject
    private ChartEventServiceBean eventServiceBean;

    @Resource
    private TransactionSynchronizationRegistry registry;
//masuda$

    public enum PatientSearchType {
        NAME,
        KANA,
        PATIENT_ID,
        TELEPHONE,
        ZIPCODE
    }

    
    public List<PatientModel> getPatientsByName(String fid, String name) {
        return searchPatients(fid, PatientSearchType.NAME, name);
    }

    
    public List<PatientModel> getPatientsByKana(String fid, String name) {
        return searchPatients(fid, PatientSearchType.KANA, name);
    }

    
    public List<PatientModel> getPatientsByDigit(String fid, String digit) {
        return searchPatients(fid, PatientSearchType.PATIENT_ID, digit);
    }

    public List<PatientModel> getPatientsByTelephone(String fid, String number) {
        return searchPatients(fid, PatientSearchType.TELEPHONE, number);
    }

    public List<PatientModel> getPatientsByZipCode(String fid, String zipCode) {
        return searchPatients(fid, PatientSearchType.ZIPCODE, zipCode);
    }

    public List<PatientModel> searchPatients(String fid, PatientSearchType searchType, String keyword) {
        if (fid == null || fid.isBlank() || searchType == null || keyword == null || keyword.isBlank()) {
            return List.of();
        }

        List<PatientModel> ret = switch (searchType) {
            case NAME -> searchPatientsByPrefixQuery(QUERY_PATIENT_BY_NAME, NAME, fid, keyword);
            case KANA -> searchPatientsByPrefixQuery(QUERY_PATIENT_BY_KANA, NAME, fid, keyword);
            case PATIENT_ID -> searchPatientsByPrefixQuery(QUERY_PATIENT_BY_FID_PID_PREFIX, PID, fid, keyword);
            case TELEPHONE -> searchPatientsByPrefixQuery(QUERY_PATIENT_BY_TELEPHONE, NUMBER, fid, keyword);
            case ZIPCODE -> searchPatientsByPrefixQuery(QUERY_PATIENT_BY_ZIPCODE, ZIPCODE, fid, keyword);
        };

        return finalizePatientSearchResults(fid, ret);
    }
    
    public List<PatientModel> getPatientsByPvtDate(String fid, String pvtDate) {
        LocalDate targetDate = ModelUtils.parseDate(pvtDate);
        if (targetDate == null) {
            return List.of();
        }

        List<PatientVisitModel> list =
                em.createQuery(QUERY_PATIENT_BY_PVTDATE)
                  .setParameter(FID, fid)
                  .setParameter(FROM_DATE, targetDate.atStartOfDay())
                  .setParameter(TO_DATE, targetDate.plusDays(1).atStartOfDay())
                  .getResultList();

        List<PatientModel> ret = new ArrayList<PatientModel>();

        for (PatientVisitModel pvt : list) {
            PatientModel patient = pvt.getPatientModel();
            ret.add(patient);
//masuda^   最終受診日設定
            patient.setLastVisitAt(pvt.getPvtDate());
//masuda$
        }
        populateHealthInsurances(ret);
        return ret;
    }

    private List<PatientModel> searchPatientsByPrefixQuery(String query, String parameterName, String fid, String keyword) {
        return em.createQuery(query, PatientModel.class)
                .setParameter(FID, fid)
                .setParameter(parameterName, keyword.trim() + PERCENT)
                .getResultList();
    }

    private List<PatientModel> finalizePatientSearchResults(String fid, List<PatientModel> patients) {
        if (patients == null || patients.isEmpty()) {
            return List.of();
        }

        populateHealthInsurances(patients);
        populatePvtDate(fid, patients);
        return patients;
    }

    /**
     * 患者ID(BUSINESS KEY)を指定して患者オブジェクトを返す。
     *
     * @param patientId 施設内患者ID
     * @return 該当するPatientModel
     */
    
    public PatientModel getPatientById(String fid,String pid) {

        // 患者レコードは FacilityId と patientId で複合キーになっている
        PatientModel bean;
        try {
            bean = (PatientModel) em.createQuery(QUERY_PATIENT_BY_FID_PID_EXACT)
                    .setParameter(FID, fid)
                    .setParameter(PID, pid)
                    .getSingleResult();
        } catch (NoResultException e) {
            return null;
        }

        long pk = bean.getId();

        // Lazy Fetch の 基本属性を検索する
        // 患者の健康保険を取得する
        populateHealthInsurances(List.of(bean));

        return bean;
    }
    
//minagawa^ 音声検索辞書作成    
    public int countPatients(String facilityId) {
        Long count = (Long)em.createQuery("select count(*) from PatientModel p where p.facilityId=:fid")
                .setParameter("fid", facilityId).getSingleResult();
        return count.intValue();
    }
    
    public List<String> getAllPatientsWithKana(String facilityId, int firstResult, int maxResult) {
        List<String> list = em.createQuery("select p.kanaName from PatientModel p where p.facilityId=:fid order by p.kanaName")
                .setParameter("fid", facilityId)
                .setFirstResult(firstResult)
                .setMaxResults(maxResult)
                .getResultList();
        return list;
    }
    
    /**
     * 仮保存カルテがある患者のリストを返す。
     */
    public List<PatientModel> getTmpKarte(String facilityId) {
        
        List<PatientModel> ret = new ArrayList();
        
        List<DocumentModel> list = (List<DocumentModel>)
        em.createQuery("from DocumentModel d where d.karte.patient.facilityId=:fid and d.status='T'")
                .setParameter("fid", facilityId)
                .getResultList();
        
        HashMap<String, String> map = new HashMap(10,0.75f);
        for (DocumentModel dm : list) {
            if (dm.getFirstConfirmed().after(dm.getConfirmed())) {
                continue;
            }
            KarteBean kb = dm.getKarte();
            PatientModel pm = kb.getPatient();
            if (map.get(pm.getPatientId())!=null) {
                continue;
            }
            map.put(pm.getPatientId(), "pid");
            ret.add(pm);
        }
        
        this.setHealthInsurances(ret);
        
        return ret;
    }
//minagawa$    

    /**
     * 患者を登録する。
     * @param patient PatientModel
     * @return データベース Primary Key
     */
    public long addPatient(PatientModel patient) {
        em.persist(patient);
        em.flush();
        ensureKarte(patient);
        em.flush();
        return patient.getId();
    }

    public SyncPatientUpsertResult upsertPatientsForSync(String fid, List<PatientModel> patients) {
        if (fid == null || fid.isBlank() || patients == null || patients.isEmpty()) {
            return new SyncPatientUpsertResult(0, 0);
        }

        List<PatientModel> normalizedPatients = normalizeSyncPatients(fid, patients);
        if (normalizedPatients.isEmpty()) {
            return new SyncPatientUpsertResult(0, 0);
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

        executeSyncPatientUpsert(normalizedPatients);

        List<PatientModel> affectedPatients = em.createQuery(
                        QUERY_PATIENTS_BY_FACILITY_AND_IDS, PatientModel.class)
                .setParameter(FID, fid)
                .setParameter("ids", patientIds)
                .getResultList();
        ensureKarteForPatients(affectedPatients);
        updatePvtList(affectedPatients);

        int created = 0;
        int updated = 0;
        for (PatientModel patient : normalizedPatients) {
            if (existingIds.contains(patient.getPatientId())) {
                updated++;
            } else {
                created++;
            }
        }
        return new SyncPatientUpsertResult(created, updated);
    }

    /**
     * 患者情報を更新する。
     * @param fid 更新対象施設ID
     * @param patient 更新する患者
     * @return 更新数
     */

    public int updateForFacility(String fid, PatientModel patient) {
        if (fid == null || fid.isBlank() || patient == null || patient.getId() <= 0) {
            return 0;
        }
        PatientModel existing = em.find(PatientModel.class, patient.getId());
        if (existing == null || existing.getFacilityId() == null || !existing.getFacilityId().equals(fid)) {
            return 0;
        }
        patient.setFacilityId(existing.getFacilityId());
        PatientModel merged = em.merge(patient);
        ensureKarte(merged);
//masuda^   患者情報が更新されたらPvtListも更新する必要あり
        updatePvtList(merged);
//masuda$
        return 1;
    }

    /**
     * @deprecated facility境界付きの {@link #updateForFacility(String, PatientModel)} を使用すること。
     */
    @Deprecated
    public int update(PatientModel patient) {
        if (patient == null) {
            return 0;
        }
        return updateForFacility(patient.getFacilityId(), patient);
    }

    private KarteBean ensureKarte(PatientModel patient) {
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

    public KarteBean ensureKarteByPatientPk(long patientPk) {
        if (patientPk <= 0) {
            return null;
        }
        PatientModel managed = em.find(PatientModel.class, patientPk);
        if (managed == null) {
            return null;
        }
        return ensureKarte(managed);
    }

    private List<PatientModel> normalizeSyncPatients(String fid, List<PatientModel> patients) {
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

    private void executeSyncPatientUpsert(List<PatientModel> patients) {
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

    private void ensureKarteForPatients(Collection<PatientModel> patients) {
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

//masuda^
    // pvtListのPatientModelを更新し、クライアントにも通知する
    private void updatePvtList(PatientModel pm) {
        updatePvtList(List.of(pm));
    }

    private void updatePvtList(Collection<PatientModel> patients) {
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
//s.oh^ 2013/10/07 患者情報が正しく表示されない
                List<HealthInsuranceModel> him = pvt.getPatientModel().getHealthInsurances();
                if(pm.getHealthInsurances() == null) {
                    pm.setHealthInsurances(him);
                }
//s.oh$
                pvt.setPatientModel(pm);
                 // クライアントに通知
                String uuid = eventServiceBean.getServerUUID();
                ChartEventModel msg = new ChartEventModel(uuid);
                msg.setPatientModel(pm);
                msg.setFacilityId(fid);
                msg.setEventType(ChartEventModel.PM_MERGE);
                deferredEvents.add(msg);
            }
        }
        dispatchAfterCommit(deferredEvents);
    }

    private void dispatchAfterCommit(List<ChartEventModel> events) {
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
                    // no-op
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
    
    private void setPvtDate(String fid, List<PatientModel> list) {
        populatePvtDate(fid, list);
    }
    
    public List<PatientModel> getPatientList(String fid, List<String> idList) {
        
        final String sql 
                = "from PatientModel p where p.facilityId = :fid and p.patientId in (:ids)";
        
        List<PatientModel> list = (List<PatientModel>)
                em.createQuery(sql)
                .setParameter("fid", fid)
                .setParameter("ids", idList)
                .getResultList();
        
        // 患者の健康保険を取得する。忘れがちｗ
        populateHealthInsurances(list);
        
        return list;
    }

    protected void setHealthInsurances(Collection<PatientModel> list) {
        populateHealthInsurances(list);
    }
    
    protected void setHealthInsurances(PatientModel pm) {
        if (pm != null) {
            List<HealthInsuranceModel> ins = getHealthInsurances(pm.getId());
            pm.setHealthInsurances(ins);
        }
    }

    protected List<HealthInsuranceModel> getHealthInsurances(long pk) {
        
        List<HealthInsuranceModel> ins =
                em.createQuery(QUERY_INSURANCE_BY_PATIENT_PK)
                .setParameter(PK, pk)
                .getResultList();
        return ins;
    }

    private void populateHealthInsurances(Collection<PatientModel> patients) {
        if (patients == null || patients.isEmpty()) {
            return;
        }
        Map<Long, List<HealthInsuranceModel>> insuranceMap = getHealthInsurancesByPatientIds(extractPatientIds(patients));
        for (PatientModel patient : patients) {
            if (patient == null) {
                continue;
            }
            patient.setHealthInsurances(new ArrayList<>(insuranceMap.getOrDefault(patient.getId(), List.of())));
        }
    }

    private void populatePvtDate(String fid, Collection<PatientModel> patients) {
        if (fid == null || fid.isBlank() || patients == null || patients.isEmpty()) {
            return;
        }
        Map<Long, LocalDateTime> pvtDateMap = getLatestPvtDates(fid, extractPatientIds(patients));
        for (PatientModel patient : patients) {
            if (patient == null) {
                continue;
            }
            patient.setLastVisitAt(pvtDateMap.get(patient.getId()));
        }
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

    private Map<Long, List<HealthInsuranceModel>> getHealthInsurancesByPatientIds(Collection<Long> patientIds) {
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

    private Map<Long, LocalDateTime> getLatestPvtDates(String fid, Collection<Long> patientIds) {
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

//masuda$
    
    // 検索件数が1000件超過
    public Long getPatientCount(String facilityId, String patientId) {
        Long ret = (Long)em.createQuery("select count(*) from PatientModel p where p.facilityId=:fid and p.patientId like :pid")
                .setParameter("fid", facilityId)
                .setParameter("pid", patientId+"%")
                .getSingleResult();
        return ret;
    }
    
//s.oh^ 2014/07/22 一括カルテPDF出力
    public List<PatientModel> getAllPatient(String fid) {
        return getAllPatient(fid, 0, DEFAULT_ALL_PATIENT_PAGE_SIZE);
    }

    public List<PatientModel> getAllPatient(String fid, int offset, int limit) {
        int safeOffset = normalizePatientPageOffset(offset);
        int safeLimit = normalizePatientPageSize(limit);

        List<PatientModel> ret = em.createQuery(QUERY_ALL_PATIENTS_BY_FACILITY, PatientModel.class)
                .setParameter(FID, fid)
                .setFirstResult(safeOffset)
                .setMaxResults(safeLimit)
                .getResultList();

        populateHealthInsurances(ret);

        return ret;
    }
//s.oh$

    public static int normalizePatientPageOffset(int offset) {
        return Math.max(offset, 0);
    }

    public static int normalizePatientPageSize(int limit) {
        if (limit <= 0) {
            return DEFAULT_ALL_PATIENT_PAGE_SIZE;
        }
        return Math.min(limit, MAX_ALL_PATIENT_PAGE_SIZE);
    }

    public record SyncPatientUpsertResult(int createdCount, int updatedCount) {
    }
    
//s.oh^ 2014/10/01 患者検索(傷病名)
    private String toSqlLikePattern(String raw) {
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

    public List<PatientModel> getCustom(String fid, String param) {
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

        this.populateHealthInsurances(ret);

        return ret;
    }
//s.oh$
}
