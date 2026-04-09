package open.dolphin.rest.orca;

import open.dolphin.infomodel.ClaimConst;
import open.dolphin.infomodel.IInfoModel;

final class OrcaChargeClassSupport {

    private static final ChargeClassRule BASE_CHARGE_RULE = new ChargeClassRule(
            IInfoModel.ENTITY_BASE_CHARGE_ORDER, "110", OrcaMedicalClassCatalog.BASE_CHARGE_LABEL);
    private static final ChargeClassRule INSTRUCTION_CHARGE_RULE = new ChargeClassRule(
            IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER, "130", OrcaMedicalClassCatalog.INSTRUCTION_CHARGE_LABEL);

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
        String normalizedClassCode = trimDigits(classCode);
        if (normalizedClassCode != null) {
            String resolvedEntity = OrcaMedicalClassCatalog.resolveChargeEntityFromClassCode(normalizedClassCode);
            if (resolvedEntity == null) {
                return null;
            }
            if (isChargeEntity(entity) && !resolvedEntity.equals(OrcaOrderBundleRequestSupport.normalizeEntityStorage(entity))) {
                return null;
            }
            return OrcaMedicalClassCatalog.resolveChargeClassName(normalizedClassCode);
        }
        ChargeClassRule resolvedRule = resolveRuleByEntity(entity);
        return resolvedRule != null ? resolvedRule.className() : null;
    }

    static ChargeClassMeta resolveCanonicalChargeClassMeta(String entity, String classCode, String itemCategory) {
        ChargeClassRule entityRule = resolveRuleByEntity(entity);
        if (entityRule == null) {
            return null;
        }
        String normalizedCategory = trimDigits(itemCategory);
        if (normalizedCategory != null && isChargeItemCategoryCompatible(entity, normalizedCategory)) {
            return new ChargeClassMeta(normalizedCategory, ClaimConst.CLASS_CODE_ID, entityRule.className());
        }
        String normalizedClassCode = trimDigits(classCode);
        if (normalizedClassCode != null && isChargeClassCompatible(entity, normalizedClassCode)) {
            return new ChargeClassMeta(normalizedClassCode, ClaimConst.CLASS_CODE_ID, entityRule.className());
        }
        return new ChargeClassMeta(entityRule.defaultClassCode(), ClaimConst.CLASS_CODE_ID, entityRule.className());
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

    private static ChargeClassRule resolveRuleByEntity(String entity) {
        String normalizedEntity = OrcaOrderBundleRequestSupport.normalizeEntityStorage(entity);
        if (IInfoModel.ENTITY_BASE_CHARGE_ORDER.equals(normalizedEntity)) {
            return BASE_CHARGE_RULE;
        }
        if (IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER.equals(normalizedEntity)) {
            return INSTRUCTION_CHARGE_RULE;
        }
        return null;
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

    record ChargeClassMeta(String classCode, String classCodeSystem, String className) {
    }

    private record ChargeClassRule(String entity, String defaultClassCode, String className) {
    }
}
