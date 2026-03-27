package open.dolphin.orca.push.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class OrcaPushMedicalInformation {

    private String Insurance_Combination_Number;
    private String Department_Code;
    private String Physician_Code;
    private String Invoice_Number;

    public OrcaPushMedicalInformation() {
    }

    public OrcaPushMedicalInformation(OrcaPushMedicalInformation source) {
        if (source == null) {
            return;
        }
        this.Insurance_Combination_Number = source.Insurance_Combination_Number;
        this.Department_Code = source.Department_Code;
        this.Physician_Code = source.Physician_Code;
        this.Invoice_Number = source.Invoice_Number;
    }

    public static OrcaPushMedicalInformation copyOf(OrcaPushMedicalInformation source) {
        return source == null ? null : new OrcaPushMedicalInformation(source);
    }

    public String getInsurance_Combination_Number() {
        return Insurance_Combination_Number;
    }

    public void setInsurance_Combination_Number(String insurance_Combination_Number) {
        Insurance_Combination_Number = insurance_Combination_Number;
    }

    public String getDepartment_Code() {
        return Department_Code;
    }

    public void setDepartment_Code(String department_Code) {
        Department_Code = department_Code;
    }

    public String getPhysician_Code() {
        return Physician_Code;
    }

    public void setPhysician_Code(String physician_Code) {
        Physician_Code = physician_Code;
    }

    public String getInvoice_Number() {
        return Invoice_Number;
    }

    public void setInvoice_Number(String invoice_Number) {
        Invoice_Number = invoice_Number;
    }
}
