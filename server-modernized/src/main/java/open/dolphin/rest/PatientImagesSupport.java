package open.dolphin.rest;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.ResponseBuilder;
import jakarta.ws.rs.core.StreamingOutput;
import jakarta.ws.rs.core.UriBuilder;
import jakarta.ws.rs.core.UriInfo;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.awt.image.ColorModel;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.rest.dto.PatientImageEntryResponse;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.ServerRuntimeConfiguration;
import open.dolphin.security.audit.AuditDetailSanitizer;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.AuditTrailService;
import open.dolphin.session.PatientImageServiceBean;
import open.dolphin.session.PatientServiceBean;
import open.dolphin.session.UserServiceBean;
import open.dolphin.storage.attachment.AttachmentStorageManager;
import org.jboss.resteasy.plugins.providers.multipart.InputPart;
import org.jboss.resteasy.plugins.providers.multipart.MultipartFormDataInput;

final class PatientImagesSupport {

    private static final Logger LOGGER = Logger.getLogger(PatientImagesSupport.class.getName());

    private static final String CACHE_CONTROL_NO_STORE = "private, no-store, max-age=0, must-revalidate";
    private static final String PRAGMA_NO_CACHE = "no-cache";
    private static final String EXPIRES_IMMEDIATELY = "0";
    private static final long DEFAULT_MAX_BYTES = 5L * 1024L * 1024L;
    private static final int DEFAULT_MAX_WIDTH = 4096;
    private static final int DEFAULT_MAX_HEIGHT = 4096;
    private static final Set<String> ALLOWED_UPLOAD_CONTENT_TYPES = Set.of("image/jpeg", "image/png");
    private static final int AUDIT_RUN_ID_MAX_LEN = 64;

    private final HttpServletRequest request;
    private final HttpServletResponse response;
    private final UriInfo uriInfo;
    private final PatientServiceBean patientServiceBean;
    private final PatientImageServiceBean patientImageServiceBean;
    private final AuditTrailService auditTrailService;
    private final UserServiceBean userServiceBean;
    private final AttachmentStorageManager attachmentStorageManager;
    private final ServerConfigurationResolver configurationResolver;

    PatientImagesSupport(HttpServletRequest request,
            HttpServletResponse response,
            UriInfo uriInfo,
            PatientServiceBean patientServiceBean,
            PatientImageServiceBean patientImageServiceBean,
            AuditTrailService auditTrailService,
            UserServiceBean userServiceBean,
            AttachmentStorageManager attachmentStorageManager,
            ServerConfigurationResolver configurationResolver) {
        this.request = request;
        this.response = response;
        this.uriInfo = uriInfo;
        this.patientServiceBean = patientServiceBean;
        this.patientImageServiceBean = patientImageServiceBean;
        this.auditTrailService = auditTrailService;
        this.userServiceBean = userServiceBean;
        this.attachmentStorageManager = attachmentStorageManager;
        this.configurationResolver = configurationResolver;
    }

    void requireFeatureEnabled() {
        if (patientImagesSettings().enabled()) {
            return;
        }
        throw AbstractResource.restError(request, Response.Status.NOT_FOUND,
                "feature_disabled", "Images PhaseA is disabled",
                Map.of("requiredConfig", ServerConfigurationResolver.KEY_PATIENT_IMAGES_ENABLED),
                null);
    }

    String resolveFacilityId() {
        String remoteUser = request != null ? request.getRemoteUser() : null;
        String facility = AbstractResource.getRemoteFacility(remoteUser);
        if (facility == null || facility.isBlank()) {
            throw AbstractResource.restError(request, Response.Status.UNAUTHORIZED,
                    "facility_missing", "Facility identifier is not available",
                    Map.of("remoteUser", remoteUser), null);
        }
        return facility;
    }

    String resolveActorId() {
        return request != null && request.getRemoteUser() != null ? request.getRemoteUser() : "system";
    }

    void requirePatientAccessible(String facilityId, String patientId) {
        if (facilityId == null || facilityId.isBlank() || patientId == null || patientId.isBlank()) {
            throw AbstractResource.restError(request, Response.Status.NOT_FOUND,
                    "not_found", "Resource was not found",
                    Map.of("facilityId", facilityId, "patientId", patientId), null);
        }
        if (patientServiceBean != null && patientServiceBean.getPatientById(facilityId, patientId) == null) {
            throw AbstractResource.restError(request, Response.Status.NOT_FOUND,
                    "not_found", "Resource was not found",
                    Map.of("facilityId", facilityId, "patientId", patientId), null);
        }
    }

    long resolveMaxBytes() {
        Long configured = patientImagesSettings().maxBytes();
        return configured != null && configured > 0L ? configured : DEFAULT_MAX_BYTES;
    }

