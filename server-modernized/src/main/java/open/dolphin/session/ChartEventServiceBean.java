package open.dolphin.session;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.UnsupportedEncodingException;
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
import jakarta.servlet.AsyncContext;
import jakarta.transaction.Transactional;
import open.dolphin.infomodel.*;
import open.dolphin.mbean.ServletContextHolder;
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

        // Modernized realtime notifications must go through SSE first.
        // The AsyncContext list is retained only as a frozen fallback for legacy long-poll clients.
        chartEventStreamPublisher.broadcast(evt);
        dispatchLegacyAsyncContexts(evt, fid);
    }

    private void dispatchLegacyAsyncContexts(ChartEventModel evt, String fid) {
        List<AsyncContext> acList = contextHolder.getAsyncContextList();
        if (acList.isEmpty()) {
            return;
        }
        synchronized (acList) {
            for (Iterator<AsyncContext> itr = acList.iterator(); itr.hasNext();) {
                
                AsyncContext ac = itr.next();
                String acFid = (String) ac.getRequest().getAttribute(ChartEventSessionKeys.FACILITY_ID);
                String acUUID = (String) ac.getRequest().getAttribute(ChartEventSessionKeys.CLIENT_UUID);
                String issuerUUID = evt.getIssuerUUID();
                
                // 同一施設かつChartEventModelの発行者でないクライアントに通知する
                if (fid.equals(acFid) && !acUUID.equals(issuerUUID)) {
                    itr.remove();
                    try {
                        ac.getRequest().setAttribute(ChartEventSessionKeys.EVENT_ATTRIBUTE, evt);
                        ac.dispatch(ChartEventSessionKeys.DISPATCH_URL);
//minagawa^                        
                        if (true) {
                            StringBuilder sb = new StringBuilder();
                            sb.append(acFid).append(":").append(acUUID);
                            sb.append(" did notified by ").append(issuerUUID);
                            debug(sb.toString());
                        }
//minagawa$                        
                    } catch (Exception ex) {
                        warn("Exception in ac.dispatch.", ex);
                    }
                }
            }
        }
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
        
        int eventType = evt.getEventType();
        
        if (DEBUG) {
            StringBuilder sb = new StringBuilder();
            sb.append("ChartEventServiceBean: ").append(eventType).append(" will issue");
            debug(sb.toString());
        }
        
        boolean sendEvent = true;
        switch(eventType) {
            case ChartEventModel.PVT_DELETE:
                sendEvent = processPvtDeleteEvent(evt);
                break;
            case ChartEventModel.PVT_STATE:
                sendEvent = processPvtStateEvent(evt);
                break;
//s.oh^ 2014/10/14 診察終了後のメモ対応
            case ChartEventModel.PVT_MEMO:
                sendEvent = processPvtMemoEvent(evt);
                break;
//s.oh$
            default:
                return 0;
        }
        // クライアントに通知
        if(sendEvent) notifyEvent(evt);

        return 1;
    }

    private boolean processPvtDeleteEvent(ChartEventModel evt) {
        
        long pvtPk = evt.getPvtPk();
        String fid = evt.getFacilityId();

        // データベースから削除
        PatientVisitModel exist = em.find(PatientVisitModel.class, pvtPk);
        if (!isPvtFacilityMatched(exist, fid)) {
            return false;
        }
        // WatingListから開いていないとexist = nullなので。
        PatientModel pm = exist.getPatientModel();
        if(pm != null) {
            log("processPvtDeleteEvent : pvtPk = " + String.valueOf(pvtPk) + ", ptId = " + pm.getPatientId() + ", pvtDate = " + exist.getPvtDate());
        }
        em.remove(exist);
        // pvtListから削除
        List<PatientVisitModel> pvtList = getPvtList(fid);
        PatientVisitModel toRemove = null;
        for (PatientVisitModel model : pvtList) {
            if (model.getId() == pvtPk) {
                toRemove = model;
                break;
            }
        }
        if (toRemove != null) {
            pvtList.remove(toRemove);
        }
        return true;
    }
    
    private boolean processPvtStateEvent(ChartEventModel evt) {
        
        // msgからパラメーターを取得
        String fid = evt.getFacilityId();
        long pvtId = evt.getPvtPk();
        int state = evt.getState();
        int byomeiCount = evt.getByomeiCount();
        int byomeiCountToday = evt.getByomeiCountToday();
        String memo = evt.getMemo();
        String ownerUUID = evt.getOwnerUUID();
        
        if((state & (1 << PatientVisitModel.BIT_NOTUPDATE)) > 0) {
            return false;
        }

        // データベースのPatientVisitModelを更新
        PatientVisitModel pvt = em.find(PatientVisitModel.class, pvtId);
        if (!isPvtFacilityMatched(pvt, fid)) {
            return false;
        }
        List<PatientVisitModel> pvtList = getPvtList(fid);

        if (pvt != null) {
//s.oh^ 2013/08/29
            //pvt.setState(state);
            if(state <= 1 && pvt.getState() >= 2) {
                if((state & (1 << PatientVisitModel.BIT_CANCEL)) == 0 && (pvt.getState() & (1 << PatientVisitModel.BIT_CANCEL)) > 0) {
                    int status = pvt.getState();
                    status &= ~(1 << PatientVisitModel.BIT_CANCEL);
                    pvt.setState(status);
                }else if((state & (1 << PatientVisitModel.BIT_TREATMENT)) == 0 && (pvt.getState() & (1 << PatientVisitModel.BIT_TREATMENT)) > 0) {
                    int status = pvt.getState();
                    status &= ~(1 << PatientVisitModel.BIT_TREATMENT);
                    pvt.setState(status);
                }else if((state & (1 << PatientVisitModel.BIT_GO_OUT)) == 0 && (pvt.getState() & (1 << PatientVisitModel.BIT_GO_OUT)) > 0) {
                    int status = pvt.getState();
                    status &= ~(1 << PatientVisitModel.BIT_GO_OUT);
                    pvt.setState(status);
                }else if((state & (1 << PatientVisitModel.BIT_HURRY)) == 0 && (pvt.getState() & (1 << PatientVisitModel.BIT_HURRY)) > 0) {
                    int status = pvt.getState();
                    status &= ~(1 << PatientVisitModel.BIT_HURRY);
                    pvt.setState(status);
                }else{
                    log("state <= 1 && pvt.getState() >= 2 && pvt.getState() != BIT_CANCEL/BIT_TREATMENT/BIT_GO_OUT/BIT_HURRY");
                }
                // 正しい情報で通知するように設定
                evt.setState(pvt.getState());
            }else{
                pvt.setState(state);
            }
//s.oh$
            pvt.setByomeiCount(byomeiCount);
            pvt.setByomeiCountToday(byomeiCountToday);
            pvt.setMemo(memo);
        }
        // データベースのPatientModelを更新
        PatientModel pm = pvt.getPatientModel();
        long resolvedPtPk = pm != null ? pm.getId() : 0L;
        if (pm != null) {
            log("processPvtStateEvent : owner = " + ownerUUID + ", pvtPk = " + String.valueOf(pvtId) + ", ptId = " + pm.getPatientId() + ", state = " + String.valueOf(state));
            pm.setOwnerUUID(ownerUUID);
        }

        // pvtListを更新
        for (PatientVisitModel model : pvtList) {
            if (model.getId() == pvtId) {
//s.oh^ 2013/08/29
                //model.setState(state);
                if(state <= 1 && model.getState() >= 2) {
                    if((state & (1 << PatientVisitModel.BIT_CANCEL)) == 0 && (model.getState() & (1 << PatientVisitModel.BIT_CANCEL)) > 0) {
                        int status = model.getState();
                        status &= ~(1 << PatientVisitModel.BIT_CANCEL);
                        model.setState(status);
                    }else if((state & (1 << PatientVisitModel.BIT_TREATMENT)) == 0 && (model.getState() & (1 << PatientVisitModel.BIT_TREATMENT)) > 0) {
                        int status = model.getState();
                        status &= ~(1 << PatientVisitModel.BIT_TREATMENT);
                        model.setState(status);
                    }else if((state & (1 << PatientVisitModel.BIT_GO_OUT)) == 0 && (model.getState() & (1 << PatientVisitModel.BIT_GO_OUT)) > 0) {
                        int status = model.getState();
                        status &= ~(1 << PatientVisitModel.BIT_GO_OUT);
                        model.setState(status);
                    }else if((state & (1 << PatientVisitModel.BIT_HURRY)) == 0 && (model.getState() & (1 << PatientVisitModel.BIT_HURRY)) > 0) {
                        int status = model.getState();
                        status &= ~(1 << PatientVisitModel.BIT_HURRY);
                        model.setState(status);
                    }else{
                        log("state <= 1 && model.getState() >= 2 && model.getState() != BIT_CANCEL/BIT_TREATMENT/BIT_GO_OUT/BIT_HURRY");
                    }
                    // 正しい情報で通知するように設定
                    evt.setState(model.getState());
                }else{
                    model.setState(state);
                }
//s.oh$
                model.setByomeiCount(byomeiCount);
                model.setByomeiCountToday(byomeiCountToday);
                model.setMemo(memo);
                if (model.getPatientModel() != null) {
                    model.getPatientModel().setOwnerUUID(ownerUUID);
                }
                break;
            }
        }
//s.oh^ 2013/08/13
        for (PatientVisitModel model : pvtList) {
            if (resolvedPtPk > 0 && model.getPatientModel() != null && model.getPatientModel().getId() == resolvedPtPk) {
                model.setStateBit(PatientVisitModel.BIT_OPEN, ownerUUID != null);
                model.getPatientModel().setOwnerUUID(ownerUUID);
            }
        }
//s.oh$
        return true;
    }
    
