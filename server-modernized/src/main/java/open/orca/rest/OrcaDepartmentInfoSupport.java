package open.orca.rest;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

final class OrcaDepartmentInfoSupport {

    private OrcaDepartmentInfoSupport() {
    }

    static String currentBaseDate() {
        return new SimpleDateFormat("yyyy-MM-dd").format(new Date());
    }

    static String buildSystemManagementRequest(String baseDate) {
        return "<data><system01_managereq type=\"record\">"
                + "<Base_Date type=\"string\">" + baseDate + "</Base_Date>"
                + "</system01_managereq></data>";
    }

    static String sanitizeResponse(String body) {
        return body != null ? body.replaceAll("\\<.*?>", ",") : "";
    }

    static WebApplicationException orcaConfigMissing() {
        return error("orca_config_missing", "ORCA 接続設定が不足しています。");
    }

    static WebApplicationException orcaUnavailable() {
        return error("orca_unavailable", "ORCA 診療科情報の取得に失敗しました。");
    }

    private static WebApplicationException error(String code, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", code);
        body.put("code", code);
        body.put("errorCode", code);
        body.put("message", message);
        body.put("status", Response.Status.SERVICE_UNAVAILABLE.getStatusCode());
        body.put("errorCategory", code);
        return new WebApplicationException(Response.status(Response.Status.SERVICE_UNAVAILABLE)
                .type(MediaType.APPLICATION_JSON_TYPE)
                .entity(body)
                .build());
    }
}
