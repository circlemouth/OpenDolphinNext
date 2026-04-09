package open.dolphin.rest.orca;

import open.dolphin.infomodel.ClaimConst;
import open.dolphin.infomodel.IInfoModel;

final class OrcaChargeClassSupport {

    private OrcaChargeClassSupport() {
    }

    static String resolveChargeEntityFromClassCode(String classCode) {
        return OrcaMedicalClassCatalog.resolveChargeEntityFromClassCode(classCode);
    }

    static boolean isChargeEntity(String entity) {
        String normalizedEntity = OrcaOrderBundleRequestSupport.normalizeEntityStorage(entity);
        return IInfoModel.ENTITY_BASE_CHARGE_ORDER.equals(normalizedEntity)
                || IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER.equals(normalizedEntity);
    }

    static boolean isChargeClassCompatible(String entity, String classCode) {
        if (!isChargeEntity(entity)) {
            return false;
        }
        String normalizedClassCode = trimDigits(classCode);
        if (normalizedClassCode == null) {
            return false;
        }
        String resolvedEntity = OrcaMedicalClassCatalog.resolveChargeEntityFromClassCode(normalizedClassCode);
        return resolvedEntity != null && resolvedEntity.equals(OrcaOrderBundleRequestSupport.normalizeEntityStorage(entity));
    }

    static boolean isChargeItemCategoryCompatible(String entity, String category) {
        return isChargeClassCompatible(entity, category);
    }

    static String resolveCanonicalChargeClassName(String entity, String classCode) {
        String normalizedEntity = OrcaMedicalClassCatalog.normalizeEntity(entity);
        String normalizedClassCode = trimDigits(classCode);
        if (normalizedClassCode != null) {
            String resolvedEntity = OrcaMedicalClassCatalog.resolveChargeEntityFromClassCode(normalizedClassCode);
            if (resolvedEntity == null) {
                return null;
            }
            if (isChargeEntity(normalizedEntity) && !resolvedEntity.equals(normalizedEntity)) {
                return null;
            }
            return OrcaMedicalClassCatalog.resolveExactClassName(resolvedEntity, normalizedClassCode);
        }
        OrcaMedicalClassCatalog.ClassMeta defaultMeta = resolveChargeDefaultClassMeta(normalizedEntity);
        return defaultMeta != null ? defaultMeta.className() : null;
    }

    static ChargeClassMeta resolveCanonicalChargeClassMeta(String entity, String classCode, String itemCategory) {
        String normalizedEntity = OrcaMedicalClassCatalog.normalizeEntity(entity);
        OrcaMedicalClassCatalog.ClassMeta defaultMeta = resolveChargeDefaultClassMeta(normalizedEntity);
        if (defaultMeta == null) {
            return null;
        }
        String normalizedCategory = trimDigits(itemCategory);
        if (normalizedCategory != null && isChargeItemCategoryCompatible(normalizedEntity, normalizedCategory)) {
            return new ChargeClassMeta(normalizedCategory, ClaimConst.CLASS_CODE_ID, defaultMeta.className());
        }
        String normalizedClassCode = trimDigits(classCode);
        if (normalizedClassCode != null && isChargeClassCompatible(normalizedEntity, normalizedClassCode)) {
            return new ChargeClassMeta(normalizedClassCode, ClaimConst.CLASS_CODE_ID, defaultMeta.className());
        }
        return new ChargeClassMeta(defaultMeta.classCode(), ClaimConst.CLASS_CODE_ID, defaultMeta.className());
    }

    static String resolveCanonicalClassNameForMedicalClass(String medicalClass) {
        return OrcaMedicalClassCatalog.resolveChargeClassName(medicalClass);
    }

    static String resolveCanonicalClassNameForMedicalClass(String medicalClass, String explicitClassName) {
        String canonical = resolveCanonicalClassNameForMedicalClass(medicalClass);
        return canonical != null ? canonical : OrcaOrderBundleRequestSupport.trimToNull(explicitClassName);
    }

    static OrcaOrderInputSetSupport.ClassMetadata resolveInputSetClassMetadata(String receiptCode) {
        String resolvedEntity = OrcaMedicalClassCatalog.resolveChargeEntityFromClassCode(receiptCode);
        String resolvedClassName = OrcaMedicalClassCatalog.resolveChargeClassName(receiptCode);
        if (resolvedEntity == null || resolvedClassName == null) {
            return null;
        }
        return new OrcaOrderInputSetSupport.ClassMetadata(resolvedEntity, resolvedClassName);
    }

    private static String trimDigits(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        if (normalized.isEmpty() || !normalized.chars().allMatch(Character::isDigit)) {
            return null;
        }
        return normalized;
    }

    private static OrcaMedicalClassCatalog.ClassMeta resolveChargeDefaultClassMeta(String entity) {
        String normalizedEntity = OrcaMedicalClassCatalog.normalizeEntity(entity);
        if (!isChargeEntity(normalizedEntity)) {
            return null;
        }
        return OrcaMedicalClassCatalog.resolveDefaultClassMeta(normalizedEntity);
    }

    record ChargeClassMeta(String classCode, String classCodeSystem, String className) {
    }
}