    UploadedFile extractFile(MultipartFormDataInput input, long maxBytes) {
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
        java.nio.file.Path uploadedFile = null;
        try {
            String fileName = fileNameFromPart(part);
            String contentType = normalizeContentType(part.getMediaType() != null ? part.getMediaType().toString() : null);
            requireSupportedContentType(contentType);
            uploadedFile = readPartToTempFile(part, maxBytes);
            NormalizedImage normalized = inspectAndNormalizeImage(contentType, uploadedFile, maxBytes);
            if (fileName == null || fileName.isBlank()) {
                fileName = "upload-" + UUID.randomUUID() + extensionFor(normalized.contentType());
            }
            return new UploadedFile(normalizeUploadFileName(fileName), normalized.contentType(), normalized.path(), normalized.contentLength());
        } catch (WebApplicationException ex) {
            throw ex;
        } catch (Exception ex) {
            LOGGER.log(Level.WARNING, "Failed to read multipart file", ex);
            throw AbstractResource.restError(request, Response.Status.BAD_REQUEST,
                    "invalid_multipart", "Failed to read multipart file", null, ex);
        } finally {
            deleteTempFile(uploadedFile);
        }
    }

    String normalizeContentType(String contentType) {
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

    void requireSupportedContentType(String contentType) {
        if (contentType == null || contentType.isBlank() || !ALLOWED_UPLOAD_CONTENT_TYPES.contains(contentType)) {
            throw AbstractResource.restError(request, Response.Status.UNSUPPORTED_MEDIA_TYPE,
                    "unsupported_media_type", "Unsupported content type",
                    Map.of("allowed", ALLOWED_UPLOAD_CONTENT_TYPES, "contentType", contentType), null);
        }
    }

    NormalizedImage inspectAndNormalizeImage(String declaredContentType, java.nio.file.Path uploadedFile, long maxBytes) {
        if (uploadedFile == null || !Files.exists(uploadedFile)) {
            throw AbstractResource.restError(request, Response.Status.BAD_REQUEST,
                    "invalid_image", "Image payload is empty", null, null);
        }
        String detectedContentType = detectContentTypeByMagic(uploadedFile);
        if (detectedContentType == null) {
            throw AbstractResource.restError(request, Response.Status.UNSUPPORTED_MEDIA_TYPE,
                    "unsupported_media_type", "Unsupported image format",
                    Map.of("allowed", ALLOWED_UPLOAD_CONTENT_TYPES), null);
        }
        if (!detectedContentType.equals(declaredContentType)) {
            throw AbstractResource.restError(request, Response.Status.UNSUPPORTED_MEDIA_TYPE,
                    "content_type_mismatch", "Declared Content-Type does not match image data",
                    Map.of("declared", declaredContentType, "detected", detectedContentType), null);
        }
        int maxWidth = resolveMaxDimension(patientImagesSettings().maxWidth(), DEFAULT_MAX_WIDTH);
        int maxHeight = resolveMaxDimension(patientImagesSettings().maxHeight(), DEFAULT_MAX_HEIGHT);
        BufferedImage image;
        try (ImageInputStream imageInput = ImageIO.createImageInputStream(uploadedFile.toFile())) {
            if (imageInput == null) {
                throw AbstractResource.restError(request, Response.Status.BAD_REQUEST,
                        "invalid_image", "Failed to decode image payload", null, null);
            }
            Iterator<ImageReader> readers = ImageIO.getImageReaders(imageInput);
            if (readers == null || !readers.hasNext()) {
                throw AbstractResource.restError(request, Response.Status.BAD_REQUEST,
                        "invalid_image", "Failed to decode image payload", null, null);
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(imageInput, true, true);
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width <= 0 || height <= 0 || width > maxWidth || height > maxHeight) {
                    throw AbstractResource.restError(request, Response.Status.REQUEST_ENTITY_TOO_LARGE,
                            "image_dimension_too_large", "Image dimensions exceed allowed limit",
                            Map.of("maxWidth", maxWidth, "maxHeight", maxHeight,
                                    "width", width, "height", height),
                            null);
                }
                image = reader.read(0);
            } finally {
                reader.dispose();
            }
        } catch (Exception ex) {
            if (ex instanceof WebApplicationException webApplicationException) {
                throw webApplicationException;
            }
            throw AbstractResource.restError(request, Response.Status.BAD_REQUEST,
                    "invalid_image", "Failed to decode image payload", null, ex);
        }
        if (image == null) {
            throw AbstractResource.restError(request, Response.Status.BAD_REQUEST,
                    "invalid_image", "Failed to decode image payload", null, null);
        }
        java.nio.file.Path normalizedPath = reencodeImage(image, detectedContentType);
        try {
            long normalizedSize = Files.size(normalizedPath);
            if (normalizedSize <= 0L) {
                deleteTempFile(normalizedPath);
                throw AbstractResource.restError(request, Response.Status.BAD_REQUEST,
                        "invalid_image", "Failed to normalize image payload", null, null);
            }
            if (normalizedSize > maxBytes) {
                deleteTempFile(normalizedPath);
                throw AbstractResource.restError(request, Response.Status.REQUEST_ENTITY_TOO_LARGE,
                        "payload_too_large", "Payload too large",
                        Map.of("maxBytes", maxBytes, "size", normalizedSize,
                                "config", ServerConfigurationResolver.KEY_PATIENT_IMAGES_MAX_BYTES), null);
            }
            return new NormalizedImage(detectedContentType, normalizedPath, normalizedSize);
        } catch (WebApplicationException ex) {
            throw ex;
        } catch (Exception ex) {
            deleteTempFile(normalizedPath);
            throw AbstractResource.restError(request, Response.Status.BAD_REQUEST,
                    "invalid_image", "Failed to normalize image payload", null, ex);
        }
    }

