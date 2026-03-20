package open.dolphin.rest;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;
import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import open.dolphin.converter.LetterModuleConverter;
import open.dolphin.converter.LetterModuleListConverter;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.LetterModule;
import open.dolphin.infomodel.LetterModuleList;
import open.dolphin.security.audit.AuditDetailSanitizer;
import open.dolphin.session.LetterServiceBean;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.AuditTrailService;
import open.dolphin.session.UserServiceBean;
import open.dolphin.session.framework.SessionTraceContext;
import open.dolphin.session.framework.SessionTraceManager;
import open.dolphin.session.framework.SessionOperation;

/**
 * REST Web Service
 *
 * @author Kazushi Minagawa, Digital Globe, Inc.
 */
@Path("/odletter")
public class LetterResource extends AbstractResource {

    @Inject
    private LetterServiceBean letterServiceBean;

    @Inject
    private AuditTrailService auditTrailService;

    @Inject
    private SessionTraceManager sessionTraceManager;

    @Inject
    private UserServiceBean userServiceBean;

    @Context
    private HttpServletRequest httpServletRequest;

    /** Creates a new instance of KarteResource */
    public LetterResource() {
    }

    @SessionOperation
    @PUT
    @Path("/letter")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public String putLetter(String json) throws IOException {
        String fid = requireActorFacility(httpServletRequest);

        LetterModule model = readJson(json, LetterModule.class);
        
        Logger.getLogger("open.dolphin").log(Level.INFO, "LinkID : {0}, PatID : {1}", new Object[]{String.valueOf(model.getLinkId()), model.getPatientId()});

        long pk = letterServiceBean.saveOrUpdateLetterForFacility(fid, model);
        if (pk == 0L) {
            throw new NotFoundException("Letter not found");
        }

        String pkStr = String.valueOf(pk);
        debug(pkStr);

        return pkStr;
    }

    @GET
    @Path("/list/{param}")
    @Produces(MediaType.APPLICATION_JSON)
    public LetterModuleListConverter getLetterList(@PathParam("param") String param) {

        debug(param);
        String fid = requireActorFacility(httpServletRequest);
        String[] params = param.split(CAMMA);
        long karteId = Long.parseLong(params[0]);

        List<LetterModule> result = letterServiceBean.getLetterListForFacility(fid, karteId);
        LetterModuleList list = new LetterModuleList();
        if (result!=null && result.size()>0) {
            list.setList(result);
        } else {
            list.setList(new ArrayList<LetterModule>());
        }
        
        LetterModuleListConverter conv = new LetterModuleListConverter();
        conv.setModel(list);

        return conv;
    }

    @GET
    @Path("/letter/{param}")
    @Produces(MediaType.APPLICATION_JSON)
    public LetterModuleConverter getLetter(@PathParam("param") String param) {

        String fid = requireActorFacility(httpServletRequest);
        long pk = Long.parseLong(param);

        LetterModule result = letterServiceBean.getLetterForFacility(fid, pk);
        if (result == null) {
            throw new NotFoundException("Letter not found: " + pk);
        }
        LetterModuleConverter conv = new LetterModuleConverter();
        conv.setModel(result);
        return conv;
    }

    @DELETE
    @Path("/letter/{param}")
    public void delete(@PathParam("param") String param) {

        String fid = requireActorFacility(httpServletRequest);
        long pk = Long.parseLong(param);
        LetterModule existing;
        existing = letterServiceBean.getLetterForFacility(fid, pk);
        if (existing == null) {
            recordLetterDeletionAudit(pk, null, "failed", "letter_not_found");
            throw new NotFoundException("Letter not found: " + pk);
        }

        try {
            int deleted = letterServiceBean.deleteLetterForFacility(fid, pk);
            if (deleted == 0) {
                recordLetterDeletionAudit(pk, existing, "failed", "letter_not_found");
                throw new NotFoundException("Letter not found: " + pk);
            }
            recordLetterDeletionAudit(pk, existing, "success", null);
        } catch (NotFoundException e) {
            throw e;
        } catch (RuntimeException e) {
            recordLetterDeletionAudit(pk, existing, "failed", e.getClass().getSimpleName());
            throw e;
        }
    }

