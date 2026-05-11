package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Client request for the local close-and-send workflow.
 *
 * <p>The workflow derives patient, facility, ORCA visit identifiers, class code,
 * insurance and Medical_Uid on the server. Any client-provided authority field
 * is recorded and rejected by the resource.</p>
 */
public class CloseAndSendToBillingRequest {

    private static final Set<String> FORBIDDEN_AUTHORITY_FIELDS = Set.of(
            "patientid",
            "facilityid",
            "ownerid",
            "voucher",
            "vouchernumber",
            "acceptanceid",
            "acceptancedate",
            "acceptancetime",
            "sequential",
            "sequentialnumber",
            "departmentcode",
            "physiciancode",
            "insurance",
            "insurancecombinationnumber",
            "medicaluid",
            "classcode",
            "requestnumber",
            "uri",
            "objectkey",
            "digest",
            "url",
            "serverurl",
            "rawxml");

    private String idempotencyKey;
    private Boolean runPrecheck;

    @JsonIgnore
    private final Map<String, Object> forbiddenClientAuthorityFields = new LinkedHashMap<>();

    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public void setIdempotencyKey(String idempotencyKey) {
        this.idempotencyKey = idempotencyKey;
    }

    public Boolean getRunPrecheck() {
        return runPrecheck;
    }

    public void setRunPrecheck(Boolean runPrecheck) {
        this.runPrecheck = runPrecheck;
    }

    @JsonIgnore
    public Map<String, Object> getForbiddenClientAuthorityFields() {
        return forbiddenClientAuthorityFields;
    }

    @JsonAnySetter
    public void captureUnknownField(String name, Object value) {
        if (name == null || name.isBlank()) {
            return;
        }
        String normalized = name.replace("_", "").replace("-", "").toLowerCase(Locale.ROOT);
        if (FORBIDDEN_AUTHORITY_FIELDS.contains(normalized)) {
            forbiddenClientAuthorityFields.put(name, value);
        }
    }
}
