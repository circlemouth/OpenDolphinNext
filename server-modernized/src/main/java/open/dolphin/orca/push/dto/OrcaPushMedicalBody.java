package open.dolphin.orca.push.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.ArrayList;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class OrcaPushMedicalBody implements OrcaPushBody {

    private String Patient_Mode;
    private String Patient_ID;
    private String Information_Date;
    private String Information_Time;
    private String Perform_Date;
    private List<OrcaPushMedicalInformation> Medical_Information = new ArrayList<>();

    public OrcaPushMedicalBody() {
    }

    public OrcaPushMedicalBody(OrcaPushMedicalBody source) {
        if (source == null) {
            return;
        }
        this.Patient_Mode = source.Patient_Mode;
        this.Patient_ID = source.Patient_ID;
        this.Information_Date = source.Information_Date;
        this.Information_Time = source.Information_Time;
        this.Perform_Date = source.Perform_Date;
        this.Medical_Information = copyMedicalInformationList(source.Medical_Information);
    }

    public static OrcaPushMedicalBody copyOf(OrcaPushMedicalBody source) {
        return source == null ? null : new OrcaPushMedicalBody(source);
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

    public String getInformation_Date() {
        return Information_Date;
    }

    public void setInformation_Date(String information_Date) {
        Information_Date = information_Date;
    }

    public String getInformation_Time() {
        return Information_Time;
    }

    public void setInformation_Time(String information_Time) {
        Information_Time = information_Time;
    }

    public String getPerform_Date() {
        return Perform_Date;
    }

    public void setPerform_Date(String perform_Date) {
        Perform_Date = perform_Date;
    }

    public List<OrcaPushMedicalInformation> getMedical_Information() {
        return copyMedicalInformationList(Medical_Information);
    }

    public void setMedical_Information(List<OrcaPushMedicalInformation> medical_Information) {
        Medical_Information = copyMedicalInformationList(medical_Information);
    }

    private static List<OrcaPushMedicalInformation> copyMedicalInformationList(List<OrcaPushMedicalInformation> source) {
        List<OrcaPushMedicalInformation> copy = new ArrayList<>();
        if (source == null) {
            return copy;
        }
        for (OrcaPushMedicalInformation item : source) {
            copy.add(OrcaPushMedicalInformation.copyOf(item));
        }
        return copy;
    }
}
