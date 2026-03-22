package open.dolphin.session;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.*;
import open.dolphin.session.framework.SessionOperation;
import open.dolphin.session.framework.SessionTraceAttributes;
import open.dolphin.session.framework.SessionTraceContext;
import open.dolphin.session.framework.SessionTraceManager;
import open.dolphin.security.audit.SessionAuditDispatcher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
@Named
@ApplicationScoped
@Transactional
@SessionOperation
public class NLabServiceBean {

    private static final Logger LOGGER = LoggerFactory.getLogger(NLabServiceBean.class);

    private static final String QUERY_MODULE_BY_MODULE_KEY = "from NLaboModule m where m.moduleKey=:moduleKey";
    private static final String QUERY_MODULE_BY_PID_SAMPLEDATE_LABCODE = "from NLaboModule m where m.patientId=:fidPid and m.sampleDate=:sampleDate and m.laboCenterCode=:laboCode";
    private static final String QUERY_MODULE_BY_FIDPID = "from NLaboModule l where l.patientId=:fidPid order by l.sampleDate desc";
    private static final String QUERY_ITEM_BY_MID = "from NLaboItem l where l.laboModule.id=:mid order by groupCode,parentCode,itemCode";
    private static final String QUERY_ITEM_BY_MID_ORDERBY_SORTKEY = "from NLaboItem l where l.laboModule.id=:mid order by l.sortKey";
    private static final String QUERY_ITEM_BY_FIDPID_ITEMCODE = "from NLaboItem l where l.patientId=:fidPid and l.itemCode=:itemCode order by l.sampleDate desc";
    private static final String QUERY_INSURANCE_BY_PATIENT_PK = "from HealthInsuranceModel h where h.patient.id=:pk";
    private static final String QUERY_MODULECOUNT_BY_FIDPID = "select count(*) from NLaboModule l where l.patientId=:fidPid";

    private static final String PK = "pk";
    private static final String FIDPID = "fidPid";
    private static final String SAMPLEDATE = "sampleDate";
    private static final String LABOCODE = "laboCode";
    private static final String MODULEKEY = "moduleKey";
    private static final String MID = "mid";
    private static final String ITEM_CODE = "itemCode";
    private static final String WOLF = "WOLF";

    @PersistenceContext
    private EntityManager em;

    @Inject
    private SessionAuditDispatcher sessionAuditDispatcher;

    @Inject
    private SessionTraceManager traceManager;

    
    public List<PatientLiteModel> getConstrainedPatients(String fid, List<String>idList) {

        List<PatientLiteModel> ret = new ArrayList<PatientLiteModel>(idList.size());

        for (String pid : idList) {

            try {
                PatientModel patient = (PatientModel) em
                    .createQuery("from PatientModel p where p.facilityId=:fid and p.patientId=:pid")
                    .setParameter("fid", fid)
                    .setParameter("pid", pid)
                    .getSingleResult();
                
                ret.add(patient.patientAsLiteModel());
                
            } catch (NoResultException e) {
                PatientLiteModel dummy = new PatientLiteModel();
                dummy.setFullName("未登録");
                dummy.setKanaName("未登録");
                dummy.setGender("U");
                ret.add(dummy);
            }
        }

        return ret;
    }

    
    public PatientModel create(String fid, NLaboModule module) {
        String fidPidBeforeNormalization = fid != null && module != null ? fid + ":" + module.getPatientId() : null;
        String previousPatientContext = setPatientContext(extractPatientId(fidPidBeforeNormalization));
        final String action = "LAB_TEST_CREATE";
        try {
            String pid = module.getPatientId();
            PatientModel patient = loadPatient(fid, pid);
            attachInsurance(patient);
            String fidPid = fid + ":" + pid;
            remapModulePatientContext(fidPid, fid, pid, module);
            NLaboModule exist = findExistingModule(fidPid, module.getSampleDate(), module.getLaboCenterCode(), module.getModuleKey());
            if (exist != null) em.remove(exist);
            em.persist(module);
            recordLabAudit(action, fidPidBeforeNormalization != null ? fidPidBeforeNormalization : module.getPatientId(), module != null ? module.getLaboCenterCode() : null, module != null && module.getItems() != null ? module.getItems().size() : 0, null, buildModuleDetails(module));
            return patient;
        } catch (RuntimeException ex) {
            recordLabAudit(action, fidPidBeforeNormalization, module != null ? module.getLaboCenterCode() : null, module != null && module.getItems() != null ? module.getItems().size() : 0, ex, buildModuleDetails(module));
            throw ex;
        } finally {
            restorePatientContext(previousPatientContext);
        }
    }