    StreamingOutput toStreamingOutput(open.dolphin.infomodel.AttachmentModel attachment) {
        return stream -> attachmentStorageManager.writeBinaryTo(attachment, stream);
    }

    open.dolphin.infomodel.AttachmentModel toStreamingAttachment(PatientImageServiceBean.DownloadHandle handle) {
        open.dolphin.infomodel.AttachmentModel attachment = new open.dolphin.infomodel.AttachmentModel();
        attachment.setId(handle.attachmentId());
        attachment.setFileName(handle.fileName());
        attachment.setContentType(handle.contentType());
        attachment.setContentSize(handle.contentSize());
        attachment.setUri(handle.uri());
        attachment.setDigest(handle.digest());
        return attachment;
    }

    ResponseBuilder noStore(ResponseBuilder builder) {
        return builder
                .header("Cache-Control", CACHE_CONTROL_NO_STORE)
                .header("Pragma", PRAGMA_NO_CACHE)
                .header("Expires", EXPIRES_IMMEDIATELY);
    }

    void applyNoStoreHeaders(HttpServletResponse response) {
        HttpServletResponse target = response != null ? response : this.response;
        if (target == null) {
            return;
        }
        target.setHeader("Cache-Control", CACHE_CONTROL_NO_STORE);
        target.setHeader("Pragma", PRAGMA_NO_CACHE);
        target.setHeader("Expires", EXPIRES_IMMEDIATELY);
    }

    String buildDownloadUrl(long imageId) {
        UriBuilder builder = uriInfo != null ? uriInfo.getAbsolutePathBuilder() : null;
        if (builder == null) {
            return "/api/patients/*/images/" + imageId;
        }
        return builder.path(Long.toString(imageId)).build().toString();
    }

    String safeFileNameForHeader(String original, String fallbackBase) {
        return safeFileName(original, fallbackBase);
    }

    java.nio.file.Path createTempFile(String prefix, String suffix) {
        try {
            return Files.createTempFile(prefix, suffix);
        } catch (Exception ex) {
            throw AbstractResource.restError(request, Response.Status.INTERNAL_SERVER_ERROR,
                    "temporary_storage_unavailable", "Failed to allocate temporary storage", null, ex);
        }
    }

    void deleteTempFile(java.nio.file.Path path) {
        if (path == null) {
            return;
        }
        try {
            Files.deleteIfExists(path);
        } catch (Exception ex) {
            LOGGER.log(Level.FINE, "Failed to delete temp file " + path, ex);
        }
    }

