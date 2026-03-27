package open.dolphin.rest;

import jakarta.ws.rs.core.Response;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.SimpleAddressModel;

final class PatientModV2OutpatientSupport {

    static final Set<String> EDITABLE_KEYS = Set.of("name", "kana", "birthDate", "sex", "phone", "zip", "address");

    private PatientModV2OutpatientSupport() {
    }

    static PatientPatch toPatientPatch(Map<String, Object> payload) {
        PatientPatch patch = new PatientPatch();
        patch.patientId = requireNumericId(getText(payload, "patientId", "Patient_ID"), "patientId");
        patch.name = getText(payload, "name", "wholeName", "Patient_Name");
        patch.kana = getText(payload, "kana", "wholeNameKana", "Patient_Kana");
        patch.birthDate = getText(payload, "birthDate", "Patient_BirthDate");
        patch.sex = getText(payload, "sex", "Patient_Sex");
        patch.phone = getText(payload, "phone", "telephone", "tel", "PhoneNumber");
        patch.zip = getText(payload, "zip", "zipCode", "postal");
        patch.address = getText(payload, "address", "addressLine");
        patch.changedKeys = extractChangedKeys(payload);
        return patch;
    }

    static Set<String> resolveChangeSet(PatientPatch patch, OrcaPatientBaseline baseline) {
        Set<String> clientKeys = patch.changedKeys != null ? patch.changedKeys : Set.of();
        if (!clientKeys.isEmpty()) {
            LinkedHashSet<String> filtered = new LinkedHashSet<>();
            for (String key : clientKeys) {
                if (key == null) {
                    continue;
                }
                String normalized = key.trim();
                if (!normalized.isEmpty() && EDITABLE_KEYS.contains(normalized)) {
                    filtered.add(normalized);
                }
            }
            return filtered;
        }

        LinkedHashSet<String> resolved = new LinkedHashSet<>();
        String baselineSexLocal = toLocalSex(baseline.sex);
        maybeAddChanged(resolved, "name", patch.name, baseline.wholeName, false);
        maybeAddChanged(resolved, "kana", patch.kana, baseline.wholeNameKana, false);
        maybeAddChanged(resolved, "birthDate", patch.birthDate, baseline.birthDate, false);
        maybeAddChanged(resolved, "sex", patch.sex, baselineSexLocal, false);
        maybeAddChanged(resolved, "phone", patch.phone, baseline.phone1, false);
        maybeAddChanged(resolved, "zip", patch.zip, baseline.zipCode, false);
        maybeAddChanged(resolved, "address", patch.address, baseline.address, false);
        return resolved;
    }

    static OrcaDesired buildDesired(PatientPatch patch, OrcaPatientBaseline baseline, Set<String> changeSet) {
        OrcaDesired desired = new OrcaDesired();
        desired.wholeName = changeSet.contains("name") ? safeTrimKeepEmpty(patch.name) : baseline.wholeName;
        desired.wholeNameKana = changeSet.contains("kana") ? safeTrimKeepEmpty(patch.kana) : baseline.wholeNameKana;
        desired.birthDate = changeSet.contains("birthDate") ? safeTrimKeepEmpty(patch.birthDate) : baseline.birthDate;
        desired.sex = changeSet.contains("sex") ? requireOrcaSexCode(patch.sex, "sex") : baseline.sex;

        if (changeSet.contains("name") && (desired.wholeName == null || desired.wholeName.isBlank())) {
            throw AbstractResource.restError(null, Response.Status.BAD_REQUEST, "invalid_request", "name is required when changed");
        }
        if (changeSet.contains("kana") && (desired.wholeNameKana == null || desired.wholeNameKana.isBlank())) {
            throw AbstractResource.restError(null, Response.Status.BAD_REQUEST, "invalid_request", "kana is required when changed");
        }
        if (changeSet.contains("birthDate")) {
            if (desired.birthDate == null || desired.birthDate.isBlank()) {
                throw AbstractResource.restError(null, Response.Status.BAD_REQUEST, "invalid_request", "birthDate is required when changed");
            }
            try {
                LocalDate.parse(desired.birthDate);
            } catch (Exception ex) {
                throw AbstractResource.restError(null, Response.Status.BAD_REQUEST, "invalid_request", "birthDate must be yyyy-MM-dd");
            }
        }

        desired.phone1 = resolveOptionalValue(changeSet, "phone", patch.phone, baseline.phone1);
        desired.zipCode = normalizeZipForOrca(resolveOptionalValue(changeSet, "zip", patch.zip, baseline.zipCode));
        desired.address = resolveOptionalValue(changeSet, "address", patch.address, baseline.address);
        return desired;
    }

