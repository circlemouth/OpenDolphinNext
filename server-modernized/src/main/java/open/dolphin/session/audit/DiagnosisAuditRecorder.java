package open.dolphin.session.audit;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import open.dolphin.infomodel.DiagnosisSendWrapper;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.RegisteredDiagnosisModel;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;

/**
 * Diagnosis API 用の監査イベント生成ヘルパー（Modernized）。
 */
@ApplicationScoped
public class DiagnosisAuditRecorder {

    private static final String DEFAULT_RESOURCE = "/api/local/diagnoses";

    @Inject
    private SessionAuditDispatcher sessionAuditDispatcher;

    public void recordCreate(DiagnosisSendWrapper wrapper,
            List<RegisteredDiagnosisModel> models,
            List<Long> persistedIds) {
        if (wrapper == null || models == null || models.isEmpty()) {
            return;
        }
        Map<String, Object> details = baseDetails(wrapper);
        details.put("payloadCount", models.size());
        addDiagnosisCodes(details, models);
        addIds(details, persistedIds, "createdDiagnosisIds");
        dispatch(wrapper, "EHT_DIAGNOSIS_CREATE", details);
    }

    public void recordUpdate(DiagnosisSendWrapper wrapper,
            List<RegisteredDiagnosisModel> models) {
        if (wrapper == null || models == null || models.isEmpty()) {
            return;
        }
        Map<String, Object> details = baseDetails(wrapper);
        details.put("affectedRows", models.size());
        addIds(details, models.stream()
                .map(RegisteredDiagnosisModel::getId)
                .collect(Collectors.toList()), "updatedDiagnosisIds");
        addDiagnosisCodes(details, models);
        dispatch(wrapper, "EHT_DIAGNOSIS_UPDATE", details);
    }

    private void dispatch(DiagnosisSendWrapper wrapper, String action, Map<String, Object> details) {
        if (sessionAuditDispatcher == null) {
            return;
        }
        AuditEventPayload payload = new AuditEventPayload();
        String actorId = resolveActorId(wrapper);
        payload.setActorId(actorId);
        payload.setActorDisplayName(resolveActorDisplayName(wrapper, actorId));
        payload.setAction(action);
        payload.setResource(resolveResource(wrapper));
        payload.setPatientId(wrapper.getPatientId());
        payload.setRequestId(resolveRequestId(wrapper));
        payload.setTraceId(resolveTraceId(wrapper));
        payload.setDetails(details);
        sessionAuditDispatcher.record(payload);
    }

    private Map<String, Object> baseDetails(DiagnosisSendWrapper wrapper) {
        Map<String, Object> details = new HashMap<>();
        if (wrapper == null) {
            return details;
        }
        if (wrapper.getRemoteUser() != null && !wrapper.getRemoteUser().isBlank()) {
            details.put("remoteUser", wrapper.getRemoteUser());
            int idx = wrapper.getRemoteUser().indexOf(IInfoModel.COMPOSITE_KEY_MAKER);
            if (idx > 0) {
                details.put("facilityId", wrapper.getRemoteUser().substring(0, idx));
                if (idx + 1 < wrapper.getRemoteUser().length()) {
                    details.put("userId", wrapper.getRemoteUser().substring(idx + 1));
                }
            }
        }
        if (wrapper.getCreatorId() != null) {
            details.put("creatorId", wrapper.getCreatorId());
        }
        if (wrapper.getCreatorName() != null) {
            details.put("creatorName", wrapper.getCreatorName());
        }
        if (wrapper.getConfirmDate() != null) {
            details.put("confirmDate", wrapper.getConfirmDate());
        }
        if (wrapper.getPatientId() != null) {
            details.put("patientId", wrapper.getPatientId());
        }
        return details;
    }

    private void addDiagnosisCodes(Map<String, Object> details, List<RegisteredDiagnosisModel> models) {
        List<String> codes = models.stream()
                .map(RegisteredDiagnosisModel::getDiagnosisCode)
                .filter(code -> code != null && !code.isBlank())
                .collect(Collectors.toList());
        if (!codes.isEmpty()) {
            details.put("diagnosisCodes", codes);
        }
        List<Long> karteIds = models.stream()
                .map(RegisteredDiagnosisModel::getKarteBean)
                .map(bean -> bean != null ? bean.getId() : null)
                .filter(id -> id != null && id > 0)
                .collect(Collectors.toList());
        if (!karteIds.isEmpty()) {
            details.put("karteIds", karteIds);
        }
    }

    private void addIds(Map<String, Object> details, List<Long> ids, String key) {
        if (ids == null) {
            return;
        }
        List<Long> filtered = ids.stream()
                .filter(id -> id != null && id > 0)
                .collect(Collectors.toList());
        if (!filtered.isEmpty()) {
            details.put(key, filtered);
        }
    }

    private String resolveResource(DiagnosisSendWrapper wrapper) {
        if (wrapper != null && wrapper.getAuditResource() != null && !wrapper.getAuditResource().isBlank()) {
            return wrapper.getAuditResource();
        }
        return DEFAULT_RESOURCE;
    }

    private String resolveActorId(DiagnosisSendWrapper wrapper) {
        if (wrapper == null) {
            return "anonymous";
        }
        String remoteUser = wrapper.getRemoteUser();
        if (remoteUser != null && !remoteUser.isBlank()) {
            return remoteUser;
        }
        if (wrapper.getCreatorId() != null && !wrapper.getCreatorId().isBlank()) {
            return wrapper.getCreatorId();
        }
        return "anonymous";
    }

    private String resolveActorDisplayName(DiagnosisSendWrapper wrapper, String actorId) {
        if (wrapper != null && wrapper.getCreatorName() != null && !wrapper.getCreatorName().isBlank()) {
            return wrapper.getCreatorName();
        }
        if (actorId == null) {
            return "anonymous";
        }
        int idx = actorId.indexOf(IInfoModel.COMPOSITE_KEY_MAKER);
        if (idx >= 0 && idx + 1 < actorId.length()) {
            return actorId.substring(idx + 1);
        }
        return actorId;
    }

    private String resolveRequestId(DiagnosisSendWrapper wrapper) {
        if (wrapper == null) {
            return UUID.randomUUID().toString();
        }
        if (wrapper.getRequestId() != null && !wrapper.getRequestId().isBlank()) {
            return wrapper.getRequestId();
        }
        if (wrapper.getTraceId() != null && !wrapper.getTraceId().isBlank()) {
            return wrapper.getTraceId();
        }
        return UUID.randomUUID().toString();
    }

    private String resolveTraceId(DiagnosisSendWrapper wrapper) {
        if (wrapper == null) {
            return null;
        }
        if (wrapper.getTraceId() != null && !wrapper.getTraceId().isBlank()) {
            return wrapper.getTraceId();
        }
        return wrapper.getRequestId();
    }
}
