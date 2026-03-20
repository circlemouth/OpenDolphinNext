package open.dolphin.orca.transport;

/**
 * Abstraction for invoking ORCA APIs.
 */
public interface OrcaTransport {

    /**
     * Execute the given ORCA endpoint.
     *
     * @param endpoint target ORCA API
     * @param requestXml serialized payload (currently unused by stub implementation)
     * @return ORCA XML payload as UTF-8 string
     */
    String invoke(OrcaEndpoint endpoint, String requestXml);

    /**
     * Execute the given ORCA endpoint and return detailed response information.
     */
    default OrcaTransportResult invokeDetailed(OrcaEndpoint endpoint, OrcaTransportRequest request) {
        String body = invoke(endpoint, request != null ? request.getBody() : null);
        String contentType = endpoint != null && endpoint.getAccept() != null
                ? endpoint.getAccept()
                : "application/xml";
        return OrcaTransportResult.fallback(body, contentType);
    }

}
