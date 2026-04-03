package open.dolphin.orca.read;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.rest.dto.orca.OrcaOrderInputSetDetailResponse;
import open.dolphin.rest.dto.orca.OrcaOrderInputSetListResponse;
import open.orca.rest.ORCAConnection;

public class OrcaOrderInputSetReadService {

    private static final String MATERIAL_CODE_PREFIX = "7";
    private static final String COMMENT_CODE_REGEX = "^(008[1-6]|8[1-6]|098|099|98|99).*";

    private final ORCAConnection orcaConnection;

    public OrcaOrderInputSetReadService(ORCAConnection orcaConnection) {
        this.orcaConnection = orcaConnection;
    }

    public List<OrcaOrderInputSetListResponse.Item> loadInputSetSummaries(
            String keyword,
            String effective,
            String claimClassSystem,
            ClassMetadataResolver classMetadataResolver) throws SQLException {
        Map<String, InputSetAggregate> aggregates = new LinkedHashMap<>();
        String normalizedKeyword = keyword != null ? keyword.trim().toLowerCase(Locale.ROOT) : null;
        try (Connection connection = orcaConnection.getConnection();
             PreparedStatement ps = connection.prepareStatement(
                "SELECT inputcd, dspname FROM tbl_inputcd WHERE inputcd LIKE 'P%' OR inputcd LIKE 'S%' ORDER BY inputcd");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                String setCode = trimToNull(rs.getString(1));
                String name = trimToNull(rs.getString(2));
                if (setCode == null || name == null || !matchesKeyword(normalizedKeyword, setCode, name)) {
                    continue;
                }
                InputSetAggregate aggregate = aggregates.computeIfAbsent(setCode, key -> new InputSetAggregate(setCode, name));
                aggregate.name = name;
            }
        }
        try (Connection connection = orcaConnection.getConnection()) {
            for (InputSetAggregate aggregate : aggregates.values()) {
                fillInputSetAggregate(connection, aggregate, effective, claimClassSystem, classMetadataResolver);
            }
        }
        return aggregates.values().stream()
                .filter(InputSetAggregate::hasValidItems)
                .map(InputSetAggregate::toItem)
                .collect(Collectors.toList());
    }

    public OrcaOrderInputSetDetailResponse.Bundle loadInputSetDetail(
            String setCode,
            String effective,
            String requestedName,
            String bodyPartCodePrefix,
            String claimClassSystem,
            ClassMetadataResolver classMetadataResolver) throws SQLException {
        try (Connection connection = orcaConnection.getConnection()) {
            String bundleName = trimToNull(requestedName);
            if (bundleName == null) {
                bundleName = loadInputSetName(connection, setCode);
            }
            if (bundleName == null) {
                return null;
            }
            OrcaOrderInputSetDetailResponse.Bundle bundle = new OrcaOrderInputSetDetailResponse.Bundle();
            bundle.setSourceSetCode(setCode);
            bundle.setBundleName(bundleName);
            bundle.setBundleNumber("1");
            bundle.setClassCodeSystem(claimClassSystem);
            bundle.setStarted(toIsoDate(effective));
            bundle.setItems(new ArrayList<>());

            try (PreparedStatement ps = connection.prepareStatement(
                    "SELECT inputcd, suryo1, kaisu, yukostymd, yukoedymd FROM tbl_inputset WHERE setcd=? AND yukostymd<=? AND yukoedymd>=? ORDER BY setseq")) {
                ps.setString(1, setCode);
                ps.setString(2, effective);
                ps.setString(3, effective);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        String inputCode = trimToNull(rs.getString(1));
                        if (inputCode == null) {
                            continue;
                        }
                        String bundleNumber = trimToNull(rs.getString(3));
                        if (bundleNumber != null && !bundleNumber.isBlank() && !"0".equals(bundleNumber)) {
                            bundle.setBundleNumber(bundleNumber);
                        }
                        if (inputCode.startsWith(".")) {
                            applyBundleClass(bundle, normalizeClassCode(inputCode), claimClassSystem, classMetadataResolver);
                            continue;
                        }
                        OrcaOrderInputSetDetailResponse.Item item = loadInputSetItem(connection, inputCode);
                        if (item == null) {
                            continue;
                        }
                        item.setCode(inputCode);
                        item.setQuantity(trimNumeric(rs.getString(2)));
                        if (inputCode.startsWith(bodyPartCodePrefix) && bundle.getBodyPart() == null) {
                            bundle.setBodyPart(toBodyPart(item));
                            continue;
                        }
                        bundle.getItems().add(item);
                    }
                }
            }
            if (bundle.getClassCode() == null) {
                applyBundleClass(bundle, setCode.startsWith("P") ? "212" : "900", claimClassSystem, classMetadataResolver);
            }
            if (bundle.getBodyPart() != null) {
                bundle.getBodyPart().setRowRole("bodyPart");
            }
            for (OrcaOrderInputSetDetailResponse.Item item : bundle.getItems()) {
                if (item == null) {
                    continue;
                }
                item.setRowRole(resolveRowRole(bundle.getEntity(), item.getCode()));
            }
            if (bundle.getItems().isEmpty() && bundle.getBodyPart() == null) {
                return null;
            }
            return bundle;
        }
    }

    public static String normalizeClassCode(String inputCode) {
        if (inputCode == null || inputCode.isBlank()) {
            return null;
        }
        String normalized = inputCode.startsWith(".") ? inputCode.substring(1) : inputCode;
        if (normalized.length() > 3) {
            return normalized.substring(0, 3);
        }
        return normalized;
    }

    public static OrcaOrderInputSetDetailResponse.BodyPart toBodyPart(OrcaOrderInputSetDetailResponse.Item item) {
        OrcaOrderInputSetDetailResponse.BodyPart bodyPart = new OrcaOrderInputSetDetailResponse.BodyPart();
        bodyPart.setCode(item.getCode());
        bodyPart.setName(item.getName());
        bodyPart.setQuantity(item.getQuantity());
        bodyPart.setUnit(item.getUnit());
        bodyPart.setMemo(item.getMemo());
        return bodyPart;
    }

    private static boolean matchesKeyword(String normalizedKeyword, String setCode, String name) {
        if (normalizedKeyword == null || normalizedKeyword.isBlank()) {
            return true;
        }
        return (setCode + " " + name).toLowerCase(Locale.ROOT).contains(normalizedKeyword);
    }

    private static void fillInputSetAggregate(
            Connection connection,
            InputSetAggregate aggregate,
            String effective,
            String claimClassSystem,
            ClassMetadataResolver classMetadataResolver) throws SQLException {
        try (PreparedStatement ps = connection.prepareStatement(
                "SELECT SUM(CASE WHEN inputcd NOT LIKE '.%' THEN 1 ELSE 0 END), MIN(yukostymd), MAX(yukoedymd) "
                        + "FROM tbl_inputset WHERE setcd=? AND yukostymd<=? AND yukoedymd>=?")) {
            ps.setString(1, aggregate.setCode);
            ps.setString(2, effective);
            ps.setString(3, effective);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    aggregate.itemCount = rs.getInt(1);
                    aggregate.validFrom = trimToNull(rs.getString(2));
                    aggregate.validTo = trimToNull(rs.getString(3));
                }
            }
        }
        aggregate.kind = aggregate.setCode.startsWith("P") ? "P" : "S";
        if ("P".equals(aggregate.kind)) {
            aggregate.entity = IInfoModel.ENTITY_MED_ORDER;
            aggregate.classCode = "212";
            aggregate.classCodeSystem = claimClassSystem;
            return;
        }
        try (PreparedStatement ps = connection.prepareStatement(
                "SELECT inputcd FROM tbl_inputset "
                        + "WHERE setcd=? AND yukostymd<=? AND yukoedymd>=? AND inputcd LIKE '.%' "
                        + "ORDER BY setseq")) {
            ps.setString(1, aggregate.setCode);
            ps.setString(2, effective);
            ps.setString(3, effective);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String classCode = normalizeClassCode(trimToNull(rs.getString(1)));
                    if (!hasText(classCode)) {
                        continue;
                    }
                    ClassMetadata resolved = classMetadataResolver.resolve(classCode);
                    aggregate.entity = resolved.entity();
                    aggregate.classCode = classCode;
                    aggregate.classCodeSystem = claimClassSystem;
                    return;
                }
            }
        }
    }

    private static String loadInputSetName(Connection connection, String setCode) throws SQLException {
        try (PreparedStatement ps = connection.prepareStatement(
                "SELECT dspname FROM tbl_inputcd WHERE inputcd=? ORDER BY dspseq")) {
            ps.setString(1, setCode);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String name = trimToNull(rs.getString(1));
                    if (name != null) {
                        return name;
                    }
                }
            }
        }
        return null;
    }

    private static OrcaOrderInputSetDetailResponse.Item loadInputSetItem(Connection connection, String inputCode) throws SQLException {
        try (PreparedStatement ps = connection.prepareStatement(
                "SELECT name, taniname FROM tbl_tensu WHERE srycd=? ORDER BY yukoedymd DESC")) {
            ps.setString(1, inputCode);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                OrcaOrderInputSetDetailResponse.Item item = new OrcaOrderInputSetDetailResponse.Item();
                item.setName(trimToNull(rs.getString(1)));
                item.setUnit(trimToNull(rs.getString(2)));
                item.setMemo("");
                return item;
            }
        }
    }

    private static void applyBundleClass(
            OrcaOrderInputSetDetailResponse.Bundle bundle,
            String classCode,
            String claimClassSystem,
            ClassMetadataResolver classMetadataResolver) {
        if (!hasText(classCode)) {
            return;
        }
        ClassMetadata resolved = classMetadataResolver.resolve(classCode);
        bundle.setClassCode(classCode);
        bundle.setClassCodeSystem(claimClassSystem);
        bundle.setEntity(resolved.entity());
        bundle.setClassName(resolved.className());
    }

    private static String resolveRowRole(String entity, String code) {
        String normalizedCode = trimToNull(code);
        if (normalizedCode == null) {
            return "main";
        }
        if (shouldTreatAsMaterialItem(entity, normalizedCode)) {
            return "material";
        }
        if (normalizedCode.matches(COMMENT_CODE_REGEX)) {
            return "comment";
        }
        return "main";
    }

    private static boolean shouldTreatAsMaterialItem(String entity, String code) {
        if (code == null || !code.startsWith(MATERIAL_CODE_PREFIX)) {
            return false;
        }
        return !IInfoModel.ENTITY_RADIOLOGY_ORDER.equals(entity);
    }

    @FunctionalInterface
    public interface ClassMetadataResolver {
        ClassMetadata resolve(String classCode);
    }

    public record ClassMetadata(String entity, String className) {
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String trimNumeric(String value) {
        String trimmed = trimToNull(value);
        if (trimmed == null) {
            return null;
        }
        if (trimmed.endsWith(".0")) {
            return trimmed.substring(0, trimmed.length() - 2);
        }
        return trimmed;
    }

    private static String toIsoDate(String yyyymmdd) {
        if (yyyymmdd == null || yyyymmdd.length() != 8) {
            return java.time.LocalDate.now().toString();
        }
        return yyyymmdd.substring(0, 4) + "-" + yyyymmdd.substring(4, 6) + "-" + yyyymmdd.substring(6, 8);
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static final class InputSetAggregate {
        private final String setCode;
        private String name;
        private String entity;
        private String kind;
        private String classCode;
        private String classCodeSystem;
        private Integer itemCount;
        private String validFrom;
        private String validTo;

        private InputSetAggregate(String setCode, String name) {
            this.setCode = setCode;
            this.name = name;
        }

        private boolean hasValidItems() {
            return itemCount != null && itemCount.intValue() > 0 && name != null && !name.isBlank();
        }

        private OrcaOrderInputSetListResponse.Item toItem() {
            OrcaOrderInputSetListResponse.Item item = new OrcaOrderInputSetListResponse.Item();
            item.setSetCode(setCode);
            item.setName(name);
            item.setEntity(entity);
            item.setKind(kind);
            item.setClassCode(classCode);
            item.setClassCodeSystem(classCodeSystem);
            item.setItemCount(itemCount);
            item.setValidFrom(validFrom);
            item.setValidTo(validTo);
            return item;
        }
    }
}