    private void recordLetterDeletionAudit(long letterId, LetterModule letter, String status, String reason) {
        if (auditTrailService == null) {
            return;
        }
        AuditEventPayload payload = createBaseAuditPayload("LETTER_DELETE");
        Map<String, Object> details = new HashMap<>();
        details.put("letterId", letterId);
        details.put("status", status);
        if (reason != null) {
            details.put("reason", reason);
        }
        if (letter != null) {
            details.put("patientId", letter.getPatientId());
            if (letter.getKarte() != null) {
                details.put("karteId", letter.getKarte().getId());
            }
        }
        enrichUserDetails(details);
        enrichTraceDetails(details);
        payload.setPatientId(AuditDetailSanitizer.resolvePatientId(null, details));
        payload.setDetails(details);
        auditTrailService.record(payload);
    }

    private AuditEventPayload createBaseAuditPayload(String action) {
        AuditEventPayload payload = new AuditEventPayload();
        String actorId = resolveActorId();
        payload.setActorId(actorId);
        payload.setActorDisplayName(resolveActorDisplayName(actorId));
        payload.setActorRole(resolveActorRole(httpServletRequest, userServiceBean));
        payload.setAction(action);
        payload.setResource(resolveResourcePath());
        String traceId = resolveTraceId(httpServletRequest);
        if (traceId == null || traceId.isBlank()) {
            traceId = resolveRequestId();
        }
        payload.setRequestId(traceId);
        payload.setTraceId(traceId);
        payload.setIpAddress(resolveClientIp(httpServletRequest));
        payload.setUserAgent(resolveUserAgent());
        return payload;
    }

    private void enrichUserDetails(Map<String, Object> details) {
        String remoteUser = resolveRemoteUser();
        if (remoteUser != null) {
            details.put("remoteUser", remoteUser);
            int idx = remoteUser.indexOf(IInfoModel.COMPOSITE_KEY_MAKER);
            if (idx > 0) {
                details.put("facilityId", remoteUser.substring(0, idx));
                if (idx + 1 < remoteUser.length()) {
                    details.put("userId", remoteUser.substring(idx + 1));
                }
            }
        }
    }

    private void enrichTraceDetails(Map<String, Object> details) {
        boolean traceCaptured = false;
        if (sessionTraceManager != null) {
            SessionTraceContext context = sessionTraceManager.current();
            if (context != null) {
                details.put("traceId", context.getTraceId());
                details.put("sessionOperation", context.getOperation());
                traceCaptured = true;
            }
        }
        if (!traceCaptured) {
            String traceId = resolveTraceId(httpServletRequest);
            if (traceId != null) {
                details.put("traceId", traceId);
            }
        }
    }

    private String resolveActorId() {
        return Optional.ofNullable(resolveRemoteUser()).orElse("system");
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

    private String resolveResourcePath() {
        return httpServletRequest != null ? httpServletRequest.getRequestURI() : "/odletter/letter";
    }

    private String resolveRequestId() {
        if (httpServletRequest == null) {
            return UUID.randomUUID().toString();
        }
        return Optional.ofNullable(httpServletRequest.getHeader("X-Request-Id")).orElse(UUID.randomUUID().toString());
    }

    private String resolveIpAddress() {
        return httpServletRequest != null ? httpServletRequest.getRemoteAddr() : null;
    }

    private String resolveUserAgent() {
        return httpServletRequest != null ? httpServletRequest.getHeader("User-Agent") : null;
    }

    private String resolveRemoteUser() {
        return httpServletRequest != null ? httpServletRequest.getRemoteUser() : null;
    }

}
