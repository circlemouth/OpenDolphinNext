package open.dolphin.rest.dto.localsummary;

import java.util.LinkedHashMap;
import java.util.Map;

public class LocalMedicalSummaryErrorResponse {

    private ErrorEnvelope error = new ErrorEnvelope();

    public ErrorEnvelope getError() {
        return error;
    }

    public void setError(ErrorEnvelope error) {
        this.error = error != null ? error : new ErrorEnvelope();
    }

    public static class ErrorEnvelope {
        private String code;
        private String message;
        private Integer httpStatus;
        private String requestId;
        private String traceId;
        private Map<String, Object> details = new LinkedHashMap<>();

        public String getCode() {
            return code;
        }

        public void setCode(String code) {
            this.code = code;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }

        public Integer getHttpStatus() {
            return httpStatus;
        }

        public void setHttpStatus(Integer httpStatus) {
            this.httpStatus = httpStatus;
        }

        public String getRequestId() {
            return requestId;
        }

        public void setRequestId(String requestId) {
            this.requestId = requestId;
        }

        public String getTraceId() {
            return traceId;
        }

        public void setTraceId(String traceId) {
            this.traceId = traceId;
        }

        public Map<String, Object> getDetails() {
            return details;
        }

        public void setDetails(Map<String, Object> details) {
            this.details = details != null ? details : new LinkedHashMap<>();
        }
    }
}
