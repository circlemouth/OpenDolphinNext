package open.dolphin.session;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import jakarta.persistence.TypedQuery;
import jakarta.transaction.Transactional;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.infomodel.LetterDate;
import open.dolphin.infomodel.LetterItem;
import open.dolphin.infomodel.LetterModule;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.LetterText;
import open.dolphin.infomodel.UserModel;
import open.dolphin.session.framework.SessionOperation;
import open.dolphin.session.framework.SessionTraceAttributes;
import open.dolphin.session.framework.SessionTraceContext;
import open.dolphin.session.framework.SessionTraceManager;
import open.dolphin.security.audit.SessionAuditDispatcher;
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
public class LetterServiceBean {

    private static final Logger LOGGER = LoggerFactory.getLogger(LetterServiceBean.class);
    
    private static final String KARTE_ID = "karteId";
    private static final String ID = "id";
    private static final String FID = "fid";

    private static final String QUERY_LETTER_BY_KARTE_ID = "from LetterModule l where l.karte.id=:karteId";
    private static final String QUERY_LETTER_BY_ID = "from LetterModule l where l.id=:id";
    private static final String QUERY_ITEM_BY_ID = "from LetterItem l where l.module.id=:id";
    private static final String QUERY_TEXT_BY_ID = "from LetterText l where l.module.id=:id";
    private static final String QUERY_DATE_BY_ID = "from LetterDate l where l.module.id=:id";
    private static final String QUERY_LETTER_BY_KARTE_ID_FOR_FACILITY =
            "from LetterModule l where l.karte.id=:karteId and l.karte.patient.facilityId=:fid";
    private static final String QUERY_LETTER_BY_ID_FOR_FACILITY =
            "from LetterModule l where l.id=:id and l.karte.patient.facilityId=:fid";
    private static final String QUERY_ITEM_BY_ID_FOR_FACILITY =
            "from LetterItem l where l.module.id=:id and l.module.karte.patient.facilityId=:fid";
    private static final String QUERY_TEXT_BY_ID_FOR_FACILITY =
            "from LetterText l where l.module.id=:id and l.module.karte.patient.facilityId=:fid";
    private static final String QUERY_DATE_BY_ID_FOR_FACILITY =
            "from LetterDate l where l.module.id=:id and l.module.karte.patient.facilityId=:fid";
    private static final String QUERY_KARTE_BY_ID_FOR_FACILITY =
            "select k from KarteBean k where k.id=:karteId and k.patient.facilityId=:fid";

    @PersistenceContext
    private EntityManager em;

    @Inject
    private SessionAuditDispatcher sessionAuditDispatcher;

    @Inject
    private SessionTraceManager traceManager;

    @Inject
    private UserServiceBean userService;

    
    public long saveOrUpdateLetter(LetterModule model) {
        if (model == null) {
            return 0L;
        }

        KarteBean resolvedKarte = null;
        boolean updating = model.getLinkId() != 0L;
        String previousPatientContext = setPatientContext(model.getPatientId());
        String action = updating ? "LETTER_UPDATE" : "LETTER_CREATE";

        try {
            resolvedKarte = resolveKarteReference(model);
            model.setKarteBean(resolvedKarte);

            UserModel resolvedUser = resolveUserReference(model);
            if (resolvedUser == null) {
                throw new IllegalStateException("Unable to resolve creator for letter (userModel/userId missing)");
            }
            model.setUserModel(resolvedUser);

            em.persist(model);
            persistLetterChildren(model);

            if (model.getLinkId() != 0L) {
                deleteLegacyLetterArtifacts(model.getLinkId());
            }

            recordLetterMutation(model, resolvedKarte, action, null);
            return model.getId();
        } catch (RuntimeException ex) {
            recordLetterMutation(model, resolvedKarte, action, ex);
            throw ex;
        } finally {
            restorePatientContext(previousPatientContext);
        }
    }

    private void persistLetterChildren(LetterModule model) {
        persistLetterItems(model);
        persistLetterTexts(model);
        persistLetterDates(model);
    }

    private void persistLetterItems(LetterModule model) {
        List<LetterItem> items = model.getLetterItems();
        if (items == null) {
            return;
        }
        for (LetterItem item : items) {
            item.setModule(model);
            em.persist(item);
        }
    }

