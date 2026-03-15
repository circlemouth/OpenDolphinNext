package open.dolphin.session;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import open.dolphin.infomodel.*;
import open.dolphin.mbean.ServletContextHolder;
import open.dolphin.session.framework.SessionOperation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 *
 * @author Kazushi Minagawa, Digital Globe, Inc.
 */
@Named
@ApplicationScoped
@Transactional
@SessionOperation
public class PVTServiceBean {

    private static final Logger LOGGER = LoggerFactory.getLogger(PVTServiceBean.class);

    private static final String QUERY_PATIENT_BY_FID_PID        = "from PatientModel p where p.facilityId=:fid and p.patientId=:pid";
    private static final String QUERY_PVT_BY_FID_PID_DATE       = "from PatientVisitModel p where p.facilityId=:fid and p.pvtDate >= :fromDate and p.pvtDate < :toDate and p.patient.patientId=:pid";
    private static final String QUERY_PVT_BY_FID_PID_PVT_DATE   = "from PatientVisitModel p where p.facilityId=:fid and p.pvtDate=:pvtDate and p.patient.patientId=:pid order by p.id";
    private static final String QUERY_PVT_BY_FID_DATE           = "from PatientVisitModel p where p.facilityId=:fid and p.pvtDate >= :fromDate and p.pvtDate < :toDate order by p.pvtDate";
    private static final String QUERY_PVT_BY_FID_DID_DATE       = "from PatientVisitModel p where p.facilityId=:fid and p.pvtDate >= :fromDate and p.pvtDate < :toDate and (doctorId=:did or doctorId=:unassigned) order by p.pvtDate";
    private static final String QUERY_INSURANCE_BY_PATIENT_ID   = "from HealthInsuranceModel h where h.patient.id=:id";
    private static final String QUERY_KARTE_BY_PATIENT_ID       = "from KarteBean k where k.patient.id=:id";
    private static final String QUERY_APPO_BY_KARTE_ID_DATE     = "from AppointmentModel a where a.karte.id=:id and a.date=:date";
    private static final String QUERY_PVT_BY_PK                 = "from PatientVisitModel p where p.id=:id";
    private static final String QUERY_PVT_BY_PK_FID             = "from PatientVisitModel p where p.id=:id and p.facilityId=:fid";
//masuda^    
    private static final String QUERY_KARTE_ID_BY_PATIENT_ID    = "select k.id from KarteBean k where k.patient.id = :id";
    
    private static final String FID = "fid";
    private static final String PID = "pid";
    private static final String DID = "did";
    private static final String UNASSIGNED = "unassigned";
    private static final String ID = "id";
    private static final String DATE = "date";
    private static final String FROM_DATE = "fromDate";
    private static final String TO_DATE = "toDate";
    private static final String PVT_DATE = "pvtDate";
    private static final String PERCENT = "%";
    private static final int LEGACY_FINALIZED_SAVE_BIT   = 1;
    private static final int LEGACY_FINALIZED_MODIFY_BIT = 2;
    private static final int LEGACY_FINALIZED_SAVE_STATE = 1 << LEGACY_FINALIZED_SAVE_BIT;   // 2
    private static final int LEGACY_FINALIZED_MODIFY_STATE = 1 << LEGACY_FINALIZED_MODIFY_BIT; // 4
    private static final int BIT_CANCEL = 6;
    public static final int DEFAULT_PVT_PAGE_SIZE = 50;
    public static final int MAX_PVT_PAGE_SIZE = 200;

    @PersistenceContext
    private EntityManager em;
    
    @Inject
    private ChartEventServiceBean eventServiceBean;
    
    @Inject
    private ServletContextHolder contextHolder;
    
    
   /**
     * 患者来院情報を登録する。
     * @param pvt
     * @return 登録個数
     */
    public int addPvt(PatientVisitModel pvt) {

        eventServiceBean.ensureInitialized();
        String fid = prepareIncomingPvt(pvt);
        synchronizePatientAndAttach(fid, pvt);
        pvt.setPvtDate(normalizePvtDateForStorage(pvt.getPvtDate()));
        return registerVisit(fid, pvt);
    }

    private String prepareIncomingPvt(PatientVisitModel pvt) {
        // 外部連携入力では facilityID が登録値と異なる場合がある。
        // 施設IDを認証にパスしたユーザの施設IDに設定する。
        String fid = pvt.getFacilityId();
        PatientModel patient = pvt.getPatientModel();
        pvt.setFacilityId(fid);
        patient.setFacilityId(fid);

        // 1.4との互換性のためdepartmentにも設定する
        StringBuilder sb = new StringBuilder();
        sb.append(pvt.getDeptName()).append(",");
        sb.append(pvt.getDeptCode()).append(",");
        sb.append(pvt.getDoctorName()).append(",");
        sb.append(pvt.getDoctorId()).append(",");
        sb.append(pvt.getJmariNumber()).append(",");
        pvt.setDepartment(sb.toString());
        return fid;
    }

