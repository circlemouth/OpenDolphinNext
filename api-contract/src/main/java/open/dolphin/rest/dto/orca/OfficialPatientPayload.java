package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Canonical patient payload for official patient create/update requests.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class OfficialPatientPayload {

    private String patientId;
    private String wholeName;
    private String wholeNameKana;
    private String birthDate;
    private String sex;
    private String telephone;
    private String zipCode;
    private String addressLine;

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

    public String getWholeNameKana() {
        return wholeNameKana;
    }

    public void setWholeNameKana(String wholeNameKana) {
        this.wholeNameKana = wholeNameKana;
    }

    public String getBirthDate() {
        return birthDate;
    }

    public void setBirthDate(String birthDate) {
        this.birthDate = birthDate;
    }

    public String getSex() {
        return sex;
    }

    public void setSex(String sex) {
        this.sex = sex;
    }

    public String getTelephone() {
        return telephone;
    }

    public void setTelephone(String telephone) {
        this.telephone = telephone;
    }

    public String getZipCode() {
        return zipCode;
    }

    public void setZipCode(String zipCode) {
        this.zipCode = zipCode;
    }

    public String getAddressLine() {
        return addressLine;
    }

    public void setAddressLine(String addressLine) {
        this.addressLine = addressLine;
    }
}
