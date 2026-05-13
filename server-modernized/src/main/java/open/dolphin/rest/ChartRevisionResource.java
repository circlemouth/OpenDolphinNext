package open.dolphin.rest;

import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import open.dolphin.reporting.ReportingResult;
import open.dolphin.rest.dto.chart.ChartRevisionChangeRequest;
import open.dolphin.rest.dto.chart.ChartRevisionChangeResponse;
import open.dolphin.rest.dto.chart.ChartRevisionDraftResponse;
import open.dolphin.rest.dto.chart.ChartRevisionExportResponse;
import open.dolphin.rest.dto.chart.ChartRevisionFinalizeRequest;
import open.dolphin.rest.dto.chart.ChartRevisionFinalizeResponse;
import open.dolphin.rest.dto.chart.ChartRevisionPeriodExportResponse;
import open.dolphin.rest.orca.AbstractOrcaRestResource;
import open.dolphin.session.ChartRevisionDraftService;
import open.dolphin.session.ChartRevisionExportService;
import open.dolphin.session.ChartRevisionFinalizeService;
import open.dolphin.session.UserServiceBean;

@Path("/charts")
@Produces(MediaType.APPLICATION_JSON)
public class ChartRevisionResource extends AbstractOrcaRestResource {

    @Inject
    private ChartRevisionFinalizeService finalizeService;

    @Inject
    private ChartRevisionDraftService draftService;

    @Inject
    private ChartRevisionExportService exportService;

    @Inject
    private UserServiceBean userServiceBean;

    @POST
    @Path("/document-drafts")
    @Consumes(MediaType.APPLICATION_JSON)
    @Transactional
    public ChartRevisionDraftResponse createDocumentDraft(
            @Context HttpServletRequest request,
            String payload) {
        String actor = requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        return draftService.createDraft(facilityId, resolveActorUserId(actor), payload);
    }

    @GET
    @Path("/revision-exports")
    @Transactional
    public ChartRevisionPeriodExportResponse exportChartPeriod(
            @Context HttpServletRequest request,
            @QueryParam("fromDate") String fromDate,
            @QueryParam("toDate") String toDate,
            @QueryParam("patientId") Long patientId) {
        requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        return exportService.exportChartPeriod(facilityId, fromDate, toDate, patientId);
    }

    @GET
    @Path("/revision-exports.csv")
    @Produces("text/csv")
    @Transactional
    public Response exportChartPeriodCsv(
            @Context HttpServletRequest request,
            @QueryParam("fromDate") String fromDate,
            @QueryParam("toDate") String toDate,
            @QueryParam("patientId") Long patientId) {
        requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        String csv = exportService.exportChartPeriodCsv(facilityId, fromDate, toDate, patientId);
        return Response.ok(csv, "text/csv")
                .header("Content-Disposition",
                        "attachment; filename=\"chart-revisions-" + fromDate + "-" + toDate + ".csv\"")
                .build();
    }

    @GET
    @Path("/revision-exports.pdf")
    @Produces("application/pdf")
    @Transactional
    public Response exportChartPeriodPdf(
            @Context HttpServletRequest request,
            @QueryParam("fromDate") String fromDate,
            @QueryParam("toDate") String toDate,
            @QueryParam("patientId") Long patientId) {
        requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        ReportingResult pdf = exportService.exportChartPeriodPdf(facilityId, fromDate, toDate, patientId);
        return pdfResponse(pdf, "attachment");
    }

    @GET
    @Path("/revision-exports.print.pdf")
    @Produces("application/pdf")
    @Transactional
    public Response printChartPeriodPdf(
            @Context HttpServletRequest request,
            @QueryParam("fromDate") String fromDate,
            @QueryParam("toDate") String toDate,
            @QueryParam("patientId") Long patientId) {
        requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        ReportingResult pdf = exportService.exportChartPeriodPdf(facilityId, fromDate, toDate, patientId);
        return pdfResponse(pdf, "inline");
    }

    @GET
    @Path("/{chartId}/revisions/export")
    @Transactional
    public ChartRevisionExportResponse exportChart(
            @Context HttpServletRequest request,
            @PathParam("chartId") long chartId) {
        requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        return exportService.exportChart(chartId, facilityId);
    }

