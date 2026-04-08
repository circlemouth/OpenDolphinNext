package open.dolphin.rest.orca;

final class OrcaSendabilityPolicy {

    enum EntityMode {
        SENDABLE,
        IMPORT_ONLY,
        LOCAL_ONLY,
        UNKNOWN
    }

    private OrcaSendabilityPolicy() {
    }

    static EntityMode entityMode(String entity) {
        String normalized = OrcaMedicalClassCatalog.normalizeEntity(entity);
        if (OrcaMedicalClassCatalog.isSendableEntity(normalized)) {
            return EntityMode.SENDABLE;
        }
        if (OrcaMedicalClassCatalog.isImportOnlyEntity(normalized)) {
            return EntityMode.IMPORT_ONLY;
        }
        if (OrcaMedicalClassCatalog.isLocalOnlyEntity(normalized)) {
            return EntityMode.LOCAL_ONLY;
        }
        return EntityMode.UNKNOWN;
    }

    static boolean isSendableEntity(String entity) {
        return entityMode(entity) == EntityMode.SENDABLE;
    }

    static boolean isImportOnlyEntity(String entity) {
        return entityMode(entity) == EntityMode.IMPORT_ONLY;
    }

    static boolean isLocalOnlyEntity(String entity) {
        return entityMode(entity) == EntityMode.LOCAL_ONLY;
    }

    static boolean blocksSelectionCommentParameter() {
        return !OrcaCommentCarrierRules.isSelectionCommentParameterAllowed();
    }

    static boolean blocksAdminCodeWireCarrier(String entity) {
        return true;
    }

    static boolean blocksUsage(String entity) {
        return OrcaMedicalClassCatalog.isMedOrderUsageBlocked(entity);
    }

    static boolean supportsBodyPartField(String entity) {
        return OrcaMedicalClassCatalog.supportsBodyPartField(entity);
    }

    static boolean requiresSendableMainRow(String entity) {
        return OrcaMedicalClassCatalog.requiresSendableMainRow(entity);
    }
}