    private void synchronizePatientAndAttach(String fid, PatientVisitModel pvt) {
        PatientModel patient = pvt.getPatientModel();
        try {
            PatientModel exist = findExistingPatient(fid, patient.getPatientId());
            LOGGER.info("addPvt : merge patient");
            mergePatientState(exist, patient);
            em.merge(exist);
            pvt.setPatientModel(exist);
        } catch (NoResultException e) {
            LOGGER.info("addPvt : add patient");
            persistNewPatientAndKarte(patient);
        }
    }

    private PatientModel findExistingPatient(String fid, String patientId) {
        return (PatientModel) em.createQuery(QUERY_PATIENT_BY_FID_PID)
                .setParameter(FID, fid)
                .setParameter(PID, patientId)
                .getSingleResult();
    }

    private void mergePatientState(PatientModel exist, PatientModel incoming) {
        mergePatientInsurances(exist, incoming.getHealthInsurances());
        copyPatientProfile(exist, incoming);
    }

    private void mergePatientInsurances(PatientModel exist, List<HealthInsuranceModel> incomingInsurances) {
        @SuppressWarnings("unchecked")
        List<HealthInsuranceModel> old = em.createQuery(QUERY_INSURANCE_BY_PATIENT_ID)
                .setParameter(ID, exist.getId())
                .getResultList();

        if (incomingInsurances != null && !incomingInsurances.isEmpty()) {
            InsuranceMergeResult mergeResult = mergeInsurances(old, incomingInsurances);
            for (InsuranceUpdate update : mergeResult.updates()) {
                HealthInsuranceModel persisted = update.persisted();
                HealthInsuranceModel incoming = update.incoming();
                persisted.setBeanJson(incoming.getBeanJson());
                persisted.setPatient(exist);
            }

            for (HealthInsuranceModel model : mergeResult.additions()) {
                model.setPatient(exist);
                em.persist(model);
            }
            exist.setHealthInsurances(mergeResult.merged());
            return;
        }

        // pvtに保険情報が乗っかっていない場合は古いのを使う
        exist.setHealthInsurances(old);
    }

    private void copyPatientProfile(PatientModel exist, PatientModel incoming) {
        // 名前を更新する 2007-04-12
        exist.setFamilyName(incoming.getFamilyName());
        exist.setGivenName(incoming.getGivenName());
        exist.setFullName(incoming.getFullName());
        exist.setKanaFamilyName(incoming.getKanaFamilyName());
        exist.setKanaGivenName(incoming.getKanaGivenName());
        exist.setKanaName(incoming.getKanaName());
        //exist.setRomanFamilyName(incoming.getRomanFamilyName());   // ローマ字はマージしない 2013.10.25 K.Funabashi 3Line
        //exist.setRomanGivenName(incoming.getRomanGivenName());
        //exist.setRomanName(incoming.getRomanName());

        // 性別
        exist.setGender(incoming.getGender());
        exist.setGenderDesc(incoming.getGenderDesc());
        exist.setGenderCodeSys(incoming.getGenderCodeSys());

        // Birthday
        exist.setBirthday(incoming.getBirthday());

        // 住所、電話を更新する
        exist.setSimpleAddressModel(incoming.getSimpleAddressModel());
        exist.setTelephone(incoming.getTelephone());
        //exist.setMobilePhone(incoming.getMobilePhone());

//s.oh^ 2014/08/19 施設患者一括表示機能
        exist.setAppMemo(incoming.getAppMemo());
//s.oh$
    }

    private void persistNewPatientAndKarte(PatientModel patient) {
        // 新規患者であれば登録する
        // 患者属性は cascade=PERSIST で自動的に保存される
        em.persist(patient);

        KarteBean karte = new KarteBean();
        karte.setPatientModel(patient);
        karte.setCreated(new Date());
        em.persist(karte);
    }

    private int registerVisit(String fid, PatientVisitModel pvt) {
        // 旧仕様では患者情報のみを登録し、来院情報がない場合がある。
        // 来院情報を登録する。pvtDate == nullなら患者登録のみ
        if (pvt.getPvtDate() == null) {
            return 0;   // 追加０個、終了
        }

//minagawa^ 予約: ORCAで未来日受付の場合、persistしてリターン(予定カルテ対応)
        if (!isToday(pvt.getPvtDate())) {
            return registerScheduledVisit(fid, pvt);
        }
//minagawa$
        return registerTodayVisit(fid, pvt);
    }

