package open.dolphin.security.audit;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;

@ApplicationScoped
@Transactional(Transactional.TxType.REQUIRES_NEW)
public class AuditTrailService extends AuthoritativeAuditTrailService {
}
