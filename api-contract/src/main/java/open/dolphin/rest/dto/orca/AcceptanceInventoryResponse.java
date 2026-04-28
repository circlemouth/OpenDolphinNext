package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.ArrayList;
import java.util.List;

/**
 * Sanitized response for read-only acceptlstv2 target inventory.
 */
public class AcceptanceInventoryResponse extends OrcaApiResponse {

    private String endpoint;
    private String orcaEndpoint;
    private String requestClass;
    private String method;
    private String serializer;
    private String parser;
    private String sanitizer;
    private String classCode;
    private String acceptanceDate;
    private int sourceRowCount;
    private int sanitizedRowCount;
    private int targetReadyRowCount;
    private boolean targetReady;
    private boolean rawSensitiveFieldsExcluded = true;
    private boolean clientProvidedIdentifiersTrusted;
    private boolean serverDerivedAuthorityRequired = true;
    private final List<AcceptanceInventoryRow> rows = new ArrayList<>();

    public String getEndpoint() {
        return endpoint;
    }

    public void setEndpoint(String endpoint) {
        this.endpoint = endpoint;
    }

    public String getOrcaEndpoint() {
        return orcaEndpoint;
    }

    public void setOrcaEndpoint(String orcaEndpoint) {
        this.orcaEndpoint = orcaEndpoint;
    }

    public String getRequestClass() {
        return requestClass;
    }

    public void setRequestClass(String requestClass) {
        this.requestClass = requestClass;
    }

    public String getMethod() {
        return method;
    }

    public void setMethod(String method) {
        this.method = method;
    }

    public String getSerializer() {
        return serializer;
    }

    public void setSerializer(String serializer) {
        this.serializer = serializer;
    }

    public String getParser() {
        return parser;
    }

    public void setParser(String parser) {
        this.parser = parser;
    }

    public String getSanitizer() {
        return sanitizer;
    }

    public void setSanitizer(String sanitizer) {
        this.sanitizer = sanitizer;
    }

    public String getClassCode() {
        return classCode;
    }

    public void setClassCode(String classCode) {
        this.classCode = classCode;
    }

    public String getAcceptanceDate() {
        return acceptanceDate;
    }

    public void setAcceptanceDate(String acceptanceDate) {
        this.acceptanceDate = acceptanceDate;
    }

    public int getSourceRowCount() {
        return sourceRowCount;
    }

    public void setSourceRowCount(int sourceRowCount) {
        this.sourceRowCount = sourceRowCount;
    }

    public int getSanitizedRowCount() {
        return sanitizedRowCount;
    }

    public void setSanitizedRowCount(int sanitizedRowCount) {
        this.sanitizedRowCount = sanitizedRowCount;
    }

    public int getTargetReadyRowCount() {
        return targetReadyRowCount;
    }

    public void setTargetReadyRowCount(int targetReadyRowCount) {
        this.targetReadyRowCount = targetReadyRowCount;
    }

    public boolean isTargetReady() {
        return targetReady;
    }

    public void setTargetReady(boolean targetReady) {
        this.targetReady = targetReady;
    }

    public boolean isRawSensitiveFieldsExcluded() {
        return rawSensitiveFieldsExcluded;
    }

    public void setRawSensitiveFieldsExcluded(boolean rawSensitiveFieldsExcluded) {
        this.rawSensitiveFieldsExcluded = rawSensitiveFieldsExcluded;
    }

    public boolean isClientProvidedIdentifiersTrusted() {
        return clientProvidedIdentifiersTrusted;
    }

    public void setClientProvidedIdentifiersTrusted(boolean clientProvidedIdentifiersTrusted) {
        this.clientProvidedIdentifiersTrusted = clientProvidedIdentifiersTrusted;
    }

    public boolean isServerDerivedAuthorityRequired() {
        return serverDerivedAuthorityRequired;
    }

    public void setServerDerivedAuthorityRequired(boolean serverDerivedAuthorityRequired) {
        this.serverDerivedAuthorityRequired = serverDerivedAuthorityRequired;
    }

    public List<AcceptanceInventoryRow> getRows() {
        return rows;
    }