    private void persistLetterTexts(LetterModule model) {
        List<LetterText> texts = model.getLetterTexts();
        if (texts == null) {
            return;
        }
        for (LetterText txt : texts) {
            txt.setModule(model);
            em.persist(txt);
        }
    }

    private void persistLetterDates(LetterModule model) {
        List<LetterDate> dates = model.getLetterDates();
        if (dates == null) {
            return;
        }
        for (LetterDate date : dates) {
            date.setModule(model);
            em.persist(date);
        }
    }

    private void deleteLegacyLetterArtifacts(long linkId) {
        deleteLegacyLetterItems(linkId);
        deleteLegacyLetterTexts(linkId);
        deleteLegacyLetterDates(linkId);
        deleteLegacyLetterModule(linkId);
    }

    private void deleteLegacyLetterItems(long linkId) {
        try {
            List<LetterItem> itemList = (List<LetterItem>) em.createQuery(QUERY_ITEM_BY_ID)
                    .setParameter(ID, linkId)
                    .getResultList();
            for (LetterItem item : itemList) {
                em.remove(item);
            }
        } catch (NoResultException e) {
            LOGGER.warn("QUERY_ITEM_BY_ID : {}", e.toString());
        }
    }

    private void deleteLegacyLetterTexts(long linkId) {
        try {
            List<LetterText> textList = (List<LetterText>) em.createQuery(QUERY_TEXT_BY_ID)
                    .setParameter(ID, linkId)
                    .getResultList();
            for (LetterText txt : textList) {
                em.remove(txt);
            }
        } catch (NoResultException e) {
            LOGGER.warn("QUERY_TEXT_BY_ID : {}", e.toString());
        }
    }

    private void deleteLegacyLetterDates(long linkId) {
        try {
            List<LetterDate> dateList = (List<LetterDate>) em.createQuery(QUERY_DATE_BY_ID)
                    .setParameter(ID, linkId)
                    .getResultList();
            for (LetterDate date : dateList) {
                em.remove(date);
            }
        } catch (NoResultException e) {
            LOGGER.warn("QUERY_DATE_BY_ID : {}", e.toString());
        }
    }

    private void deleteLegacyLetterModule(long linkId) {
        try {
            LetterModule delete = (LetterModule) em.createQuery(QUERY_LETTER_BY_ID)
                    .setParameter(ID, linkId)
                    .getSingleResult();
            em.remove(delete);
        } catch (NoResultException e) {
            LOGGER.warn("QUERY_LETTER_BY_ID : {}", e.toString());
        }
    }

    public long saveOrUpdateLetterForFacility(String fid, LetterModule model) {
        if (fid == null || fid.isBlank() || model == null) {
            return 0L;
        }
        String normalizedFid = fid.trim();

        KarteBean resolvedKarte = tryResolveKarte(model);
        if (resolvedKarte == null || resolvedKarte.getId() <= 0) {
            return 0L;
        }

        KarteBean securedKarte = findKarteByIdForFacility(normalizedFid, resolvedKarte.getId());
        if (securedKarte == null) {
            return 0L;
        }

        long linkId = model.getLinkId();
        if (linkId != 0L && !existsLetterForFacility(normalizedFid, linkId)) {
            return 0L;
        }

        model.setKarteBean(securedKarte);
        return saveOrUpdateLetter(model);
    }

    
    private KarteBean resolveKarteReference(LetterModule model) {
        KarteBean resolved = tryResolveKarte(model);
        if (resolved == null) {
            throw new IllegalStateException(String.format("Unable to resolve Karte for patientId=%s (karteId=%s)",
                    model.getPatientId(),
                    model.getKarteBean()!=null ? model.getKarteBean().getId() : "n/a"));
        }
        return resolved;
    }

    private KarteBean tryResolveKarte(LetterModule model) {
        KarteBean payloadKarte = model.getKarteBean();
        KarteBean byId = findKarteById(payloadKarte);
        if (byId != null) {
            return byId;
        }

        KarteBean byPatientPk = findKarteByPatientModel(payloadKarte != null ? payloadKarte.getPatientModel() : null);
        if (byPatientPk != null) {
            return byPatientPk;
        }

        return findKarteByIdentifiers(model);
    }