//s.oh^ 2014/10/14 診察終了後のメモ対応
    private boolean processPvtMemoEvent(ChartEventModel evt) {
        
        String fid = evt.getFacilityId();
        long pvtId = evt.getPvtPk();
        int state = evt.getState();
        String memo = evt.getMemo();
        
        if((state & (1 << PatientVisitModel.BIT_NOTUPDATE)) > 0) {
            return false;
        }

        PatientVisitModel pvt = em.find(PatientVisitModel.class, pvtId);
        if (!isPvtFacilityMatched(pvt, fid)) {
            return false;
        }

        List<PatientVisitModel> pvtList = getPvtList(fid);
        pvt.setMemo(memo);
        
        log("processPvtMemoEvent : pvtPk = " + String.valueOf(pvtId) + ", memo = " + memo);

        for(PatientVisitModel model : pvtList) {
            if(model.getId() == pvtId) {
                model.setMemo(memo);
                break;
            }
        }
        return true;
    }
//s.oh$

    private boolean isPvtFacilityMatched(PatientVisitModel pvt, String fid) {
        if (pvt == null || fid == null || fid.isBlank()) {
            return false;
        }
        String pvtFid = pvt.getFacilityId();
        return pvtFid != null && fid.trim().equals(pvtFid.trim());
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
            contextHolder.getPvtList(fid).add(pvt);

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
    
    // ０時にpvtListをリニューアルする
    public void renewPvtList() {
        
        contextHolder.setToday();
        
        Map<String, List<PatientVisitModel>> map = contextHolder.getPvtListMap();
        
//s.oh^ 受付リストのクリア 2013/08/15
        Properties config = new Properties();
        StringBuilder sb = new StringBuilder();
        sb.append(System.getProperty("jboss.home.dir"));
        sb.append(File.separator);
        sb.append("custom.properties");
        File f = new File(sb.toString());
        String pvtListClear = null;
        try {
            FileInputStream fin = new FileInputStream(f);
            InputStreamReader r = new InputStreamReader(fin, "JISAutoDetect");
            config.load(r);
            r.close();
            pvtListClear = config.getProperty("pvtlist.clear", "false");
        } catch (FileNotFoundException ex) {
            LOGGER.error("", ex);
        } catch (UnsupportedEncodingException ex) {
            LOGGER.error("", ex);
        } catch (IOException ex) {
            LOGGER.error("", ex);
        }
        
        if(pvtListClear != null && pvtListClear.equals("true")) {
            List<String> fidList = new ArrayList<String>();
            for (Iterator itr = map.entrySet().iterator(); itr.hasNext();) {
                Map.Entry entry = (Map.Entry) itr.next();
                List<PatientVisitModel> pvtList = (List<PatientVisitModel>) entry.getValue();
                pvtList.clear();
                fidList.add((String)entry.getKey());
                log("ChartEventService: fid = " + (String)entry.getKey());
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
        }else{
//s.oh$
        
            for (Iterator itr = map.entrySet().iterator(); itr.hasNext();) {
                Map.Entry entry = (Map.Entry) itr.next();
                List<PatientVisitModel> pvtList = (List<PatientVisitModel>) entry.getValue();

                List<PatientVisitModel> toRemove = new ArrayList<PatientVisitModel>();
                for (PatientVisitModel pvt : pvtList) {
                    boolean legacyFinalized =
                            pvt.getStateBit(LEGACY_FINALIZED_SAVE_BIT)
                                    || pvt.getStateBit(LEGACY_FINALIZED_MODIFY_BIT);
                    if (legacyFinalized || pvt.getStateBit(PatientVisitModel.BIT_CANCEL)) {
                        toRemove.add(pvt);
                    }
                }
                pvtList.removeAll(toRemove);

                // クライアントに伝える。
                String fid = (String) entry.getKey();
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
    
    private void warn(String msg, Throwable throwable) {
        LOGGER.warn(msg, throwable);
    }
//minagawa$    
}