    private PatientModel loadPatient(String fid, String pid) {
        return (PatientModel) em.createQuery("from PatientModel p where p.facilityId=:fid and p.patientId=:pid")
                .setParameter("fid", fid)
                .setParameter("pid", pid)
                .getSingleResult();
    }

    private void attachInsurance(PatientModel patient) {
        if (patient == null) {
            return;
        }
        @SuppressWarnings("unchecked")
        List<HealthInsuranceModel> insurances = (List<HealthInsuranceModel>) em.createQuery(QUERY_INSURANCE_BY_PATIENT_PK)
                .setParameter(PK, patient.getId())
                .getResultList();
        patient.setHealthInsurances(insurances);
    }

    private void remapModulePatientContext(String fidPid, String fid, String pid, NLaboModule module) {
        if (module == null) {
            return;
        }
        module.setPatientId(fidPid);
        for (NLaboItem item : module.getItems()) {
            item.setPatientId(fidPid);
        }
        String moduleKey = normalizeModuleKey(fid, pid, module);
        if (moduleKey != null) {
            module.setModuleKey(moduleKey);
        }
    }

    private String normalizeModuleKey(String fid, String pid, NLaboModule module) {
        String moduleKey = module.getModuleKey();
        if (moduleKey == null) {
            return null;
        }
        String expected = new StringBuilder().append(pid).append('.').append(module.getSampleDate()).append('.').append(module.getLaboCenterCode()).toString();
        if (!expected.equals(moduleKey)) {
            return moduleKey;
        }
        return new StringBuilder().append(fid).append(':').append(moduleKey).toString();
    }

    private NLaboModule findExistingModule(String fidPid, String sampleDate, String laboCode, String moduleKey) {
        try {
            if (moduleKey != null) {
                return (NLaboModule) em.createQuery(QUERY_MODULE_BY_MODULE_KEY)
                        .setParameter(MODULEKEY, moduleKey)
                        .getSingleResult();
            }
            return (NLaboModule) em.createQuery(QUERY_MODULE_BY_PID_SAMPLEDATE_LABCODE)
                    .setParameter(FIDPID, fidPid)
                    .setParameter(SAMPLEDATE, sampleDate)
                    .setParameter(LABOCODE, laboCode)
                    .getSingleResult();
        } catch (Exception e) {
            return null;
        }
    }
    
    public List<NLaboModule> getLaboTest(String fidPid, int firstResult, int maxResult) {

        final String action = "LAB_TEST_READ";
        String previousPatientContext = setPatientContext(extractPatientId(fidPid));
        try {
            List<NLaboModule> ret = (List<NLaboModule>)
                            em.createQuery(QUERY_MODULE_BY_FIDPID)
                              .setParameter(FIDPID, fidPid)
                              .setFirstResult(firstResult)
                              .setMaxResults(maxResult)
                              .getResultList();

            for (NLaboModule m : ret) {

                if (m.getReportFormat()!=null && m.getReportFormat().equals(WOLF)) {
                    List<NLaboItem> items = (List<NLaboItem>)
                                    em.createQuery(QUERY_ITEM_BY_MID_ORDERBY_SORTKEY)
                                      .setParameter(MID, m.getId())
                                      .getResultList();
                    m.setItems(items);

                } else {
                    List<NLaboItem> items = (List<NLaboItem>)
                                    em.createQuery(QUERY_ITEM_BY_MID)
                                      .setParameter(MID, m.getId())
                                      .getResultList();
                    m.setItems(items);
                }
            }

            recordLabAudit(action, fidPid, joinLabCodes(ret), ret.size(), null,
                    buildReadDetails(firstResult, maxResult));
            return ret;
        } catch (RuntimeException ex) {
            recordLabAudit(action, fidPid, null, 0, ex, buildReadDetails(firstResult, maxResult));
            throw ex;
        } finally {
            restorePatientContext(previousPatientContext);
        }
    }
    public Long getLaboTestCount(String fidPid) {
        Long ret = (Long)em.createQuery(QUERY_MODULECOUNT_BY_FIDPID)
                .setParameter(FIDPID, fidPid)
                .getSingleResult();
        return ret;
    }
    
