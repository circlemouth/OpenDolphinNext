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
@Named
@ApplicationScoped
@Transactional
@SessionOperation
public class PVTServiceBean {

    private static final Logger LOGGER = LoggerFactory.getLogger(PVTServiceBean.class);

    private static final String QUERY_PATIENT_BY_FID_PID        = "from PatientModel p where p.facilityId=:fid and p.patientId=:pid";
    private static final String QUERY_PVT_BY_FID_DATE           = "from PatientVisitModel p where p.facilityId=:fid and p.pvtDate >= :fromDate and p.pvtDate < :toDate order by p.pvtDate";
    private static final String QUERY_PVT_BY_FID_DID_DATE       = "from PatientVisitModel p where p.facilityId=:fid and p.pvtDate >= :fromDate and p.pvtDate < :toDate and (doctorId=:did or doctorId=:unassigned) order by p.pvtDate";
    private static final String QUERY_INSURANCE_BY_PATIENT_ID   = "from HealthInsuranceModel h where h.patient.id=:id";
    private static final String QUERY_KARTE_BY_PATIENT_ID       = "from KarteBean k where k.patient.id=:id";
    private static final String QUERY_APPO_BY_KARTE_ID_DATE     = "from AppointmentModel a where a.karte.id=:id and a.date=:date";
    private static final String QUERY_PVT_BY_PK                 = "from PatientVisitModel p where p.id=:id";
    private static final String QUERY_PVT_BY_PK_FID             = "from PatientVisitModel p where p.id=:id and p.facilityId=:fid";
    private static final String QUERY_KARTE_ID_BY_PATIENT_ID    = "select k.id from KarteBean k where k.patient.id = :id";
    
    private static final String FID = "fid";
    private static final String PID = "pid";
    private static final String DID = "did";
    private static final String UNASSIGNED = "unassigned";
    private static final String ID = "id";
    private static final String DATE = "date";
    private static final String FROM_DATE = "fromDate";
    private static final String TO_DATE = "toDate";
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
    public int addPvt(PatientVisitModel pvt) {

        eventServiceBean.ensureInitialized();
        String fid = prepareIncomingPvt(pvt);
        synchronizePatientAndAttach(fid, pvt);
        pvt.setPvtDate(normalizeVisitTimestamp(pvt.getPvtDate()));
        return registerVisit(fid, pvt);
    }

