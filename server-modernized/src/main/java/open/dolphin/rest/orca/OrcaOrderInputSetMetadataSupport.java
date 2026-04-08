package open.dolphin.rest.orca;

import open.dolphin.infomodel.IInfoModel;
import org.slf4j.Logger;

final class OrcaOrderInputSetMetadataSupport {

    static final String UNSUPPORTED_ENTITY = "unsupportedOrder";
    static final String UNSUPPORTED_CLASS_NAME = "unsupported";

    private OrcaOrderInputSetMetadataSupport() {
    }

    static OrcaOrderInputSetSupport.ClassMetadata resolveClassMetadata(String receiptCode, Logger logger) {
        try {
            OrcaOrderInputSetSupport.ClassMetadata chargeMetadata =
                    OrcaChargeClassSupport.resolveInputSetClassMetadata(receiptCode);
            if (chargeMetadata != null) {
                return chargeMetadata;
            }
            String normalizedReceiptCode = receiptCode != null ? receiptCode.trim() : null;
            String exactEntity = OrcaMedicalClassCatalog.resolveEntityForClassCode(normalizedReceiptCode);
            if (exactEntity != null) {
                String exactClassName = OrcaMedicalClassCatalog.resolveExactClassName(exactEntity, normalizedReceiptCode);
                String fallbackLabel = OrcaMedicalClassCatalog.resolveEntityLabel(exactEntity);
                return new OrcaOrderInputSetSupport.ClassMetadata(
                        exactEntity,
                        exactClassName != null ? exactClassName : fallbackLabel);
            }
            int number = Integer.parseInt(receiptCode);
            if (number >= 200 && number <= 299) {
                return new OrcaOrderInputSetSupport.ClassMetadata(IInfoModel.ENTITY_MED_ORDER, "RP");
            }
            if (number >= 300 && number <= 399) {
                return new OrcaOrderInputSetSupport.ClassMetadata(IInfoModel.ENTITY_INJECTION_ORDER, "注射");
            }
        } catch (NumberFormatException e) {
            logger.debug("Failed to resolve entity from receipt code {}", receiptCode);
        }
        logger.warn("Rejecting unsupported ORCA input-set receipt code {}", receiptCode);
        return new OrcaOrderInputSetSupport.ClassMetadata(UNSUPPORTED_ENTITY, UNSUPPORTED_CLASS_NAME);
    }

    static boolean isSupportedEntity(String entity) {
        return entity != null && !entity.isBlank() && !UNSUPPORTED_ENTITY.equals(entity);
    }
}