    public List<NLaboItem> getLaboTestItem(String fidPid, int firstResult, int maxResult, String itemCode) {

        final String action = "LAB_TEST_READ";
        String previousPatientContext = setPatientContext(extractPatientId(fidPid));
        try {
            List<NLaboItem> ret = (List<NLaboItem>)
                            em.createQuery(QUERY_ITEM_BY_FIDPID_ITEMCODE)
                              .setParameter(FIDPID, fidPid)
                              .setParameter(ITEM_CODE, itemCode)
                              .setFirstResult(firstResult)
                              .setMaxResults(maxResult)
                              .getResultList();

            recordLabAudit(action, fidPid, itemCode, ret.size(), null,
                    buildItemReadDetails(firstResult, maxResult, itemCode));
            return ret;
        } catch (RuntimeException ex) {
            recordLabAudit(action, fidPid, itemCode, 0, ex,
                    buildItemReadDetails(firstResult, maxResult, itemCode));
            throw ex;
        } finally {
            restorePatientContext(previousPatientContext);
        }
    }
    public int deleteLabTestForFacility(String fid, long id) {
        if (fid == null || fid.isBlank()) {
            return 0;
        }
        final String action = "LAB_TEST_DELETE";
        NLaboModule target = em.find(NLaboModule.class, id);
        String fidPid = target != null ? target.getPatientId() : null;
        String previousPatientContext = setPatientContext(extractPatientId(fidPid));
        try {
            if (target == null) {
                return 0;
            }
            String targetFacility = extractFacilityId(fidPid);
            if (targetFacility == null || !targetFacility.equals(fid)) {
                return 0;
            }
            em.remove(target);
            LOGGER.info("Lab module deleted {}", id);
            recordLabAudit(action, fidPid, target.getLaboCenterCode(),
                    target.getItems() != null ? target.getItems().size() : 0,
                    null, moduleIdDetails(id));
            return 1;
        } catch (RuntimeException ex) {
            recordLabAudit(action, fidPid, target != null ? target.getLaboCenterCode() : null,
                    target != null && target.getItems() != null ? target.getItems().size() : 0,
                    ex, moduleIdDetails(id));
            throw ex;
        } finally {
            restorePatientContext(previousPatientContext);
        }
    }
    @Deprecated
    public int deleteLabTest(long id) {
        final String action = "LAB_TEST_DELETE";
        NLaboModule target = em.find(NLaboModule.class,id);
        String fidPid = target != null ? target.getPatientId() : null;
        String previousPatientContext = setPatientContext(extractPatientId(fidPid));
        try {
            if (target == null) {
                IllegalArgumentException ex = new IllegalArgumentException("Lab module not found: " + id);
                recordLabAudit(action, null, null, 0, ex, moduleIdDetails(id));
                throw ex;
            }
            em.remove(target);
            LOGGER.info("Lab module deleted {}", id);
            recordLabAudit(action, fidPid, target.getLaboCenterCode(),
                    target.getItems() != null ? target.getItems().size() : 0,
                    null, moduleIdDetails(id));
            return 1;
        } catch (RuntimeException ex) {
            recordLabAudit(action, fidPid, target != null ? target.getLaboCenterCode() : null,
                    target != null && target.getItems() != null ? target.getItems().size() : 0,
                    ex, moduleIdDetails(id));
            throw ex;
        } finally {
            restorePatientContext(previousPatientContext);
        }
    }

    private void recordLabAudit(String action, String fidPid, String labCode, int resultCount, Throwable error, Map<String, Object> extraDetails) {
        if (sessionAuditDispatcher == null) {
            return;
        }
        try {
            AuditEventEnvelope.Builder builder = newLabAuditBuilder(action);
            String patientId = extractPatientId(fidPid);
            builder.patientId(patientId != null ? patientId : resolveContextPatientId());
            Map<String, Object> details = new HashMap<>();
            details.put("fidPid", fidPid);
            details.put("facilityId", extractFacilityId(fidPid));
            details.put("patientId", patientId);
            details.put("labCode", labCode);
            details.put("resultCount", resultCount);
            if (extraDetails != null) {
                details.putAll(extraDetails);
            }
            builder.details(details);
            if (error != null) {
                builder.failure(error);
            }
            sessionAuditDispatcher.dispatch(builder.build());
        } catch (IllegalStateException ex) {
            LOGGER.warn("Failed to dispatch lab audit event [action={}]: {}", action, ex.getMessage());
        }
    }

    private AuditEventEnvelope.Builder newLabAuditBuilder(String action) {
        AuditEventEnvelope.Builder builder = AuditEventEnvelope.builder(action, "NLabServiceBean");
        SessionTraceContext context = traceManager != null ? traceManager.current() : null;
        String actorId = resolveActorId(context);
        builder.actorId(actorId);
        builder.actorDisplayName(resolveActorDisplayName(actorId));
        builder.actorRole(context != null ? context.getActorRole() : null);
        builder.facilityId(resolveFacilityId(actorId));
        String traceId = resolveTraceId(context);
        builder.traceId(traceId);
        builder.requestId(resolveRequestId(context, traceId));
        builder.component(context != null ? context.getAttribute(SessionTraceAttributes.COMPONENT) : null);
        builder.operation(context != null ? context.getOperation() : null);
        return builder;
    }

