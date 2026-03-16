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
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.StreamingOutput;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;
import javax.imageio.ImageIO;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.rest.dto.PatientImageEntryResponse;
import open.dolphin.rest.dto.PatientImageUploadResponse;
import open.dolphin.security.audit.AuditDetailSanitizer;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.AuditTrailService;
import open.dolphin.session.PatientImageServiceBean;
import open.dolphin.session.PatientServiceBean;
import open.dolphin.storage.attachment.AttachmentStorageManager;
import org.jboss.resteasy.plugins.providers.multipart.InputPart;
import org.jboss.resteasy.plugins.providers.multipart.MultipartFormDataInput;

/**
 * PhaseA: patient image upload/list/download (feature gated).
 */
@Path("/patients/{patientId}/images")
public class PatientImagesResource extends AbstractResource {

    private static final Logger LOGGER = Logger.getLogger(PatientImagesResource.class.getName());

    private static final String FEATURE_ENV = "OPENDOLPHIN_PATIENT_IMAGES_ENABLED";
    private static final String FEATURE_PROPERTY = "opendolphin.patient.images.enabled";
    private static final String CACHE_CONTROL_NO_STORE = "private, no-store, max-age=0, must-revalidate";
    private static final String PRAGMA_NO_CACHE = "no-cache";
    private static final String EXPIRES_IMMEDIATELY = "0";

    private static final String MAX_BYTES_ENV = "OPENDOLPHIN_IMAGES_MAX_BYTES";
    private static final String MAX_BYTES_PROPERTY = "opendolphin.images.max.bytes";
    private static final long DEFAULT_MAX_BYTES = 5L * 1024L * 1024L; // 5MiB
    private static final String MAX_WIDTH_ENV = "OPENDOLPHIN_IMAGES_MAX_WIDTH";
    private static final String MAX_WIDTH_PROPERTY = "opendolphin.images.max.width";
    private static final int DEFAULT_MAX_WIDTH = 4096;
    private static final String MAX_HEIGHT_ENV = "OPENDOLPHIN_IMAGES_MAX_HEIGHT";
    private static final String MAX_HEIGHT_PROPERTY = "opendolphin.images.max.height";
    private static final int DEFAULT_MAX_HEIGHT = 4096;

    private static final Set<String> ALLOWED_UPLOAD_CONTENT_TYPES = Set.of("image/jpeg", "image/png");
    private static final int AUDIT_RUN_ID_MAX_LEN = 64;

    @Inject
    private PatientServiceBean patientServiceBean;

    @Inject
    private PatientImageServiceBean patientImageServiceBean;

    @Inject
    private AuditTrailService auditTrailService;

    @Inject
    private AttachmentStorageManager attachmentStorageManager;

    @Context
    private HttpServletRequest httpServletRequest;

    @Context
    private HttpServletResponse httpServletResponse;

    @POST
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Produces(MediaType.APPLICATION_JSON)
    public PatientImageUploadResponse upload(@PathParam("patientId") String patientId,
                                             MultipartFormDataInput input) {
        requireFeatureEnabled();
        String fid = resolveFacilityId();
        String actor = resolveActorId();
        requirePatientAccessible(fid, patientId);

        long maxBytes = resolveMaxBytes();
        UploadedFile file = extractFile(input, maxBytes);
        if (file == null || file.bytes == null || file.bytes.length == 0) {
            throw restError(httpServletRequest, Response.Status.BAD_REQUEST,
                    "IMAGE_UPLOAD_VALIDATION_ERROR", "file is required",
                    Map.of("field", "file"), null);
        }

        PatientImageServiceBean.UploadResult created = patientImageServiceBean.uploadImage(
                fid, patientId, actor, file.fileName, file.contentType, file.bytes);

        PatientImageUploadResponse response = new PatientImageUploadResponse();
        response.setImageId(created.attachmentId());
        response.setDocumentId(created.documentId());
        response.setFileName(file.fileName);
        response.setContentType(file.contentType);
        response.setSize((long) file.bytes.length);
        response.setCreatedAt(created.createdAt().toInstant().toString());

        recordAudit("PATIENT_IMAGE_UPLOAD", detailsOf(
                "status", "SUCCESS",
                "operation", "image_upload",
                "patientId", patientId,
                "documentId", created.documentId(),
                "attachmentId", created.attachmentId(),
                "filename", file.fileName,
                "contentType", file.contentType,
                "size", file.bytes.length
        ));

        return response;
    }

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response list(@PathParam("patientId") String patientId) {
        requireFeatureEnabled();
        String fid = resolveFacilityId();
        requirePatientAccessible(fid, patientId);
        List<PatientImageEntryResponse> items = patientImageServiceBean.listImages(fid, patientId);
        for (PatientImageEntryResponse item : items) {
            if (item != null && item.getImageId() != null) {
                item.setDownloadUrl("/openDolphin/api/patients/" + patientId + "/images/" + item.getImageId());
            }
        }
        applyNoStoreHeaders(httpServletResponse);
        return noStore(Response.ok(items)).build();
    }

