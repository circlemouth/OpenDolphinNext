package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.ArrayList;
import java.util.List;

/**
 * Request payload for POST /orca/visits/mutation (acceptmodv2).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class VisitMutationRequest {

    private String requestNumber;
    private String patientId;
    private String wholeName;
    private String acceptancePush;
    private String claimSendInfo;
    private String acceptanceDate;
    private String acceptanceTime;
    private String acceptanceId;
    private String departmentCode;
    private String physicianCode;
    private String medicalInformation;
    private final List<InsuranceInformation> insurances = new ArrayList<>();

    public String getRequestNumber() {
        return requestNumber;
    }

    public void setRequestNumber(String requestNumber) {
        this.requestNumber = requestNumber;
    }

    public String getPatientId() {
        return patientId;
    }

    public void setPatientId(String patientId) {
        this.patientId = patientId;
    }

    public String getWholeName() {
        return wholeName;
    }

    public void setWholeName(String wholeName) {
        this.wholeName = wholeName;
    }

    public String getAcceptancePush() {
        return acceptancePush;
    }

    public void setAcceptancePush(String acceptancePush) {
        this.acceptancePush = acceptancePush;
    }

    public String getClaimSendInfo() {
        return claimSendInfo;
    }

    public void setClaimSendInfo(String claimSendInfo) {
        this.claimSendInfo = claimSendInfo;
    }

    public String getAcceptanceDate() {
        return acceptanceDate;
    }

    public void setAcceptanceDate(String acceptanceDate) {
        this.acceptanceDate = acceptanceDate;
    }

    public String getAcceptanceTime() {
        return acceptanceTime;
    }

    public void setAcceptanceTime(String acceptanceTime) {
        this.acceptanceTime = acceptanceTime;
    }

    public String getAcceptanceId() {
        return acceptanceId;
    }

    public void setAcceptanceId(String acceptanceId) {
        this.acceptanceId = acceptanceId;
    }

    public String getDepartmentCode() {
        return departmentCode;
    }

    public void setDepartmentCode(String departmentCode) {
        this.departmentCode = departmentCode;
    }

    public String getPhysicianCode() {
        return physicianCode;
    }

    public void setPhysicianCode(String physicianCode) {
        this.physicianCode = physicianCode;
    }

    public String getMedicalInformation() {
        return medicalInformation;
    }

    public void setMedicalInformation(String medicalInformation) {
        this.medicalInformation = medicalInformation;
    }

    public List<InsuranceInformation> getInsurances() {
        return insurances;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class InsuranceInformation {
        private String insuranceCombinationNumber;
        private String insuranceProviderClass;
        private String insuranceProviderNumber;
        private String insuranceProviderWholeName;
        private String healthInsuredPersonSymbol;
        private String healthInsuredPersonNumber;
        private String healthInsuredPersonBranchNumber;
        private String healthInsuredPersonContinuation;
        private String relationToInsuredPerson;
        private String certificateStartDate;
        private String certificateExpiredDate;
        private final List<PublicInsuranceInformation> publicInsurances = new ArrayList<>();

        public String getInsuranceCombinationNumber() {
            return insuranceCombinationNumber;
        }

        public void setInsuranceCombinationNumber(String insuranceCombinationNumber) {
            this.insuranceCombinationNumber = insuranceCombinationNumber;
        }

        public String getInsuranceProviderClass() {
            return insuranceProviderClass;
        }

        public void setInsuranceProviderClass(String insuranceProviderClass) {
            this.insuranceProviderClass = insuranceProviderClass;
        }

        public String getInsuranceProviderNumber() {
            return insuranceProviderNumber;
        }

        public void setInsuranceProviderNumber(String insuranceProviderNumber) {
            this.insuranceProviderNumber = insuranceProviderNumber;
        }

        public String getInsuranceProviderWholeName() {
            return insuranceProviderWholeName;
        }

        public void setInsuranceProviderWholeName(String insuranceProviderWholeName) {
            this.insuranceProviderWholeName = insuranceProviderWholeName;
        }

        public String getHealthInsuredPersonSymbol() {
            return healthInsuredPersonSymbol;
        }

        public void setHealthInsuredPersonSymbol(String healthInsuredPersonSymbol) {
            this.healthInsuredPersonSymbol = healthInsuredPersonSymbol;
        }

        public String getHealthInsuredPersonNumber() {
            return healthInsuredPersonNumber;
        }

        public void setHealthInsuredPersonNumber(String healthInsuredPersonNumber) {
            this.healthInsuredPersonNumber = healthInsuredPersonNumber;
        }

        public String getHealthInsuredPersonBranchNumber() {
            return healthInsuredPersonBranchNumber;
        }

        public void setHealthInsuredPersonBranchNumber(String healthInsuredPersonBranchNumber) {
            this.healthInsuredPersonBranchNumber = healthInsuredPersonBranchNumber;
        }

        public String getHealthInsuredPersonContinuation() {
            return healthInsuredPersonContinuation;
        }

        public void setHealthInsuredPersonContinuation(String healthInsuredPersonContinuation) {
            this.healthInsuredPersonContinuation = healthInsuredPersonContinuation;
        }

        public String getRelationToInsuredPerson() {
            return relationToInsuredPerson;
        }

        public void setRelationToInsuredPerson(String relationToInsuredPerson) {
            this.relationToInsuredPerson = relationToInsuredPerson;
        }

        public String getCertificateStartDate() {
            return certificateStartDate;
        }

        public void setCertificateStartDate(String certificateStartDate) {
            this.certificateStartDate = certificateStartDate;
        }

        public String getCertificateExpiredDate() {
            return certificateExpiredDate;
        }

        public void setCertificateExpiredDate(String certificateExpiredDate) {
            this.certificateExpiredDate = certificateExpiredDate;
        }

        public List<PublicInsuranceInformation> getPublicInsurances() {
            return publicInsurances;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PublicInsuranceInformation {
        private String publicInsuranceClass;
        private String publicInsuranceName;
        private String publicInsuredPersonNumber;
        private String rateAdmission;
        private String rateOutpatient;

        public String getPublicInsuranceClass() {
            return publicInsuranceClass;
        }

        public void setPublicInsuranceClass(String publicInsuranceClass) {
            this.publicInsuranceClass = publicInsuranceClass;
        }

        public String getPublicInsuranceName() {
            return publicInsuranceName;
        }

        public void setPublicInsuranceName(String publicInsuranceName) {
            this.publicInsuranceName = publicInsuranceName;
        }

        public String getPublicInsuredPersonNumber() {
            return publicInsuredPersonNumber;
        }

        public void setPublicInsuredPersonNumber(String publicInsuredPersonNumber) {
            this.publicInsuredPersonNumber = publicInsuredPersonNumber;
        }

        public String getRateAdmission() {
            return rateAdmission;
        }

        public void setRateAdmission(String rateAdmission) {
            this.rateAdmission = rateAdmission;
        }

        public String getRateOutpatient() {
            return rateOutpatient;
        }

        public void setRateOutpatient(String rateOutpatient) {
            this.rateOutpatient = rateOutpatient;
        }
    }
}
