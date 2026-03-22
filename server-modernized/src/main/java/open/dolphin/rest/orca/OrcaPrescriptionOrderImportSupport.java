package open.dolphin.rest.orca;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import open.dolphin.rest.dto.orca.PrescriptionDoInputMeta;
import open.dolphin.rest.dto.orca.PrescriptionDoctorComment;
import open.dolphin.rest.dto.orca.PrescriptionDrug;
import open.dolphin.rest.dto.orca.PrescriptionOrder;
import open.dolphin.rest.dto.orca.PrescriptionRp;
import open.dolphin.rest.dto.orca.PrescriptionSetting;

final class OrcaPrescriptionOrderImportSupport {

    private OrcaPrescriptionOrderImportSupport() {
    }

    static PrescriptionOrder applyDoImport(
            PrescriptionOrder base,
            PrescriptionOrder doOrder,
            String patientId,
            String targetEncounterId,
            LocalDate targetEncounterDate,
            String remoteUser,
            String runId,
            Instant now,
            List<String> warnings,
            ObjectMapper mapper) {

        PrescriptionOrder merged = copyOrder(base, mapper);
        PrescriptionOrder incoming = copyOrder(doOrder, mapper);
        if (merged == null) {
            merged = new PrescriptionOrder();
        }
        if (incoming == null) {
            incoming = new PrescriptionOrder();
        }

        merged.setPatientId(patientId);
        merged.setEncounterId(resolveEncounterId(merged, incoming, targetEncounterId));
        applyEncounterDate(merged, incoming, targetEncounterDate);
        applyPerformDate(merged, incoming);
        if (incoming.getPatientRequested() != null) {
            merged.setPatientRequested(incoming.getPatientRequested());
        }

        List<PrescriptionRp> incomingRps = safeList(incoming.getRps());
        for (PrescriptionRp incomingRp : incomingRps) {
            stampImportedRp(incomingRp, incoming, runId, remoteUser, now);
        }
        merged.setRps(mergeRps(merged.getRps(), incomingRps));
        mergeSupplementalSections(merged, incoming);
        merged.setDoInputMeta(buildDoInputMeta(merged.getDoInputMeta(), incoming, patientId, remoteUser, runId, now));

        LocalDate effectiveDate = firstNonNull(
                parseFlexibleDate(merged.getEncounterDate()),
                targetEncounterDate,
                LocalDate.now());
        excludeExpiredImportedDrugs(merged, effectiveDate, warnings);
        return merged;
    }

    static boolean hasMissingUsageCode(PrescriptionOrder doOrder) {
        if (doOrder == null || doOrder.getRps() == null) {
            return false;
        }
        for (PrescriptionRp rp : doOrder.getRps()) {
            if (rp == null || rp.getDrugs() == null || rp.getDrugs().isEmpty()) {
                continue;
            }
            if (!hasText(rp.getUsageCode())) {
                return true;
            }
        }
        return false;
    }

