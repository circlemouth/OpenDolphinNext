package open.dolphin.rest;

import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import java.util.LinkedHashMap;
import java.util.Map;
import open.dolphin.encounter.ScheduleProjectionRepository;

@Path("/schedules")
public class ScheduleResource extends AbstractResource {

    @Inject
    private ScheduleProjectionRepository scheduleProjectionRepository;

    @GET
    @Path("/{scheduleKey}")
    @Produces(MediaType.APPLICATION_JSON)
    public Map<String, Object> getSchedule(@Context HttpServletRequest request, @PathParam("scheduleKey") String scheduleKey) {
        requireRemoteUser(request);
        String facilityId = requireActorFacility(request);
        ScheduleProjectionRepository.ScheduleRow row = scheduleProjectionRepository.findByScheduleKey(scheduleKey);
        if (row == null || !facilityId.equals(row.facilityId())) {
            throw new NotFoundException();
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("scheduleKey", row.scheduleKey());
        response.put("facilityId", row.facilityId());
        response.put("patientId", row.patientId());
        response.put("karteId", row.karteId());
        response.put("orcaAppointmentId", row.orcaAppointmentId());
        response.put("state", row.state());
        response.put("scheduledAt", row.scheduledDatetime().toString());
        response.put("encounterKey", row.linkedEncounterKey());
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("departmentCode", row.departmentCode());
        metadata.put("physicianCode", row.physicianCode());
        metadata.put("sourceUpdatedAt", row.sourceUpdatedAt() != null ? row.sourceUpdatedAt().toString() : null);
        metadata.put("projectedAt", row.projectedAt().toString());
        response.put("metadata", metadata);
        return response;
    }
}
