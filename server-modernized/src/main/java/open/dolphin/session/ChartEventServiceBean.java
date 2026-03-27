package open.dolphin.session;

import java.text.SimpleDateFormat;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import open.dolphin.infomodel.*;
import open.dolphin.mbean.ServletContextHolder;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.session.framework.SessionOperation;
import open.dolphin.session.support.ChartEventSessionKeys;
import open.dolphin.session.support.ChartEventStreamPublisher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * ChartEventServiceBean
 * @author masuda, Masuda Naika
 */
@ApplicationScoped
@Transactional
@SessionOperation
public class ChartEventServiceBean {

    //private static final Logger logger = Logger.getLogger(ChartEventServiceBean.class.getSimpleName());

    private static final Logger LOGGER = LoggerFactory.getLogger(ChartEventServiceBean.class);
    private static final int LEGACY_FINALIZED_SAVE_BIT = 1;
    private static final int LEGACY_FINALIZED_MODIFY_BIT = 2;
    private static final String QUERY_PVT_BY_DATE =
            "from PatientVisitModel p where p.pvtDate >= :fromDate and p.pvtDate < :toDate order by p.id";
    private static final String QUERY_INSURANCE_BY_PATIENT_IDS =
            "from HealthInsuranceModel h where h.patient.id in :patientIds";
    private static final String QUERY_KARTE_BY_PATIENT_IDS =
            "from KarteBean k where k.patient.id in :patientIds";
    private static final String QUERY_APPOINTMENTS_BY_KARTE_IDS_DATE =
            "from AppointmentModel a where a.karte.id in :karteIds and a.date = :date";
    private static final String QUERY_DIAGNOSES_BY_KARTE_IDS =
            "from RegisteredDiagnosisModel r where r.karte.id in :karteIds";
    
    @Inject
    private ServletContextHolder contextHolder;

    @Inject
    private ChartEventStreamPublisher chartEventStreamPublisher;

    @Inject
    private ServerConfigurationResolver configurationResolver;
    
    @PersistenceContext
    private EntityManager em;
    
    private boolean DEBUG = false;
    private final AtomicBoolean initialized = new AtomicBoolean(false);
    private final Object initLock = new Object();
    

    public void notifyEvent(ChartEventModel evt) {

        String fid = evt.getFacilityId();
        if (fid == null) {
            warn("Facility id is null.");
            return;
        }

        chartEventStreamPublisher.broadcast(evt);
    }
    
    public String getServerUUID() {
        return contextHolder.getServerUUID();
    }

    public List<PatientVisitModel> getPvtList(String fid) {
        return contextHolder.getPvtList(fid);
    }
    
    /**
     * ChartEventModelを処理する
     */
    public int processChartEvent(ChartEventModel evt) {
        if (evt == null) {
            return 0;
        }
        int eventType = evt.getEventType();
        if (eventType == ChartEventModel.PVT_DELETE
                || eventType == ChartEventModel.PVT_STATE
                || eventType == ChartEventModel.PVT_MEMO) {
            warn("Legacy PVT mutation event was ignored after encounter cutover: eventType=" + eventType);
            return 0;
        }
        return 0;
    }

    public void start() {
        log("ChartEventServiceBean: start did call");
        ensureInitialized();
    }

    /**
     * ServletStartup が呼ばれないケースでもコンテキストの初期化を保証する。
     */
    public void ensureInitialized() {
        if (initialized.get()) {
            contextHolder.ensureDateInitialized();
            return;
        }

        synchronized (initLock) {
            if (initialized.get()) {
                contextHolder.ensureDateInitialized();
                return;
            }

            contextHolder.ensureDateInitialized();
            setupServerUUID();
            initializePvtList();
            initialized.set(true);
        }
    }
    
    // serverUUIDを設定する
    private void setupServerUUID() {
        String uuid = UUID.randomUUID().toString();
        contextHolder.setServerUUID(uuid);
        log("ServerUUID="+uuid);
    }
    
