package open.dolphin.orca.transport;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.InputStream;
import org.junit.jupiter.api.Test;

class OrcaEndpointStubResourceTest {

    @Test
    void everyEndpointStubResourceExistsOnClasspath() throws IOException {
        ClassLoader loader = Thread.currentThread().getContextClassLoader();
        for (OrcaEndpoint endpoint : OrcaEndpoint.values()) {
            String resourcePath = StubOrcaPayloadCatalog.resourceFor(endpoint);
            assertNotNull(resourcePath, "Stub resource path is null for endpoint " + endpoint.name());

            try (InputStream stream = loader.getResourceAsStream(resourcePath)) {
                assertNotNull(stream,
                        "Missing ORCA stub resource for endpoint " + endpoint.name() + ": " + resourcePath);
                byte[] bytes = stream.readAllBytes();
                assertFalse(bytes.length == 0,
                        "Empty ORCA stub resource for endpoint " + endpoint.name() + ": " + resourcePath);
            }
        }
    }

    @Test
    void patientAppointmentListEndpointCarriesClassQueryFromPayloadMeta() {
        assertEquals("/api01rv2/appointlst2v2", OrcaEndpoint.PATIENT_APPOINTMENT_LIST.getPath());
        assertTrue(OrcaEndpoint.PATIENT_APPOINTMENT_LIST.usesQueryFromMeta());
        assertEquals("orca/stub/15_appointlst2v2_response.sample.xml",
                StubOrcaPayloadCatalog.resourceFor(OrcaEndpoint.PATIENT_APPOINTMENT_LIST));
    }

    @Test
    void insuranceCombinationEndpointUsesPatientlst6StubPayload() {
        assertEquals("/api01rv2/patientlst6v2", OrcaEndpoint.INSURANCE_COMBINATION.getPath());
        assertEquals("orca/stub/35_patientlst6v2_response.sample.xml",
                StubOrcaPayloadCatalog.resourceFor(OrcaEndpoint.INSURANCE_COMBINATION));
    }
}