    private String prepareIncomingPvt(PatientVisitModel pvt) {
        String fid = pvt.getFacilityId();
        PatientModel patient = pvt.getPatientModel();
        pvt.setFacilityId(fid);
        patient.setFacilityId(fid);
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

    private void mergePatientInsurances(PatientModel exist, List<HealthInsuranceModel> incomingInsurances) { @SuppressWarnings("unchecked") List<HealthInsuranceModel> old = em.createQuery(QUERY_INSURANCE_BY_PATIENT_ID).setParameter(ID, exist.getId()).getResultList(); if (incomingInsurances != null && !incomingInsurances.isEmpty()) { InsuranceMergeResult mergeResult = mergeInsurances(old, incomingInsurances); for (InsuranceUpdate update : mergeResult.updates()) { HealthInsuranceModel persisted = update.persisted(); HealthInsuranceModel incoming = update.incoming(); persisted.setBeanJson(incoming.getBeanJson()); persisted.setPatient(exist); } for (HealthInsuranceModel model : mergeResult.additions()) { model.setPatient(exist); em.persist(model); } exist.setHealthInsurances(mergeResult.merged()); return; } exist.setHealthInsurances(old); }

    private void copyPatientProfile(PatientModel exist, PatientModel incoming) { exist.setFamilyName(incoming.getFamilyName()); exist.setGivenName(incoming.getGivenName()); exist.setFullName(incoming.getFullName()); exist.setKanaFamilyName(incoming.getKanaFamilyName()); exist.setKanaGivenName(incoming.getKanaGivenName()); exist.setKanaName(incoming.getKanaName()); exist.setGender(incoming.getGender()); exist.setGenderDesc(incoming.getGenderDesc()); exist.setGenderCodeSys(incoming.getGenderCodeSys()); exist.setBirthday(incoming.getBirthday()); exist.setSimpleAddressModel(incoming.getSimpleAddressModel()); exist.setTelephone(incoming.getTelephone()); exist.setAppMemo(incoming.getAppMemo()); }

    private void persistNewPatientAndKarte(PatientModel patient) { em.persist(patient); KarteBean karte = new KarteBean(); karte.setPatientModel(patient); karte.setCreated(new Date()); em.persist(karte); }

    private int registerVisit(String fid, PatientVisitModel pvt) {
        if (pvt.getPvtDate() == null) {
            return 0;
        }
        return isToday(pvt.getPvtDate()) ? persistTodayVisit(fid, pvt) : persistScheduledVisit(pvt);
    }

    private int persistScheduledVisit(PatientVisitModel pvt) {
        LOGGER.info("scheduled PVT: {}", pvt.getPvtDate());
        LocalDate visitDate = resolveVisitDate(pvt.getPvtDate());
        if (visitDate == null) {
            LOGGER.warn("skip scheduled PVT registration because visit timestamp is invalid: {}", pvt.getPvtDate());
            return 0;
        }
        em.persist(pvt);
        return 1;
    }

    private int persistTodayVisit(String fid, PatientVisitModel pvt) {
        long karteId = findKarteId(pvt);
        applyTodayAppointment(pvt, karteId);
        eventServiceBean.setByomeiCount(karteId, pvt);
        em.persist(pvt);
        notifyPvtEvent(pvt, ChartEventModel.PVT_ADD);
        return 1;
    }

    private long findKarteId(PatientVisitModel pvt) { return (Long) em.createQuery(QUERY_KARTE_ID_BY_PATIENT_ID).setParameter(ID, pvt.getPatientModel().getId()).getSingleResult(); }

    private void applyTodayAppointment(PatientVisitModel pvt, long karteId) { @SuppressWarnings("unchecked") List<AppointmentModel> appointments = em.createQuery(QUERY_APPO_BY_KARTE_ID_DATE).setParameter(ID, karteId).setParameter(DATE, contextHolder.getToday().getTime()).getResultList(); if (appointments != null && !appointments.isEmpty()) pvt.setAppointment(appointments.get(0).getName()); }

    private boolean isToday(LocalDateTime pvtDate) { LocalDate test = resolveVisitDate(pvtDate); return test != null && test.equals(LocalDate.now()); }

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

    static LocalDateTime normalizeVisitTimestamp(LocalDateTime rawPvtDate) {
        return rawPvtDate == null ? null : rawPvtDate.withNano(0);
    }

    static LocalDate resolveVisitDate(LocalDateTime pvtDate) {
        return pvtDate == null ? null : pvtDate.toLocalDate();
    }

    private void notifyPvtEvent(PatientVisitModel pvt, int eventType) {
        String uuid = contextHolder.getServerUUID();
        ChartEventModel msg = new ChartEventModel(uuid);
        msg.setParamFromPvt(pvt);
        msg.setPatientVisitModel(pvt);
        msg.setEventType(eventType);
        eventServiceBean.notifyEvent(msg);
    }

    private static String resolveInsuranceKey(HealthInsuranceModel model) { if (model == null) return null; PVTHealthInsuranceModel insurance = decodeInsurance(model); if (insurance == null) return null; String guid = normalizeText(insurance.getGUID()); if (guid != null) return "guid:" + guid; String metadataKey = joinInsuranceKey(insurance.getInsuranceClassCode(), insurance.getInsuranceNumber(), insurance.getClientGroup(), insurance.getClientNumber(), insurance.getFamilyClass(), insurance.getStartDate()); return metadataKey != null ? "meta:" + metadataKey : null; }

    private static PVTHealthInsuranceModel decodeInsurance(HealthInsuranceModel model) { String json = model != null ? model.getBeanJson() : null; if (json == null || json.isBlank()) return null; try { Object decoded = ModelUtils.jsonDecode(json); return decoded instanceof PVTHealthInsuranceModel insurance ? insurance : null; } catch (RuntimeException ignore) { return null; } }

    private static String joinInsuranceKey(String... parts) { StringBuilder builder = new StringBuilder(); boolean hasValue = false; for (int i = 0; i < parts.length; i++) { if (i > 0) builder.append('|'); String normalized = normalizeText(parts[i]); if (normalized != null) { builder.append(normalized); hasValue = true; } } return hasValue ? builder.toString() : null; }

    private static String normalizeText(String value) { if (value == null) return null; String trimmed = value.trim(); return trimmed.isEmpty() ? null : trimmed; }

    record InsuranceUpdate(HealthInsuranceModel persisted, HealthInsuranceModel incoming) {}

    record InsuranceMergeResult(List<InsuranceUpdate> updates, List<HealthInsuranceModel> additions, List<HealthInsuranceModel> merged) {}

    public List<PatientVisitModel> getPvt(String fid, String date, int firstResult, String appoDateFrom, String appoDateTo) { return getPvt(fid, date, firstResult, DEFAULT_PVT_PAGE_SIZE, appoDateFrom, appoDateTo); }

    public List<PatientVisitModel> getPvt(String fid, String date, int firstResult, int maxResult, String appoDateFrom, String appoDateTo) { LocalDate targetDate = ModelUtils.parseDate(date != null ? date.replace("%", "") : null); if (targetDate == null) return List.of(); List<PatientVisitModel> result = (List<PatientVisitModel>) em.createQuery(QUERY_PVT_BY_FID_DATE).setParameter(FID, fid).setParameter(FROM_DATE, targetDate.atStartOfDay()).setParameter(TO_DATE, targetDate.plusDays(1).atStartOfDay()).setFirstResult(normalizePvtFirstResult(firstResult)).setMaxResults(normalizePvtPageSize(maxResult)).getResultList(); if (result.isEmpty()) return result; Date theDate = ModelUtils.getDateAsObject(targetDate.toString()); attachVisitHealthInsurances(result); if (appoDateFrom != null && appoDateTo != null) attachVisitAppointments(result, theDate); return result; }

    public List<PatientVisitModel> getPvt(String fid, String did, String unassigned, String date, int firstResult, String appoDateFrom, String appoDateTo) { return getPvt(fid, did, unassigned, date, firstResult, DEFAULT_PVT_PAGE_SIZE, appoDateFrom, appoDateTo); }

    public List<PatientVisitModel> getPvt(String fid, String did, String unassigned, String date, int firstResult, int maxResult, String appoDateFrom, String appoDateTo) { LocalDate targetDate = ModelUtils.parseDate(date != null ? date.replace("%", "") : null); if (targetDate == null) return List.of(); List<PatientVisitModel> result = (List<PatientVisitModel>) em.createQuery(QUERY_PVT_BY_FID_DID_DATE).setParameter(FID, fid).setParameter(DID, did).setParameter(UNASSIGNED, unassigned).setParameter(FROM_DATE, targetDate.atStartOfDay()).setParameter(TO_DATE, targetDate.plusDays(1).atStartOfDay()).setFirstResult(normalizePvtFirstResult(firstResult)).setMaxResults(normalizePvtPageSize(maxResult)).getResultList(); if (result.isEmpty()) return result; Date theDate = ModelUtils.getDateAsObject(targetDate.toString()); attachVisitHealthInsurances(result); if (appoDateFrom != null && appoDateTo != null) attachVisitAppointments(result, theDate); return result; }

    static int normalizePvtFirstResult(int firstResult) { return Math.max(firstResult, 0); }

    public static int normalizePvtPageSize(int maxResult) { return maxResult <= 0 ? DEFAULT_PVT_PAGE_SIZE : Math.min(maxResult, MAX_PVT_PAGE_SIZE); }

    private void attachVisitHealthInsurances(List<PatientVisitModel> visits) { List<Long> patientIds = extractPatientIds(visits); if (patientIds.isEmpty()) return; List<HealthInsuranceModel> insurances = em.createQuery("from HealthInsuranceModel h where h.patient.id in (:ids)", HealthInsuranceModel.class).setParameter("ids", patientIds).getResultList(); Map<Long, List<HealthInsuranceModel>> grouped = new LinkedHashMap<>(); for (HealthInsuranceModel insurance : insurances) if (insurance != null && insurance.getPatient() != null) grouped.computeIfAbsent(insurance.getPatient().getId(), ignored -> new ArrayList<>()).add(insurance); for (PatientVisitModel visit : visits) if (visit != null && visit.getPatientModel() != null) visit.getPatientModel().setHealthInsurances(new ArrayList<>(grouped.getOrDefault(visit.getPatientModel().getId(), List.of()))); }

    private void attachVisitAppointments(List<PatientVisitModel> visits, Date targetDate) { if (targetDate == null) return; List<Long> patientIds = extractPatientIds(visits); if (patientIds.isEmpty()) return; List<KarteBean> kartes = em.createQuery("from KarteBean k where k.patient.id in (:ids)", KarteBean.class).setParameter("ids", patientIds).getResultList(); Map<Long, KarteBean> karteByPatientId = new LinkedHashMap<>(); for (KarteBean karte : kartes) if (karte != null && karte.getPatient() != null) karteByPatientId.putIfAbsent(karte.getPatient().getId(), karte); List<Long> karteIds = new ArrayList<>(); for (KarteBean karte : karteByPatientId.values()) if (karte != null && karte.getId() > 0) karteIds.add(karte.getId()); if (karteIds.isEmpty()) return; List<AppointmentModel> appointments = em.createQuery("from AppointmentModel a where a.karte.id in (:ids) and a.date = :date order by a.karte.id, a.id", AppointmentModel.class).setParameter("ids", karteIds).setParameter("date", targetDate).getResultList(); Map<Long, AppointmentModel> firstAppointmentByKarteId = new LinkedHashMap<>(); for (AppointmentModel appointment : appointments) if (appointment != null && appointment.getKarteBean() != null) firstAppointmentByKarteId.putIfAbsent(appointment.getKarteBean().getId(), appointment); for (PatientVisitModel visit : visits) if (visit != null && visit.getPatientModel() != null) { KarteBean karte = karteByPatientId.get(visit.getPatientModel().getId()); AppointmentModel appointment = karte != null ? firstAppointmentByKarteId.get(karte.getId()) : null; if (appointment != null) visit.setAppointment(appointment.getName()); } }

    private List<Long> extractPatientIds(List<PatientVisitModel> visits) { LinkedHashMap<Long, Boolean> ids = new LinkedHashMap<>(); for (PatientVisitModel visit : visits) if (visit != null && visit.getPatientModel() != null) { long patientId = visit.getPatientModel().getId(); if (patientId > 0) ids.put(patientId, Boolean.TRUE); } return new ArrayList<>(ids.keySet()); }

    public int removePvt(long id, String fid) { return removePvtForFacility(fid, id); }

    public int removePvtForFacility(String fid, long id) { if (fid == null || fid.isBlank()) return 0; try { PatientVisitModel exist = findPvtForFacility(fid, id); if (exist == null) return 0; em.remove(exist); return 1; } catch (Exception e) { return 0; } }

    public int removePvt(long id) { PatientVisitModel exist = (PatientVisitModel) em.find(PatientVisitModel.class, Long.valueOf(id)); em.remove(exist); return 1; }

    public int updatePvtStateForFacility(String fid, long pk, int state) { PatientVisitModel exist = findPvtForFacility(fid, pk); return exist == null ? 0 : updatePvtStateInternal(exist, state); }

    public int updatePvtState(long pk, int state) { List<PatientVisitModel> list = em.createQuery(QUERY_PVT_BY_PK).setParameter(ID, pk).getResultList(); return list.isEmpty() ? 0 : updatePvtStateInternal(list.get(0), state); }

    private int updatePvtStateInternal(PatientVisitModel exist, int state) { if (state == LEGACY_FINALIZED_SAVE_STATE || state == LEGACY_FINALIZED_MODIFY_STATE) { exist.setState(state); em.flush(); return 1; } int curState = exist.getState(); boolean finalizedSave = (curState & LEGACY_FINALIZED_SAVE_STATE) != 0; boolean finalizedModify = (curState & LEGACY_FINALIZED_MODIFY_STATE) != 0; boolean cancel = (curState & (1 << BIT_CANCEL)) != 0; if (finalizedSave || finalizedModify || cancel) return 0; exist.setState(state); em.flush(); return 1; }

    public int updateMemoForFacility(String fid, long pk, String memo) { PatientVisitModel exist = findPvtForFacility(fid, pk); if (exist == null) return 0; exist.setMemo(memo); return 1; }

    public int updateMemo(long pk, String memo) { PatientVisitModel exist = (PatientVisitModel) em.find(PatientVisitModel.class, Long.valueOf(pk)); exist.setMemo(memo); return 1; }

    private PatientVisitModel findPvtForFacility(String fid, long id) { if (fid == null || fid.isBlank()) return null; List<PatientVisitModel> list = em.createQuery(QUERY_PVT_BY_PK_FID).setParameter(ID, id).setParameter(FID, fid).setMaxResults(1).getResultList(); return list.isEmpty() ? null : list.get(0); }
}
