package open.dolphin.rest.dto.orca;

import java.util.ArrayList;
import java.util.List;

public class ChartSupportMedicalModV2Request {

    private String patientId;
    private String performDate;
    private String classCode;
    private String departmentCode;
    private String physicianCode;
    private String requestNumber;
    private String medicalPush;
    private String medicalUid;
    private boolean includeInitialConsultation;
    private List<MedicalInformation> medicalInformation = new ArrayList<>();

    public String getPatientId() {
        return patientId;
    }

    public void setPatientId(String patientId) {
        this.patientId = patientId;
    }

    public String getPerformDate() {
        return performDate;
    }

    public void setPerformDate(String performDate) {
        this.performDate = performDate;
    }

    public String getClassCode() {
        return classCode;
    }

    public void setClassCode(String classCode) {
        this.classCode = classCode;
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
        private String medicalClass;
        private String medicalClassName;
        private String medicalClassNumber;
        private List<Medication> medications = new ArrayList<>();

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
}