    @GET
    @Path("/{imageId}")
    public Response download(@PathParam("patientId") String patientId,
                             @PathParam("imageId") long imageId) {
        requireFeatureEnabled();
        String fid = resolveFacilityId();
        requirePatientAccessible(fid, patientId);

        PatientImageServiceBean.DownloadHandle handle = patientImageServiceBean.getImageForDownload(fid, patientId, imageId);
        if (handle == null) {
            throw restError(httpServletRequest, Response.Status.NOT_FOUND,
                    "not_found", "Image not found",
                    Map.of("patientId", patientId, "imageId", imageId), null);
        }

        boolean hasUri = handle.uri() != null && !handle.uri().isBlank();
        boolean hasInlineBytes = handle.contentBytes() != null && handle.contentBytes().length > 0;
        if (!hasUri && !hasInlineBytes) {
            throw restError(httpServletRequest, Response.Status.INTERNAL_SERVER_ERROR,
                    "image_bytes_missing", "Image bytes are not available",
                    Map.of("patientId", patientId, "imageId", imageId), null);
        }

        String contentType = handle.contentType();
        if (contentType == null || contentType.isBlank()) {
            contentType = "application/octet-stream";
        }
        String fileName = safeFileName(handle.fileName(), "image-" + imageId);
        long contentLength = handle.contentSize() > 0L ? handle.contentSize() : -1L;
        open.dolphin.infomodel.AttachmentModel attachment = toStreamingAttachment(handle);
        StreamingOutput output = stream -> attachmentStorageManager.writeBinaryTo(attachment, stream);

        recordAudit("PATIENT_IMAGE_DOWNLOAD", detailsOf(
                "status", "SUCCESS",
                "operation", "image_download",
                "patientId", patientId,
                "attachmentId", imageId,
                "filename", fileName,
                "contentType", contentType,
                "size", contentLength > 0 ? contentLength : null
        ));

        Response.ResponseBuilder builder = noStore(Response.ok(output, contentType))
                .header("Content-Disposition", "attachment; filename=\"" + fileName + "\"");
        if (contentLength > 0L) {
            builder.header("Content-Length", contentLength);
        }
        applyNoStoreHeaders(httpServletResponse);
        return builder.build();
    }

    private open.dolphin.infomodel.AttachmentModel toStreamingAttachment(PatientImageServiceBean.DownloadHandle handle) {
        open.dolphin.infomodel.AttachmentModel attachment = new open.dolphin.infomodel.AttachmentModel();
        attachment.setId(handle.attachmentId());
        attachment.setFileName(handle.fileName());
        attachment.setContentType(handle.contentType());
        attachment.setContentSize(handle.contentSize());
        attachment.setUri(handle.uri());
        attachment.setDigest(handle.digest());
        attachment.setContentBytes(handle.contentBytes());
        return attachment;
    }

    private void requireFeatureEnabled() {
        String fromProperty = System.getProperty(FEATURE_PROPERTY);
        String fromEnv = readEnvironmentValue(FEATURE_ENV);
        if (isTruthy(fromProperty) || isTruthy(fromEnv)) {
            return;
        }
        throw restError(httpServletRequest, Response.Status.NOT_FOUND,
                "feature_disabled", "Images PhaseA is disabled",
                Map.of("requiredEnv", FEATURE_ENV, "requiredProperty", FEATURE_PROPERTY),
                null);
    }

