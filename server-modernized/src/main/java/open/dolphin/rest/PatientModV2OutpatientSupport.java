package open.dolphin.rest;

import jakarta.ws.rs.core.Response;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.SimpleAddressModel;
import open.dolphin.rest.dto.orca.OfficialPatientAuditMeta;
import open.dolphin.rest.dto.orca.OfficialPatientCreateRequest;
import open.dolphin.rest.dto.orca.OfficialPatientPayload;
import open.dolphin.rest.dto.orca.OfficialPatientUpdateRequest;
import open.dolphin.rest.dto.outpatient.PatientOutpatientResponse;

final class PatientModV2OutpatientSupport {

    static final Set<String> EDITABLE_KEYS = Set.of("name", "kana", "birthDate", "sex", "phone", "zip", "address");

    private PatientModV2OutpatientSupport() {
    }

    static PatientPatch toCreatePatch(OfficialPatientCreateRequest request) {
        return toPatientPatch(request != null ? request.getPatient() : null, true,
                request != null ? request.getAuditMeta() : null);
    }

    static PatientPatch toUpdatePatch(OfficialPatientUpdateRequest request) {
        return toPatientPatch(request != null ? request.getPatient() : null, false,
                request != null ? request.getAuditMeta() : null);
    }

    private static PatientPatch toPatientPatch(OfficialPatientPayload payload,
            boolean allowAutoAssignPatientId,
            OfficialPatientAuditMeta auditMeta) {
        PatientPatch patch = new PatientPatch();
        patch.patientId = allowAutoAssignPatientId
                ? normalizeCreatePatientId(payload != null ? payload.getPatientId() : null)
                : requireNumericId(payload != null ? payload.getPatientId() : null, "patientId");
        patch.name = payload != null ? payload.getWholeName() : null;
        patch.kana = payload != null ? payload.getWholeNameKana() : null;
        patch.birthDate = payload != null ? payload.getBirthDate() : null;
        patch.sex = payload != null ? payload.getSex() : null;
        patch.phone = payload != null ? payload.getTelephone() : null;
        patch.zip = payload != null ? payload.getZipCode() : null;
        patch.address = payload != null ? payload.getAddressLine() : null;
        patch.changedKeys = extractChangedKeys(auditMeta);
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

    static PatientOutpatientResponse.PatientRecord toPatientRecord(PatientModel model) {
        PatientOutpatientResponse.PatientRecord record = new PatientOutpatientResponse.PatientRecord();
        record.setPatientId(model.getPatientId());
        record.setName(model.getFullName());
        record.setKana(model.getKanaName());
        record.setBirthDate(ModelUtils.formatDate(model.getBirthday()));
        record.setSex(model.getGender());
        record.setPhone(firstNonBlank(model.getTelephone(), model.getMobilePhone()));
        SimpleAddressModel address = model.getAddress();
        if (address != null) {
            record.setZip(address.getZipCode());
            record.setAddress(address.getAddress());
        } else {
            record.setZip(null);
            record.setAddress(null);
        }
        record.setInsurance(null);
        record.setMemo(model.getMemo());
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
        if (!"*".equals(patientId) && !patientId.matches("\\d+")) {
            throw new IllegalArgumentException("patientId must be numeric or *");
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
        String patientId;
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
        Boolean idempotent;
        String idempotentReason;
    }

    static void applyAuditMeta(Map<String, Object> details, OfficialPatientAuditMeta auditMeta) {
        if (details == null || auditMeta == null) {
            return;
        }
        if (auditMeta.getSource() != null && !auditMeta.getSource().isBlank()) {
            details.put("source", auditMeta.getSource().trim());
        }
        if (auditMeta.getSection() != null && !auditMeta.getSection().isBlank()) {
            details.put("section", auditMeta.getSection().trim());
        }
        if (!auditMeta.getChangedKeys().isEmpty()) {
            details.put("changedKeys", new LinkedHashSet<>(auditMeta.getChangedKeys()));
        }
        if (auditMeta.getReceptionId() != null && !auditMeta.getReceptionId().isBlank()) {
            details.put("receptionId", auditMeta.getReceptionId().trim());
        }
        if (auditMeta.getAppointmentId() != null && !auditMeta.getAppointmentId().isBlank()) {
            details.put("appointmentId", auditMeta.getAppointmentId().trim());
        }
        if (auditMeta.getVisitDate() != null && !auditMeta.getVisitDate().isBlank()) {
            details.put("visitDate", auditMeta.getVisitDate().trim());
        }
        if (auditMeta.getActorRole() != null && !auditMeta.getActorRole().isBlank()) {
            details.put("actorRole", auditMeta.getActorRole().trim());
        }
    }

    private static Set<String> extractChangedKeys(OfficialPatientAuditMeta auditMeta) {
        if (auditMeta == null || auditMeta.getChangedKeys().isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<String> keys = new LinkedHashSet<>();
        for (String entry : auditMeta.getChangedKeys()) {
            if (entry == null) {
                continue;
            }
            String normalized = entry.trim();
            if (!normalized.isEmpty()) {
                keys.add(normalized);
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

    private static String normalizeCreatePatientId(String value) {
        String trimmed = safeTrimKeepEmpty(value);
        if (trimmed == null || trimmed.isBlank()) {
            return "*";
        }
        if ("*".equals(trimmed)) {
            return "*";
        }
        if (!trimmed.matches("\\d+")) {
            throw AbstractResource.restError(null, Response.Status.BAD_REQUEST, "invalid_request",
                    "patientId must be numeric or *");
        }
        return trimmed;
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