    private String resolveActorId(SessionTraceContext context) {
        if (context == null) {
            return "system";
        }
        String actorId = context.getAttribute(SessionTraceAttributes.ACTOR_ID);
        return actorId == null || actorId.isBlank() ? "system" : actorId;
    }

    private String resolveActorDisplayName(String actorId) {
        if (actorId == null) {
            return "system";
        }
        int idx = actorId.indexOf(IInfoModel.COMPOSITE_KEY_MAKER);
        if (idx >= 0 && idx + 1 < actorId.length()) {
            return actorId.substring(idx + 1);
        }
        return actorId;
    }

    private String resolveFacilityId(String actorId) {
        if (actorId == null) {
            return null;
        }
        int idx = actorId.indexOf(IInfoModel.COMPOSITE_KEY_MAKER);
        if (idx <= 0) {
            return null;
        }
        return actorId.substring(0, idx);
    }

    private String resolveTraceId(SessionTraceContext context) {
        if (context != null && context.getTraceId() != null && !context.getTraceId().isBlank()) {
            return context.getTraceId();
        }
        return UUID.randomUUID().toString();
    }

    private String resolveRequestId(SessionTraceContext context, String traceId) {
        if (context != null) {
            String requestId = context.getAttribute(SessionTraceAttributes.REQUEST_ID);
            if (requestId != null && !requestId.isBlank()) {
                return requestId;
            }
        }
        return traceId;
    }

    private String resolveContextPatientId() {
        if (traceManager == null) {
            return "N/A";
        }
        SessionTraceContext context = traceManager.current();
        if (context == null) {
            return "N/A";
        }
        String patient = context.getAttribute(SessionTraceAttributes.PATIENT_ID);
        return patient == null || patient.isBlank() ? "N/A" : patient;
    }

    private Map<String, Object> buildReadDetails(int firstResult, int maxResult) {
        Map<String, Object> details = new HashMap<>();
        details.put("firstResult", firstResult);
        details.put("maxResult", maxResult);
        return details;
    }

    private Map<String, Object> buildItemReadDetails(int firstResult, int maxResult, String itemCode) {
        Map<String, Object> details = buildReadDetails(firstResult, maxResult);
        details.put("itemCode", itemCode);
        return details;
    }

    private Map<String, Object> buildModuleDetails(NLaboModule module) {
        Map<String, Object> details = new HashMap<>();
        if (module != null) {
            details.put("sampleDate", module.getSampleDate());
            details.put("moduleKey", module.getModuleKey());
            details.put("laboModuleId", module.getId());
        }
        return details;
    }

    private Map<String, Object> moduleIdDetails(long id) {
        Map<String, Object> details = new HashMap<>();
        details.put("moduleId", id);
        return details;
    }

    private String joinLabCodes(List<NLaboModule> modules) {
        if (modules == null || modules.isEmpty()) {
            return null;
        }
        Set<String> codes = new LinkedHashSet<>();
        for (NLaboModule module : modules) {
            if (module == null) {
                continue;
            }
            String code = module.getLaboCenterCode();
            if (code != null && !code.isBlank()) {
                codes.add(code);
            }
        }
        if (codes.isEmpty()) {
            return null;
        }
        return String.join(",", codes);
    }

    private String extractFacilityId(String fidPid) {
        if (fidPid == null) {
            return null;
        }
        int idx = fidPid.indexOf(':');
        if (idx <= 0) {
            return null;
        }
        return fidPid.substring(0, idx);
    }

    private String extractPatientId(String fidPid) {
        if (fidPid == null) {
            return null;
        }
        int idx = fidPid.indexOf(':');
        if (idx < 0 || idx + 1 >= fidPid.length()) {
            return fidPid;
        }
        return fidPid.substring(idx + 1);
    }

    private String setPatientContext(String patientId) {
        if (traceManager == null) {
            return null;
        }
        String normalized = (patientId == null || patientId.isBlank()) ? null : patientId;
        String previous = traceManager.getAttribute(SessionTraceAttributes.PATIENT_ID);
        traceManager.putAttribute(SessionTraceAttributes.PATIENT_ID, normalized);
        return previous;
    }

    private void restorePatientContext(String previousPatientId) {
        if (traceManager == null) {
            return;
        }
        traceManager.putAttribute(SessionTraceAttributes.PATIENT_ID, previousPatientId);
    }
}