    static boolean matchesLocalPatient(PatientModel existing, PatientPatch patch) {
        if (existing == null || patch == null) {
            return false;
        }
        if (!equalsIfProvided(patch.name, existing.getFullName())) {
            return false;
        }
        if (!equalsIfProvided(patch.kana, existing.getKanaName())) {
            return false;
        }
        if (!equalsIfProvided(patch.birthDate, ModelUtils.formatDate(existing.getBirthday()))) {
            return false;
        }
        if (!equalsIfProvided(patch.sex, existing.getGender())) {
            return false;
        }

        String existingPhone = firstNonBlank(existing.getTelephone(), existing.getMobilePhone());
        if (!equalsIfProvided(patch.phone, existingPhone)) {
            return false;
        }

        SimpleAddressModel address = existing.getAddress();
        String existingZip = address != null ? address.getZipCode() : null;
        String existingAddress = address != null ? address.getAddress() : null;
        return equalsIfProvided(patch.zip, existingZip) && equalsIfProvided(patch.address, existingAddress);
    }

    static Map<String, Object> toPatientRecord(PatientModel model) {
        Map<String, Object> record = new LinkedHashMap<>();
        record.put("patientId", model.getPatientId());
        record.put("name", model.getFullName());
        record.put("kana", model.getKanaName());
        record.put("birthDate", ModelUtils.formatDate(model.getBirthday()));
        record.put("sex", model.getGender());
        record.put("phone", firstNonBlank(model.getTelephone(), model.getMobilePhone()));
        SimpleAddressModel address = model.getAddress();
        if (address != null) {
            record.put("zip", address.getZipCode());
            record.put("address", address.getAddress());
        } else {
            record.put("zip", null);
            record.put("address", null);
        }
        record.put("insurance", null);
        record.put("memo", model.getMemo());
        return record;
    }

    static String buildPatientModPayload(String modKey,
            String patientId,
            String wholeName,
            String wholeNameKana,
            String birthDate,
            String sex,
            String zipCode,
            String address,
            String phone1,
            String phone2) {
        if (patientId == null || patientId.isBlank()) {
            throw new IllegalArgumentException("patientId is required");
        }
        if (wholeName == null || wholeName.isBlank()) {
            throw new IllegalArgumentException("wholeName is required");
        }
        if (wholeNameKana == null || wholeNameKana.isBlank()) {
            throw new IllegalArgumentException("wholeNameKana is required");
        }
        if (birthDate == null || birthDate.isBlank()) {
            throw new IllegalArgumentException("birthDate is required");
        }
        if (sex == null || sex.isBlank()) {
            throw new IllegalArgumentException("sex is required");
        }

        String normalizedZip = zipCode != null ? normalizeZipForOrca(zipCode) : null;
        String zipTag = normalizedZip != null && !normalizedZip.isBlank() ? normalizedZip : (normalizedZip != null ? "" : null);
        String addressTag = address != null && !address.isBlank() ? address : (address != null ? "" : null);
        String phone1Tag = phone1 != null && !phone1.isBlank() ? phone1 : (phone1 != null ? "" : null);
        String phone2Tag = phone2 != null && !phone2.isBlank() ? phone2 : (phone2 != null ? "" : null);

        StringBuilder builder = new StringBuilder();
        builder.append("<data><patientmodreq>");
        appendTag(builder, "Mod_Key", modKey);
        appendTag(builder, "Patient_ID", patientId);
        appendTag(builder, "WholeName", wholeName);
        appendTag(builder, "WholeName_inKana", wholeNameKana);
        appendTag(builder, "BirthDate", birthDate);
        appendTag(builder, "Sex", sex);

        if (zipTag != null || addressTag != null || phone1Tag != null || phone2Tag != null) {
            builder.append("<Home_Address_Information>");
            appendTag(builder, "Address_ZipCode", zipTag);
            appendTag(builder, "WholeAddress1", addressTag);
            appendTag(builder, "PhoneNumber1", phone1Tag);
            appendTag(builder, "PhoneNumber2", phone2Tag);
            builder.append("</Home_Address_Information>");
        }

        builder.append("</patientmodreq></data>");
        return builder.toString();
    }

    static String extractTagValue(String payload, String tag) {
        if (payload == null || tag == null) {
            return null;
        }
        Pattern pattern = Pattern.compile("<" + tag + "\\b[^>]*>(.*?)</" + tag + ">", Pattern.DOTALL);
        Matcher matcher = pattern.matcher(payload);
        if (!matcher.find()) {
            return null;
        }
        String value = matcher.group(1);
        return value != null ? value.trim() : null;
    }

    static String getNonBlankText(Map<String, Object> payload, String key) {
        String value = getText(payload, key);
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    static String safeTrim(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    static String safeTrimKeepEmpty(String value) {
        return value == null ? null : value.trim();
    }

    static String normalizeOrcaSexCode(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if ("1".equals(trimmed) || "2".equals(trimmed)) {
            return trimmed;
        }
        String normalized = trimmed.toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "M", "MALE" -> "1";
            case "F", "FEMALE" -> "2";
            default -> null;
        };
    }

    static String normalizeZipForOrca(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return "";
        }
        String digits = trimmed.replaceAll("[^0-9]", "");
        return digits.length() == 7 ? digits : digits.isEmpty() ? trimmed : digits;
    }

    static final class PatientPatch {
        String patientId;
        String name;
        String kana;
        String birthDate;
        String sex;
        String phone;
        String zip;
        String address;
        Set<String> changedKeys = Set.of();

