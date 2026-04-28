package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.ArrayList;
import java.util.List;

/**
 * Sanitized, artifact-free identifier proof for Charts handoff / ORCA order send.
 */
public class MedicalIdentifierPreflightResponse extends OrcaApiResponse {

    private String endpoint;
    private String acceptanceEndpoint;
    private String medicalGetEndpoint;
    private String requestClass;
    private String parser;
    private String sanitizer;
    private String acceptanceClassCode;
    private String medicalGetClassCode;
    private String acceptanceDate;
    private String selectedAcceptanceRowHash;
    private boolean selectedAcceptanceTargetReady;
    private int acceptanceSourceRowCount;
    private int acceptanceTargetReadyRowCount;
    private int medicalSourceRowCount;
    private int medicalSanitizedRowCount;
    private boolean artifactFree = true;
    private boolean rawSensitiveFieldsExcluded = true;
    private boolean clientProvidedIdentifiersTrusted;
    private boolean serverDerivedAuthorityRequired = true;
    private boolean identifierPreflightReady;
    private final List<MedicalIdentifierRow> medicalRows = new ArrayList<>();

    public String getEndpoint() {
        return endpoint;
    }

    public void setEndpoint(String endpoint) {
        this.endpoint = endpoint;
    }

    public String getAcceptanceEndpoint() {
        return acceptanceEndpoint;
    }

    public void setAcceptanceEndpoint(String acceptanceEndpoint) {
        this.acceptanceEndpoint = acceptanceEndpoint;
    }

    public String getMedicalGetEndpoint() {
        return medicalGetEndpoint;
    }

    public void setMedicalGetEndpoint(String medicalGetEndpoint) {
        this.medicalGetEndpoint = medicalGetEndpoint;
    }

    public String getRequestClass() {
        return requestClass;
    }

