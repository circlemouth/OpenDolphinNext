package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
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
import open.dolphin.rest.dto.orca.ChartSupportContraindicationCheckRequest;
import open.dolphin.rest.dto.orca.ChartSupportContraindicationCheckResponse;
import open.dolphin.rest.dto.orca.ChartSupportIncomeInfoRequest;
import open.dolphin.rest.dto.orca.ChartSupportIncomeInfoResponse;
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

    @Test
    void medicationGetAllowsRequestNumber01WithInputCode() {
        CapturingTransport transport = new CapturingTransport("""
                <data>
                  <medicationgetres type="record">
                    <Information_Date type="string">2026-03-22</Information_Date>
                    <Information_Time type="string">08:01:00</Information_Time>
                    <Api_Result type="string">000</Api_Result>
                    <Api_Result_Message type="string">処理終了</Api_Result_Message>
                    <Request_Code type="string">Y00001</Request_Code>
                    <Base_Date type="string">2026-03-22</Base_Date>
                  </medicationgetres>
                </data>
                """);
        OrcaChartSupportResource resource = new OrcaChartSupportResource();
        injectField(resource, "orcaTransport", transport);

        HttpServletRequest request = buildRequest();
        ChartSupportMedicationGetRequest payload = new ChartSupportMedicationGetRequest();
        payload.setRequestNumber("01");
        payload.setRequestCode("Y00001");
        payload.setBaseDate("2026-03-22");

        ChartSupportMedicationGetResponse response = resource.medicationGet(request, payload);

        assertNotNull(response);
        assertEquals("01", transport.requestNumber());
        assertTrue(transport.requestXml().contains("<Request_Number type=\"string\">01</Request_Number>"));
        assertTrue(transport.requestXml().contains("<Request_Code type=\"string\">Y00001</Request_Code>"));
    }

    @Test
    void contraindicationCheckInvokesOfficialRouteWithDefaultRequestNumberAndCheckTerm() {
        CapturingTransport transport = new CapturingTransport("""
                <data>
                  <contraindicationcheckres type="record">
                    <Information_Date type="string">2026-03-22</Information_Date>
                    <Information_Time type="string">08:02:00</Information_Time>
                    <Api_Result type="string">000</Api_Result>
                    <Api_Result_Message type="string">処理終了</Api_Result_Message>
                  </contraindicationcheckres>
                </data>
                """);
        OrcaChartSupportResource resource = new OrcaChartSupportResource();
        injectField(resource, "orcaTransport", transport);

        HttpServletRequest request = buildRequest();
        ChartSupportContraindicationCheckRequest payload = new ChartSupportContraindicationCheckRequest();
        payload.setPatientId("12345");
        payload.setPerformMonth("2026-03");

        ChartSupportContraindicationCheckResponse response = resource.contraindicationCheck(request, payload);

        assertNotNull(response);
        assertEquals(OrcaEndpoint.CONTRAINDICATION_CHECK, transport.endpoint());
        assertTrue(transport.requestXml().contains("<Request_Number type=\"string\">01</Request_Number>"));
        assertTrue(transport.requestXml().contains("<Check_Term type=\"string\">1</Check_Term>"));
        assertTrue(transport.requestXml().contains("<Patient_ID type=\"string\">12345</Patient_ID>"));
        assertTrue(transport.requestXml().contains("<Perform_Month type=\"string\">2026-03</Perform_Month>"));
    }

    @Test
    void contraindicationCheckParsesWarningsAndSymptomInfo() {
        CapturingTransport transport = new CapturingTransport("""
                <data>
                  <contraindicationcheckres type="record">
                    <Information_Date type="string">2026-03-22</Information_Date>
                    <Information_Time type="string">08:02:00</Information_Time>
                    <Api_Result type="string">0000</Api_Result>
                    <Api_Result_Message type="string">処理終了</Api_Result_Message>
                    <Medical_Information type="array">
                      <Medical_Information_child type="record">
                        <Medication_Code type="string">620001234</Medication_Code>
                        <Medication_Name type="string">アスピリン</Medication_Name>
                        <Medical_Result type="string">W01</Medical_Result>
                        <Medical_Result_Message type="string">併用注意</Medical_Result_Message>
                        <Medical_Info type="array">
                          <Medical_Info_child type="record">
                            <Contra_Code type="string">C001</Contra_Code>
                            <Contra_Name type="string">禁忌A</Contra_Name>
                            <Interact_Code type="string">I001</Interact_Code>
                            <Administer_Date type="string">2026-03-01</Administer_Date>
                            <Context_Class type="string">01</Context_Class>
                          </Medical_Info_child>
                        </Medical_Info>
                      </Medical_Information_child>
                    </Medical_Information>
                    <Symptom_Information type="array">
                      <Symptom_Information_child type="record">
                        <Symptom_Code type="string">S001</Symptom_Code>
                        <Symptom_Content type="string">喘息</Symptom_Content>
                        <Symptom_Detail type="string">既往あり</Symptom_Detail>
                      </Symptom_Information_child>
                    </Symptom_Information>
                  </contraindicationcheckres>
                </data>
                """);
        OrcaChartSupportResource resource = new OrcaChartSupportResource();
        injectField(resource, "orcaTransport", transport);

        ChartSupportContraindicationCheckRequest payload = new ChartSupportContraindicationCheckRequest();
        payload.setPatientId("12345");
        payload.setPerformMonth("2026-03");

        ChartSupportContraindicationCheckResponse response = resource.contraindicationCheck(buildRequest(), payload);

        assertEquals("0000", response.getApiResult());
        assertEquals(1, response.getResults().size());
        assertEquals("620001234", response.getResults().get(0).getMedicationCode());
        assertEquals(1, response.getResults().get(0).getWarnings().size());
        assertEquals("C001", response.getResults().get(0).getWarnings().get(0).getContraCode());
        assertEquals(1, response.getSymptomInfo().size());
        assertEquals("S001", response.getSymptomInfo().get(0).getCode());
    }

    @Test
    void incomeInfoUsesOfficialRouteAndPrefersPerformDate() {
        CapturingTransport transport = new CapturingTransport("""
                <data>
                  <incomeinfores type="record">
                    <Api_Result type="string">0000</Api_Result>
                    <Api_Result_Message type="string">OK</Api_Result_Message>
                    <Income_Information_child type="record">
                      <Perform_Date type="string">2026-03-22</Perform_Date>
                      <Department_Name type="string">内科</Department_Name>
                      <Cd_Information type="record">
                        <Ac_Money type="string">1200</Ac_Money>
                      </Cd_Information>
                    </Income_Information_child>
                  </incomeinfores>
                </data>
                """);
        OrcaChartSupportResource resource = new OrcaChartSupportResource();
        injectField(resource, "orcaTransport", transport);

        ChartSupportIncomeInfoRequest payload = new ChartSupportIncomeInfoRequest();
        payload.setPatientId("12345");
        payload.setPerformDate("2026-03-22");
        payload.setPerformMonth("2026-03");
        payload.setPerformYear("2026");

        ChartSupportIncomeInfoResponse response = resource.incomeInfo(buildRequest(), payload);

        assertEquals(OrcaEndpoint.INCOME_INFO, transport.endpoint());
        assertTrue(transport.requestXml().contains("<Patient_ID type=\"string\">12345</Patient_ID>"));
        assertTrue(transport.requestXml().contains("<Perform_Date type=\"string\">2026-03-22</Perform_Date>"));
        assertTrue(!transport.requestXml().contains("<Perform_Month type=\"string\">2026-03</Perform_Month>"));
        assertTrue(!transport.requestXml().contains("<Perform_Year type=\"string\">2026</Perform_Year>"));
        assertEquals("0000", response.getApiResult());
        assertEquals(1, response.getEntries().size());
        assertEquals("2026-03-22", response.getEntries().get(0).getPerformDate());
        assertEquals("内科", response.getEntries().get(0).getDepartmentName());
        assertEquals(1200.0, response.getEntries().get(0).getAcMoney(), 0.0001);
        assertNull(response.getEntries().get(0).getIcMoney());
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
        private final String responseXml;
        private OrcaEndpoint endpoint;

        CapturingTransport() {
            this("""
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
                    """);
        }

        CapturingTransport(String responseXml) {
            this.responseXml = responseXml;
        }

        @Override
        public OrcaTransportResult invoke(String facilityId, OrcaEndpoint endpoint, OrcaTransportRequest request) {
            this.endpoint = endpoint;
            requestXml = request.getBody();
            requestNumber = extractTag(requestXml, "Request_Number");
            return OrcaTransportResult.fallback(responseXml, "application/xml");
        }

        String requestXml() {
            return requestXml;
        }

        String requestNumber() {
            return requestNumber;
        }

        OrcaEndpoint endpoint() {
            return endpoint;
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