    @GET
    @Path("/{chartId}/revisions/export.csv")
    @Produces("text/csv")
    @Transactional
    public Response exportChartCsv(
            @Context HttpServletRequest request,
            @PathParam("chartId") long chartId) {
        requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        String csv = exportService.exportChartCsv(chartId, facilityId);
        return Response.ok(csv, "text/csv")
                .header("Content-Disposition", "attachment; filename=\"chart-revisions-" + chartId + ".csv\"")
                .build();
    }

    @GET
    @Path("/{chartId}/revisions/export.pdf")
    @Produces("application/pdf")
    @Transactional
    public Response exportChartPdf(
            @Context HttpServletRequest request,
            @PathParam("chartId") long chartId) {
        requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        ReportingResult pdf = exportService.exportChartPdf(chartId, facilityId);
        return pdfResponse(pdf, "attachment");
    }

    @GET
    @Path("/{chartId}/revisions/print.pdf")
    @Produces("application/pdf")
    @Transactional
    public Response printChartPdf(
            @Context HttpServletRequest request,
            @PathParam("chartId") long chartId) {
        requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        ReportingResult pdf = exportService.exportChartPdf(chartId, facilityId);
        return pdfResponse(pdf, "inline");
    }

    @POST
    @Path("/{chartId}/revisions/{revisionId}/finalize")
    @Consumes(MediaType.APPLICATION_JSON)
    @Transactional
    public ChartRevisionFinalizeResponse finalizeRevision(
            @Context HttpServletRequest request,
            @PathParam("chartId") long chartId,
            @PathParam("revisionId") long revisionId,
            ChartRevisionFinalizeRequest payload) {
        requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        return finalizeService.finalizeRevision(chartId, revisionId, facilityId, payload);
    }

    @POST
    @Path("/{chartId}/revisions/{revisionId}/amend")
    @Consumes(MediaType.APPLICATION_JSON)
    @Transactional
    public ChartRevisionChangeResponse amendRevision(
            @Context HttpServletRequest request,
            @PathParam("chartId") long chartId,
            @PathParam("revisionId") long revisionId,
            ChartRevisionChangeRequest payload) {
        requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        return finalizeService.amendRevision(chartId, revisionId, facilityId, payload);
    }

    @POST
    @Path("/{chartId}/revisions/{revisionId}/addendum")
    @Consumes(MediaType.APPLICATION_JSON)
    @Transactional
    public ChartRevisionChangeResponse addAddendum(
            @Context HttpServletRequest request,
            @PathParam("chartId") long chartId,
            @PathParam("revisionId") long revisionId,
            ChartRevisionChangeRequest payload) {
        requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        return finalizeService.addAddendum(chartId, revisionId, facilityId, payload);
    }

    @POST
    @Path("/{chartId}/revisions/{revisionId}/cancel")
    @Consumes(MediaType.APPLICATION_JSON)
    @Transactional
    public ChartRevisionChangeResponse cancelRevision(
            @Context HttpServletRequest request,
            @PathParam("chartId") long chartId,
            @PathParam("revisionId") long revisionId,
            ChartRevisionChangeRequest payload) {
        requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        return finalizeService.cancelRevision(chartId, revisionId, facilityId, payload);
    }

    private static Response pdfResponse(ReportingResult pdf, String disposition) {
        return Response.ok(pdf.getData(), "application/pdf")
                .header("Content-Disposition", disposition + "; filename=\"" + pdf.getFileName() + "\"")
                .build();
    }

    private long resolveActorUserId(String actor) {
        if (userServiceBean == null) {
            throw restError(null, Response.Status.UNAUTHORIZED, "actor_unresolved",
                    "Authenticated actor could not be resolved");
        }
        try {
            return userServiceBean.getUser(actor).getId();
        } catch (RuntimeException ex) {
            throw restError(null, Response.Status.UNAUTHORIZED, "actor_unresolved",
                    "Authenticated actor could not be resolved");
        }
    }
}
