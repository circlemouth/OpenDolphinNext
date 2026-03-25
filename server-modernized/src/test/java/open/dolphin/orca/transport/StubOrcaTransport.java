package open.dolphin.orca.transport;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import open.dolphin.orca.OrcaGatewayException;

/**
 * Test-only file based transport that returns canned ORCA payloads.
 */
public class StubOrcaTransport implements OrcaTransport {

    @Override
    public OrcaTransportResult invoke(String facilityId, OrcaEndpoint endpoint, OrcaTransportRequest request) {
        String resource = StubOrcaPayloadCatalog.resourceFor(endpoint);
        try (InputStream stream = Thread.currentThread().getContextClassLoader().getResourceAsStream(resource)) {
            if (stream == null) {
                throw new OrcaGatewayException("Stub payload not found: " + resource);
            }
            String body = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
            String contentType = endpoint != null && endpoint.getAccept() != null
                    ? endpoint.getAccept()
                    : "application/xml";
            return OrcaTransportResult.fallback(body, contentType);
        } catch (IOException ex) {
            throw new OrcaGatewayException("Failed to read stub payload for " + endpoint.name(), ex);
        }
    }
}
