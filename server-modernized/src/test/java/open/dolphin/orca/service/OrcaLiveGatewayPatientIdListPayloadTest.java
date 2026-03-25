package open.dolphin.orca.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import open.dolphin.orca.converter.OrcaXmlMapper;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.orca.transport.StubOrcaTransport;
import open.dolphin.rest.dto.orca.PatientIdListRequest;
import org.junit.jupiter.api.Test;

class OrcaLiveGatewayPatientIdListPayloadTest {

    @Test
    void includeTestPatientTrueSetsExcludeFlagOff() {
        CapturingTransport transport = new CapturingTransport(new StubOrcaTransport());
        OrcaLiveGateway service = new DefaultOrcaLiveGateway(transport, new OrcaXmlMapper());

        PatientIdListRequest request = new PatientIdListRequest();
        request.setStartDate(LocalDate.of(2026, 2, 1));
        request.setEndDate(LocalDate.of(2026, 2, 1));
        request.setIncludeTestPatient(true);

        service.getPatientIdList("F001", request);

        assertEquals("F001", transport.lastFacilityId);
        assertEquals(OrcaEndpoint.PATIENT_ID_LIST, transport.lastEndpoint);
        assertNotNull(transport.lastPayload);
        assertTrue(transport.lastPayload.contains("query=class=01"));
        assertTrue(transport.lastPayload.contains("<Contain_TestPatient_Flag>0</Contain_TestPatient_Flag>"));
    }

    @Test
    void includeTestPatientFalseSetsExcludeFlagOn() {
        CapturingTransport transport = new CapturingTransport(new StubOrcaTransport());
        OrcaLiveGateway service = new DefaultOrcaLiveGateway(transport, new OrcaXmlMapper());

        PatientIdListRequest request = new PatientIdListRequest();
        request.setStartDate(LocalDate.of(2026, 2, 1));
        request.setEndDate(LocalDate.of(2026, 2, 1));
        request.setIncludeTestPatient(false);

        service.getPatientIdList("F001", request);

        assertEquals("F001", transport.lastFacilityId);
        assertTrue(transport.lastPayload.contains("<Contain_TestPatient_Flag>1</Contain_TestPatient_Flag>"));
    }

    private static final class CapturingTransport implements OrcaTransport {
        private final OrcaTransport delegate;
        private String lastFacilityId;
        private OrcaEndpoint lastEndpoint;
        private String lastPayload;

        private CapturingTransport(OrcaTransport delegate) {
            this.delegate = delegate;
        }

        @Override
        public OrcaTransportResult invoke(String facilityId, OrcaEndpoint endpoint, OrcaTransportRequest request) {
            lastFacilityId = facilityId;
            lastEndpoint = endpoint;
            lastPayload = request != null ? request.getBody() : null;
            return delegate.invoke(facilityId, endpoint, request);
        }
    }
}
