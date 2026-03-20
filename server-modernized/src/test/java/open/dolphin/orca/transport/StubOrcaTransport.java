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
    public boolean isStub() {
        return true;
    }

    @Override
    public String invoke(OrcaEndpoint endpoint, String requestXml) {
        String resource = StubOrcaPayloadCatalog.resourceFor(endpoint);
        try (InputStream stream = Thread.currentThread().getContextClassLoader().getResourceAsStream(resource)) {
            if (stream == null) {
                throw new OrcaGatewayException("Stub payload not found: " + resource);
            }
            return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new OrcaGatewayException("Failed to read stub payload for " + endpoint.name(), ex);
        }
    }

    @Override
    public OrcaTransportResult invokeDetailed(OrcaEndpoint endpoint, OrcaTransportRequest request) {
        String body = invoke(endpoint, request != null ? request.getBody() : null);
        String contentType = endpoint != null && endpoint.getAccept() != null
                ? endpoint.getAccept()
                : "application/xml";
        return OrcaTransportResult.fallback(body, contentType);
    }
}
