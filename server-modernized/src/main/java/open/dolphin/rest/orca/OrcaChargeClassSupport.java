package open.dolphin.rest.orca;

import open.dolphin.infomodel.ClaimConst;
import open.dolphin.infomodel.IInfoModel;

import java.util.Map;

final class OrcaChargeClassSupport {

    private static final ChargeClassRule BASE_CHARGE_RULE = new ChargeClassRule(
            IInfoModel.ENTITY_BASE_CHARGE_ORDER,
            "110",
            Map.of(
                    "110", "初診料",
                    "114", "初診加算料",
                    "120", "再診",
                    "124", "再診加算料"));
    private static final ChargeClassRule INSTRUCTION_CHARGE_RULE = new ChargeClassRule(
            IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER,
            "130",
            Map.of(
                    "130", "管理料",
                    "132", "管理材料",
                    "133", "管理加算料",
                    "140", "在宅料",
                    "141", "在宅薬剤",
                    "142", "在宅材料",
                    "143", "在宅加算料",
                    "148", "在宅薬剤（院外処方）",
                    "149", "在宅材料（院外処方）"));
    private static final Map<String, ChargeClassRule> CHARGE_RULES_BY_ENTITY = Map.of(
            BASE_CHARGE_RULE.entity(), BASE_CHARGE_RULE,
            INSTRUCTION_CHARGE_RULE.entity(), INSTRUCTION_CHARGE_RULE);

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
        ChargeClassRule entityRule = resolveRuleByEntity(entity);
        return entityRule != null && entityRule.isAllowed(normalizedClassCode);
    }

    static boolean isChargeItemCategoryCompatible(String entity, String category) {
        return isChargeClassCompatible(entity, category);
    }

    static String resolveCanonicalChargeClassName(String entity, String classCode) {
        ChargeClassRule entityRule = resolveRuleByEntity(entity);
        ChargeClassRule explicitRule = resolveRuleByClassCode(classCode);
        String normalizedClassCode = trimDigits(classCode);
        if (explicitRule != null) {
            if (entityRule != null && explicitRule != entityRule) {
                return null;
            }
            return explicitRule.className(normalizedClassCode);
        }
        if (entityRule == null) {
            return null;
        }
        if (normalizedClassCode == null) {
            return entityRule.defaultClassName();
        }
        return null;
    }

    static ChargeClassMeta resolveCanonicalChargeClassMeta(String entity, String classCode, String itemCategory) {
        ChargeClassRule entityRule = resolveRuleByEntity(entity);
        if (entityRule == null) {
            return null;
        }
        String normalizedCategory = trimDigits(itemCategory);
        String normalizedClassCode = trimDigits(classCode);
        if (normalizedClassCode != null) {
            ChargeClassRule classRule = resolveRuleByClassCode(normalizedClassCode);
            if (classRule != entityRule) {
                return null;
            }
            return new ChargeClassMeta(normalizedClassCode, ClaimConst.CLASS_CODE_ID, entityRule.className(normalizedClassCode));
        }
        if (normalizedCategory != null) {
            ChargeClassRule categoryRule = resolveRuleByClassCode(normalizedCategory);
            if (categoryRule != entityRule) {
                return null;
            }
            return new ChargeClassMeta(normalizedCategory, ClaimConst.CLASS_CODE_ID, entityRule.className(normalizedCategory));
        }
        return new ChargeClassMeta(entityRule.defaultClassCode(), ClaimConst.CLASS_CODE_ID, entityRule.defaultClassName());
    }

    static String resolveCanonicalClassNameForMedicalClass(String medicalClass) {
        ChargeClassRule rule = resolveRuleByClassCode(medicalClass);
        return rule != null ? rule.className(trimDigits(medicalClass)) : null;
    }

    static String resolveCanonicalClassNameForMedicalClass(String medicalClass, String explicitClassName) {
        String canonical = resolveCanonicalClassNameForMedicalClass(medicalClass);
        return canonical != null ? canonical : OrcaOrderBundleRequestSupport.trimToNull(explicitClassName);
    }

    static OrcaOrderInputSetSupport.ClassMetadata resolveInputSetClassMetadata(String receiptCode) {
        ChargeClassRule rule = resolveRuleByClassCode(receiptCode);
        if (rule == null) {
            return null;
        }
        String normalizedReceiptCode = trimDigits(receiptCode);
        return new OrcaOrderInputSetSupport.ClassMetadata(rule.entity(), rule.className(normalizedReceiptCode));
    }

    private static ChargeClassRule resolveRuleByEntity(String entity) {
        String normalizedEntity = OrcaOrderBundleRequestSupport.normalizeEntityStorage(entity);
        return CHARGE_RULES_BY_ENTITY.get(normalizedEntity);
    }

    private static ChargeClassRule resolveRuleByClassCode(String classCode) {
        String normalizedClassCode = trimDigits(classCode);
        if (normalizedClassCode == null) {
            return null;
        }
        if (BASE_CHARGE_RULE.isAllowed(normalizedClassCode)) {
            return BASE_CHARGE_RULE;
        }
        if (INSTRUCTION_CHARGE_RULE.isAllowed(normalizedClassCode)) {
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

    private record ChargeClassRule(String entity, String defaultClassCode, Map<String, String> classNames) {
        boolean isAllowed(String classCode) {
            return classNames.containsKey(classCode);
        }

        String className(String classCode) {
            return classNames.get(classCode);
        }

        String defaultClassName() {
            return className(defaultClassCode);
        }
    }
}