    private KarteBean findKarteById(KarteBean candidate) {
        if (candidate == null) {
            return null;
        }
        long karteId = candidate.getId();
        if (karteId <= 0) {
            return null;
        }
        KarteBean managed = em.find(KarteBean.class, karteId);
        if (managed == null) {
            LOGGER.warn("Referenced KarteBean id={} not found; falling back to patientId search.", karteId);
        }
        return managed;
    }

    private KarteBean findKarteByPatientModel(PatientModel patient) {
        if (patient == null) {
            return null;
        }
        if (patient.getId() > 0) {
            List<KarteBean> hits = em.createQuery("select k from KarteBean k where k.patient.id = :patientPk", KarteBean.class)
                                     .setParameter("patientPk", patient.getId())
                                     .setMaxResults(1)
                                     .getResultList();
            if (!hits.isEmpty()) {
                return hits.get(0);
            }
        }
        return findKarteByIdentifiers(patient.getFacilityId(), patient.getPatientId());
    }

    private KarteBean findKarteByIdentifiers(LetterModule model) {
        return findKarteByIdentifiers(extractFacilityId(model), model.getPatientId());
    }

    private KarteBean findKarteByIdentifiers(String facilityId, String patientIdentifier) {
        if (patientIdentifier == null || patientIdentifier.isBlank()) {
            return null;
        }
        String normalizedPid = patientIdentifier.trim();
        String resolvedFacility = facilityId;
        int compositeIdx = normalizedPid.indexOf(IInfoModel.COMPOSITE_KEY_MAKER);
        if (compositeIdx > 0) {
            resolvedFacility = normalizedPid.substring(0, compositeIdx);
            normalizedPid = normalizedPid.substring(compositeIdx + 1);
        }

        StringBuilder jpql = new StringBuilder("select k from KarteBean k where k.patient.patientId = :pid");
        if (resolvedFacility != null && !resolvedFacility.isBlank()) {
            jpql.append(" and k.patient.facilityId = :fid");
        } else {
            jpql.append(" order by k.id");
        }

        TypedQuery<KarteBean> query = em.createQuery(jpql.toString(), KarteBean.class)
                                        .setParameter("pid", normalizedPid);
        if (resolvedFacility != null && !resolvedFacility.isBlank()) {
            query.setParameter("fid", resolvedFacility);
        } else {
            query.setMaxResults(1);
        }
        List<KarteBean> hits = query.getResultList();
        return hits.isEmpty() ? null : hits.get(0);
    }

    private String extractFacilityId(LetterModule model) {
        if (model.getUserModel()!=null && model.getUserModel().getFacilityModel()!=null) {
            return model.getUserModel().getFacilityModel().getFacilityId();
        }
        KarteBean payloadKarte = model.getKarteBean();
        if (payloadKarte!=null && payloadKarte.getPatientModel()!=null) {
            return payloadKarte.getPatientModel().getFacilityId();
        }
        SessionTraceContext context = traceManager != null ? traceManager.current() : null;
        if (context != null) {
            String actorId = context.getAttribute(SessionTraceAttributes.ACTOR_ID);
            return extractFacilityIdFromActor(actorId);
        }
        return null;
    }

    private UserModel resolveUserReference(LetterModule model) {
        if (model == null) {
            return null;
        }
        UserModel payload = model.getUserModel();
        if (payload != null && payload.getId() > 0) {
            UserModel byId = em.find(UserModel.class, payload.getId());
            if (byId != null) {
                return byId;
            }
        }
        if (payload != null && payload.getUserId() != null && !payload.getUserId().isBlank()) {
            try {
                return userService.getUser(payload.getUserId());
            } catch (NoResultException ex) {
                LOGGER.warn("User not found by userId={}", payload.getUserId());
            }
        }
        SessionTraceContext context = traceManager != null ? traceManager.current() : null;
        if (context != null) {
            String actorId = context.getAttribute(SessionTraceAttributes.ACTOR_ID);
            if (actorId != null && !actorId.isBlank()) {
                try {
                    return userService.getUser(actorId);
                } catch (NoResultException ex) {
                    LOGGER.warn("User not found by actorId={}", actorId);
                }
            }
        }
        return null;
    }

    public List<LetterModule> getLetterList(long karteId) {
        return (List<LetterModule>) em.createQuery(QUERY_LETTER_BY_KARTE_ID)
                .setParameter(KARTE_ID, karteId)
                .getResultList();
    }