        Map<String, Object> toResponse() {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("patientId", patientId);
            response.put("name", name);
            response.put("kana", kana);
            response.put("birthDate", birthDate);
            response.put("sex", sex);
            response.put("phone", phone);
            response.put("zip", zip);
            response.put("address", address);
            return response;
        }
    }

    static final class OrcaPatientBaseline {
        String patientId;
        String wholeName;
        String wholeNameKana;
        String birthDate;
        String sex;
        String zipCode;
        String address;
        String phone1;
        String phone2;
    }

    static final class OrcaDesired {
        String wholeName;
        String wholeNameKana;
        String birthDate;
        String sex;
        String phone1;
        String zipCode;
        String address;
    }

    static final class OrcaApiResult {
        boolean success;
        int httpStatus;
        String apiResult;
        String apiResultMessage;
    }

    static final class OrcaUpdateExecution {
        final boolean success;
        final OrcaApiResult last;

        OrcaUpdateExecution(boolean success, OrcaApiResult last) {
            this.success = success;
            this.last = last;
        }
    }

    static final class OrcaMutationResult {
        String apiResult;
        String apiResultMessage;
        PatientModel patient;
    }

    private static Set<String> extractChangedKeys(Map<String, Object> payload) {
        if (payload == null) {
            return Set.of();
        }
        Object audit = payload.get("auditEvent");
        if (!(audit instanceof Map<?, ?> auditMap)) {
            return Set.of();
        }
        Object raw = auditMap.get("changedKeys");
        if (raw == null) {
            return Set.of();
        }
        LinkedHashSet<String> keys = new LinkedHashSet<>();
        if (raw instanceof String text) {
            for (String part : text.split(",")) {
                String normalized = part != null ? part.trim() : "";
                if (!normalized.isEmpty()) {
                    keys.add(normalized);
                }
            }
            return keys;
        }
        if (raw instanceof List<?> list) {
            for (Object entry : list) {
                if (entry instanceof String text) {
                    String normalized = text.trim();
                    if (!normalized.isEmpty()) {
                        keys.add(normalized);
                    }
                }
            }
        }
        return keys;
    }

    private static void maybeAddChanged(Set<String> target, String key, String current, String baseline, boolean allowBlank) {
        if (target == null || key == null) {
            return;
        }
        String next = safeTrimKeepEmpty(current);
        if (!allowBlank && (next == null || next.isBlank())) {
            return;
        }
        String prev = safeTrimKeepEmpty(baseline);
        if (next != null && !next.equals(prev != null ? prev : "")) {
            target.add(key);
        }
    }

    private static boolean equalsIfProvided(String provided, String baseline) {
        String next = safeTrim(provided);
        if (next == null) {
            return true;
        }
        String prev = safeTrimKeepEmpty(baseline);
        return next.equals(prev != null ? prev : "");
    }

    private static String requireNumericId(String value, String label) {
        String trimmed = safeTrim(value);
        if (trimmed == null || trimmed.isBlank()) {
            return null;
        }
        if (!trimmed.matches("\\d+")) {
            throw AbstractResource.restError(null, Response.Status.BAD_REQUEST, "invalid_request", label + " must be numeric");
        }
        return trimmed;
    }

    private static String getText(Map<String, Object> payload, String... keys) {
        if (payload == null || keys == null) {
            return null;
        }
        for (String key : keys) {
            Object value = payload.get(key);
            if (value instanceof String text) {
                return text;
            }
        }
        return null;
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private static String toLocalSex(String orcaSex) {
        String normalized = normalizeOrcaSexCode(orcaSex);
        if ("1".equals(normalized)) {
            return "M";
        }
        if ("2".equals(normalized)) {
            return "F";
        }
        return "";
    }

    private static String requireOrcaSexCode(String value, String label) {
        String normalized = normalizeOrcaSexCode(value);
        if (!"1".equals(normalized) && !"2".equals(normalized)) {
            throw AbstractResource.restError(null, Response.Status.BAD_REQUEST, "invalid_request",
                    label + " must be M/F (or ORCA 1/2)");
        }
        return normalized;
    }

    private static String resolveOptionalValue(Set<String> changeSet, String key, String current, String baseline) {
        if (changeSet != null && changeSet.contains(key)) {
            return safeTrimKeepEmpty(current);
        }
        return safeTrimKeepEmpty(baseline);
    }

    private static void appendTag(StringBuilder builder, String tag, String value) {
        if (builder == null || tag == null || value == null) {
            return;
        }
        builder.append('<').append(tag).append('>').append(escapeXml(value)).append("</").append(tag).append('>');
    }

    private static String escapeXml(String value) {
        if (value == null) {
            return "";
        }
        StringBuilder out = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char ch = value.charAt(i);
            switch (ch) {
                case '&' -> out.append("&amp;");
                case '<' -> out.append("&lt;");
                case '>' -> out.append("&gt;");
                case '"' -> out.append("&quot;");
                case '\'' -> out.append("&apos;");
                default -> out.append(ch);
            }
        }
        return out.toString();
    }
}
