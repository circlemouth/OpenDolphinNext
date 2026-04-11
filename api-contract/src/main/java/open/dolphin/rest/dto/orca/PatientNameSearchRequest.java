package open.dolphin.rest.dto.orca;

/**
 * Request payload for POST /orca/patients/name-search.
 */
public class PatientNameSearchRequest {

    private String name;
    private String kana;
    private java.time.LocalDate birthStartDate;
    private java.time.LocalDate birthEndDate;
    private String sex;
    private String inOut;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getKana() {
        return kana;
    }

    public void setKana(String kana) {
        this.kana = kana;
    }

    public java.time.LocalDate getBirthStartDate() {
        return birthStartDate;
    }

    public void setBirthStartDate(java.time.LocalDate birthStartDate) {
        this.birthStartDate = birthStartDate;
    }

    public java.time.LocalDate getBirthEndDate() {
        return birthEndDate;
    }

    public void setBirthEndDate(java.time.LocalDate birthEndDate) {
        this.birthEndDate = birthEndDate;
    }

    public String getSex() {
        return sex;
    }

    public void setSex(String sex) {
        this.sex = sex;
    }

    public String getInOut() {
        return inOut;
    }

    public void setInOut(String inOut) {
        this.inOut = inOut;
    }
}
