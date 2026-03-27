package open.dolphin.orca.push.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class OrcaPushReceptionBody implements OrcaPushBody {

    private String Patient_Mode;
    private String Patient_ID;
    private String Accept_Date;
    private String Accept_Time;
    private String Accept_Id;
    private String Department_Code;
    private String Physician_Code;
    private String Insurance_Combination_Number;

    public OrcaPushReceptionBody() {
    }

    public OrcaPushReceptionBody(OrcaPushReceptionBody source) {
        if (source == null) {
            return;
        }
        this.Patient_Mode = source.Patient_Mode;
        this.Patient_ID = source.Patient_ID;
        this.Accept_Date = source.Accept_Date;
        this.Accept_Time = source.Accept_Time;
        this.Accept_Id = source.Accept_Id;
        this.Department_Code = source.Department_Code;
        this.Physician_Code = source.Physician_Code;
        this.Insurance_Combination_Number = source.Insurance_Combination_Number;
    }

    public static OrcaPushReceptionBody copyOf(OrcaPushReceptionBody source) {
        return source == null ? null : new OrcaPushReceptionBody(source);
    }

    public String getPatient_Mode() {
        return Patient_Mode;
    }

    public void setPatient_Mode(String patient_Mode) {
        Patient_Mode = patient_Mode;
    }

    public String getPatient_ID() {
        return Patient_ID;
    }

    public void setPatient_ID(String patient_ID) {
        Patient_ID = patient_ID;
    }

    public String getAccept_Date() {
        return Accept_Date;
    }

    public void setAccept_Date(String accept_Date) {
        Accept_Date = accept_Date;
    }

    public String getAccept_Time() {
        return Accept_Time;
    }

    public void setAccept_Time(String accept_Time) {
        Accept_Time = accept_Time;
    }

    public String getAccept_Id() {
        return Accept_Id;
    }

    public void setAccept_Id(String accept_Id) {
        Accept_Id = accept_Id;
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

    public String getInsurance_Combination_Number() {
        return Insurance_Combination_Number;
    }

    public void setInsurance_Combination_Number(String insurance_Combination_Number) {
        Insurance_Combination_Number = insurance_Combination_Number;
    }
}
