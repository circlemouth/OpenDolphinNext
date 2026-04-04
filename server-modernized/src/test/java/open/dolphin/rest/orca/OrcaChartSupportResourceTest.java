package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.WebApplicationException;
import java.lang.reflect.Proxy;
import java.util.List;
import java.util.Map;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.rest.dto.orca.ChartSupportMedicationGetRequest;
import open.dolphin.rest.dto.orca.ChartSupportMedicationGetResponse;
import org.junit.jupiter.api.Test;

class OrcaChartSupportResourceTest {

    @Test
    void medicationGetDefaultsToRequestNumber02AndSendsNineDigitRequestCode() {
        CapturingTransport transport = new CapturingTransport();
        OrcaChartSupportResource resource = new OrcaChartSupportResource();
        injectField(resource, "orcaTransport", transport);

        HttpServletRequest request = buildRequest();
        ChartSupportMedicationGetRequest payload = new ChartSupportMedicationGetRequest();
        payload.setRequestCode("114030710");
        payload.setBaseDate("2026-03-22");

        ChartSupportMedicationGetResponse response = resource.medicationGet(request, payload);

        assertNotNull(response);
        assertEquals("02", transport.requestNumber());
        assertTrue(transport.requestXml().contains("<Request_Number type=\"string\">02</Request_Number>"));
        assertTrue(transport.requestXml().contains("<Request_Code type=\"string\">114030710</Request_Code>"));
        assertTrue(transport.requestXml().contains("<Base_Date type=\"string\">2026-03-22</Base_Date>"));
    }

    @Test
    void medicationGetRejectsNonNineDigitRequestCodeForSelectionLookup() {
        OrcaChartSupportResource resource = new OrcaChartSupportResource();
        injectField(resource, "orcaTransport", new CapturingTransport());

        HttpServletRequest request = buildRequest();
        ChartSupportMedicationGetRequest payload = new ChartSupportMedicationGetRequest();
        payload.setRequestCode("12345");

        WebApplicationException exception = assertThrows(
                WebApplicationException.class,
                () -> resource.medicationGet(request, payload));

        assertEquals(400, exception.getResponse().getStatus());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) exception.getResponse().getEntity();
        assertEquals("payload.requestCode", body.get("field"));
        assertEquals("requestCode must be a 9-digit medical code for requestNumber 02", body.get("message"));
    }

    private static HttpServletRequest buildRequest() {
        return (HttpServletRequest) Proxy.newProxyInstance(
                OrcaChartSupportResourceTest.class.getClassLoader(),
                new Class[]{HttpServletRequest.class},
                (proxy, method, args) -> {
                    String name = method.getName();
                    if ("getRemoteUser".equals(name)) return "F001:doctor01";
                    if ("getRemoteAddr".equals(name)) return "127.0.0.1";
                    if ("getRequestURI".equals(name)) return "/api/orca/chart-support/medication-get";
                    if ("getHeader".equals(name) && args != null && args.length == 1) {
                        String header = String.valueOf(args[0]);
                        return switch (header) {
                            case "X-Request-Id" -> "req-medication-get";
                            case "X-Trace-Id" -> "trace-medication-get";
                            case "User-Agent" -> "JUnit";
                            default -> null;
                        };
                    }
                    return null;
                });
    }

    private static final class CapturingTransport implements OrcaTransport {
        private String requestXml;
        private String requestNumber;

        @Override
        public OrcaTransportResult invoke(String facilityId, OrcaEndpoint endpoint, OrcaTransportRequest request) {
            requestXml = request.getBody();
            requestNumber = extractTag(requestXml, "Request_Number");
            String responseXml = """
                    <data>
                      <medicationgetres type="record">
                        <Information_Date type="string">2026-03-22</Information_Date>
                        <Information_Time type="string">08:01:00</Information_Time>
                        <Api_Result type="string">000</Api_Result>
                        <Api_Result_Message type="string">処理終了</Api_Result_Message>
                        <Request_Code type="string">114030710</Request_Code>
                        <Base_Date type="string">2026-03-22</Base_Date>
                      </medicationgetres>
                    </data>
                    """;
            return OrcaTransportResult.fallback(responseXml, "application/xml");
        }

        String requestXml() {
            return requestXml;
        }

        String requestNumber() {
            return requestNumber;
        }

        private static String extractTag(String xml, String tagName) {
            String start = "<" + tagName + " type=\"string\">";
            String end = "</" + tagName + ">";
            if (xml == null || !xml.contains(start) || !xml.contains(end)) {
                return null;
            }
            int from = xml.indexOf(start) + start.length();
            int to = xml.indexOf(end);
            return xml.substring(from, to);
        }
    }

    private static void injectField(Object target, String fieldName, Object value) {
        try {
            var field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
