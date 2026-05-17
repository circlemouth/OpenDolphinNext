package open.dolphin.rest.dto.orca;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.ArrayList;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class OrcaOrderInteractionCheckResponse {

    private boolean ok;
    private int totalCount;
    private List<Pair> pairs = new ArrayList<>();
    private String runId;
    private String traceId;
    private OrcaMasterMeta meta;

    public boolean isOk() {
        return ok;
    }

    public void setOk(boolean ok) {
        this.ok = ok;
    }

    public int getTotalCount() {
        return totalCount;
    }

    public void setTotalCount(int totalCount) {
        this.totalCount = totalCount;
    }

    public List<Pair> getPairs() {
        return pairs;
    }

    public void setPairs(List<Pair> pairs) {
        this.pairs = pairs;
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
    public static class Pair {
        private String code1;
        private String code2;
        private String interactionCode;
        private String interactionName;
        private String message;

        public String getCode1() {
            return code1;
        }

        public void setCode1(String code1) {
            this.code1 = code1;
        }

        public String getCode2() {
            return code2;
        }

        public void setCode2(String code2) {
            this.code2 = code2;
        }

        public String getInteractionCode() {
            return interactionCode;
        }

        public void setInteractionCode(String interactionCode) {
            this.interactionCode = interactionCode;
        }

        public String getInteractionName() {
            return interactionName;
        }

        public void setInteractionName(String interactionName) {
            this.interactionName = interactionName;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }
    }
}
