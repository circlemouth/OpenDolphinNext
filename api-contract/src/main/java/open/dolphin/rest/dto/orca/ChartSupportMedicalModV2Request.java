package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.ArrayList;
import java.util.List;

public class ChartSupportMedicalModV2Request {

    private String classCode;
    private String requestNumber;
    private String medicalPush;
    private String medicalUid;
    private boolean includeInitialConsultation;
    private OrcaEncounterContext encounterContext;
    private List<MedicalInformation> medicalInformation = new ArrayList<>();

    public OrcaEncounterContext getEncounterContext() {
        return encounterContext;
    }

    public void setEncounterContext(OrcaEncounterContext encounterContext) {
        this.encounterContext = encounterContext;
    }

    public String getPatientId() {
        return encounterContext != null ? encounterContext.getPatientId() : null;
    }

    @JsonIgnore
    public void setPatientId(String patientId) {
        ensureEncounterContext().setPatientId(patientId);
    }

    public String getPerformDate() {
        return encounterContext != null ? encounterContext.getVisitDate() : null;
    }

    @JsonIgnore
    public void setPerformDate(String performDate) {
        ensureEncounterContext().setVisitDate(performDate);
    }

    public String getClassCode() {
        return classCode;
    }

    public void setClassCode(String classCode) {
        this.classCode = classCode;
    }

    public String getDepartmentCode() {
        return encounterContext != null ? encounterContext.getDepartmentCode() : null;
    }

    @JsonIgnore
    public void setDepartmentCode(String departmentCode) {
        ensureEncounterContext().setDepartmentCode(departmentCode);
    }

    public String getPhysicianCode() {
        return encounterContext != null ? encounterContext.getPhysicianCode() : null;
    }

    @JsonIgnore
    public void setPhysicianCode(String physicianCode) {
        ensureEncounterContext().setPhysicianCode(physicianCode);
    }

    public String getInsuranceCombinationNumber() {
        return encounterContext != null ? encounterContext.getInsuranceCombinationNumber() : null;
    }

    @JsonIgnore
    public void setInsuranceCombinationNumber(String insuranceCombinationNumber) {
        ensureEncounterContext().setInsuranceCombinationNumber(insuranceCombinationNumber);
    }

    public String getVoucherNumber() {
        return encounterContext != null ? encounterContext.getVoucherNumber() : null;
    }

    @JsonIgnore
    public void setVoucherNumber(String voucherNumber) {
        ensureEncounterContext().setVoucherNumber(voucherNumber);
    }

    public String getSequentialNumber() {
        return encounterContext != null ? encounterContext.getSequentialNumber() : null;
    }

    @JsonIgnore
    public void setSequentialNumber(String sequentialNumber) {
        ensureEncounterContext().setSequentialNumber(sequentialNumber);
    }

    public String getRequestNumber() {
        return requestNumber;
    }

    public void setRequestNumber(String requestNumber) {
        this.requestNumber = requestNumber;
    }

    public String getMedicalPush() {
        return medicalPush;
    }

    public void setMedicalPush(String medicalPush) {
        this.medicalPush = medicalPush;
    }

    public String getMedicalUid() {
        return medicalUid;
    }

    public void setMedicalUid(String medicalUid) {
        this.medicalUid = medicalUid;
    }

    public boolean isIncludeInitialConsultation() {
        return includeInitialConsultation;
    }

    public void setIncludeInitialConsultation(boolean includeInitialConsultation) {
        this.includeInitialConsultation = includeInitialConsultation;
    }

    public List<MedicalInformation> getMedicalInformation() {
        return medicalInformation;
    }

    public void setMedicalInformation(List<MedicalInformation> medicalInformation) {
        this.medicalInformation = medicalInformation;
    }

    public static class MedicalInformation {
        /** Local-only carrier. physiologyOrder is not first-class in ORCA payload/XML. */
        private String entity;
        private String medicalClass;
        private String medicalClassName;
        private String medicalClassNumber;
        private List<Medication> medications = new ArrayList<>();

        public String getEntity() {
            return entity;
        }

        public void setEntity(String entity) {
            this.entity = entity;
        }

        public String getMedicalClass() {
            return medicalClass;
        }

        public void setMedicalClass(String medicalClass) {
            this.medicalClass = medicalClass;
        }

        public String getMedicalClassName() {
            return medicalClassName;
        }

        public void setMedicalClassName(String medicalClassName) {
            this.medicalClassName = medicalClassName;
        }

        public String getMedicalClassNumber() {
            return medicalClassNumber;
        }

        public void setMedicalClassNumber(String medicalClassNumber) {
            this.medicalClassNumber = medicalClassNumber;
        }

        public List<Medication> getMedications() {
            return medications;
        }

        public void setMedications(List<Medication> medications) {
            this.medications = medications;
        }

        public boolean isPhysiologyOrder() {
            return "physiologyOrder".equals(entity != null ? entity.trim() : null);
        }
    }

    public static class Medication {
        private String code;
        private String name;
        private String number;
        private String genericFlg;

        public String getCode() {
            return code;
        }

        public void setCode(String code) {
            this.code = code;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getNumber() {
            return number;
        }

        public void setNumber(String number) {
            this.number = number;
        }

        public String getGenericFlg() {
            return genericFlg;
        }

        public void setGenericFlg(String genericFlg) {
            this.genericFlg = genericFlg;
        }
    }

    public boolean hasPhysiologyOrder() {
        if (medicalInformation == null || medicalInformation.isEmpty()) {
            return false;
        }
        for (MedicalInformation information : medicalInformation) {
            if (information != null && information.isPhysiologyOrder()) {
                return true;
            }
        }
        return false;
    }

    public void validateForOrcaSend() {
        if (hasPhysiologyOrder()) {
            throw new IllegalArgumentException("physiologyOrder is not supported for ORCA medical-mod-v2");
        }
    }

    private OrcaEncounterContext ensureEncounterContext() {
        if (encounterContext == null) {
            encounterContext = new OrcaEncounterContext();
        }
        return encounterContext;
    }
}
