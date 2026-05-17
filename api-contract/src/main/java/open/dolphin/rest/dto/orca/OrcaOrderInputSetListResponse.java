package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.ArrayList;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class OrcaOrderInputSetListResponse {

    private Integer totalCount;
    private List<Item> items = new ArrayList<>();
    private String runId;
    private String traceId;
    private OrcaMasterMeta meta;

    public Integer getTotalCount() {
        return totalCount;
    }

    public void setTotalCount(Integer totalCount) {
        this.totalCount = totalCount;
    }

    public List<Item> getItems() {
        return items;
    }

    public void setItems(List<Item> items) {
        this.items = items;
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

    public OrcaMasterMeta getMeta() {
        return meta;
    }

    public void setMeta(OrcaMasterMeta meta) {
        this.meta = meta;
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Item {
        private String setCode;
        private String name;
        private String entity;
        private String kind;
        private String classCode;
        private String classCodeSystem;
        private Integer itemCount;
        private String validFrom;
        private String validTo;

        public String getSetCode() {
            return setCode;
        }

        public void setSetCode(String setCode) {
            this.setCode = setCode;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getEntity() {
            return entity;
        }

        public void setEntity(String entity) {
            this.entity = entity;
        }

        public String getKind() {
            return kind;
        }

        public void setKind(String kind) {
            this.kind = kind;
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

        public Integer getItemCount() {
            return itemCount;
        }

        public void setItemCount(Integer itemCount) {
            this.itemCount = itemCount;
        }

        public String getValidFrom() {
            return validFrom;
        }

        public void setValidFrom(String validFrom) {
            this.validFrom = validFrom;
        }

        public String getValidTo() {
            return validTo;
        }

        public void setValidTo(String validTo) {
            this.validTo = validTo;
        }
    }
}
