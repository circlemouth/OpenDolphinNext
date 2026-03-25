package open.dolphin.rest;

import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.LinkedHashMap;
import java.util.Map;
import open.dolphin.encounter.EncounterProjectionRepository;
import open.dolphin.encounter.EncounterTransitionService;

@Path("/encounters")
public class EncounterResource extends AbstractResource {

    @Inject
    private EncounterProjectionRepository encounterProjectionRepository;

    @Inject
    private EncounterTransitionService encounterTransitionService;

    @GET
    @Path("/{encounterKey}")
    @Produces(MediaType.APPLICATION_JSON)
    public Map<String, Object> getEncounter(@Context HttpServletRequest request, @PathParam("encounterKey") String encounterKey) {
        requireRemoteUser(request);
        String facilityId = requireActorFacility(request);
        EncounterProjectionRepository.EncounterRow row = encounterProjectionRepository.findByEncounterKey(encounterKey);
        if (row == null || !facilityId.equals(row.facilityId())) {
            throw new NotFoundException();
        }
        return toEncounterResponse(row);
    }

    @POST
    @Path("/{encounterKey}/transitions")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response transitionEncounter(
            @Context HttpServletRequest request,
            @PathParam("encounterKey") String encounterKey,
            Map<String, Object> payload) {
        requireRemoteUser(request);
        String facilityId = requireActorFacility(request);
        EncounterTransitionService.TransitionResult result;
        try {
            result = encounterTransitionService.transition(new EncounterTransitionService.TransitionCommand(
                    stringValue(payload, "operation"),
                    stringValue(payload, "facilityId", facilityId),
                    stringValue(payload, "patientId"),
                    longValue(payload.get("karteId")),
                    encounterKey,
                    stringValue(payload, "requestId"),
                    stringValue(payload, "traceId", resolveTraceId(request)),
                    stringValue(payload, "idempotencyKey"),
                    stringValue(payload, "ownerUserId"),
                    stringValue(payload, "memo"),
                    mapValue(payload.get("worklistFlags"))));
        } catch (IllegalArgumentException ex) {
            throw restError(request, Response.Status.BAD_REQUEST, "invalid_request", ex.getMessage());
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("encounterKey", result.encounterKey());
        response.put("scheduleKey", result.scheduleKey());
        response.put("facilityId", result.facilityId());
        response.put("patientId", result.patientId());
        response.put("karteId", result.karteId());
        response.put("fromState", result.fromState());
        response.put("businessState", result.toState());
        response.put("requestId", result.requestId());
        response.put("traceId", result.traceId());
        response.put("idempotencyKey", result.idempotencyKey());
        response.put("transitionedAt", result.transitionedAt().toString());
        return Response.ok(response).build();
    }

    private static Map<String, Object> toEncounterResponse(EncounterProjectionRepository.EncounterRow row) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("encounterKey", row.encounterKey());
        response.put("scheduleKey", row.scheduleKey());
        response.put("facilityId", row.facilityId());
        response.put("patientId", row.patientId());
        response.put("karteId", row.karteId());
        response.put("orcaAcceptanceId", row.orcaAcceptanceId());
        response.put("businessState", row.businessState());
        response.put("acceptedAt", row.acceptanceDatetime().toString());
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("ownerUserId", row.ownerUserId());
        metadata.put("memo", row.memo());
        metadata.put("worklistFlags", row.worklistFlagsJson());
        metadata.put("chartOpenedAt", row.chartOpenedAt() != null ? row.chartOpenedAt().toString() : null);
        metadata.put("billedAt", row.billedAt() != null ? row.billedAt().toString() : null);
        metadata.put("cancelledAt", row.cancelledAt() != null ? row.cancelledAt().toString() : null);
        metadata.put("lastOrcaSyncAt", row.lastOrcaSyncAt() != null ? row.lastOrcaSyncAt().toString() : null);
        metadata.put("stateVersion", row.stateVersion());
        metadata.put("projectedAt", row.projectedAt().toString());
        response.put("metadata", metadata);
        return response;
    }

    private static String stringValue(Map<String, Object> payload, String key) {
        return stringValue(payload, key, null);
    }

    private static String stringValue(Map<String, Object> payload, String key, String defaultValue) {
        Object value = payload != null ? payload.get(key) : null;
        if (value == null) {
            return defaultValue;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? defaultValue : text;
    }

    private static Long longValue(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        return Long.valueOf(String.valueOf(value));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> mapValue(Object value) {
        return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
    }
}
