package open.dolphin.security.audit;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@ApplicationScoped
public class AuditChainVerifier {

    @Inject
    private AuthoritativeAuditRepository authoritativeAuditRepository;

    @Inject
    private AuditHashService auditHashService;

    public VerificationResult verifyAll() {
        List<String> errors = new ArrayList<>();
        List<AuthoritativeAuditRepository.EventRow> rows = authoritativeAuditRepository.loadAllEvents();
        Long expectedPreviousEventId = null;
        String expectedPreviousHash = null;
        for (AuthoritativeAuditRepository.EventRow row : rows) {
            String payloadHash = auditHashService.hashPayloadJson(row.payloadJson());
            if (!payloadHash.equals(row.payloadHash())) {
                errors.add("payload_hash mismatch for event_id=" + row.eventId());
            }
            String eventHash = auditHashService.computeEventHash(new AuditHashService.EventHashInput(
                    row.eventTime().toString(),
                    row.action(),
                    row.resource(),
                    row.actorId(),
                    row.facilityId(),
                    row.subjectType(),
                    row.subjectId(),
                    row.outcome(),
                    row.httpStatus() != null ? row.httpStatus().toString() : null,
                    row.traceId(),
                    row.requestId(),
                    row.payloadHash(),
                    row.previousEventId() != null ? row.previousEventId().toString() : null,
                    row.previousHash()));
            if (!eventHash.equals(row.eventHash())) {
                errors.add("event_hash mismatch for event_id=" + row.eventId());
            }
            if (!java.util.Objects.equals(expectedPreviousEventId, row.previousEventId())) {
                errors.add("previous_event_id mismatch for event_id=" + row.eventId());
            }
            if (!java.util.Objects.equals(expectedPreviousHash, row.previousHash())) {
                errors.add("previous_hash mismatch for event_id=" + row.eventId());
            }
            expectedPreviousEventId = row.eventId();
            expectedPreviousHash = row.eventHash();
        }
        AuthoritativeAuditRepository.ChainHeadView head = authoritativeAuditRepository.loadChainHead();
        if (!java.util.Objects.equals(expectedPreviousEventId, head.headEventId())) {
            errors.add("chain head event_id mismatch");
        }
        if (!java.util.Objects.equals(expectedPreviousHash, head.headHash())) {
            errors.add("chain head hash mismatch");
        }
        return new VerificationResult(errors.isEmpty(), rows.size(), errors);
    }

    public record VerificationResult(boolean valid, int verifiedEvents, List<String> errors) {
        public VerificationResult {
            errors = errors == null ? List.of() : List.copyOf(errors);
        }

        @Override
        public List<String> errors() {
            return List.copyOf(errors);
        }
    }
}