    // 起動後最初のPvtListを作る
    private void initializePvtList() {

        contextHolder.ensureDateInitialized();
        
        // PatientVisitModel.pvtDate は LocalDateTime のため、サーバー日付境界を LocalDateTime で渡す。
        LocalDateTime fromDate = startOfDay(contextHolder.getToday());
        LocalDateTime toDate = startOfDay(contextHolder.getTomorrow());

        // PatientVisitModelを施設IDで検索する
        @SuppressWarnings("unchecked")
        List<PatientVisitModel> result =
                em.createQuery(QUERY_PVT_BY_DATE)
                .setParameter("fromDate", fromDate)
                .setParameter("toDate", toDate)
                .getResultList();

        Map<Long, List<HealthInsuranceModel>> insurancesByPatientId = loadInsurancesByPatientIds(result);
        Map<Long, KarteBean> karteByPatientId = loadKarteByPatientIds(result);
        Map<Long, String> appointmentsByKarteId = loadAppointmentsByKarteId(karteByPatientId.values());
        Map<Long, List<RegisteredDiagnosisModel>> diagnosesByKarteId =
                loadDiagnosesByKarteId(karteByPatientId.values());

        // 患者の基本データを取得する
        // 来院情報と患者は ManyToOne の関係である
        //int counter = 0;

        for (PatientVisitModel pvt : result) {
            
            String fid = pvt.getFacilityId();
            contextHolder.addPvt(fid, pvt);

            PatientModel patient = pvt.getPatientModel();
            patient.setHealthInsurances(new ArrayList<>(
                    insurancesByPatientId.getOrDefault(patient.getId(), List.of())));

            KarteBean karte = karteByPatientId.get(patient.getId());
            if (karte == null) {
                throw new NoResultException("KarteBean not found for patient id=" + patient.getId());
            }

            // カルテの PK を得る
            long karteId = karte.getId();

            String appointment = appointmentsByKarteId.get(karteId);
            if (appointment != null) {
                pvt.setAppointment(appointment);
            }

            // 病名数をチェックする
            applyByomeiCount(diagnosesByKarteId.getOrDefault(karteId, List.of()), pvt);
            // 受付番号セット
            //pvt.setNumber(++counter);
        }
        
        log("ChartEventService: initializePvtList did done");
    }

    private LocalDateTime startOfDay(Calendar calendar) {
        if (calendar == null) {
            return null;
        }
        return LocalDate.ofInstant(calendar.toInstant(), ZoneId.systemDefault()).atStartOfDay();
    }
    
    // データベースを調べてpvtに病名数を設定する
    public void setByomeiCount(long karteId, PatientVisitModel pvt) {
        List<RegisteredDiagnosisModel> rdList =
                em.createQuery("from RegisteredDiagnosisModel r where r.karte.id = :karteId")
                .setParameter("karteId", karteId)
                .getResultList();
        applyByomeiCount(rdList, pvt);
    }

    private void applyByomeiCount(List<RegisteredDiagnosisModel> rdList, PatientVisitModel pvt) {
        // byomeiCountがすでに0でないならば、byomeiCountは設定済みであろう
        //if (pvt.getByomeiCount() != 0) {
        //    return;
        //}

        int byomeiCount = 0;
        int byomeiCountToday = 0;
        Date pvtDate = Date.from(pvt.getPvtDate().atZone(ZoneId.systemDefault()).toInstant());

        for (RegisteredDiagnosisModel rd : rdList) {
            Date start = ModelUtils.getStartDate(rd.getStarted()).getTime();
            Date ended = ModelUtils.getEndedDate(rd.getEnded()).getTime();
            if (start.getTime() == pvtDate.getTime()) {
                byomeiCountToday++;
            }
            if (ModelUtils.isDateBetween(start, ended, pvtDate)) {
                byomeiCount++;
            }
        }
        pvt.setByomeiCount(byomeiCount);
        pvt.setByomeiCountToday(byomeiCountToday);
    }

    private Map<Long, List<HealthInsuranceModel>> loadInsurancesByPatientIds(List<PatientVisitModel> visits) {
        Set<Long> patientIds = collectPatientIds(visits);
        if (patientIds.isEmpty()) {
            return Map.of();
        }

        @SuppressWarnings("unchecked")
        List<HealthInsuranceModel> insurances = em.createQuery(QUERY_INSURANCE_BY_PATIENT_IDS)
                .setParameter("patientIds", patientIds)
                .getResultList();

        Map<Long, List<HealthInsuranceModel>> grouped = new HashMap<>();
        for (HealthInsuranceModel insurance : insurances) {
            grouped.computeIfAbsent(insurance.getPatient().getId(), ignored -> new ArrayList<>()).add(insurance);
        }
        return grouped;
    }

    private Map<Long, KarteBean> loadKarteByPatientIds(List<PatientVisitModel> visits) {
        Set<Long> patientIds = collectPatientIds(visits);
        if (patientIds.isEmpty()) {
            return Map.of();
        }

        @SuppressWarnings("unchecked")
        List<KarteBean> karteList = em.createQuery(QUERY_KARTE_BY_PATIENT_IDS)
                .setParameter("patientIds", patientIds)
                .getResultList();

        Map<Long, KarteBean> grouped = new HashMap<>();
        for (KarteBean karte : karteList) {
            grouped.putIfAbsent(karte.getPatientModel().getId(), karte);
        }
        return grouped;
    }