    public void setRequestClass(String requestClass) {
        this.requestClass = requestClass;
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

    public String getAcceptanceClassCode() {
        return acceptanceClassCode;
    }

    public void setAcceptanceClassCode(String acceptanceClassCode) {
        this.acceptanceClassCode = acceptanceClassCode;
    }

    public String getMedicalGetClassCode() {
        return medicalGetClassCode;
    }

    public void setMedicalGetClassCode(String medicalGetClassCode) {
        this.medicalGetClassCode = medicalGetClassCode;
    }

    public String getAcceptanceDate() {
        return acceptanceDate;
    }

    public void setAcceptanceDate(String acceptanceDate) {
        this.acceptanceDate = acceptanceDate;
    }

    public String getSelectedAcceptanceRowHash() {
        return selectedAcceptanceRowHash;
    }

    public void setSelectedAcceptanceRowHash(String selectedAcceptanceRowHash) {
        this.selectedAcceptanceRowHash = selectedAcceptanceRowHash;
    }

    public boolean isSelectedAcceptanceTargetReady() {
        return selectedAcceptanceTargetReady;
    }

    public void setSelectedAcceptanceTargetReady(boolean selectedAcceptanceTargetReady) {
        this.selectedAcceptanceTargetReady = selectedAcceptanceTargetReady;
    }

    public int getAcceptanceSourceRowCount() {
        return acceptanceSourceRowCount;
    }

    public void setAcceptanceSourceRowCount(int acceptanceSourceRowCount) {
        this.acceptanceSourceRowCount = acceptanceSourceRowCount;
    }

    public int getAcceptanceTargetReadyRowCount() {
        return acceptanceTargetReadyRowCount;
    }

    public void setAcceptanceTargetReadyRowCount(int acceptanceTargetReadyRowCount) {
        this.acceptanceTargetReadyRowCount = acceptanceTargetReadyRowCount;
    }

    public int getMedicalSourceRowCount() {
        return medicalSourceRowCount;
    }

    public void setMedicalSourceRowCount(int medicalSourceRowCount) {
        this.medicalSourceRowCount = medicalSourceRowCount;
    }

    public int getMedicalSanitizedRowCount() {
        return medicalSanitizedRowCount;
    }

    public void setMedicalSanitizedRowCount(int medicalSanitizedRowCount) {
        this.medicalSanitizedRowCount = medicalSanitizedRowCount;
    }

    public boolean isArtifactFree() {
        return artifactFree;
    }

    public void setArtifactFree(boolean artifactFree) {
        this.artifactFree = artifactFree;
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

    public boolean isIdentifierPreflightReady() {
        return identifierPreflightReady;
    }

    public void setIdentifierPreflightReady(boolean identifierPreflightReady) {
        this.identifierPreflightReady = identifierPreflightReady;
    }

    public List<MedicalIdentifierRow> getMedicalRows() {
        return medicalRows;
    }

    public static class MedicalIdentifierRow {
        private String rowHash;
        private boolean hasPerformDate;
        private boolean hasDepartmentCode;
        private boolean hasSequentialNumber;
        private boolean hasInsuranceCombinationNumber;
        private boolean hasInvoiceNumber;
        private boolean rawSensitiveFieldsExcluded = true;
        private String serverPerformDate;
        private String serverDepartmentCode;
        private String serverSequentialNumber;
        private String serverInsuranceCombinationNumber;

        public String getRowHash() {
            return rowHash;
        }

        public void setRowHash(String rowHash) {
            this.rowHash = rowHash;
        }

        public boolean isHasPerformDate() {
            return hasPerformDate;
        }

        public void setHasPerformDate(boolean hasPerformDate) {
            this.hasPerformDate = hasPerformDate;
        }

        public boolean isHasDepartmentCode() {
            return hasDepartmentCode;
        }

        public void setHasDepartmentCode(boolean hasDepartmentCode) {
            this.hasDepartmentCode = hasDepartmentCode;
        }

        public boolean isHasSequentialNumber() {
            return hasSequentialNumber;
        }

        public void setHasSequentialNumber(boolean hasSequentialNumber) {
            this.hasSequentialNumber = hasSequentialNumber;
        }

        public boolean isHasInsuranceCombinationNumber() {
            return hasInsuranceCombinationNumber;
        }

        public void setHasInsuranceCombinationNumber(boolean hasInsuranceCombinationNumber) {
            this.hasInsuranceCombinationNumber = hasInsuranceCombinationNumber;
        }

        public boolean isHasInvoiceNumber() {
            return hasInvoiceNumber;
        }

        public void setHasInvoiceNumber(boolean hasInvoiceNumber) {
            this.hasInvoiceNumber = hasInvoiceNumber;
        }

        public boolean isRawSensitiveFieldsExcluded() {
            return rawSensitiveFieldsExcluded;
        }

        public void setRawSensitiveFieldsExcluded(boolean rawSensitiveFieldsExcluded) {
            this.rawSensitiveFieldsExcluded = rawSensitiveFieldsExcluded;
        }

        @JsonIgnore
        public String getServerPerformDate() {
            return serverPerformDate;
        }

        public void setServerPerformDate(String serverPerformDate) {
            this.serverPerformDate = serverPerformDate;
        }

        @JsonIgnore
        public String getServerDepartmentCode() {
            return serverDepartmentCode;
        }

        public void setServerDepartmentCode(String serverDepartmentCode) {
            this.serverDepartmentCode = serverDepartmentCode;
        }

        @JsonIgnore
        public String getServerSequentialNumber() {
            return serverSequentialNumber;
        }

        public void setServerSequentialNumber(String serverSequentialNumber) {
            this.serverSequentialNumber = serverSequentialNumber;
        }

        @JsonIgnore
        public String getServerInsuranceCombinationNumber() {
            return serverInsuranceCombinationNumber;
        }

        public void setServerInsuranceCombinationNumber(String serverInsuranceCombinationNumber) {
            this.serverInsuranceCombinationNumber = serverInsuranceCombinationNumber;
        }
    }
}
