package open.dolphin.orca.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import open.dolphin.orca.converter.OrcaXmlMapper;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.orca.transport.StubOrcaTransport;
import open.dolphin.rest.dto.orca.InsuranceCombinationRequest;
import open.dolphin.rest.dto.orca.PatientAppointmentListRequest;
import org.junit.jupiter.api.Test;

class OrcaLiveGatewayReadOnlyContractPayloadTest {

    @Test
    void patientAppointmentListTransportPayloadIncludesClass01Meta() {
        CapturingTransport transport = new CapturingTransport(new StubOrcaTransport());
        OrcaLiveGateway service = new DefaultOrcaLiveGateway(transport, new OrcaXmlMapper());
        PatientAppointmentListRequest request = new PatientAppointmentListRequest();
        request.setPatientId("000019");
        request.setBaseDate(LocalDate.of(2026, 4, 20));
        request.setDepartmentCode("01");

        service.getPatientAppointments("F001", request);

        assertEquals(OrcaEndpoint.PATIENT_APPOINTMENT_LIST, transport.lastEndpoint);
        assertNotNull(transport.lastPayload);
        assertTrue(transport.lastPayload.contains("query=class=01"));
        assertTrue(transport.lastPayload.contains("<appointlst2req>"));
        assertTrue(transport.lastPayload.contains("<Patient_ID>000019</Patient_ID>"));
        assertTrue(transport.lastPayload.contains("<Base_Date>2026-04-20</Base_Date>"));
        assertFalse(transport.lastPayload.contains("<Department_Code>"));
    }

    @Test
    void insuranceCombinationTransportPayloadUsesPatientlst6RequestContract() {
        CapturingTransport transport = new CapturingTransport(new StubOrcaTransport());
        OrcaLiveGateway service = new DefaultOrcaLiveGateway(transport, new OrcaXmlMapper());
        InsuranceCombinationRequest request = new InsuranceCombinationRequest();
        request.setPatientId("000019");
        request.setBaseDate("2026-04-20");
        request.setRangeStart("2026-04-01");
        request.setRangeEnd("2026-04-30");

        service.getInsuranceCombinations("F001", request);

        assertEquals(OrcaEndpoint.INSURANCE_COMBINATION, transport.lastEndpoint);
        assertNotNull(transport.lastPayload);
        assertTrue(transport.lastPayload.contains("<patientlst6req>"));
        assertTrue(transport.lastPayload.contains("<Reqest_Number>01</Reqest_Number>"));
        assertTrue(transport.lastPayload.contains("<Patient_ID>000019</Patient_ID>"));
        assertTrue(transport.lastPayload.contains("<Base_Date>2026-04-20</Base_Date>"));
        assertTrue(transport.lastPayload.contains("<Start_Date>2026-04-01</Start_Date>"));
        assertTrue(transport.lastPayload.contains("<End_Date>2026-04-30</End_Date>"));
        assertFalse(transport.lastPayload.contains("insurancecombinationreq"));
        assertFalse(transport.lastPayload.contains("Perform_Date"));
    }

    private static final class CapturingTransport implements OrcaTransport {
        private final OrcaTransport delegate;
        private OrcaEndpoint lastEndpoint;
        private String lastPayload;

        private CapturingTransport(OrcaTransport delegate) {
            this.delegate = delegate;
        }

        @Override
        public OrcaTransportResult invoke(String facilityId, OrcaEndpoint endpoint, OrcaTransportRequest request) {
            lastEndpoint = endpoint;
            lastPayload = request != null ? request.getBody() : null;
            return delegate.invoke(facilityId, endpoint, request);
        }
    }
}