    private int registerScheduledVisit(String fid, PatientVisitModel pvt) {
        LOGGER.info("scheduled PVT: {}", pvt.getPvtDate());
        LocalDate visitDate = extractPvtDatePart(pvt.getPvtDate());
        if (visitDate == null) {
            LOGGER.warn("skip scheduled PVT registration because pvtDate is invalid: {}", pvt.getPvtDate());
            return 0;
        }

        @SuppressWarnings("unchecked")
        List<PatientVisitModel> list = em.createQuery(QUERY_PVT_BY_FID_PID_DATE)
                .setParameter(FID, fid)
                .setParameter(FROM_DATE, visitDate.atStartOfDay())
                .setParameter(TO_DATE, visitDate.plusDays(1).atStartOfDay())
                .setParameter(PID, pvt.getPatientId())
                .getResultList();

        if (list.isEmpty()) {
            em.persist(pvt);
            return 1;
        }

        updateScheduledVisit(list.get(0), pvt);
        return 1;
    }

    private void updateScheduledVisit(PatientVisitModel target, PatientVisitModel incoming) {
        target.setDepartment(incoming.getDepartment());
        target.setDeptCode(incoming.getDeptCode());
        target.setDeptName(incoming.getDeptName());
        target.setDoctorId(incoming.getDoctorId());
        target.setDoctorName(incoming.getDoctorName());
        target.setFirstInsurance(incoming.getFirstInsurance());
        target.setInsuranceUid(incoming.getInsuranceUid());
        target.setJmariNumber(incoming.getJmariNumber());
        // transient及び値が変更されないもの
        //target.setAppointment(incoming.getAppointment());
        //target.setFacilityId(incoming.getFacilityId());
        //target.setMemo(incoming.getMemo());
        //target.setNumber(incoming.getNumber());
        //target.setPatientModel(incoming.getPatientModel());
        //target.setPvtDate(incoming.getPvtDate());
        //target.setState(incoming.getState());
        //target.setWatingTime(incoming.getWatingTime());
    }

    private int registerTodayVisit(String fid, PatientVisitModel pvt) {
        long karteId = findKarteId(pvt);
        applyTodayAppointment(pvt, karteId);

        PatientVisitModel existingToday = findActiveVisitByFacilityPatientAndPvtDate(fid, pvt.getPatientId(),
                pvt.getPvtDate());
        if (existingToday != null) {
            mergeTodayVisit(fid, existingToday, pvt);
            return 0;   // 追加０個
        }

        persistTodayVisit(fid, pvt, karteId);
        return 1;   // 追加１個
    }

    private long findKarteId(PatientVisitModel pvt) {
        return (Long) em.createQuery(QUERY_KARTE_ID_BY_PATIENT_ID)
                .setParameter(ID, pvt.getPatientModel().getId())
                .getSingleResult();
    }

    private void applyTodayAppointment(PatientVisitModel pvt, long karteId) {
        @SuppressWarnings("unchecked")
        List<AppointmentModel> appointments = em.createQuery(QUERY_APPO_BY_KARTE_ID_DATE)
                .setParameter(ID, karteId)
                .setParameter(DATE, contextHolder.getToday().getTime())
                .getResultList();
        if (appointments != null && !appointments.isEmpty()) {
            AppointmentModel appo = appointments.get(0);
            pvt.setAppointment(appo.getName());
        }
    }

    private void persistTodayVisit(String fid, PatientVisitModel pvt, long karteId) {
        eventServiceBean.setByomeiCount(karteId, pvt);   // 病名数をカウントする
        em.persist(pvt);
        contextHolder.addPvt(fid, pvt);
        notifyPvtEvent(pvt, ChartEventModel.PVT_ADD);
    }
    
    /**
     * 引数の日付が今日かどうかを返す。
     * (予定カルテ対応)
     * @param mmlDate yyyy-MM-ddTHH:mm:ss
     * @return 今日の時 true
     */
    private boolean isToday(LocalDateTime pvtDate) {
        LocalDate test = extractPvtDatePart(pvtDate);
        if (test == null) {
            return false;
        }
        return test.equals(LocalDate.now());
    }