    public List<LetterModule> getLetterListForFacility(String fid, long karteId) {
        if (fid == null || fid.isBlank()) {
            return List.of();
        }
        return em.createQuery(QUERY_LETTER_BY_KARTE_ID_FOR_FACILITY, LetterModule.class)
                .setParameter(KARTE_ID, karteId)
                .setParameter(FID, fid.trim())
                .getResultList();
    }

    public LetterModule getLetter(long letterPk) {
        LetterModule ret = (LetterModule) em.createQuery(QUERY_LETTER_BY_ID)
                .setParameter(ID, letterPk)
                .getSingleResult();
        populateLetterRelations(ret, null);
        return ret;
    }

    public LetterModule getLetterForFacility(String fid, long letterPk) {
        if (fid == null || fid.isBlank()) {
            return null;
        }
        List<LetterModule> hits = em.createQuery(QUERY_LETTER_BY_ID_FOR_FACILITY, LetterModule.class)
                .setParameter(ID, letterPk)
                .setParameter(FID, fid.trim())
                .setMaxResults(1)
                .getResultList();
        if (hits.isEmpty()) {
            return null;
        }
        LetterModule ret = hits.get(0);
        populateLetterRelations(ret, fid.trim());
        return ret;
    }

    public void delete(long pk) {
        deleteById(pk, null);
    }

    public int deleteLetterForFacility(String fid, long pk) {
        if (fid == null || fid.isBlank()) {
            return 0;
        }
        String normalizedFid = fid.trim();
        if (!existsLetterForFacility(normalizedFid, pk)) {
            return 0;
        }
        deleteById(pk, normalizedFid);
        return 1;
    }

    private void deleteById(long pk, String fid) {
        boolean facilityBound = fid != null && !fid.isBlank();

        Query itemQuery = em.createQuery(facilityBound ? QUERY_ITEM_BY_ID_FOR_FACILITY : QUERY_ITEM_BY_ID)
                .setParameter(ID, pk);
        if (facilityBound) {
            itemQuery.setParameter(FID, fid);
        }
        List<LetterItem> itemList = (List<LetterItem>) itemQuery.getResultList();
        for (LetterItem item : itemList) {
            em.remove(item);
        }

        Query textQuery = em.createQuery(facilityBound ? QUERY_TEXT_BY_ID_FOR_FACILITY : QUERY_TEXT_BY_ID)
                .setParameter(ID, pk);
        if (facilityBound) {
            textQuery.setParameter(FID, fid);
        }
        List<LetterText> textList = (List<LetterText>) textQuery.getResultList();
        for (LetterText txt : textList) {
            em.remove(txt);
        }

        Query dateQuery = em.createQuery(facilityBound ? QUERY_DATE_BY_ID_FOR_FACILITY : QUERY_DATE_BY_ID)
                .setParameter(ID, pk);
        if (facilityBound) {
            dateQuery.setParameter(FID, fid);
        }
        List<LetterDate> dateList = (List<LetterDate>) dateQuery.getResultList();
        for (LetterDate date : dateList) {
            em.remove(date);
        }

        TypedQuery<LetterModule> targetQuery = em.createQuery(
                facilityBound ? QUERY_LETTER_BY_ID_FOR_FACILITY : QUERY_LETTER_BY_ID, LetterModule.class)
                .setParameter(ID, pk)
                .setMaxResults(1);
        if (facilityBound) {
            targetQuery.setParameter(FID, fid);
        }
        List<LetterModule> targets = targetQuery.getResultList();
        if (!targets.isEmpty()) {
            em.remove(targets.get(0));
        }
    }

    private void populateLetterRelations(LetterModule ret, String fid) {
        boolean facilityBound = fid != null && !fid.isBlank();

        Query itemQuery = em.createQuery(facilityBound ? QUERY_ITEM_BY_ID_FOR_FACILITY : QUERY_ITEM_BY_ID)
                .setParameter(ID, ret.getId());
        if (facilityBound) {
            itemQuery.setParameter(FID, fid);
        }
        List<LetterItem> items = (List<LetterItem>) itemQuery.getResultList();
        ret.setLetterItems(items);

        Query textQuery = em.createQuery(facilityBound ? QUERY_TEXT_BY_ID_FOR_FACILITY : QUERY_TEXT_BY_ID)
                .setParameter(ID, ret.getId());
        if (facilityBound) {
            textQuery.setParameter(FID, fid);
        }
        List<LetterText> texts = (List<LetterText>) textQuery.getResultList();
        ret.setLetterTexts(texts);

        Query dateQuery = em.createQuery(facilityBound ? QUERY_DATE_BY_ID_FOR_FACILITY : QUERY_DATE_BY_ID)
                .setParameter(ID, ret.getId());
        if (facilityBound) {
            dateQuery.setParameter(FID, fid);
        }
        List<LetterDate> dates = (List<LetterDate>) dateQuery.getResultList();
        ret.setLetterDates(dates);
    }