    void recordAudit(String action, Map<String, Object> details) {
        if (auditTrailService == null) {
            return;
        }
        try {
            AuditEventPayload payload = new AuditEventPayload();
            String actorId = resolveActorId();
            payload.setActorId(actorId);
            payload.setActorDisplayName(actorId);
            payload.setActorRole(isAdminActor() ? "ADMIN" : null);
            payload.setAction(action);
            payload.setResource(request != null ? request.getRequestURI() : "/patients/*/images");
            payload.setRequestId(resolveRequestId());
            payload.setTraceId(AbstractResource.resolveTraceIdValue(request));
            payload.setIpAddress(AbstractResource.resolveClientIp(request));
            payload.setUserAgent(request != null ? request.getHeader("User-Agent") : null);

            Map<String, Object> enriched = new HashMap<>();
            if (details != null) {
                enriched.putAll(details);
            }
            enrichUserDetails(enriched);
            enrichTraceDetails(enriched);

            String runIdHeader = request != null ? request.getHeader("X-Run-Id") : null;
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

    void enrichUserDetails(Map<String, Object> details) {
        String remoteUser = request != null ? request.getRemoteUser() : null;
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

    void enrichTraceDetails(Map<String, Object> details) {
        String traceId = AbstractResource.resolveTraceIdValue(request);
        if (traceId != null && !traceId.isBlank()) {
            details.put("traceId", traceId);
        }
        String requestId = request != null ? request.getHeader("X-Request-Id") : null;
        if (requestId != null && !requestId.isBlank()) {
            details.put("requestId", requestId.trim());
        }
    }

    String resolveRequestId() {
        if (request == null) {
            return UUID.randomUUID().toString();
        }
        String header = request.getHeader("X-Request-Id");
        if (header != null && !header.isBlank()) {
            return header.trim();
        }
        return UUID.randomUUID().toString();
    }

    Map<String, Object> detailsOf(Object... kv) {
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

    private ServerRuntimeConfiguration.PatientImagesSettings patientImagesSettings() {
        if (configurationResolver == null) {
            return new ServerConfigurationResolver().patientImages();
        }
        return configurationResolver.patientImages();
    }

    private boolean isAdminActor() {
        return userServiceBean != null && request != null && userServiceBean.isAdmin(request.getRemoteUser());
    }

    private int resolveMaxDimension(Integer configured, int defaultValue) {
        return configured != null && configured > 0 ? configured : defaultValue;
    }

    private java.nio.file.Path reencodeImage(BufferedImage source, String contentType) {
        Objects.requireNonNull(source, "source");
        String format = "image/jpeg".equals(contentType) ? "jpeg" : "png";
        BufferedImage normalized = source;
        ColorModel colorModel = source.getColorModel();
        if ("jpeg".equals(format) && colorModel != null && colorModel.hasAlpha()) {
            BufferedImage rgb = new BufferedImage(source.getWidth(), source.getHeight(), BufferedImage.TYPE_INT_RGB);
            Graphics2D g = rgb.createGraphics();
            try {
                g.setColor(java.awt.Color.WHITE);
                g.fillRect(0, 0, source.getWidth(), source.getHeight());
                g.drawImage(source, 0, 0, null);
            } finally {
                g.dispose();
            }
            normalized = rgb;
        }
        java.nio.file.Path normalizedPath = createTempFile("patient-image-normalized-", extensionFor(contentType));
        try (OutputStream out = Files.newOutputStream(normalizedPath)) {
            boolean encoded = ImageIO.write(normalized, format, out);
            out.flush();
            if (!encoded) {
                deleteTempFile(normalizedPath);
                throw AbstractResource.restError(request, Response.Status.BAD_REQUEST,
                        "invalid_image", "Failed to normalize image payload", null, null);
            }
            return normalizedPath;
        } catch (WebApplicationException ex) {
            throw ex;
        } catch (Exception ex) {
            deleteTempFile(normalizedPath);
            throw AbstractResource.restError(request, Response.Status.BAD_REQUEST,
                    "invalid_image", "Failed to normalize image payload", null, ex);
        }
    }

    private String detectContentTypeByMagic(java.nio.file.Path file) {
        if (file == null) {
            return null;
        }
        byte[] bytes = new byte[8];
        int read;
        try (InputStream in = Files.newInputStream(file)) {
            read = in.read(bytes);
        } catch (Exception ex) {
            throw AbstractResource.restError(request, Response.Status.BAD_REQUEST,
                    "invalid_image", "Failed to read image payload", null, ex);
        }
        if (read < 8) {
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

    private java.nio.file.Path readPartToTempFile(InputPart part, long maxBytes) throws Exception {
        if (part == null) {
            return null;
        }
        long limit = maxBytes > 0 ? maxBytes : DEFAULT_MAX_BYTES;
        java.nio.file.Path file = createTempFile("patient-image-upload-", ".bin");
        try (InputStream in = part.getBody(InputStream.class, null)) {
            if (in == null) {
                return null;
            }
            try (OutputStream out = Files.newOutputStream(file)) {
                byte[] buf = new byte[8192];
                long total = 0;
                int n;
                while ((n = in.read(buf)) >= 0) {
                    if (n == 0) {
                        continue;
                    }
                    total += n;
                    if (total > limit) {
                        deleteTempFile(file);
                        throw AbstractResource.restError(null, Response.Status.REQUEST_ENTITY_TOO_LARGE,
                                "payload_too_large", "Payload too large",
                                Map.of("maxBytes", limit, "size", total,
                                        "config", ServerConfigurationResolver.KEY_PATIENT_IMAGES_MAX_BYTES), null);
                    }
                    out.write(buf, 0, n);
                }
            }
            return file;
        } catch (WebApplicationException ex) {
            throw ex;
        } catch (Exception ex) {
            deleteTempFile(file);
            throw ex;
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
        name = name.replace("\"", "_")
                .replace("\r", "")
                .replace("\n", "");
        byte[] bytes = name.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > 180) {
            name = fallbackBase;
        }
        return name;
    }

    static record UploadedFile(String fileName, String contentType, java.nio.file.Path path, long contentLength) {
    }

    private record NormalizedImage(String contentType, java.nio.file.Path path, long contentLength) {
    }
}
