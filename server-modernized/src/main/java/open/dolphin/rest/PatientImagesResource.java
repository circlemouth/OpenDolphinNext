package open.dolphin.rest;

import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.StreamingOutput;
import jakarta.ws.rs.core.UriInfo;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.rest.dto.PatientImageEntryResponse;
import open.dolphin.rest.dto.PatientImageUploadResponse;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.security.audit.AuthoritativeAuditRepository;
import open.dolphin.security.audit.AuditTrailService;
import open.dolphin.session.PatientImageServiceBean;
import open.dolphin.session.PatientServiceBean;
import open.dolphin.session.UserServiceBean;
import open.dolphin.storage.attachment.AttachmentStorageManager;
import org.jboss.resteasy.plugins.providers.multipart.MultipartFormDataInput;

/**
 * PhaseA: patient image upload/list/download (feature gated).
 */
@Path("/patients/{patientId}/images")
public class PatientImagesResource extends AbstractResource {

    @Inject
    private PatientServiceBean patientServiceBean;

    @Inject
    private PatientImageServiceBean patientImageServiceBean;

    @Inject
    private AuditTrailService auditTrailService;

    @Inject
    private AuthoritativeAuditRepository authoritativeAuditRepository;

    @Inject
    private UserServiceBean userServiceBean;

    @Inject
    private AttachmentStorageManager attachmentStorageManager;

    @Inject
    private ServerConfigurationResolver configurationResolver;

    @Context
    private HttpServletRequest httpServletRequest;

    @Context
    private HttpServletResponse httpServletResponse;

    @Context
    private UriInfo uriInfo;

    @POST
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Produces(MediaType.APPLICATION_JSON)
    public PatientImageUploadResponse upload(@PathParam("patientId") String patientId,
                                             MultipartFormDataInput input) {
        PatientImagesSupport support = support();
        support.requireFeatureEnabled();
        support.requireStorageAvailable();
        ensureAuthoritativeAuditWritePathAvailable();
        String fid = support.requireActorFacilityId();
        String actor = support.resolveActorId();
        support.requirePatientAccessible(fid, patientId);

        long maxBytes = support.resolveMaxBytes();
        PatientImagesSupport.UploadedFile file = support.extractFile(input, maxBytes);
        if (file == null || file.path() == null || file.contentLength() <= 0L) {
            throw restError(httpServletRequest, Response.Status.BAD_REQUEST,
                    "IMAGE_UPLOAD_VALIDATION_ERROR", "file is required",
                    java.util.Map.of("field", "file"), null);
        }
        try {
            PatientImageServiceBean.UploadResult created = patientImageServiceBean.uploadImage(
                    fid, patientId, actor, file.fileName(), file.contentType(), file.path(), file.contentLength());

            PatientImageUploadResponse response = new PatientImageUploadResponse();
            response.setImageId(created.attachmentId());
            response.setDocumentId(created.documentId());
            response.setFileName(file.fileName());
            response.setContentType(file.contentType());
            response.setSize(file.contentLength());
            response.setCreatedAt(created.createdAt().toInstant().toString());

            support.recordAudit("PATIENT_IMAGE_UPLOAD", support.detailsOf(
                    "status", "SUCCESS",
                    "operation", "image_upload",
                    "patientId", patientId,
                    "documentId", created.documentId(),
                    "attachmentId", created.attachmentId(),
                    "filename", file.fileName(),
                    "contentType", file.contentType(),
                    "size", file.contentLength()
            ));
            return response;
        } finally {
            support.deleteTempFile(file.path());
        }
    }

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response list(@PathParam("patientId") String patientId) {
        PatientImagesSupport support = support();
        support.requireFeatureEnabled();
        support.requireStorageAvailable();
        String fid = support.requireActorFacilityId();
        support.requirePatientAccessible(fid, patientId);
        List<PatientImageEntryResponse> items = patientImageServiceBean.listImages(fid, patientId);
        for (PatientImageEntryResponse item : items) {
            if (item != null && item.getImageId() != null) {
                item.setDownloadUrl(support.buildDownloadUrl(item.getImageId()));
            }
        }
        support.applyNoStoreHeaders(httpServletResponse);
        return support.noStore(Response.ok(items)).build();
    }

    @GET
    @Path("/{imageId}")
    public Response download(@PathParam("patientId") String patientId,
                             @PathParam("imageId") long imageId) {
        PatientImagesSupport support = support();
        support.requireFeatureEnabled();
        support.requireStorageAvailable();
        String fid = support.requireActorFacilityId();
        support.requirePatientAccessible(fid, patientId);

        PatientImageServiceBean.DownloadHandle handle = patientImageServiceBean.getImageForDownload(fid, patientId, imageId);
        if (handle == null) {
            throw restError(httpServletRequest, Response.Status.NOT_FOUND,
                    "not_found", "Image not found",
                    java.util.Map.of("patientId", patientId, "imageId", imageId), null);
        }

        boolean hasUri = handle.uri() != null && !handle.uri().isBlank();
        boolean hasDigest = handle.digest() != null && !handle.digest().isBlank();
        if (!hasUri || !hasDigest) {
            throw restError(httpServletRequest, Response.Status.INTERNAL_SERVER_ERROR,
                    "image_contract_violation", "Image uri or digest is not available",
                    java.util.Map.of("patientId", patientId, "imageId", imageId), null);
        }

        String contentType = handle.contentType();
        if (contentType == null || contentType.isBlank()) {
            contentType = "application/octet-stream";
        }
        String fileName = safeFileName(handle.fileName(), "image-" + imageId);
        long contentLength = handle.contentSize() > 0L ? handle.contentSize() : -1L;
        open.dolphin.infomodel.AttachmentModel attachment = support.toStreamingAttachment(handle);
        StreamingOutput output = support.toStreamingOutput(attachment);

        support.recordAudit("PATIENT_IMAGE_DOWNLOAD", support.detailsOf(
                "status", "SUCCESS",
                "operation", "image_download",
                "patientId", patientId,
                "attachmentId", imageId,
                "filename", fileName,
                "contentType", contentType,
                "size", contentLength > 0 ? contentLength : null
        ));

        Response.ResponseBuilder builder = support.noStore(Response.ok(output, contentType))
                .header("Content-Disposition", "attachment; filename=\"" + fileName + "\"");
        if (contentLength > 0L) {
            builder.header("Content-Length", contentLength);
        }
        support.applyNoStoreHeaders(httpServletResponse);
        return builder.build();
    }

    private PatientImagesSupport support() {
        return new PatientImagesSupport(
                httpServletRequest,
                httpServletResponse,
                uriInfo,
                patientServiceBean,
                patientImageServiceBean,
                auditTrailService,
                userServiceBean,
                attachmentStorageManager,
                configurationResolver);
    }

    private String safeFileName(String original, String fallbackBase) {
        return support().safeFileNameForHeader(original, fallbackBase);
    }

    private void ensureAuthoritativeAuditWritePathAvailable() {
        if (authoritativeAuditRepository != null && authoritativeAuditRepository.isWritePathAvailable()) {
            return;
        }
        Map<String, Object> details = new HashMap<>();
        details.put("reasonCode", "audit_log_write_unavailable");
        details.put("retryable", Boolean.TRUE);
        throw restError(httpServletRequest, Response.Status.SERVICE_UNAVAILABLE,
                "audit_log_write_unavailable",
                "Audit log write path is unavailable",
                details,
                null);
    }
}
