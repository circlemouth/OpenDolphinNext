package open.dolphin.orca.model;

import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * Sanitized ORCA API result summary shared by ORCA adapters.
 */
public final class OrcaApiResult {

    public enum OperationStatus {
        ORCA_ACCEPTED,
        ORCA_REJECTED,
        ORCA_WARNING,
        ORCA_UNMATCHED,
        ORCA_CONFLICT,
        NETWORK_FAILED,
        CERTIFICATE_FAILED,
        AUTH_FAILED,
        UNKNOWN,
        NEEDS_REVIEW
    }

    private final String apiResult;
    private final String message;
    private final List<String> warnings;
    private final List<String> errors;
    private final List<String> unmatched;
    private final List<String> orcaOnly;
    private final List<String> renumberedIdentifiers;
    private final OperationStatus operationStatus;
    private final boolean needsUserReview;
    private final String performDate;
    private final String departmentCode;
    private final String physicianCode;
    private final String insuranceCombinationNumber;
    private final String rawHash;
    private final String normalizedResponse;
    private final String normalizedResponseHash;

    private OrcaApiResult(Builder builder) {
        this.apiResult = blankToNull(builder.apiResult);
        this.message = blankToNull(builder.message);
        this.warnings = copy(builder.warnings);
        this.errors = copy(builder.errors);
        this.unmatched = copy(builder.unmatched);
        this.orcaOnly = copy(builder.orcaOnly);
        this.renumberedIdentifiers = copy(builder.renumberedIdentifiers);
        this.operationStatus = builder.operationStatus;
        this.needsUserReview = builder.needsUserReview;
        this.performDate = blankToNull(builder.performDate);
        this.departmentCode = blankToNull(builder.departmentCode);
        this.physicianCode = blankToNull(builder.physicianCode);
        this.insuranceCombinationNumber = blankToNull(builder.insuranceCombinationNumber);
        this.rawHash = blankToNull(builder.rawHash);
        this.normalizedResponse = blankToNull(builder.normalizedResponse);
        this.normalizedResponseHash = blankToNull(builder.normalizedResponseHash);
    }

    public static OrcaApiResult of(String apiResult, String message, List<String> warnings) {
        return builder()
                .apiResult(apiResult)
                .message(message)
                .warnings(warnings)
                .build();
    }

    public static Builder builder() {
        return new Builder();
    }

    public String apiResult() {
        return apiResult;
    }

    public String message() {
        return message;
    }

    public List<String> warnings() {
        return List.copyOf(warnings);
    }

    public List<String> errors() {
        return List.copyOf(errors);
    }

    public List<String> unmatched() {
        return List.copyOf(unmatched);
    }

    public List<String> orcaOnly() {
        return List.copyOf(orcaOnly);
    }

    public List<String> renumberedIdentifiers() {
        return List.copyOf(renumberedIdentifiers);
    }

    public OperationStatus operationStatus() {
        return operationStatus;
    }

    public boolean needsUserReview() {
        return needsUserReview;
    }

    public String performDate() {
        return performDate;
    }

    public String departmentCode() {
        return departmentCode;
    }

    public String physicianCode() {
        return physicianCode;
    }

    public String insuranceCombinationNumber() {
        return insuranceCombinationNumber;
    }

    public String rawHash() {
        return rawHash;
    }

    public String normalizedResponse() {
        return normalizedResponse;
    }

    public String normalizedResponseHash() {
        return normalizedResponseHash;
    }

    public static OperationStatus classifyMutation(
            boolean transportOk,
            String apiResult,
            boolean hasWarnings,
            boolean hasUnmatched,
            boolean completionEvidencePresent) {
        if (!transportOk) {
            return classifyTransportFailure(null, null);
        }
        if (hasUnmatched) {
            return OperationStatus.ORCA_UNMATCHED;
        }
        if (hasWarnings) {
            return OperationStatus.ORCA_WARNING;
        }
        if (isZeroLike(apiResult) && completionEvidencePresent) {
            return OperationStatus.ORCA_ACCEPTED;
        }
        if (isZeroLike(apiResult)) {
            return OperationStatus.UNKNOWN;
        }
        if (isAuthLike(apiResult, null)) {
            return OperationStatus.AUTH_FAILED;
        }
        if (isConflictLike(apiResult, null)) {
            return OperationStatus.ORCA_CONFLICT;
        }
        return apiResult == null ? OperationStatus.UNKNOWN : OperationStatus.ORCA_REJECTED;
    }