    private Response.ResponseBuilder noStore(Response.ResponseBuilder builder) {
        return builder
                .header("Cache-Control", CACHE_CONTROL_NO_STORE)
                .header("Pragma", PRAGMA_NO_CACHE)
                .header("Expires", EXPIRES_IMMEDIATELY);
    }

    private void applyNoStoreHeaders(HttpServletResponse response) {
        if (response == null) {
            return;
        }
        response.setHeader("Cache-Control", CACHE_CONTROL_NO_STORE);
        response.setHeader("Pragma", PRAGMA_NO_CACHE);
        response.setHeader("Expires", EXPIRES_IMMEDIATELY);
    }

    String readEnvironmentValue(String key) {
        return System.getenv(key);
    }

    private boolean isTruthy(String value) {
        if (value == null) {
            return false;
        }
        String v = value.trim().toLowerCase();
        return v.equals("1") || v.equals("true") || v.equals("yes") || v.equals("on");
    }

    private void requirePatientAccessible(String facilityId, String patientId) {
        if (facilityId == null || facilityId.isBlank() || patientId == null || patientId.isBlank()) {
            throw restError(httpServletRequest, Response.Status.NOT_FOUND,
                    "not_found", "Resource was not found",
                    Map.of("facilityId", facilityId, "patientId", patientId), null);
        }
        if (patientServiceBean != null && patientServiceBean.getPatientById(facilityId, patientId) == null) {
            throw restError(httpServletRequest, Response.Status.NOT_FOUND,
                    "not_found", "Resource was not found",
                    Map.of("facilityId", facilityId, "patientId", patientId), null);
        }
    }

    private long resolveMaxBytes() {
        String raw = firstNonBlank(System.getProperty(MAX_BYTES_PROPERTY), System.getenv(MAX_BYTES_ENV));
        if (raw == null || raw.isBlank()) {
            return DEFAULT_MAX_BYTES;
        }
        try {
            long parsed = Long.parseLong(raw.trim());
            return parsed > 0 ? parsed : DEFAULT_MAX_BYTES;
        } catch (Exception ex) {
            return DEFAULT_MAX_BYTES;
        }
    }

    private UploadedFile extractFile(MultipartFormDataInput input, long maxBytes) {
        if (input == null) {
            return null;
        }
        Map<String, List<InputPart>> map = input.getFormDataMap();
        if (map == null) {
            return null;
        }
        List<InputPart> parts = map.get("file");
        if (parts == null || parts.isEmpty()) {
            return null;
        }
        InputPart part = parts.get(0);
        try {
            String fileName = fileNameFromPart(part);
            String contentType = normalizeContentType(part.getMediaType() != null ? part.getMediaType().toString() : null);
            requireSupportedContentType(contentType);
            byte[] bytes = readBytesWithLimit(part, maxBytes);
            NormalizedImage normalized = inspectAndNormalizeImage(contentType, bytes);
            if (fileName == null || fileName.isBlank()) {
                fileName = "upload-" + UUID.randomUUID() + extensionFor(normalized.contentType);
            }
            return new UploadedFile(normalizeUploadFileName(fileName), normalized.contentType, normalized.bytes);
        } catch (WebApplicationException ex) {
            // Bubble up 4xx/5xx that we intentionally created (413/415 etc).
            throw ex;
        } catch (Exception ex) {
            LOGGER.log(Level.WARNING, "Failed to read multipart file", ex);
            throw restError(httpServletRequest, Response.Status.BAD_REQUEST,
                    "invalid_multipart", "Failed to read multipart file", null, ex);
        }
    }

    private String normalizeContentType(String contentType) {
        if (contentType == null) {
            return null;
        }
        String base = contentType;
        int idx = base.indexOf(';');
        if (idx >= 0) {
            base = base.substring(0, idx);
        }
        base = base.trim().toLowerCase();
        return base.isBlank() ? null : base;
    }

    private void requireSupportedContentType(String contentType) {
        if (contentType == null || contentType.isBlank() || !ALLOWED_UPLOAD_CONTENT_TYPES.contains(contentType)) {
            throw restError(httpServletRequest, Response.Status.UNSUPPORTED_MEDIA_TYPE,
                    "unsupported_media_type", "Unsupported content type",
                    Map.of("allowed", ALLOWED_UPLOAD_CONTENT_TYPES, "contentType", contentType), null);
        }
    }

