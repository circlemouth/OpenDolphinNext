package open.dolphin.orca;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.orca.transport.RestOrcaTransport;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

@EnabledIfEnvironmentVariable(named = "ORCA_TRIAL_ENABLED", matches = "true|1")
class OrcaTrialIntegrationTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Test
    void systemAndMedicalApis_shouldRespondOrSkipWhenClosed() throws Exception {
        RestOrcaTransport transport = buildTransport();
        String facilityId = facilityId();

        List<RequestSpec> specs = List.of(
                new RequestSpec(OrcaEndpoint.SYSTEM_DAILY, readXml("server-modernized/src/test/resources/orca-api-requests/xml/44_system01dailyv2_request.xml")),
                new RequestSpec(OrcaEndpoint.SYSTEM_INFO, readXml("server-modernized/src/test/resources/orca-api-requests/xml/28_systeminfv2_request.xml")),
                new RequestSpec(OrcaEndpoint.TEMP_MEDICAL_GET, tmedicalGetPayload()),
                new RequestSpec(OrcaEndpoint.INCOME_INFO, incomeInfoPayload()),
                new RequestSpec(OrcaEndpoint.MEDICAL_SET, readXml("server-modernized/src/test/resources/orca-api-requests/xml/33_medicalsetv2_request.xml")),
                new RequestSpec(OrcaEndpoint.INSURANCE_LIST, insuranceListPayload()),
                new RequestSpec(OrcaEndpoint.MASTER_LAST_UPDATE, "<data></data>"),
                new RequestSpec(OrcaEndpoint.CONTRAINDICATION_CHECK, contraindicationPayload()),
                new RequestSpec(OrcaEndpoint.MEDICATION_GET, medicationGetPayload()),
                new RequestSpec(OrcaEndpoint.PUSH_EVENT_GET, pushEventPayload())
        );

        for (RequestSpec spec : specs) {
            assertOrSkip(transport, facilityId, spec);
        }
    }

    @Test
    void patientGetAndPatientMod_shouldRespondOrSkipWhenClosed() throws Exception {
        RestOrcaTransport transport = buildTransport();
        String facilityId = facilityId();
        OrcaTransportResult getResult = invokeOrSkip(transport, facilityId, OrcaEndpoint.PATIENT_GET,
                OrcaTransportRequest.get("id=00001"));
        assertNotNull(getResult);
        assertTrue(getResult.getBody().contains("Api_Result"));

        OrcaTransportResult modResult = invokeOrSkip(transport, facilityId, OrcaEndpoint.PATIENT_MOD,
                OrcaTransportRequest.post(readXml("server-modernized/src/test/resources/orca-api-requests/14_patientmodv2_request.xml")));
        assertNotNull(modResult);
        assertTrue(modResult.getBody().contains("Api_Result"));
    }

    @Test
    void reportApi_shouldReturnJsonOrPdfWhenAvailable() throws Exception {
        RestOrcaTransport transport = buildTransport();
        String facilityId = facilityId();
        OrcaTransportResult result = invokeOrSkip(transport, facilityId, OrcaEndpoint.PRESCRIPTION_REPORT,
                OrcaTransportRequest.post(readXml("server-modernized/src/test/resources/orca-api-requests/xml/44_system01dailyv2_request.xml")));
        assertNotNull(result);
        assertTrue(result.getBody().contains("Api_Result") || result.getBody().contains("Data_Id"));
        String dataId = extractDataId(result.getBody());
        if (dataId != null) {
            byte[] blob = fetchBlob(transport, facilityId, dataId);
            assertNotNull(blob);
            assertTrue(blob.length > 0);
        }
    }

    private void assertOrSkip(RestOrcaTransport transport, String facilityId, RequestSpec spec) {
        try {
            OrcaTransportResult result = transport.invoke(facilityId, spec.endpoint, OrcaTransportRequest.post(spec.payload));
            assertNotNull(result);
            String body = result.getBody();
            assertNotNull(body);
            assertFalse(body.isBlank());
            if (spec.endpoint == OrcaEndpoint.PUSH_EVENT_GET) {
                assertTrue(body.startsWith("[") || body.contains("\"data\"") || body.contains("\"error\""),
                        "Unexpected response for " + spec.endpoint.name());
            } else {
                assertTrue(body.contains("Api_Result"), "Api_Result missing for " + spec.endpoint.name());
            }
        } catch (Exception ex) {
            String message = ex.getMessage() != null ? ex.getMessage() : "";
            if (message.contains("HTTP response status 404")
                    || message.contains("HTTP response status 405")
                    || message.contains("HTTP response status 502")
                    || message.contains("HTTP response status 503")
                    || (spec.endpoint == OrcaEndpoint.MEDICAL_SET && message.contains("HTTP response status 500"))) {
                Assumptions.assumeTrue(false, "Trial endpoint closed: " + spec.endpoint.getPath());
            }
            throw ex;
        }
    }

    private OrcaTransportResult invokeOrSkip(RestOrcaTransport transport, String facilityId, OrcaEndpoint endpoint,
            OrcaTransportRequest request) {
        try {
            return transport.invoke(facilityId, endpoint, request);
        } catch (Exception ex) {
            String message = ex.getMessage() != null ? ex.getMessage() : "";
            if (message.contains("HTTP response status 404")
                    || message.contains("HTTP response status 405")
                    || message.contains("HTTP response status 502")
                    || message.contains("HTTP response status 503")) {
                Assumptions.assumeTrue(false, "Trial endpoint closed: " + endpoint.getPath());
            }
            throw ex;
        }
    }

    private RestOrcaTransport buildTransport() throws Exception {
        RestOrcaTransport transport = new RestOrcaTransport();
        Method initialize = RestOrcaTransport.class.getDeclaredMethod("initialize");
        initialize.setAccessible(true);
        initialize.invoke(transport);
        return transport;
    }

    private String extractDataId(String json) {
        try {
            JsonNode root = JSON.readTree(json);
            Optional<JsonNode> node = findJsonValue(root, "Data_Id");
            return node.map(JsonNode::asText).orElse(null);
        } catch (IOException ex) {
            return null;
        }
    }

    private Optional<JsonNode> findJsonValue(JsonNode node, String key) {
        if (node == null || key == null) {
            return Optional.empty();
        }
        if (node.has(key)) {
            return Optional.ofNullable(node.get(key));
        }
        for (JsonNode child : node) {
            Optional<JsonNode> found = findJsonValue(child, key);
            if (found.isPresent()) {
                return found;
            }
        }
        return Optional.empty();
    }

    private byte[] fetchBlob(RestOrcaTransport transport, String facilityId, String dataId) throws IOException, InterruptedException {
        String authHeader = transport != null ? transport.resolveBasicAuthHeader(facilityId) : null;
        Assumptions.assumeTrue(authHeader != null && !authHeader.isBlank(), "basic auth missing");
        String url = transport != null ? transport.buildOrcaUrl(facilityId, "/blobapi/" + dataId) : null;
        Assumptions.assumeTrue(url != null && !url.isBlank(), "ORCA url missing");
        java.net.http.HttpClient client = transport != null && transport.rawHttpClient(facilityId) != null
                ? transport.rawHttpClient(facilityId)
                : java.net.http.HttpClient.newBuilder().build();
        java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
                .uri(java.net.URI.create(url))
                .header("Authorization", authHeader)
                .GET()
                .build();
        java.net.http.HttpResponse<byte[]> response = client.send(request,
                java.net.http.HttpResponse.BodyHandlers.ofByteArray());
        if (response.statusCode() == 404 || response.statusCode() == 405) {
            Assumptions.assumeTrue(false, "blobapi closed");
        }
        return response.body();
    }

    private String facilityId() {
        String facilityId = System.getProperty("opendolphin.facility-id");
        if (facilityId == null || facilityId.isBlank()) {
            facilityId = System.getenv("OPENDOLPHIN_FACILITY_ID");
        }
        Assumptions.assumeTrue(facilityId != null && !facilityId.isBlank(), "facility id missing");
        return facilityId.trim();
    }

    private String readXml(String path) {
        Path primary = Path.of(path);
        if (!Files.exists(primary)) {
            primary = Path.of("..").resolve(path);
        }
        try {
            return Files.readString(primary, StandardCharsets.UTF_8);
        } catch (IOException ex) {
            return "<data></data>";
        }
    }

    private String insuranceListPayload() {
        String date = LocalDate.now().toString();
        return "<data><insuranceinf1v2req type=\"record\">"
                + "<Request_Number type=\"string\">01</Request_Number>"
                + "<Base_Date type=\"string\">" + date + "</Base_Date>"
                + "</insuranceinf1v2req></data>";
    }

    private String contraindicationPayload() {
        String month = LocalDate.now().withDayOfMonth(1).toString().substring(0, 7);
        return "<data><contraindication_checkreq type=\"record\">"
                + "<Request_Number type=\"string\">01</Request_Number>"
                + "<Patient_ID type=\"string\">00001</Patient_ID>"
                + "<Perform_Month type=\"string\">" + month + "</Perform_Month>"
                + "<Check_Term type=\"string\">1</Check_Term>"
                + "</contraindication_checkreq></data>";
    }

    private String medicationGetPayload() {
        String date = LocalDate.now().toString();
        return "<data><medicationgetreq type=\"record\">"
                + "<Request_Number type=\"string\">01</Request_Number>"
                + "<Request_Code type=\"string\">123456789</Request_Code>"
                + "<Base_Date type=\"string\">" + date + "</Base_Date>"
                + "</medicationgetreq></data>";
    }

    private String tmedicalGetPayload() {
        return "<data><tmedicalgetreq type=\"record\">"
                + "<Request_Number type=\"string\">01</Request_Number>"
                + "</tmedicalgetreq></data>";
    }

    private String incomeInfoPayload() {
        String date = LocalDate.now().toString();
        return "<data><incomeinfv2req type=\"record\">"
                + "<private_objects type=\"record\">"
                + "<Patient_ID type=\"string\">10000001</Patient_ID>"
                + "<Base_Date type=\"string\">" + date + "</Base_Date>"
                + "</private_objects>"
                + "</incomeinfv2req></data>";
    }

    private String pushEventPayload() {
        return "{\"pusheventgetv2req\":{\"event\":\"patient_accept\"}}";
    }

    private record RequestSpec(OrcaEndpoint endpoint, String payload) {
    }
}
