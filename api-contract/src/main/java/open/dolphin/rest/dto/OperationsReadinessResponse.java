package open.dolphin.rest.dto;

import java.util.LinkedHashMap;
import java.util.Map;

public class OperationsReadinessResponse {

    private String status;
    private Map<String, OperationsReadinessCheck> checks = new LinkedHashMap<>();

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Map<String, OperationsReadinessCheck> getChecks() {
        return checks;
    }

    public void setChecks(Map<String, OperationsReadinessCheck> checks) {
        this.checks = checks;
    }
}
