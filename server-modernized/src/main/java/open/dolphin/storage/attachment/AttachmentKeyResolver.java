package open.dolphin.storage.attachment;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import open.dolphin.infomodel.AttachmentModel;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.UserModel;

/**
 * S3 オブジェクトキー生成ヘルパー。
 */
public class AttachmentKeyResolver {

    private static final String DEFAULT_BASE = "attachments";

    private final AttachmentStorageSettings.S3Settings settings;

    public AttachmentKeyResolver(AttachmentStorageSettings.S3Settings settings) {
        this.settings = settings;
    }

    public String resolve(AttachmentModel attachment) {
        Map<String, String> tokens = buildTokens(attachment);
        String resolvedBase = trimSlashes(substitute(settings.getBasePath(), tokens));
        List<String> segments = new ArrayList<>();
        if (!resolvedBase.isBlank()) {
            segments.add(resolvedBase);
        }
        if (tokens.containsKey("DOCUMENT_ID") && tokens.containsKey("ATTACHMENT_ID")) {
            segments.add("doc-" + tokens.get("DOCUMENT_ID"));
            segments.add(buildAttachmentSegment(attachment, tokens.get("ATTACHMENT_ID")));
        } else {
            segments.add("pending");
            segments.add(tokens.getOrDefault("FACILITY_ID", "unknown-facility"));
            segments.add(tokens.getOrDefault("PATIENT_ID", "unknown-patient"));
            segments.add(UUID.randomUUID().toString());
            segments.add(sanitizeFileName(Optional.ofNullable(attachment.getFileName()).orElse("attachment")));
        }
        return segments.stream()
                .filter(s -> s != null && !s.isBlank())
                .collect(Collectors.joining("/"));
    }

    private Map<String, String> buildTokens(AttachmentModel attachment) {
        Map<String, String> tokens = new HashMap<>();
        if (attachment.getId() > 0) {
            tokens.put("ATTACHMENT_ID", Long.toString(attachment.getId()));
        }

        DocumentModel document = attachment.getDocumentModel();
        if (document != null) {
            if (document.getId() > 0) {
                tokens.put("DOCUMENT_ID", Long.toString(document.getId()));
            }
            KarteBean karte = document.getKarte();
            if (karte != null) {
                tokens.put("KARTE_ID", safeId(karte.getId(), "unknown-karte"));
                PatientModel patient = karte.getPatientModel();
                if (patient != null) {
                    tokens.put("PATIENT_ID", optionalString(patient.getPatientId(), "unknown-patient"));
                    tokens.put("FACILITY_ID", optionalString(patient.getFacilityId(), "unknown-facility"));
                }
            }
        }

        UserModel user = attachment.getUserModel();
        if (user != null) {
            tokens.putIfAbsent("FACILITY_ID", optionalString(userFacilityId(user), "unknown-facility"));
            tokens.put("USER_ID", optionalString(user.getUserId(), "unknown-user"));
        }

        // fallback keys if patient info was missing
        tokens.putIfAbsent("FACILITY_ID", "unknown-facility");
        tokens.putIfAbsent("PATIENT_ID", "unknown-patient");
        tokens.putIfAbsent("KARTE_ID", "unknown-karte");

        return tokens;
    }

    private String buildAttachmentSegment(AttachmentModel attachment, String attachmentId) {
        String sanitized = sanitizeFileName(Optional.ofNullable(attachment.getFileName()).orElse("attachment"));
        return String.format(Locale.ROOT, "att-%s-%s", attachmentId != null ? attachmentId : "unknown", sanitized);
    }

    private String sanitizeFileName(String candidate) {
        String normalized = Normalizer.normalize(candidate, Normalizer.Form.NFKC);
        String withoutPath = normalized.replace('\\', '_').replace('/', '_');
        String compact = withoutPath.replaceAll("[^A-Za-z0-9._-]", "_");
        if (compact.isBlank()) {
            return "attachment";
        }
        return compact.length() > 120 ? compact.substring(0, 120) : compact;
    }

    private String substitute(String pattern, Map<String, String> tokens) {
        if (pattern == null || pattern.isBlank()) {
            return DEFAULT_BASE;
        }
        String result = pattern;
        for (Map.Entry<String, String> entry : tokens.entrySet()) {
            String key = "${" + entry.getKey() + "}";
            result = result.replace(key, entry.getValue());
        }
        return result;
    }

    private String trimSlashes(String value) {
        if (value == null) {
            return "";
        }
        return value.replaceAll("^/+", "").replaceAll("/+", "/");
    }

    private String safeId(long id, String fallback) {
        return id > 0 ? Long.toString(id) : fallback;
    }

    private String optionalString(String value, String fallback) {
        return (value == null || value.isBlank()) ? fallback : value;
    }

    private String userFacilityId(UserModel user) {
        if (user.getFacilityModel() != null) {
            return user.getFacilityModel().getFacilityId();
        }
        return null;
    }
}
