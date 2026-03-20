package open.dolphin.orca.transport;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

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
}
