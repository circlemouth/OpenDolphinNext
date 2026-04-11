package open.dolphin.rest;

import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import open.dolphin.encounter.EncounterProjectionRepository;
import open.dolphin.encounter.LocalMedicalSummaryService;
import open.dolphin.encounter.LocalMedicalSummaryService.LocalMedicalSummaryFailure;
import open.dolphin.rest.dto.localsummary.LocalMedicalSummaryErrorResponse;
import open.dolphin.rest.dto.localsummary.LocalMedicalSummaryResponse;

@Path("/local/encounters")
public class LocalMedicalSummaryResource extends AbstractResource {

    private static final String SOURCE_PATH = "/api/local/encounters/{encounterKey}/medical-summary";

    @Inject
    private EncounterProjectionRepository encounterProjectionRepository;

    @Inject
    private LocalMedicalSummaryService localMedicalSummaryService;

    @GET
    @Path("/{encounterKey}/medical-summary")
    @Produces(MediaType.APPLICATION_JSON)
    public LocalMedicalSummaryResponse getMedicalSummary(
            @Context HttpServletRequest request,
            @PathParam("encounterKey") String encounterKey) {
        requireRemoteUser(request);
        String actorFacility = requireActorFacility(request);
        EncounterProjectionRepository.EncounterRow row;
        try {
            row = encounterProjectionRepository.findByEncounterKey(encounterKey);
        } catch (RuntimeException ex) {
            throw localSummaryError(request, Response.Status.SERVICE_UNAVAILABLE,
                    "LOCAL_SUMMARY_READ_MODEL_UNAVAILABLE",
                    "Failed to load local summary.",
                    Map.of("encounterKey", encounterKey, "component", "encounter_projection"));
        }
        if (row == null || row.facilityId() == null || !actorFacility.equals(row.facilityId())) {
            throw localSummaryError(request, Response.Status.NOT_FOUND,
                    "LOCAL_SUMMARY_TARGET_NOT_FOUND",
                    "Requested encounter summary was not found.",
                    Map.of("encounterKey", encounterKey));
        }
        try {
            LocalMedicalSummaryResponse response = localMedicalSummaryService.buildSummary(row);
            response.setRequestId(resolveRequestId(request));
            response.setTraceId(resolveTraceId(request));
            response.setRunId(resolveRunId(request));
            response.setFetchedAt(Instant.now().toString());
            response.setSourcePath(SOURCE_PATH);
            return response;
        } catch (LocalMedicalSummaryFailure failure) {
            throw localSummaryError(request, failure.httpStatus(), failure.code(), failure.detailsMessage(), failure.details());
        } catch (RuntimeException ex) {
            throw localSummaryError(request, Response.Status.INTERNAL_SERVER_ERROR,
                    "LOCAL_SUMMARY_INTERNAL_ERROR",
                    "Failed to load local summary.",
                    Map.of("encounterKey", encounterKey));
        }
    }

    private WebApplicationException localSummaryError(HttpServletRequest request, Response.Status status, String code,
            String message, Map<String, Object> details) {
        return localSummaryError(request, status.getStatusCode(), code, message, details);
    }

    private WebApplicationException localSummaryError(HttpServletRequest request, int status, String code,
            String message, Map<String, Object> details) {
        LocalMedicalSummaryErrorResponse response = new LocalMedicalSummaryErrorResponse();
        LocalMedicalSummaryErrorResponse.ErrorEnvelope error = new LocalMedicalSummaryErrorResponse.ErrorEnvelope();
        error.setCode(code);
        error.setMessage(message);
        error.setHttpStatus(status);
        error.setRequestId(resolveRequestId(request));
        error.setTraceId(resolveTraceId(request));
        error.setDetails(details != null ? new LinkedHashMap<>(details) : new LinkedHashMap<>());
        response.setError(error);
        Response httpResponse = Response.status(status)
                .type(MediaType.APPLICATION_JSON_TYPE)
                .entity(response)
                .build();
        return new WebApplicationException(message, httpResponse);
    }

    private String resolveRequestId(HttpServletRequest request) {
        if (request != null) {
            Object attribute = request.getAttribute(LogFilter.REQUEST_ID_ATTRIBUTE);
            if (attribute instanceof String requestId && !requestId.isBlank()) {
                return requestId.trim();
            }
            String fromHeader = request.getHeader("X-Request-Id");
            if (fromHeader != null && !fromHeader.isBlank()) {
                return fromHeader.trim();
            }
        }
        String traceId = resolveTraceId(request);
        if (traceId != null && !traceId.isBlank()) {
            return traceId;
        }
        return UUID.randomUUID().toString();
    }

    private String resolveRunId(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        Object attribute = request.getAttribute(LogFilter.RUN_ID_ATTRIBUTE);
        if (attribute instanceof String runId && !runId.isBlank()) {
            return runId.trim();
        }
        String fromHeader = request.getHeader("X-Run-Id");
        if (fromHeader != null && !fromHeader.isBlank()) {
            return fromHeader.trim();
        }
        return null;
    }
}
