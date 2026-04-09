package open.dolphin.rest.orca;

import open.dolphin.infomodel.IInfoModel;

final class OrcaChargeClassCanonicalSupport {

    static final String BASE_CHARGE_CLASS_NAME = OrcaMedicalClassCatalog.BASE_CHARGE_LABEL;
    static final String INSTRUCTION_CHARGE_CLASS_NAME = OrcaMedicalClassCatalog.INSTRUCTION_CHARGE_LABEL;
    static final String RADIOLOGY_CLASS_NAME = OrcaMedicalClassCatalog.RADIOLOGY_LABEL;

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
        if (IInfoModel.ENTITY_RADIOLOGY_ORDER.equals(normalizedEntity)
                && (isBlank(classCode) || OrcaMedicalClassCatalog.isRadiologyClassCode(classCode))) {
            return RADIOLOGY_CLASS_NAME;
        }
        if (IInfoModel.ENTITY_BASE_CHARGE_ORDER.equals(normalizedEntity)) {
            return isBlank(classCode) || OrcaMedicalClassCatalog.isBaseChargeClassCode(classCode) ? BASE_CHARGE_CLASS_NAME : null;
        }
        if (IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER.equals(normalizedEntity)) {
            return isBlank(classCode) || OrcaMedicalClassCatalog.isInstructionChargeClassCode(classCode) ? INSTRUCTION_CHARGE_CLASS_NAME : null;
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
        if (OrcaMedicalClassCatalog.isRadiologyClassCode(medicalClass)) {
            return RADIOLOGY_CLASS_NAME;
        }
        return OrcaMedicalClassCatalog.resolveChargeClassName(medicalClass);
    }

    static OrcaOrderInputSetSupport.ClassMetadata resolveClassMetadata(String receiptCode) {
        String resolvedEntity = OrcaMedicalClassCatalog.resolveChargeEntityFromClassCode(receiptCode);
        String resolvedClassName = OrcaMedicalClassCatalog.resolveChargeClassName(receiptCode);
        if (resolvedEntity != null && resolvedClassName != null) {
            return new OrcaOrderInputSetSupport.ClassMetadata(resolvedEntity, resolvedClassName);
        }
        return null;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