    public static OperationStatus classifyTransportFailure(Integer httpStatus, String message) {
        if (httpStatus != null && (httpStatus == 401 || httpStatus == 403)) {
            return OperationStatus.AUTH_FAILED;
        }
        String normalized = normalize(message);
        if (normalized.contains("certificate") || normalized.contains("certpath")
                || normalized.contains("ssl") || normalized.contains("tls")
                || normalized.contains("証明書")) {
            return OperationStatus.CERTIFICATE_FAILED;
        }
        if (isAuthLike(null, normalized)) {
            return OperationStatus.AUTH_FAILED;
        }
        return OperationStatus.NETWORK_FAILED;
    }

    public static boolean needsUserReview(OperationStatus status) {
        return status != OperationStatus.ORCA_ACCEPTED;
    }

    public static boolean isZeroLike(String apiResult) {
        return apiResult != null && apiResult.matches("0+");
    }

    private static boolean isAuthLike(String apiResult, String message) {
        String result = normalize(apiResult);
        String normalized = normalize(message);
        return "401".equals(result) || "403".equals(result)
                || normalized.contains("auth")
                || normalized.contains("unauthorized")
                || normalized.contains("forbidden")
                || normalized.contains("認証");
    }

    private static boolean isConflictLike(String apiResult, String message) {
        String result = normalize(apiResult);
        String normalized = normalize(message);
        return "409".equals(result)
                || normalized.contains("排他")
                || normalized.contains("他端末")
                || normalized.contains("使用中")
                || normalized.contains("conflict")
                || normalized.contains("locked");
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static List<String> copy(List<String> value) {
        return value == null || value.isEmpty()
                ? List.of()
                : List.copyOf(value.stream().filter(Objects::nonNull).map(String::trim).filter(v -> !v.isEmpty()).toList());
    }

    public static final class Builder {
        private String apiResult;
        private String message;
        private List<String> warnings = List.of();
        private List<String> errors = List.of();
        private List<String> unmatched = List.of();
        private List<String> orcaOnly = List.of();
        private List<String> renumberedIdentifiers = List.of();
        private OperationStatus operationStatus;
        private boolean needsUserReview;
        private String performDate;
        private String departmentCode;
        private String physicianCode;
        private String insuranceCombinationNumber;
        private String rawHash;
        private String normalizedResponse;
        private String normalizedResponseHash;

        public Builder apiResult(String apiResult) {
            this.apiResult = apiResult;
            return this;
        }

        public Builder message(String message) {
            this.message = message;
            return this;
        }

        public Builder warnings(List<String> warnings) {
            this.warnings = copy(warnings);
            return this;
        }

        public Builder errors(List<String> errors) {
            this.errors = copy(errors);
            return this;
        }

        public Builder unmatched(List<String> unmatched) {
            this.unmatched = copy(unmatched);
            return this;
        }

        public Builder orcaOnly(List<String> orcaOnly) {
            this.orcaOnly = copy(orcaOnly);
            return this;
        }

        public Builder renumberedIdentifiers(List<String> renumberedIdentifiers) {
            this.renumberedIdentifiers = copy(renumberedIdentifiers);
            return this;
        }

        public Builder operationStatus(OperationStatus operationStatus) {
            this.operationStatus = operationStatus;
            return this;
        }

        public Builder needsUserReview(boolean needsUserReview) {
            this.needsUserReview = needsUserReview;
            return this;
        }

        public Builder performDate(String performDate) {
            this.performDate = performDate;
            return this;
        }

        public Builder departmentCode(String departmentCode) {
            this.departmentCode = departmentCode;
            return this;
        }

        public Builder physicianCode(String physicianCode) {
            this.physicianCode = physicianCode;
            return this;
        }

        public Builder insuranceCombinationNumber(String insuranceCombinationNumber) {
            this.insuranceCombinationNumber = insuranceCombinationNumber;
            return this;
        }

        public Builder rawHash(String rawHash) {
            this.rawHash = rawHash;
            return this;
        }

        public Builder normalizedResponse(String normalizedResponse) {
            this.normalizedResponse = normalizedResponse;
            return this;
        }

        public Builder normalizedResponseHash(String normalizedResponseHash) {
            this.normalizedResponseHash = normalizedResponseHash;
            return this;
        }

        public OrcaApiResult build() {
            return new OrcaApiResult(this);
        }
    }
}
