package open.dolphin.rest.orca;

import open.dolphin.infomodel.IInfoModel;
import org.slf4j.Logger;

final class OrcaOrderInputSetMetadataSupport {

    static final String UNSUPPORTED_ENTITY = "unsupportedOrder";
    static final String UNSUPPORTED_CLASS_NAME = "unsupported";

    private OrcaOrderInputSetMetadataSupport() {
    }

    static OrcaOrderInputSetSupport.ClassMetadata resolveClassMetadata(String receiptCode, Logger logger) {
        OrcaOrderInputSetSupport.ClassMetadata chargeMetadata =
                OrcaChargeClassSupport.resolveInputSetClassMetadata(receiptCode);
        if (chargeMetadata != null) {
            return chargeMetadata;
        }
        OrcaOrderInputSetSupport.ClassMetadata metadata = OrcaMedicalClassCatalog.resolveInputSetClassMetadata(receiptCode);
        if (metadata != null) {
            return metadata;
        }
        logger.debug("Failed to resolve entity from exact receipt code {}", receiptCode);
        logger.warn("Rejecting unsupported ORCA input-set receipt code {}", receiptCode);
        return new OrcaOrderInputSetSupport.ClassMetadata(UNSUPPORTED_ENTITY, UNSUPPORTED_CLASS_NAME);
    }

    static boolean isSupportedEntity(String entity) {
        return entity != null && !entity.isBlank() && !UNSUPPORTED_ENTITY.equals(entity);
    }
}