    static LocalDate parseFlexibleDate(String value) {
        if (!hasText(value)) {
            return null;
        }
        try {
            return parseFlexibleDateStrict(value);
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    static String normalizeDateText(String value) {
        LocalDate parsed = parseFlexibleDate(value);
        return parsed != null ? parsed.toString() : null;
    }

    static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    static String trimToNull(String value) {
        if (!hasText(value)) {
            return null;
        }
        return value.trim();
    }

    static String trimToEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    private static String resolveEncounterId(PrescriptionOrder merged, PrescriptionOrder incoming, String targetEncounterId) {
        if (hasText(targetEncounterId)) {
            return targetEncounterId;
        }
        if (hasText(incoming.getEncounterId())) {
            return incoming.getEncounterId().trim();
        }
        return trimToNull(merged.getEncounterId());
    }

    private static void applyEncounterDate(PrescriptionOrder merged, PrescriptionOrder incoming, LocalDate targetEncounterDate) {
        LocalDate resolvedEncounterDate = targetEncounterDate;
        if (resolvedEncounterDate == null) {
            resolvedEncounterDate = parseFlexibleDate(incoming.getEncounterDate());
        }
        if (resolvedEncounterDate == null) {
            resolvedEncounterDate = parseFlexibleDate(merged.getEncounterDate());
        }
        if (resolvedEncounterDate != null) {
            merged.setEncounterDate(resolvedEncounterDate.toString());
        }
    }

    private static void applyPerformDate(PrescriptionOrder merged, PrescriptionOrder incoming) {
        LocalDate resolvedPerformDate = parseFlexibleDate(incoming.getPerformDate());
        if (resolvedPerformDate == null) {
            resolvedPerformDate = parseFlexibleDate(merged.getPerformDate());
        }
        if (resolvedPerformDate != null) {
            merged.setPerformDate(resolvedPerformDate.toString());
        }
    }

    private static void mergeSupplementalSections(PrescriptionOrder merged, PrescriptionOrder incoming) {
        if (!safeList(incoming.getClaimComments()).isEmpty()) {
            List<open.dolphin.rest.dto.orca.PrescriptionClaimComment> claimComments = safeList(merged.getClaimComments());
            claimComments.addAll(safeList(incoming.getClaimComments()));
            merged.setClaimComments(claimComments);
        }

        if (!safeList(incoming.getRemarks()).isEmpty()) {
            merged.setRemarks(safeList(incoming.getRemarks()));
        }

        merged.setPrescriptionSettings(mergeSettings(merged.getPrescriptionSettings(), incoming.getPrescriptionSettings()));

        List<PrescriptionDoctorComment> doctorComments = safeList(merged.getDoctorComments());
        doctorComments.addAll(safeList(incoming.getDoctorComments()));
        merged.setDoctorComments(doctorComments);
    }

    private static PrescriptionDoInputMeta buildDoInputMeta(
            PrescriptionDoInputMeta existing,
            PrescriptionOrder incoming,
            String patientId,
            String remoteUser,
            String runId,
            Instant now) {
        PrescriptionDoInputMeta doMeta = existing != null ? existing : new PrescriptionDoInputMeta();
        doMeta.setImportedFromDo(Boolean.TRUE);
        doMeta.setSourcePatientId(hasText(incoming.getPatientId()) ? incoming.getPatientId().trim() : patientId);
        doMeta.setSourceEncounterId(trimToNull(incoming.getEncounterId()));
        doMeta.setSourceEncounterDate(normalizeDateText(incoming.getEncounterDate()));
        if (incoming.getDoInputMeta() != null && hasText(incoming.getDoInputMeta().getSourceOrderId())) {
            doMeta.setSourceOrderId(incoming.getDoInputMeta().getSourceOrderId().trim());
        }
        doMeta.setImportedBy(remoteUser);
        doMeta.setImportedAt(now.toString());
        doMeta.setPolicyVersion("v1");
        doMeta.setRunId(runId);
        return doMeta;
    }

    private static void excludeExpiredImportedDrugs(PrescriptionOrder order, LocalDate asOf, List<String> warnings) {
        if (order == null || order.getRps() == null) {
            return;
        }
        for (PrescriptionRp rp : order.getRps()) {
            if (rp == null || rp.getDrugs() == null) {
                continue;
            }
            List<PrescriptionDrug> kept = new ArrayList<>();
            for (PrescriptionDrug drug : rp.getDrugs()) {
                if (drug == null) {
                    continue;
                }
                if (shouldKeepDrug(rp, drug, asOf, warnings)) {
                    kept.add(drug);
                }
            }
            rp.setDrugs(kept);
        }
    }

    private static boolean shouldKeepDrug(
            PrescriptionRp rp,
            PrescriptionDrug drug,
            LocalDate asOf,
            List<String> warnings) {
        PrescriptionDoInputMeta meta = drug.getDoInputMeta();
        boolean imported = meta != null && Boolean.TRUE.equals(meta.getImportedFromDo());
        if (!imported) {
            return true;
        }
        LocalDate validTo = parseFlexibleDate(drug.getValidTo());
        if (validTo == null || !validTo.isBefore(asOf)) {
            return true;
        }
        warnings.add("有効期限切れ薬剤を除外: rp="
                + trimToEmpty(rp.getRpNumber())
                + ", code=" + trimToEmpty(drug.getCode())
                + ", validTo=" + validTo);
        return false;
    }

    private static void stampImportedRp(
            PrescriptionRp rp,
            PrescriptionOrder sourceOrder,
            String runId,
            String remoteUser,
            Instant now) {
        if (rp == null || rp.getDrugs() == null) {
            return;
        }
        for (PrescriptionDrug drug : rp.getDrugs()) {
            if (drug == null) {
                continue;
            }
            PrescriptionDoInputMeta meta = drug.getDoInputMeta();
            if (meta == null) {
                meta = new PrescriptionDoInputMeta();
            }
            meta.setImportedFromDo(Boolean.TRUE);
            if (!hasText(meta.getSourcePatientId())) {
                meta.setSourcePatientId(trimToNull(sourceOrder.getPatientId()));
            }
            if (!hasText(meta.getSourceEncounterId())) {
                meta.setSourceEncounterId(trimToNull(sourceOrder.getEncounterId()));
            }
            if (!hasText(meta.getSourceEncounterDate())) {
                meta.setSourceEncounterDate(normalizeDateText(sourceOrder.getEncounterDate()));
            }
            meta.setImportedBy(remoteUser);
            meta.setImportedAt(now.toString());
            if (!hasText(meta.getPolicyVersion())) {
                meta.setPolicyVersion("v1");
            }
            meta.setRunId(runId);
            drug.setDoInputMeta(meta);
        }
    }

    private static List<PrescriptionRp> mergeRps(List<PrescriptionRp> baseRps, List<PrescriptionRp> incomingRps) {
        List<PrescriptionRp> merged = safeList(baseRps);
        if (incomingRps == null || incomingRps.isEmpty()) {
            return merged;
        }
        Map<String, Integer> byNumber = new LinkedHashMap<>();
        for (int i = 0; i < merged.size(); i++) {
            PrescriptionRp rp = merged.get(i);
            String key = rp != null ? trimToNull(rp.getRpNumber()) : null;
            if (key != null && !byNumber.containsKey(key)) {
                byNumber.put(key, i);
            }
        }
        for (PrescriptionRp incoming : incomingRps) {
            if (incoming == null) {
                continue;
            }
            String key = trimToNull(incoming.getRpNumber());
            Integer index = key != null ? byNumber.get(key) : null;
            if (index != null) {
                merged.set(index, incoming);
            } else {
                merged.add(incoming);
                if (key != null) {
                    byNumber.put(key, merged.size() - 1);
                }
            }
        }
        return merged;
    }

    private static List<PrescriptionSetting> mergeSettings(
            List<PrescriptionSetting> baseSettings,
            List<PrescriptionSetting> incomingSettings) {
        List<PrescriptionSetting> merged = safeList(baseSettings);
        if (incomingSettings == null || incomingSettings.isEmpty()) {
            return merged;
        }
        Map<String, Integer> byCode = new LinkedHashMap<>();
        for (int i = 0; i < merged.size(); i++) {
            PrescriptionSetting setting = merged.get(i);
            String key = setting != null ? trimToNull(setting.getCode()) : null;
            if (key != null && !byCode.containsKey(key)) {
                byCode.put(key, i);
            }
        }
        for (PrescriptionSetting incoming : incomingSettings) {
            if (incoming == null) {
                continue;
            }
            String key = trimToNull(incoming.getCode());
            Integer index = key != null ? byCode.get(key) : null;
            if (index != null) {
                merged.set(index, incoming);
            } else {
                merged.add(incoming);
                if (key != null) {
                    byCode.put(key, merged.size() - 1);
                }
            }
        }
        return merged;
    }

    private static LocalDate parseFlexibleDateStrict(String value) {
        if (!hasText(value)) {
            return null;
        }
        String normalized = value.trim();
        if (normalized.matches("\\d{8}")) {
            return LocalDate.parse(normalized, DateTimeFormatter.BASIC_ISO_DATE);
        }
        return LocalDate.parse(normalized);
    }

    private static PrescriptionOrder copyOrder(PrescriptionOrder source, ObjectMapper mapper) {
        if (source == null) {
            return null;
        }
        return mapper.convertValue(source, PrescriptionOrder.class);
    }

    private static <T> List<T> safeList(List<T> source) {
        if (source == null || source.isEmpty()) {
            return new ArrayList<>();
        }
        List<T> copied = new ArrayList<>(source.size());
        for (T item : source) {
            if (Objects.nonNull(item)) {
                copied.add(item);
            }
        }
        return copied;
    }

    private static LocalDate firstNonNull(LocalDate first, LocalDate second, LocalDate third) {
        return first != null ? first : (second != null ? second : third);
    }
}
