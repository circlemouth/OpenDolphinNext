package open.dolphin.rest.dto.orca;

import java.time.LocalDate;

/**
 * Request payload for sanitized acceptlstv2 target inventory.
 */
public class AcceptanceInventoryRequest {

    private LocalDate acceptanceDate;
    private String classCode;
    private String departmentCode;

    public LocalDate getAcceptanceDate() {
        return acceptanceDate;
    }

    public void setAcceptanceDate(LocalDate acceptanceDate) {
        this.acceptanceDate = acceptanceDate;
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
}