    public static class AcceptanceInventoryRow {
        private String rowHash;
        private boolean hasAcceptanceId;
        private boolean hasPatientId;
        private boolean hasAcceptanceDate;
        private boolean hasAcceptanceTime;
        private boolean hasDepartmentCode;
        private boolean hasPhysicianCode;
        private boolean hasMedicalInformation;
        private boolean hasInsuranceCombinationNumber;
        private boolean rawSensitiveFieldsExcluded = true;
        private String serverAcceptanceId;
        private String serverPatientId;
        private String serverAcceptanceDate;
        private String serverAcceptanceTime;
        private String serverDepartmentCode;
        private String serverPhysicianCode;
        private String serverMedicalInformation;

        public String getRowHash() {
            return rowHash;
        }

        public void setRowHash(String rowHash) {
            this.rowHash = rowHash;
        }

        public boolean isHasAcceptanceId() {
            return hasAcceptanceId;
        }

        public void setHasAcceptanceId(boolean hasAcceptanceId) {
            this.hasAcceptanceId = hasAcceptanceId;
        }

        public boolean isHasPatientId() {
            return hasPatientId;
        }

        public void setHasPatientId(boolean hasPatientId) {
            this.hasPatientId = hasPatientId;
        }

        public boolean isHasAcceptanceDate() {
            return hasAcceptanceDate;
        }

        public void setHasAcceptanceDate(boolean hasAcceptanceDate) {
            this.hasAcceptanceDate = hasAcceptanceDate;
        }

        public boolean isHasAcceptanceTime() {
            return hasAcceptanceTime;
        }

        public void setHasAcceptanceTime(boolean hasAcceptanceTime) {
            this.hasAcceptanceTime = hasAcceptanceTime;
        }

        public boolean isHasDepartmentCode() {
            return hasDepartmentCode;
        }

        public void setHasDepartmentCode(boolean hasDepartmentCode) {
            this.hasDepartmentCode = hasDepartmentCode;
        }

        public boolean isHasPhysicianCode() {
            return hasPhysicianCode;
        }

        public void setHasPhysicianCode(boolean hasPhysicianCode) {
            this.hasPhysicianCode = hasPhysicianCode;
        }

        public boolean isHasMedicalInformation() {
            return hasMedicalInformation;
        }

        public void setHasMedicalInformation(boolean hasMedicalInformation) {
            this.hasMedicalInformation = hasMedicalInformation;
        }

        public boolean isHasInsuranceCombinationNumber() {
            return hasInsuranceCombinationNumber;
        }

        public void setHasInsuranceCombinationNumber(boolean hasInsuranceCombinationNumber) {
            this.hasInsuranceCombinationNumber = hasInsuranceCombinationNumber;
        }

        public boolean isRawSensitiveFieldsExcluded() {
            return rawSensitiveFieldsExcluded;
        }

        public void setRawSensitiveFieldsExcluded(boolean rawSensitiveFieldsExcluded) {
            this.rawSensitiveFieldsExcluded = rawSensitiveFieldsExcluded;
        }

        @JsonIgnore
        public String getServerAcceptanceId() {
            return serverAcceptanceId;
        }

        public void setServerAcceptanceId(String serverAcceptanceId) {
            this.serverAcceptanceId = serverAcceptanceId;
        }

        @JsonIgnore
        public String getServerPatientId() {
            return serverPatientId;
        }

        public void setServerPatientId(String serverPatientId) {
            this.serverPatientId = serverPatientId;
        }

        @JsonIgnore
        public String getServerAcceptanceDate() {
            return serverAcceptanceDate;
        }

        public void setServerAcceptanceDate(String serverAcceptanceDate) {
            this.serverAcceptanceDate = serverAcceptanceDate;
        }

        @JsonIgnore
        public String getServerAcceptanceTime() {
            return serverAcceptanceTime;
        }

        public void setServerAcceptanceTime(String serverAcceptanceTime) {
            this.serverAcceptanceTime = serverAcceptanceTime;
        }

        @JsonIgnore
        public String getServerDepartmentCode() {
            return serverDepartmentCode;
        }

        public void setServerDepartmentCode(String serverDepartmentCode) {
            this.serverDepartmentCode = serverDepartmentCode;
        }

        @JsonIgnore
        public String getServerPhysicianCode() {
            return serverPhysicianCode;
        }

        public void setServerPhysicianCode(String serverPhysicianCode) {
            this.serverPhysicianCode = serverPhysicianCode;
        }

        @JsonIgnore
        public String getServerMedicalInformation() {
            return serverMedicalInformation;
        }

        public void setServerMedicalInformation(String serverMedicalInformation) {
            this.serverMedicalInformation = serverMedicalInformation;
        }
    }
}
