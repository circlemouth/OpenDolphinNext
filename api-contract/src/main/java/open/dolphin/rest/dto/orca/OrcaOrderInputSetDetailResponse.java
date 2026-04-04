package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.ArrayList;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class OrcaOrderInputSetDetailResponse {

    private boolean ok;
    private String setCode;
    private Bundle bundle;
    private String runId;
    private String traceId;

    public boolean isOk() {
        return ok;
    }

    public void setOk(boolean ok) {
        this.ok = ok;
    }

    public String getSetCode() {
        return setCode;
    }

    public void setSetCode(String setCode) {
        this.setCode = setCode;
    }

    public Bundle getBundle() {
        return bundle;
    }

    public void setBundle(Bundle bundle) {
        this.bundle = bundle;
    }

    public String getRunId() {
        return runId;
    }

    public void setRunId(String runId) {
        this.runId = runId;
    }

    public String getTraceId() {
        return traceId;
    }

    public void setTraceId(String traceId) {
        this.traceId = traceId;
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Bundle {
        private String entity;
        private String sourceSetCode;
        private String bundleName;
        private String bundleNumber;
        private String subtype;
        private String classCode;
        private String classCodeSystem;
        private String className;
        private String admin;
        private String adminCode;
        private String adminCodeSystem;
        private String adminMemo;
        private String memo;
        private String started;
        private BodyPart bodyPart;
        private List<Item> items = new ArrayList<>();

        public String getEntity() {
            return entity;
        }

        public void setEntity(String entity) {
            this.entity = entity;
        }

        public String getSourceSetCode() {
            return sourceSetCode;
        }

        public void setSourceSetCode(String sourceSetCode) {
            this.sourceSetCode = sourceSetCode;
        }

        public String getBundleName() {
            return bundleName;
        }

        public void setBundleName(String bundleName) {
            this.bundleName = bundleName;
        }

        public String getBundleNumber() {
            return bundleNumber;
        }

        public void setBundleNumber(String bundleNumber) {
            this.bundleNumber = bundleNumber;
        }

        public String getSubtype() {
            return subtype;
        }

        public void setSubtype(String subtype) {
            this.subtype = subtype;
        }

        public String getClassCode() {
            return classCode;
        }

        public void setClassCode(String classCode) {
            this.classCode = classCode;
        }

        public String getClassCodeSystem() {
            return classCodeSystem;
        }

        public void setClassCodeSystem(String classCodeSystem) {
            this.classCodeSystem = classCodeSystem;
        }

        public String getClassName() {
            return className;
        }

        public void setClassName(String className) {
            this.className = className;
        }

        public String getAdmin() {
            return admin;
        }

        public void setAdmin(String admin) {
            this.admin = admin;
        }

        public String getAdminCode() {
            return adminCode;
        }

        public void setAdminCode(String adminCode) {
            this.adminCode = adminCode;
        }

        public String getAdminCodeSystem() {
            return adminCodeSystem;
        }

        public void setAdminCodeSystem(String adminCodeSystem) {
            this.adminCodeSystem = adminCodeSystem;
        }

        public String getAdminMemo() {
            return adminMemo;
        }

        public void setAdminMemo(String adminMemo) {
            this.adminMemo = adminMemo;
        }

        public String getMemo() {
            return memo;
        }

        public void setMemo(String memo) {
            this.memo = memo;
        }

        public String getStarted() {
            return started;
        }

        public void setStarted(String started) {
            this.started = started;
        }

        public BodyPart getBodyPart() {
            return bodyPart;
        }

        public void setBodyPart(BodyPart bodyPart) {
            this.bodyPart = bodyPart;
        }

        public List<Item> getItems() {
            return items;
        }

        public void setItems(List<Item> items) {
            this.items = items;
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Item {
        private String code;
        private String name;
        private String quantity;
        private String unit;
        private String memo;
        private String rowRole;
        private String rowSubtype;

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

        public String getQuantity() {
            return quantity;
        }

        public void setQuantity(String quantity) {
            this.quantity = quantity;
        }

        public String getUnit() {
            return unit;
        }

        public void setUnit(String unit) {
            this.unit = unit;
        }

        public String getMemo() {
            return memo;
        }

        public void setMemo(String memo) {
            this.memo = memo;
        }

        public String getRowRole() {
            return rowRole;
        }

        public void setRowRole(String rowRole) {
            this.rowRole = rowRole;
        }

        public String getRowSubtype() {
            return rowSubtype;
        }

        public void setRowSubtype(String rowSubtype) {
            this.rowSubtype = rowSubtype;
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class BodyPart extends Item {
    }
}
