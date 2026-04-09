package open.dolphin.rest.orca;

import open.dolphin.infomodel.IInfoModel;

final class OrcaChargeClassCanonicalSupport {

    static final String BASE_CHARGE_CLASS_NAME = OrcaMedicalClassCatalog.BASE_CHARGE_LABEL;
    static final String INSTRUCTION_CHARGE_CLASS_NAME = OrcaMedicalClassCatalog.INSTRUCTION_CHARGE_LABEL;
    static final String RADIOLOGY_CLASS_NAME = OrcaMedicalClassCatalog.RADIOLOGY_LABEL;

    private OrcaChargeClassCanonicalSupport() {
    }

    static String canonicalClassName(String entity, String classCode, String className) {
        String canonical = canonicalClassName(entity, classCode);
        if (canonical != null) {
            return canonical;
        }
        String normalizedEntity = OrcaMedicalClassCatalog.normalizeEntity(entity);
        if (IInfoModel.ENTITY_RADIOLOGY_ORDER.equals(normalizedEntity)) {
            return OrcaMedicalClassCatalog.normalizeRadiologyLabel(className);
        }
        return OrcaMedicalClassCatalog.trimToNull(className);
    }

    static String canonicalClassCode(String entity, String classCode) {
        OrcaChargeClassSupport.ChargeClassMeta chargeMeta =
                OrcaChargeClassSupport.resolveCanonicalChargeClassMeta(entity, classCode, null);
        if (chargeMeta != null) {
            return chargeMeta.classCode();
        }
        return OrcaMedicalClassCatalog.trimToNull(classCode);
    }

    static String canonicalClassName(String entity, String classCode) {
        String normalizedEntity = OrcaMedicalClassCatalog.normalizeEntity(entity);
        String normalizedClassCode = OrcaMedicalClassCatalog.trimToNull(classCode);
        if (normalizedClassCode != null) {
            return OrcaMedicalClassCatalog.resolveExactClassName(normalizedEntity, normalizedClassCode);
        }
        OrcaMedicalClassCatalog.ClassMeta defaultMeta = OrcaMedicalClassCatalog.resolveDefaultClassMeta(normalizedEntity);
        if (defaultMeta == null) {
            return null;
        }
        return isCanonicalizedEntity(normalizedEntity) ? defaultMeta.className() : null;
    }

    static String canonicalClassNameForMedicalClass(String medicalClass, String medicalClassName) {
        String canonical = canonicalClassNameForMedicalClass(medicalClass);
        if (canonical != null) {
            return canonical;
        }
        return OrcaMedicalClassCatalog.trimToNull(medicalClassName);
    }

    static String canonicalClassNameForMedicalClass(String medicalClass) {
        return OrcaMedicalClassCatalog.resolveExactClassName(null, medicalClass);
    }

    static OrcaOrderInputSetSupport.ClassMetadata resolveClassMetadata(String receiptCode) {
        OrcaOrderInputSetSupport.ClassMetadata metadata = OrcaMedicalClassCatalog.resolveInputSetClassMetadata(receiptCode);
        if (metadata == null || !isCanonicalizedEntity(metadata.entity())) {
            return null;
        }
        return metadata;
    }

    private static boolean isCanonicalizedEntity(String entity) {
        String normalizedEntity = OrcaMedicalClassCatalog.normalizeEntity(entity);
        return IInfoModel.ENTITY_RADIOLOGY_ORDER.equals(normalizedEntity)
                || OrcaChargeClassSupport.isChargeEntity(normalizedEntity);
    }
}