    static InsuranceMergeResult mergeInsurances(List<HealthInsuranceModel> existing,
            List<HealthInsuranceModel> incoming) {

        List<HealthInsuranceModel> safeExisting = existing != null ? existing : List.of();
        List<HealthInsuranceModel> safeIncoming = incoming != null ? incoming : List.of();
        if (safeIncoming.isEmpty()) {
            return new InsuranceMergeResult(List.of(), List.of(), new ArrayList<>(safeExisting));
        }

        Map<String, HealthInsuranceModel> existingByKey = new LinkedHashMap<>();
        for (HealthInsuranceModel model : safeExisting) {
            String key = resolveInsuranceKey(model);
            if (key != null && !existingByKey.containsKey(key)) {
                existingByKey.put(key, model);
            }
        }

        Set<String> seenKeys = new HashSet<>();
        List<InsuranceUpdate> updates = new ArrayList<>();
        List<HealthInsuranceModel> additions = new ArrayList<>();
        List<HealthInsuranceModel> merged = new ArrayList<>(safeExisting);

        for (HealthInsuranceModel model : safeIncoming) {
            if (model == null) {
                continue;
            }
            String key = resolveInsuranceKey(model);
            if (key != null && !seenKeys.add(key)) {
                continue;
            }
            HealthInsuranceModel persisted = key != null ? existingByKey.get(key) : null;
            if (persisted != null) {
                updates.add(new InsuranceUpdate(persisted, model));
            } else {
                additions.add(model);
                merged.add(model);
            }
        }
        return new InsuranceMergeResult(updates, additions, merged);
    }

    static LocalDateTime normalizePvtDateForStorage(LocalDateTime rawPvtDate) {
        return rawPvtDate == null ? null : rawPvtDate.withNano(0);
    }

    static LocalDate extractPvtDatePart(LocalDateTime pvtDate) {
        return pvtDate == null ? null : pvtDate.toLocalDate();
    }

    private PatientVisitModel findActiveVisitByFacilityPatientAndPvtDate(String fid, String patientId,
            LocalDateTime pvtDate) {
        if (fid == null || fid.isBlank() || patientId == null || patientId.isBlank() || pvtDate == null) {
            return null;
        }
        @SuppressWarnings("unchecked")
        List<PatientVisitModel> matches = em.createQuery(QUERY_PVT_BY_FID_PID_PVT_DATE)
                .setParameter(FID, fid)
                .setParameter(PID, patientId)
                .setParameter(PVT_DATE, pvtDate)
                .getResultList();
        for (PatientVisitModel model : matches) {
            if (!model.getStateBit(PatientVisitModel.BIT_CANCEL)) {
                return model;
            }
        }
        return null;
    }

    private void mergeTodayVisit(String fid, PatientVisitModel existingToday, PatientVisitModel incoming) {
        List<PatientVisitModel> pvtList = contextHolder.getPvtList(fid);
        PatientVisitModel cached = findCachedVisitById(pvtList, existingToday.getId());
        PatientVisitModel source = cached != null ? cached : existingToday;

        incoming.setId(existingToday.getId());
        incoming.setState(existingToday.getState());
        incoming.getPatientModel().setOwnerUUID(resolveOwnerUuid(source, existingToday));
        incoming.setByomeiCount(source.getByomeiCount());
        incoming.setByomeiCountToday(source.getByomeiCountToday());

        em.merge(incoming);
        contextHolder.replaceOrAddPvt(fid, incoming);
        notifyPvtEvent(incoming, ChartEventModel.PVT_MERGE);
    }

    private PatientVisitModel findCachedVisitById(List<PatientVisitModel> pvtList, long pvtId) {
        if (pvtList == null) {
            return null;
        }
        for (PatientVisitModel model : pvtList) {
            if (model.getId() == pvtId) {
                return model;
            }
        }
        return null;
    }

    private String resolveOwnerUuid(PatientVisitModel primary, PatientVisitModel fallback) {
        if (primary != null && primary.getPatientModel() != null && primary.getPatientModel().getOwnerUUID() != null) {
            return primary.getPatientModel().getOwnerUUID();
        }
        if (fallback != null && fallback.getPatientModel() != null) {
            return fallback.getPatientModel().getOwnerUUID();
        }
        return null;
    }

    private void notifyPvtEvent(PatientVisitModel pvt, int eventType) {
        String uuid = contextHolder.getServerUUID();
        ChartEventModel msg = new ChartEventModel(uuid);
        msg.setParamFromPvt(pvt);
        msg.setPatientVisitModel(pvt);
        msg.setEventType(eventType);
        eventServiceBean.notifyEvent(msg);
    }

    private static String resolveInsuranceKey(HealthInsuranceModel model) {
        if (model == null) {
            return null;
        }

        PVTHealthInsuranceModel insurance = decodeInsurance(model);
        if (insurance != null) {
            String guid = normalizeText(insurance.getGUID());
            if (guid != null) {
                return "guid:" + guid;
            }
            String metadataKey = joinInsuranceKey(
                    insurance.getInsuranceClassCode(),
                    insurance.getInsuranceNumber(),
                    insurance.getClientGroup(),
                    insurance.getClientNumber(),
                    insurance.getFamilyClass(),
                    insurance.getStartDate());
            if (metadataKey != null) {
                return "meta:" + metadataKey;
            }
        }

        return null;
    }

