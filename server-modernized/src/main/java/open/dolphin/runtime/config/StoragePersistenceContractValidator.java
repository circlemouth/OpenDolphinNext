package open.dolphin.runtime.config;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.ArrayList;
import java.util.List;

@ApplicationScoped
public class StoragePersistenceContractValidator {

    private static final String MODULE_PAYLOAD_TABLE = "opendolphin.d_module_payload";
    private static final String ATTACHMENT_VIOLATION_SQL =
            "select count(*) from opendolphin.d_attachment where nullif(trim(uri), '') is null or nullif(trim(digest), '') is null";
    private static final String IMAGE_VIOLATION_SQL =
            "select count(*) from opendolphin.d_image where nullif(trim(uri), '') is null or nullif(trim(digest), '') is null";
    private static final String TABLE_EXISTS_SQL = "select to_regclass('" + MODULE_PAYLOAD_TABLE + "')";

    @PersistenceContext
    EntityManager entityManager;

    public void validateOrThrow() {
        if (entityManager == null) {
            throw new IllegalStateException("Storage persistence contract validation requires database access");
        }
        List<String> violations = new ArrayList<>();
        if (tableExists()) {
            violations.add("d_module_payload table must not exist");
        }
        long attachmentViolations = singleCount(ATTACHMENT_VIOLATION_SQL);
        if (attachmentViolations > 0) {
            violations.add("external-only contract violation: d_attachment rows missing uri or digest count=" + attachmentViolations);
        }
        long imageViolations = singleCount(IMAGE_VIOLATION_SQL);
        if (imageViolations > 0) {
            violations.add("external-only contract violation: d_image rows missing uri or digest count=" + imageViolations);
        }
        if (!violations.isEmpty()) {
            throw new IllegalStateException("Storage persistence contract validation failed: " + String.join(" | ", violations));
        }
    }

    private boolean tableExists() {
        Object result = entityManager.createNativeQuery(TABLE_EXISTS_SQL).getSingleResult();
        return result != null;
    }

    private long singleCount(String sql) {
        Object result = entityManager.createNativeQuery(sql).getSingleResult();
        if (result instanceof Number number) {
            return number.longValue();
        }
        throw new IllegalStateException("Storage persistence contract validation returned non-numeric count");
    }
}