    private Map<Long, String> loadAppointmentsByKarteId(Collection<KarteBean> karteList) {
        Set<Long> karteIds = collectKarteIds(karteList);
        if (karteIds.isEmpty()) {
            return Map.of();
        }

        @SuppressWarnings("unchecked")
        List<AppointmentModel> appointments = em.createQuery(QUERY_APPOINTMENTS_BY_KARTE_IDS_DATE)
                .setParameter("karteIds", karteIds)
                .setParameter("date", contextHolder.getToday().getTime())
                .getResultList();

        Map<Long, String> grouped = new HashMap<>();
        for (AppointmentModel appointment : appointments) {
            grouped.putIfAbsent(appointment.getKarteBean().getId(), appointment.getName());
        }
        return grouped;
    }

    private Map<Long, List<RegisteredDiagnosisModel>> loadDiagnosesByKarteId(Collection<KarteBean> karteList) {
        Set<Long> karteIds = collectKarteIds(karteList);
        if (karteIds.isEmpty()) {
            return Map.of();
        }

        @SuppressWarnings("unchecked")
        List<RegisteredDiagnosisModel> diagnoses = em.createQuery(QUERY_DIAGNOSES_BY_KARTE_IDS)
                .setParameter("karteIds", karteIds)
                .getResultList();

        Map<Long, List<RegisteredDiagnosisModel>> grouped = new HashMap<>();
        for (RegisteredDiagnosisModel diagnosis : diagnoses) {
            grouped.computeIfAbsent(diagnosis.getKarteBean().getId(), ignored -> new ArrayList<>()).add(diagnosis);
        }
        return grouped;
    }

    private Set<Long> collectPatientIds(List<PatientVisitModel> visits) {
        Set<Long> patientIds = new LinkedHashSet<>();
        for (PatientVisitModel visit : visits) {
            PatientModel patient = visit.getPatientModel();
            if (patient != null && patient.getId() > 0) {
                patientIds.add(patient.getId());
            }
        }
        return patientIds;
    }

    private Set<Long> collectKarteIds(Collection<KarteBean> karteList) {
        Set<Long> karteIds = new LinkedHashSet<>();
        for (KarteBean karte : karteList) {
            if (karte != null && karte.getId() > 0) {
                karteIds.add(karte.getId());
            }
        }
        return karteIds;
    }

    private boolean isPvtListClearEnabled() {
        return configurationResolver != null && configurationResolver.pvtOperations().listClearEnabled();
    }
    
    // ０時にpvtListをリニューアルする
    public void renewPvtList() {
        
        contextHolder.setToday();
        
//s.oh^ 受付リストのクリア 2013/08/15
        if (isPvtListClearEnabled()) {
            List<String> fidList = contextHolder.getPvtFacilityIds();
            for (String fid : fidList) {
                contextHolder.clearPvtList(fid);
                log("ChartEventService: fid = " + fid);
            }
            initializePvtList();
            for(int i = 0; i < fidList.size(); i++) {
                String fid = fidList.get(i);
                String uuid = contextHolder.getServerUUID();
                ChartEventModel msg = new ChartEventModel(uuid);
                msg.setFacilityId(fid);
                msg.setEventType(ChartEventModel.PVT_RENEW);
                notifyEvent(msg);
            }
            log("ChartEventService: ServerUUID = " + contextHolder.getServerUUID());
        } else {
//s.oh$

            for (String fid : contextHolder.getPvtFacilityIds()) {
                List<PatientVisitModel> pvtList = getPvtList(fid);
                contextHolder.removePvtIf(fid, pvt -> {
                    boolean legacyFinalized =
                            pvt.getStateBit(LEGACY_FINALIZED_SAVE_BIT)
                                    || pvt.getStateBit(LEGACY_FINALIZED_MODIFY_BIT);
                    return legacyFinalized || pvt.getStateBit(PatientVisitModel.BIT_CANCEL);
                });

                // クライアントに伝える。
                String uuid = contextHolder.getServerUUID();
                ChartEventModel msg = new ChartEventModel(uuid);
                msg.setFacilityId(fid);
                msg.setEventType(ChartEventModel.PVT_RENEW);
                notifyEvent(msg);
            }
        }
        log("ChartEventService: renewPvtList did done");
    }

//minagawa^    
    private void log(String msg) {
        LOGGER.info(msg);
    }

    private void debug(String msg) {
        if (DEBUG) {
            LOGGER.debug(msg);
        }
    }

    private void warn(String msg) {
        LOGGER.warn(msg);
    }
    
//minagawa$    
}