    private static PVTHealthInsuranceModel decodeInsurance(HealthInsuranceModel model) {
        String json = model != null ? model.getBeanJson() : null;
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            Object decoded = ModelUtils.jsonDecode(json);
            return decoded instanceof PVTHealthInsuranceModel insurance ? insurance : null;
        } catch (RuntimeException ignore) {
            return null;
        }
    }

    private static String joinInsuranceKey(String... parts) {
        StringBuilder builder = new StringBuilder();
        boolean hasValue = false;
        for (int i = 0; i < parts.length; i++) {
            if (i > 0) {
                builder.append('|');
            }
            String normalized = normalizeText(parts[i]);
            if (normalized != null) {
                builder.append(normalized);
                hasValue = true;
            }
        }
        return hasValue ? builder.toString() : null;
    }

    private static String normalizeText(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    record InsuranceUpdate(HealthInsuranceModel persisted, HealthInsuranceModel incoming) {
    }

    record InsuranceMergeResult(List<InsuranceUpdate> updates,
            List<HealthInsuranceModel> additions,
            List<HealthInsuranceModel> merged) {
    }

//    /**
//     * 患者来院情報を登録する。
//     * @param spec 来院情報を保持する DTO オブジェクト
//     * @return 登録個数
//     */
//    
//    public int addPvt(PatientVisitModel pvt) {
//
//        PatientModel patient = pvt.getPatientModel();
//        String fid = pvt.getFacilityId();
//        
//        // 2012-07
//        // ORCAの受付で、受付する保険や担当医を間違え、キャンセルなしに再受付した場合の処理を変更。
//        // 前のレコードを削除して新規に受付のレコードを生成すると、クライアントプログラムで削除した受付レコードを
//        // 保持し、カルテ保存後もステータスが更新されないケースがあった。
//        // 再受付の場合は最初のレコードを後からきたデータで上書きするようにした。
//
////        //--------------------------------------------
////        // 二重登録をチェックする
////        //--------------------------------------------
////        try {
////            List<PatientVisitModel> list = (List<PatientVisitModel>)em
////                    .createQuery(QUERY_PVT_BY_FID_PID_DATE)
////                    .setParameter(FID, fid)
////                    .setParameter(DATE, pvt.getPvtDate()+PERCENT)
////                    .setParameter(PID, patient.getPatientId())
////                    .getResultList();
////            if (!list.isEmpty()) {
////                for (PatientVisitModel doubleEntry : list) {
////                    em.remove(doubleEntry);
////                }
////            }
////
////        } catch (Exception te) {
////            return 0;
////        }
//
//        // 既存の患者かどうか調べる
//        try {
//            PatientModel exist = (PatientModel) em
//                    .createQuery(QUERY_PATIENT_BY_FID_PID)
//                    .setParameter(FID, fid)
//                    .setParameter(PID, patient.getPatientId())
//                    .getSingleResult();
//
//            //-----------------------------
//            // 健康保険情報を更新する
//            //-----------------------------
//            Collection<HealthInsuranceModel> ins = patient.getHealthInsurances();
//            if (ins != null && ins.size() > 0) {
//
//                // 健康保険を更新する
//                Collection old = em.createQuery(QUERY_INSURANCE_BY_PATIENT_ID)
//                .setParameter(ID, exist.getId())
//                .getResultList();
//
//                // 現在の保険情報を削除する
//                for (Iterator iter = old.iterator(); iter.hasNext(); ) {
//                    HealthInsuranceModel model = (HealthInsuranceModel) iter.next();
//                    em.remove(model);
//                }
//
//                // 新しい健康保険情報を登録する
//                Collection<HealthInsuranceModel> newOne = patient.getHealthInsurances();
//                for (HealthInsuranceModel model : newOne) {
//                    model.setPatient(exist);
//                    em.persist(model);
//                }
//            }
//
//            // 名前を更新する 2007-04-12
//            exist.setFamilyName(patient.getFamilyName());
//            exist.setGivenName(patient.getGivenName());
//            exist.setFullName(patient.getFullName());
//            exist.setKanaFamilyName(patient.getKanaFamilyName());
//            exist.setKanaGivenName(patient.getKanaGivenName());
//            exist.setKanaName(patient.getKanaName());
//            exist.setRomanFamilyName(patient.getRomanFamilyName());
//            exist.setRomanGivenName(patient.getRomanGivenName());
//            exist.setRomanName(patient.getRomanName());
//
//            // 性別
//            exist.setGender(patient.getGender());
//            exist.setGenderDesc(patient.getGenderDesc());
//            exist.setGenderCodeSys(patient.getGenderCodeSys());
//
//            // Birthday
//            exist.setBirthday(patient.getBirthday());
//
//            // 住所、電話を更新する
//            exist.setSimpleAddressModel(patient.getSimpleAddressModel());
//            exist.setTelephone(patient.getTelephone());
//            //exist.setMobilePhone(patient.getMobilePhone());
//
//            // PatientVisit との関係を設定する
//            pvt.setPatientModel(exist);
//
//        } catch (NoResultException e) {
//            // 新規患者であれば登録する
//            // 患者属性は cascade=PERSIST で自動的に保存される
//            em.persist(patient);
//
//            // この患者のカルテを生成する
//            KarteBean karte = new KarteBean();
//            karte.setPatientModel(patient);
//            karte.setCreated(new Date());
//            em.persist(karte);
//        }
////
////        // 来院情報を登録する
////        // 旧仕様により患者情報のみを登録し、来院情報がない場合がある
////        // それを pvtDate の属性で判断している
////        if (pvt.getPvtDate() != null) {
////            em.persist(pvt);
////        }
//        
//        // 来院情報を登録する
//        // 旧仕様により患者情報のみを登録し、来院情報がない場合がある
//        // それを pvtDate の属性で判断している
//        if (pvt.getPvtDate()==null) {
//            return 1;
//        }
//        
//        //------------------------------------------
//        // 既に同一患者同一時刻で受け付けがあるか ?
//        //------------------------------------------
//        List<PatientVisitModel> list = (List<PatientVisitModel>)em
//                    .createQuery(QUERY_PVT_BY_FID_PID_DATE)
//                    .setParameter(FID, fid)
//                    .setParameter(DATE, pvt.getPvtDate()+PERCENT)
//                    .setParameter(PID, patient.getPatientId())
//                    .getResultList();
//        
//        if (list.isEmpty()) {
//            // 受付がない場合
//            em.persist(pvt);
//            
//        } else {
//            // 最初のレコードを後から来たデータで上書きする
//            PatientVisitModel target = list.get(0);
//            target.setDepartment(pvt.getDepartment());
//            target.setDeptCode(pvt.getDeptCode());
//            target.setDeptName(pvt.getDeptName());
//            target.setDoctorId(pvt.getDoctorId());
//            target.setDoctorName(pvt.getDoctorName());
//            target.setFirstInsurance(pvt.getFirstInsurance());
//            target.setInsuranceUid(pvt.getInsuranceUid());
//            target.setJmariNumber(pvt.getJmariNumber());
//            // transient及び値が変更されないもの
//            //target.setAppointment(pvt.getAppointment());
//            //target.setFacilityId(pvt.getFacilityId());
//            //target.setMemo(pvt.getMemo());
//            //target.setNumber(pvt.getNumber());
//            //target.setPatientModel(pvt.getPatientModel());
//            //target.setPvtDate(pvt.getPvtDate());
//            //target.setState(pvt.getState());
//            //target.setWatingTime(pvt.getWatingTime());
//        }
//        
//        return 1;
//    }

    /**
     * 施設の患者来院情報を取得する。
     * @param fid
     * @param date
     * @param firstResult
     * @param appoDateFrom
     * @param appoDateTo
     * @return 来院情報のCollection
     */
    
    public List<PatientVisitModel> getPvt(String fid, String date, int firstResult, String appoDateFrom, String appoDateTo) {
        return getPvt(fid, date, firstResult, DEFAULT_PVT_PAGE_SIZE, appoDateFrom, appoDateTo);
    }

    public List<PatientVisitModel> getPvt(String fid, String date, int firstResult, int maxResult, String appoDateFrom,
            String appoDateTo) {
        LocalDate targetDate = ModelUtils.parseDate(date != null ? date.replace("%", "") : null);
        if (targetDate == null) {
            return List.of();
        }
        int safeFirst = normalizePvtFirstResult(firstResult);
        int safeMax = normalizePvtPageSize(maxResult);
        
        // PatientVisitModelを施設IDで検索する
        List<PatientVisitModel> result =
                (List<PatientVisitModel>) em.createQuery(QUERY_PVT_BY_FID_DATE)
                              .setParameter(FID, fid)
                              .setParameter(FROM_DATE, targetDate.atStartOfDay())
                              .setParameter(TO_DATE, targetDate.plusDays(1).atStartOfDay())
                              .setFirstResult(safeFirst)
                              .setMaxResults(safeMax)
                              .getResultList();

        int len = result.size();

        if (len == 0) {
            return result;
        }

        Date theDate = ModelUtils.getDateAsObject(targetDate.toString());

        boolean searchAppo = (appoDateFrom != null && appoDateTo != null);
        attachVisitHealthInsurances(result);
        if (searchAppo) {
            attachVisitAppointments(result, theDate);
        }

        return result;
    }

    
    public List<PatientVisitModel> getPvt(String fid, String did, String unassigned, String date, int firstResult,
            String appoDateFrom, String appoDateTo) {
        return getPvt(fid, did, unassigned, date, firstResult, DEFAULT_PVT_PAGE_SIZE, appoDateFrom, appoDateTo);
    }

    public List<PatientVisitModel> getPvt(String fid, String did, String unassigned, String date, int firstResult,
            int maxResult, String appoDateFrom, String appoDateTo) {
        LocalDate targetDate = ModelUtils.parseDate(date != null ? date.replace("%", "") : null);
        if (targetDate == null) {
            return List.of();
        }
        int safeFirst = normalizePvtFirstResult(firstResult);
        int safeMax = normalizePvtPageSize(maxResult);

        // PatientVisitModelを施設IDで検索する
        List<PatientVisitModel> result =
                (List<PatientVisitModel>) em.createQuery(QUERY_PVT_BY_FID_DID_DATE)
                              .setParameter(FID, fid)
                              .setParameter(DID, did)
                              .setParameter(UNASSIGNED, unassigned)
                              .setParameter(FROM_DATE, targetDate.atStartOfDay())
                              .setParameter(TO_DATE, targetDate.plusDays(1).atStartOfDay())
                              .setFirstResult(safeFirst)
                              .setMaxResults(safeMax)
                              .getResultList();

        int len = result.size();

        if (len == 0) {
            return result;
        }

        Date theDate = ModelUtils.getDateAsObject(targetDate.toString());

        boolean searchAppo = (appoDateFrom != null && appoDateTo != null);
        attachVisitHealthInsurances(result);
        if (searchAppo) {
            attachVisitAppointments(result, theDate);
        }

        return result;
    }

    static int normalizePvtFirstResult(int firstResult) {
        return Math.max(firstResult, 0);
    }

    public static int normalizePvtPageSize(int maxResult) {
        if (maxResult <= 0) {
            return DEFAULT_PVT_PAGE_SIZE;
        }
        return Math.min(maxResult, MAX_PVT_PAGE_SIZE);
    }

    private void attachVisitHealthInsurances(List<PatientVisitModel> visits) {
        List<Long> patientIds = extractPatientIds(visits);
        if (patientIds.isEmpty()) {
            return;
        }
        List<HealthInsuranceModel> insurances = em.createQuery(
                        "from HealthInsuranceModel h where h.patient.id in (:ids)",
                        HealthInsuranceModel.class)
                .setParameter("ids", patientIds)
                .getResultList();
        Map<Long, List<HealthInsuranceModel>> grouped = new LinkedHashMap<>();
        for (HealthInsuranceModel insurance : insurances) {
            if (insurance == null || insurance.getPatient() == null) {
                continue;
            }
            grouped.computeIfAbsent(insurance.getPatient().getId(), ignored -> new ArrayList<>())
                    .add(insurance);
        }
        for (PatientVisitModel visit : visits) {
            if (visit == null || visit.getPatientModel() == null) {
                continue;
            }
            visit.getPatientModel().setHealthInsurances(
                    new ArrayList<>(grouped.getOrDefault(visit.getPatientModel().getId(), List.of())));
        }
    }

    private void attachVisitAppointments(List<PatientVisitModel> visits, Date targetDate) {
        if (targetDate == null) {
            return;
        }
        List<Long> patientIds = extractPatientIds(visits);
        if (patientIds.isEmpty()) {
            return;
        }
        List<KarteBean> kartes = em.createQuery(
                        "from KarteBean k where k.patient.id in (:ids)",
                        KarteBean.class)
                .setParameter("ids", patientIds)
                .getResultList();
        Map<Long, KarteBean> karteByPatientId = new LinkedHashMap<>();
        for (KarteBean karte : kartes) {
            if (karte != null && karte.getPatient() != null) {
                karteByPatientId.putIfAbsent(karte.getPatient().getId(), karte);
            }
        }

        List<Long> karteIds = new ArrayList<>();
        for (KarteBean karte : karteByPatientId.values()) {
            if (karte != null && karte.getId() > 0) {
                karteIds.add(karte.getId());
            }
        }
        if (karteIds.isEmpty()) {
            return;
        }

        List<AppointmentModel> appointments = em.createQuery(
                        "from AppointmentModel a where a.karte.id in (:ids) and a.date = :date order by a.karte.id, a.id",
                        AppointmentModel.class)
                .setParameter("ids", karteIds)
                .setParameter("date", targetDate)
                .getResultList();
        Map<Long, AppointmentModel> firstAppointmentByKarteId = new LinkedHashMap<>();
        for (AppointmentModel appointment : appointments) {
            if (appointment == null || appointment.getKarteBean() == null) {
                continue;
            }
            firstAppointmentByKarteId.putIfAbsent(appointment.getKarteBean().getId(), appointment);
        }

        for (PatientVisitModel visit : visits) {
            if (visit == null || visit.getPatientModel() == null) {
                continue;
            }
            KarteBean karte = karteByPatientId.get(visit.getPatientModel().getId());
            if (karte == null) {
                continue;
            }
            AppointmentModel appointment = firstAppointmentByKarteId.get(karte.getId());
            if (appointment != null) {
                visit.setAppointment(appointment.getName());
            }
        }
    }

    private List<Long> extractPatientIds(List<PatientVisitModel> visits) {
        LinkedHashMap<Long, Boolean> ids = new LinkedHashMap<>();
        for (PatientVisitModel visit : visits) {
            if (visit == null || visit.getPatientModel() == null) {
                continue;
            }
            long patientId = visit.getPatientModel().getId();
            if (patientId > 0) {
                ids.put(patientId, Boolean.TRUE);
            }
        }
        return new ArrayList<>(ids.keySet());
    }
    
      
    /**
     * 受付情報を削除する。
     * @param id
     * @param fid
     * @return 削除件数
     */
    public int removePvt(long id, String fid) {
        return removePvtForFacility(fid, id);
    }

    public int removePvtForFacility(String fid, long id) {
        if (fid == null || fid.isBlank()) {
            return 0;
        }
        try {
            PatientVisitModel exist = findPvtForFacility(fid, id);
            if (exist == null) {
                return 0;
            }
            em.remove(exist);

            contextHolder.removePvtById(fid, id);
            return 1;
        } catch (Exception e) {
        }
        return 0;
    }

    /**
     * 受付情報を削除する。
     * @param id 受付レコード
     * @return 削除件数
     */
    public int removePvt(long id) {
        PatientVisitModel exist = (PatientVisitModel) em.find(PatientVisitModel.class, new Long(id));
        em.remove(exist);
        return 1;
    }

    /**
     * 診察終了情報を書き込む。
     * @param pk レコードID
     * @param state 診察終了の時 1
     * @return 
     */
    
    public int updatePvtStateForFacility(String fid, long pk, int state) {
        PatientVisitModel exist = findPvtForFacility(fid, pk);
        if (exist == null) {
            return 0;
        }
        return updatePvtStateInternal(exist, state);
    }

    public int updatePvtState(long pk, int state) {
        List<PatientVisitModel> list =  em
                .createQuery(QUERY_PVT_BY_PK)
                .setParameter(ID, pk)
                .getResultList();
        
        if (list.isEmpty()) {
            return 0;
        }
        return updatePvtStateInternal(list.get(0), state);
    }

    private int updatePvtStateInternal(PatientVisitModel exist, int state) {
        // 旧来の「送信済み/修正送信済み」状態（bit=1/2）は互換のため許可する。
        if (state == LEGACY_FINALIZED_SAVE_STATE || state == LEGACY_FINALIZED_MODIFY_STATE) {
            exist.setState(state);
            em.flush();
            return 1;
        }

        int curState = exist.getState();
        boolean finalizedSave = (curState & LEGACY_FINALIZED_SAVE_STATE) != 0;
        boolean finalizedModify = (curState & LEGACY_FINALIZED_MODIFY_STATE) != 0;
        boolean cancel = (curState & (1 << BIT_CANCEL)) != 0;

        // 旧来の確定状態またはキャンセル状態は変更不可。
        if (finalizedSave || finalizedModify || cancel) {
            return 0;
        }

        exist.setState(state);
        em.flush();
        return 1;
    }

    /**
     * メモを更新する。
     * @param pk レコードID
     * @param memo メモ
     * @return 1
     */
    
    public int updateMemoForFacility(String fid, long pk, String memo) {
        PatientVisitModel exist = findPvtForFacility(fid, pk);
        if (exist == null) {
            return 0;
        }
        exist.setMemo(memo);
        return 1;
    }

    public int updateMemo(long pk, String memo) {
        PatientVisitModel exist = (PatientVisitModel) em.find(PatientVisitModel.class, new Long(pk));
        exist.setMemo(memo);
        return 1;
    }

    private PatientVisitModel findPvtForFacility(String fid, long id) {
        if (fid == null || fid.isBlank()) {
            return null;
        }
        List<PatientVisitModel> list = em
                .createQuery(QUERY_PVT_BY_PK_FID)
                .setParameter(ID, id)
                .setParameter(FID, fid)
                .setMaxResults(1)
                .getResultList();
        return list.isEmpty() ? null : list.get(0);
    }
}
