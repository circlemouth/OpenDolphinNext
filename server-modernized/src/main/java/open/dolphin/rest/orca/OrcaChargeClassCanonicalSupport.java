package open.dolphin.rest.orca;

import open.dolphin.infomodel.IInfoModel;

final class OrcaChargeClassCanonicalSupport {

    static final String BASE_CHARGE_CLASS_NAME = "基本診療料";
    static final String INSTRUCTION_CHARGE_CLASS_NAME = "医学管理等";
    static final String RADIOLOGY_CLASS_NAME = "放射線";

    private OrcaChargeClassCanonicalSupport() {
    }

    static String canonicalClassName(String entity, String classCode, String className) {
        String canonical = OrcaChargeClassSupport.resolveCanonicalChargeClassName(entity, classCode);
        if (canonical == null) {
            canonical = canonicalClassName(entity, classCode);
        }
        if (canonical != null) {
            return canonical;
        }
        return trimToNull(className);
    }

    static String canonicalClassCode(String entity, String classCode) {
        OrcaChargeClassSupport.ChargeClassMeta chargeMeta =
                OrcaChargeClassSupport.resolveCanonicalChargeClassMeta(entity, classCode, null);
        if (chargeMeta != null) {
            return chargeMeta.classCode();
        }
        String normalized = trimToNull(classCode);
        return normalized;
    }

    static String canonicalClassName(String entity, String classCode) {
        String chargeCanonical = OrcaChargeClassSupport.resolveCanonicalChargeClassName(entity, classCode);
        if (chargeCanonical != null) {
            return chargeCanonical;
        }
        String normalizedEntity = OrcaOrderBundleRequestSupport.normalizeEntityResponse(entity);
        if (IInfoModel.ENTITY_BASE_CHARGE_ORDER.equals(normalizedEntity)) {
            return isBlank(classCode) || isInRange(classCode, 110, 125) ? BASE_CHARGE_CLASS_NAME : null;
        }
        if (IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER.equals(normalizedEntity)) {
            return isBlank(classCode) || isInRange(classCode, 130, 150) ? INSTRUCTION_CHARGE_CLASS_NAME : null;
        }
        return null;
    }

    static String canonicalClassNameForMedicalClass(String medicalClass, String medicalClassName) {
        String canonical = canonicalClassNameForMedicalClass(medicalClass);
        if (canonical != null) {
            return canonical;
        }
        return trimToNull(medicalClassName);
    }

    static String canonicalClassNameForMedicalClass(String medicalClass) {
        if (isInRange(medicalClass, 700, 799)) {
            return RADIOLOGY_CLASS_NAME;
        }
        if (isInRange(medicalClass, 110, 125)) {
            return BASE_CHARGE_CLASS_NAME;
        }
        if (isInRange(medicalClass, 130, 150)) {
            return INSTRUCTION_CHARGE_CLASS_NAME;
        }
        return null;
    }

    static OrcaOrderInputSetSupport.ClassMetadata resolveClassMetadata(String receiptCode) {
        if (isInRange(receiptCode, 110, 125)) {
            return new OrcaOrderInputSetSupport.ClassMetadata(
                    IInfoModel.ENTITY_BASE_CHARGE_ORDER,
                    BASE_CHARGE_CLASS_NAME);
        }
        if (isInRange(receiptCode, 130, 150)) {
            return new OrcaOrderInputSetSupport.ClassMetadata(
                    IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER,
                    INSTRUCTION_CHARGE_CLASS_NAME);
        }
        return null;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static boolean isInRange(String value, int lowerInclusive, int upperInclusive) {
        if (isBlank(value)) {
            return false;
        }
        try {
            int number = Integer.parseInt(value.trim());
            return number >= lowerInclusive && number <= upperInclusive;
        } catch (NumberFormatException ex) {
            return false;
        }
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
