package open.dolphin.orca.transport;

import static org.junit.jupiter.api.Assertions.*;

import java.lang.reflect.Method;
import java.util.List;
import open.dolphin.orca.model.OrcaApiResult;
import org.junit.jupiter.api.Test;

class OrcaHttpClientLogTest {

    @Test
    void summaryLog_masksPhiAndKeepsHashes() {
        OrcaApiResult result = OrcaApiResult.of(
                "00",
                "患者番号0000123 山田太郎 生年月日1978-01-02",
                List.of("住所:東京都新宿区", "電話:09012345678"));

        String log = OrcaHttpClient.formatSummaryLog(
                "trace-1", "POST", "/api/patientmodv2", 200, result, 120);

        assertTrue(log.contains("apiResult=00"));
        assertFalse(log.contains("山田太郎"));
        assertFalse(log.contains("東京都"));
        assertFalse(log.contains("09012345678"));
        assertFalse(log.contains("1978"));
        assertTrue(log.contains("apiMessageHash="));
        assertTrue(log.contains("warningsHash="));
    }

    @Test
    void numericOnlyMessage_isLoggedAsIs() {
        OrcaApiResult result = OrcaApiResult.of(
                "99",
                "0001",
                List.of());

        String log = OrcaHttpClient.formatSummaryLog(
                "trace-2", "GET", "/api/system/status", 400, result, 45);

        assertTrue(log.contains("apiMessage=0001"));
        assertFalse(log.contains("apiMessageHash")); // numeric only should avoid hash in summary
    }

    @Test
    void summaryLog_doesNotRenderRawTargetMaterial() {
        String rawTarget = "https://" + "admin:pass@" + "facility.example.orca/secret-prefix";
        OrcaApiResult result = OrcaApiResult.of(
                "98",
                "Invalid target " + rawTarget,
                List.of("baseUrl=" + rawTarget, "userinfo=admin:pass"));

        String log = OrcaHttpClient.formatSummaryLog(
                "trace-3", "POST", "/api/system", 400, result, 12);

        assertFalse(log.contains(rawTarget));
        assertFalse(log.contains("facility.example.orca"));
        assertFalse(log.contains("admin:pass"));
        assertFalse(log.contains("secret-prefix"));
        assertTrue(log.contains("apiMessageHash="));
        assertTrue(log.contains("warningsHash="));
    }

    @Test
    void detailLog_reflectivePathDoesNotRenderRawTargetMaterial() throws Exception {
        String rawTarget = "https://" + "admin:pass@" + "facility.example.orca/secret-prefix";
        OrcaApiResult result = OrcaApiResult.of(
                "98",
                "Invalid target " + rawTarget,
                List.of("baseUrl=" + rawTarget, "userinfo=admin:pass"));

        Method formatDetailLog = OrcaHttpClient.class.getDeclaredMethod(
                "formatDetailLog",
                String.class,
                String.class,
                String.class,
                int.class,
                OrcaApiResult.class,
                OrcaHttpClient.OrcaLogMode.class);
        formatDetailLog.setAccessible(true);
        String log = (String) formatDetailLog.invoke(
                null,
                "trace-4",
                "POST",
                "/api/system",
                400,
                result,
                OrcaHttpClient.OrcaLogMode.DETAIL);

        assertFalse(log.contains(rawTarget));
        assertFalse(log.contains("facility.example.orca"));
        assertFalse(log.contains("admin:pass"));
        assertFalse(log.contains("secret-prefix"));
        assertTrue(log.contains("apiMessageHash="));
        assertTrue(log.contains("warningsHash="));
    }

    @Test
    void detailLog_doesNotRenderRawTargetMaterial() {
        String rawTarget = "https://" + "admin:pass@" + "facility.example.orca/secret-prefix";
        OrcaApiResult result = OrcaApiResult.of(
                "98",
                "Invalid target " + rawTarget,
                List.of("userinfo=admin:pass", "host=facility.example.orca"));

        String log = OrcaHttpClient.formatDetailLog(
                "trace-4", "POST", "/api/system", 400, result, OrcaHttpClient.OrcaLogMode.DETAIL);

        assertFalse(log.contains(rawTarget));
        assertFalse(log.contains("facility.example.orca"));
        assertFalse(log.contains("admin:pass"));
        assertFalse(log.contains("secret-prefix"));
        assertTrue(log.contains("apiMessageHash="));
        assertTrue(log.contains("warningsHash="));
    }

    @Test
    void externalServiceOrcaDetailUrlIsReducedToPathOnly() throws Exception {
        Method buildOrcaRequestDetail = open.dolphin.msg.gateway.ExternalServiceAuditLogger.class.getDeclaredMethod(
                "buildOrcaRequestDetail",
                String.class,
                String.class,
                String.class,
                String.class,
                String.class);
        buildOrcaRequestDetail.setAccessible(true);
        String rawTarget = "https://" + "admin:pass@" + "facility.example.orca/secret-prefix/api01rv2/patientgetv2";
        String log = (String) buildOrcaRequestDetail.invoke(
                null,
                rawTarget,
                "GET",
                "application/xml",
                "application/xml",
                "");

        assertTrue(log.contains("orca.url=/secret-prefix/api01rv2/patientgetv2"));
        assertFalse(log.contains("facility.example.orca"));
        assertFalse(log.contains("admin:pass"));
    }
}