    private NormalizedImage inspectAndNormalizeImage(String declaredContentType, byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            throw restError(httpServletRequest, Response.Status.BAD_REQUEST,
                    "invalid_image", "Image payload is empty", null, null);
        }
        String detectedContentType = detectContentTypeByMagic(bytes);
        if (detectedContentType == null) {
            throw restError(httpServletRequest, Response.Status.UNSUPPORTED_MEDIA_TYPE,
                    "unsupported_media_type", "Unsupported image format",
                    Map.of("allowed", ALLOWED_UPLOAD_CONTENT_TYPES), null);
        }
        if (!detectedContentType.equals(declaredContentType)) {
            throw restError(httpServletRequest, Response.Status.UNSUPPORTED_MEDIA_TYPE,
                    "content_type_mismatch", "Declared Content-Type does not match image data",
                    Map.of("declared", declaredContentType, "detected", detectedContentType), null);
        }
        BufferedImage image;
        try (ByteArrayInputStream in = new ByteArrayInputStream(bytes)) {
            image = ImageIO.read(in);
        } catch (Exception ex) {
            throw restError(httpServletRequest, Response.Status.BAD_REQUEST,
                    "invalid_image", "Failed to decode image payload", null, ex);
        }
        if (image == null) {
            throw restError(httpServletRequest, Response.Status.BAD_REQUEST,
                    "invalid_image", "Failed to decode image payload", null, null);
        }
        int maxWidth = resolveMaxDimension(MAX_WIDTH_PROPERTY, MAX_WIDTH_ENV, DEFAULT_MAX_WIDTH);
        int maxHeight = resolveMaxDimension(MAX_HEIGHT_PROPERTY, MAX_HEIGHT_ENV, DEFAULT_MAX_HEIGHT);
        if (image.getWidth() <= 0 || image.getHeight() <= 0
                || image.getWidth() > maxWidth || image.getHeight() > maxHeight) {
            throw restError(httpServletRequest, Response.Status.REQUEST_ENTITY_TOO_LARGE,
                    "image_dimension_too_large", "Image dimensions exceed allowed limit",
                    Map.of("maxWidth", maxWidth, "maxHeight", maxHeight,
                            "width", image.getWidth(), "height", image.getHeight()),
                    null);
        }
        byte[] normalized = reencodeImage(image, detectedContentType);
        return new NormalizedImage(detectedContentType, normalized);
    }

    private byte[] reencodeImage(BufferedImage source, String contentType) {
        Objects.requireNonNull(source, "source");
        String format = "image/jpeg".equals(contentType) ? "jpeg" : "png";
        BufferedImage normalized = source;
        if ("jpeg".equals(format) && source.getColorModel().hasAlpha()) {
            BufferedImage rgb = new BufferedImage(source.getWidth(), source.getHeight(), BufferedImage.TYPE_INT_RGB);
            Graphics2D g = rgb.createGraphics();
            try {
                g.drawImage(source, 0, 0, null);
            } finally {
                g.dispose();
            }
            normalized = rgb;
        }
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            boolean encoded = ImageIO.write(normalized, format, out);
            if (!encoded || out.size() == 0) {
                throw restError(httpServletRequest, Response.Status.BAD_REQUEST,
                        "invalid_image", "Failed to normalize image payload", null, null);
            }
            return out.toByteArray();
        } catch (WebApplicationException ex) {
            throw ex;
        } catch (Exception ex) {
            throw restError(httpServletRequest, Response.Status.BAD_REQUEST,
                    "invalid_image", "Failed to normalize image payload", null, ex);
        }
    }

    private String detectContentTypeByMagic(byte[] bytes) {
        if (bytes == null || bytes.length < 8) {
            return null;
        }
        if ((bytes[0] & 0xFF) == 0x89
                && (bytes[1] & 0xFF) == 0x50
                && (bytes[2] & 0xFF) == 0x4E
                && (bytes[3] & 0xFF) == 0x47
                && (bytes[4] & 0xFF) == 0x0D
                && (bytes[5] & 0xFF) == 0x0A
                && (bytes[6] & 0xFF) == 0x1A
                && (bytes[7] & 0xFF) == 0x0A) {
            return "image/png";
        }
        if ((bytes[0] & 0xFF) == 0xFF
                && (bytes[1] & 0xFF) == 0xD8
                && (bytes[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        return null;
    }

    private int resolveMaxDimension(String propertyKey, String envKey, int defaultValue) {
        String raw = firstNonBlank(System.getProperty(propertyKey), System.getenv(envKey));
        if (raw == null || raw.isBlank()) {
            return defaultValue;
        }
        try {
            int parsed = Integer.parseInt(raw.trim());
            return parsed > 0 ? parsed : defaultValue;
        } catch (Exception ex) {
            return defaultValue;
        }
    }

    private String firstNonBlank(String a, String b) {
        if (a != null && !a.isBlank()) {
            return a;
        }
        if (b != null && !b.isBlank()) {
            return b;
        }
        return null;
    }

    private String extensionFor(String contentType) {
        if ("image/jpeg".equals(contentType)) {
            return ".jpg";
        }
        if ("image/png".equals(contentType)) {
            return ".png";
        }
        return ".bin";
    }

    private String normalizeUploadFileName(String fileName) {
        if (fileName == null || fileName.isBlank()) {
            return "upload-" + UUID.randomUUID() + ".bin";
        }
        String sanitized = fileName.replace('\\', '/');
        int slash = sanitized.lastIndexOf('/');
        if (slash >= 0 && slash + 1 < sanitized.length()) {
            sanitized = sanitized.substring(slash + 1);
        }
        sanitized = sanitized.replace("\r", "")
                .replace("\n", "")
                .replace("\"", "_");
        return sanitized.isBlank() ? "upload-" + UUID.randomUUID() + ".bin" : sanitized;
    }

    private byte[] readBytesWithLimit(InputPart part, long maxBytes) throws Exception {
        if (part == null) {
            return null;
        }
        long limit = maxBytes > 0 ? maxBytes : DEFAULT_MAX_BYTES;
        try (InputStream in = part.getBody(InputStream.class, null)) {
            if (in == null) {
                return null;
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            long total = 0;
            int n;
            while ((n = in.read(buf)) >= 0) {
                if (n == 0) {
                    continue;
                }
                total += n;
                if (total > limit) {
                    throw restError(httpServletRequest, Response.Status.REQUEST_ENTITY_TOO_LARGE,
                            "payload_too_large", "Payload too large",
                            Map.of("maxBytes", limit, "size", total, "env", MAX_BYTES_ENV), null);
                }
                out.write(buf, 0, n);
            }
            return out.toByteArray();
        }
    }

    private String fileNameFromPart(InputPart part) {
        if (part == null || part.getHeaders() == null) {
            return null;
        }
        List<String> cd = part.getHeaders().get("Content-Disposition");
        if (cd == null || cd.isEmpty()) {
            return null;
        }
        // Example: form-data; name="file"; filename="a.png"
        String raw = cd.get(0);
        if (raw == null) {
            return null;
        }
        for (String token : raw.split(";")) {
            String t = token != null ? token.trim() : "";
            if (t.startsWith("filename=")) {
                String v = t.substring("filename=".length()).trim();
                if (v.startsWith("\"") && v.endsWith("\"") && v.length() >= 2) {
                    v = v.substring(1, v.length() - 1);
                }
                return v;
            }
        }
        return null;
    }

    private String safeFileName(String original, String fallbackBase) {
        String name = original;
        if (name == null || name.isBlank()) {
            name = fallbackBase;
        }
        // Replace quotes and CRLF to avoid header injection.
        name = name.replace("\"", "_")
                .replace("\r", "")
                .replace("\n", "");
        // Best-effort: keep ASCII.
        byte[] bytes = name.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > 180) {
            name = fallbackBase;
        }
        return name;
    }

    private String resolveFacilityId() {
        String remoteUser = httpServletRequest != null ? httpServletRequest.getRemoteUser() : null;
        String facility = getRemoteFacility(remoteUser);
        if (facility == null || facility.isBlank()) {
            throw restError(httpServletRequest, Response.Status.UNAUTHORIZED,
                    "facility_missing", "Facility identifier is not available",
                    Map.of("remoteUser", remoteUser), null);
        }
        return facility;
    }

    private String resolveActorId() {
        return httpServletRequest != null && httpServletRequest.getRemoteUser() != null
                ? httpServletRequest.getRemoteUser()
                : "system";
    }

    private void recordAudit(String action, Map<String, Object> details) {
        if (auditTrailService == null) {
            return;
        }
        try {
            AuditEventPayload payload = new AuditEventPayload();
            String actorId = resolveActorId();
            payload.setActorId(actorId);
            payload.setActorDisplayName(actorId);
            payload.setActorRole(httpServletRequest != null && httpServletRequest.isUserInRole("ADMIN") ? "ADMIN" : null);
            payload.setAction(action);
            payload.setResource(httpServletRequest != null ? httpServletRequest.getRequestURI() : "/patients/*/images");
            payload.setRequestId(resolveRequestId());
            payload.setTraceId(resolveTraceId(httpServletRequest));
            payload.setIpAddress(resolveClientIp(httpServletRequest));
            payload.setUserAgent(httpServletRequest != null ? httpServletRequest.getHeader("User-Agent") : null);

            Map<String, Object> enriched = new HashMap<>();
            if (details != null) {
                enriched.putAll(details);
            }
            enrichUserDetails(enriched);
            enrichTraceDetails(enriched);

            // AuditEvent.run_id has a length limit; keep a truncated copy for correlation and store full in payload.
            String runIdHeader = httpServletRequest != null ? httpServletRequest.getHeader("X-Run-Id") : null;
            if (runIdHeader != null && !runIdHeader.isBlank()) {
                String trimmed = runIdHeader.trim();
                if (trimmed.length() > AUDIT_RUN_ID_MAX_LEN) {
                    payload.setRunId(trimmed.substring(0, AUDIT_RUN_ID_MAX_LEN));
                    enriched.putIfAbsent("runIdFull", trimmed);
                } else {
                    payload.setRunId(trimmed);
                }
            }

            payload.setPatientId(AuditDetailSanitizer.resolvePatientId(null, enriched));
            payload.setDetails(enriched);
            auditTrailService.record(payload);
        } catch (Exception ex) {
            LOGGER.log(Level.FINE, "Failed to record audit action=" + action, ex);
        }
    }

    private void enrichUserDetails(Map<String, Object> details) {
        String remoteUser = httpServletRequest != null ? httpServletRequest.getRemoteUser() : null;
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
        String traceId = resolveTraceId(httpServletRequest);
        if (traceId != null && !traceId.isBlank()) {
            details.put("traceId", traceId);
        }
        String requestId = httpServletRequest != null ? httpServletRequest.getHeader("X-Request-Id") : null;
        if (requestId != null && !requestId.isBlank()) {
            details.put("requestId", requestId.trim());
        }
    }

    private String resolveRequestId() {
        if (httpServletRequest == null) {
            return UUID.randomUUID().toString();
        }
        String header = httpServletRequest.getHeader("X-Request-Id");
        if (header != null && !header.isBlank()) {
            return header.trim();
        }
        return UUID.randomUUID().toString();
    }

    private Map<String, Object> detailsOf(Object... kv) {
        Map<String, Object> details = new HashMap<>();
        if (kv == null) {
            return details;
        }
        for (int i = 0; i + 1 < kv.length; i += 2) {
            Object k = kv[i];
            Object v = kv[i + 1];
            if (k == null || v == null) {
                continue;
            }
            String key = k.toString();
            if (key.isBlank()) {
                continue;
            }
            details.put(key, v);
        }
        return details;
    }

    private static final class UploadedFile {
        private final String fileName;
        private String contentType;
        private final byte[] bytes;

        private UploadedFile(String fileName, String contentType, byte[] bytes) {
            this.fileName = fileName;
            this.contentType = contentType;
            this.bytes = bytes;
        }
    }

    private static final class NormalizedImage {
        private final String contentType;
        private final byte[] bytes;

        private NormalizedImage(String contentType, byte[] bytes) {
            this.contentType = contentType;
            this.bytes = bytes;
        }
    }
}