    private boolean existsLetterForFacility(String fid, long letterPk) {
        if (fid == null || fid.isBlank()) {
            return false;
        }
        List<Long> hits = em.createQuery(
                        "select l.id from LetterModule l where l.id=:id and l.karte.patient.facilityId=:fid",
                        Long.class)
                .setParameter(ID, letterPk)
                .setParameter(FID, fid)
                .setMaxResults(1)
                .getResultList();
        return !hits.isEmpty();
    }

    private KarteBean findKarteByIdForFacility(String fid, long karteId) {
        if (fid == null || fid.isBlank() || karteId <= 0) {
            return null;
        }
        List<KarteBean> hits = em.createQuery(QUERY_KARTE_BY_ID_FOR_FACILITY, KarteBean.class)
                .setParameter(KARTE_ID, karteId)
                .setParameter(FID, fid)
                .setMaxResults(1)
                .getResultList();
        return hits.isEmpty() ? null : hits.get(0);
    }

    private void recordLetterMutation(LetterModule model, KarteBean karte, String action, Throwable error) {
        if (sessionAuditDispatcher == null) {
            return;
        }
        try {
            AuditEventEnvelope.Builder builder = newAuditBuilder(action);
            builder.patientId(determinePatientId(model));
            builder.details(buildLetterDetails(model, karte, action));
            if (error != null) {
                builder.failure(error);
            }
            sessionAuditDispatcher.dispatch(builder.build());
        } catch (IllegalStateException ex) {
            LOGGER.warn("Failed to dispatch letter audit event [action={}]: {}", action, ex.getMessage());
        }
    }

    private Map<String, Object> buildLetterDetails(LetterModule model, KarteBean karte, String action) {
        Map<String, Object> details = new HashMap<>();
        details.put("mutationType", action);
        if (model != null) {
            details.put("letterId", model.getId());
            details.put("linkId", model.getLinkId());
            details.put("patientExternalId", model.getPatientId());
            details.put("letterType", model.getLetterType());
            details.put("consultantHospital", model.getConsultantHospital());
            details.put("itemCount", model.getLetterItems() != null ? model.getLetterItems().size() : 0);
            details.put("textCount", model.getLetterTexts() != null ? model.getLetterTexts().size() : 0);
            details.put("dateCount", model.getLetterDates() != null ? model.getLetterDates().size() : 0);
            details.put("status", model.getStatus());
        }
        if (karte != null) {
            details.put("karteId", karte.getId());
            if (karte.getPatientModel() != null) {
                details.put("resolvedFacilityId", karte.getPatientModel().getFacilityId());
                details.put("resolvedPatientPk", karte.getPatientModel().getId());
            }
        }
        return details;
    }

    private AuditEventEnvelope.Builder newAuditBuilder(String action) {
        AuditEventEnvelope.Builder builder = AuditEventEnvelope.builder(action, "LetterServiceBean");
        SessionTraceContext context = traceManager != null ? traceManager.current() : null;
        String actorId = resolveActorId(context);
        builder.actorId(actorId);
        builder.actorDisplayName(resolveActorDisplayName(actorId));
        builder.actorRole(context != null ? context.getActorRole() : null);
        builder.facilityId(extractFacilityIdFromActor(actorId));
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

    private String extractFacilityIdFromActor(String actorId) {
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

    private String resolveContextPatientId(SessionTraceContext context) {
        if (context == null) {
            return "N/A";
        }
        String patient = context.getAttribute(SessionTraceAttributes.PATIENT_ID);
        return patient == null || patient.isBlank() ? "N/A" : patient;
    }

    private String determinePatientId(LetterModule model) {
        if (model != null && model.getPatientId() != null && !model.getPatientId().isBlank()) {
            return model.getPatientId();
        }
        SessionTraceContext context = traceManager != null ? traceManager.current() : null;
        return resolveContextPatientId(context);
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
