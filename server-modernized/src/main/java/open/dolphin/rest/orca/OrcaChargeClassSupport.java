package open.dolphin.rest.orca;

import open.dolphin.infomodel.ClaimConst;
import open.dolphin.infomodel.IInfoModel;

final class OrcaChargeClassSupport {

    private static final ChargeClassRule BASE_CHARGE_RULE = new ChargeClassRule(
            IInfoModel.ENTITY_BASE_CHARGE_ORDER, 110, 125, "110", "基本診療料");
    private static final ChargeClassRule INSTRUCTION_CHARGE_RULE = new ChargeClassRule(
            IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER, 130, 150, "130", "医学管理等");

    private OrcaChargeClassSupport() {
    }

    static String resolveChargeEntityFromClassCode(String classCode) {
        ChargeClassRule rule = resolveRuleByClassCode(classCode);
        return rule != null ? rule.entity() : null;
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
        return resolveRuleByEntity(entity) == resolveRuleByClassCode(normalizedClassCode);
    }

    static boolean isChargeItemCategoryCompatible(String entity, String category) {
        return isChargeClassCompatible(entity, category);
    }

    static String resolveCanonicalChargeClassName(String entity, String classCode) {
        ChargeClassRule explicitRule = resolveRuleByClassCode(classCode);
        if (explicitRule != null && isChargeEntity(entity) && explicitRule != resolveRuleByEntity(entity)) {
            return null;
        }
        ChargeClassRule resolvedRule = explicitRule != null ? explicitRule : resolveRuleByEntity(entity);
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

    private static ChargeClassRule resolveRuleByClassCode(String classCode) {
        String normalizedClassCode = trimDigits(classCode);
        if (normalizedClassCode == null) {
            return null;
        }
        int numeric = Integer.parseInt(normalizedClassCode);
        if (numeric >= BASE_CHARGE_RULE.min() && numeric <= BASE_CHARGE_RULE.max()) {
            return BASE_CHARGE_RULE;
        }
        if (numeric >= INSTRUCTION_CHARGE_RULE.min() && numeric <= INSTRUCTION_CHARGE_RULE.max()) {
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

    private record ChargeClassRule(String entity, int min, int max, String defaultClassCode, String className) {
    }
}
