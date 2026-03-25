package open.dolphin.orca.transport;

/**
 * Abstraction for invoking ORCA APIs.
 */
public interface OrcaTransport {

    /**
     * Execute the given ORCA endpoint.
     *
     * @param facilityId explicit facilityId resolved at request edge/caller boundary
     * @param endpoint target ORCA API
     * @param request request envelope
     * @return detailed transport result
     */
    OrcaTransportResult invoke(String facilityId, OrcaEndpoint endpoint, OrcaTransportRequest request);

}
