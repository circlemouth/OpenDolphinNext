package open.dolphin.rest.orca;

import open.dolphin.infomodel.IInfoModel;

import java.util.Map;

final class OrcaChargeClassCanonicalSupport {

    private static final Map<String, String> RADIOLOGY_CLASS_NAMES = Map.of(
            "700", "画像診断",
            "701", "画像診断薬剤",
            "702", "画像診断材料",
            "703", "X線フィルム",
            "704", "画像診断加算料",
            "731", "造影剤・注入手技",
            "732", "造影剤・注入手技");
    private static final String RADIOLOGY_DEFAULT_CLASS_CODE = "700";

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
        String normalizedEntity = OrcaOrderBundleRequestSupport.normalizeEntityResponse(entity);
        if (IInfoModel.ENTITY_BASE_CHARGE_ORDER.equals(normalizedEntity)
                || IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER.equals(normalizedEntity)
                || IInfoModel.ENTITY_RADIOLOGY_ORDER.equals(normalizedEntity)) {
            return null;
        }
        return trimToNull(className);
    }

    static String canonicalClassCode(String entity, String classCode) {
        OrcaChargeClassSupport.ChargeClassMeta chargeMeta =
                OrcaChargeClassSupport.resolveCanonicalChargeClassMeta(entity, classCode, null);
        if (chargeMeta != null) {
            return chargeMeta.classCode();
        }
        String normalizedEntity = OrcaOrderBundleRequestSupport.normalizeEntityResponse(entity);
        if (IInfoModel.ENTITY_RADIOLOGY_ORDER.equals(normalizedEntity)) {
            String normalized = trimToNull(classCode);
            if (normalized == null) {
                return RADIOLOGY_DEFAULT_CLASS_CODE;
            }
            return RADIOLOGY_CLASS_NAMES.containsKey(normalized) ? normalized : null;
        }
        if (IInfoModel.ENTITY_BASE_CHARGE_ORDER.equals(normalizedEntity)
                || IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER.equals(normalizedEntity)) {
            String normalized = trimToNull(classCode);
            if (normalized == null) {
                return null;
            }
            return OrcaChargeClassSupport.resolveCanonicalChargeClassName(normalizedEntity, normalized) != null ? normalized : null;
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
        if (IInfoModel.ENTITY_RADIOLOGY_ORDER.equals(normalizedEntity)) {
            String normalized = trimToNull(classCode);
            if (normalized == null) {
                return RADIOLOGY_CLASS_NAMES.get(RADIOLOGY_DEFAULT_CLASS_CODE);
            }
            return RADIOLOGY_CLASS_NAMES.get(normalized);
        }
        if (IInfoModel.ENTITY_BASE_CHARGE_ORDER.equals(normalizedEntity)
                || IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER.equals(normalizedEntity)) {
            return null;
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
        String normalized = trimToNull(medicalClass);
        if (normalized == null) {
            return null;
        }
        String radiology = RADIOLOGY_CLASS_NAMES.get(normalized);
        if (radiology != null) {
            return radiology;
        }
        String chargeCanonical = OrcaChargeClassSupport.resolveCanonicalChargeClassName(null, normalized);
        if (chargeCanonical != null) {
            return chargeCanonical;
        }
        return null;
    }

    static OrcaOrderInputSetSupport.ClassMetadata resolveClassMetadata(String receiptCode) {
        String normalized = trimToNull(receiptCode);
        if (normalized == null) {
            return null;
        }
        String chargeEntity = OrcaChargeClassSupport.resolveChargeEntityFromClassCode(normalized);
        if (chargeEntity != null) {
            String chargeCanonical = OrcaChargeClassSupport.resolveCanonicalClassNameForMedicalClass(normalized);
            if (chargeCanonical != null) {
                return new OrcaOrderInputSetSupport.ClassMetadata(chargeEntity, chargeCanonical);
            }
        }
        if (RADIOLOGY_CLASS_NAMES.containsKey(normalized)) {
            return new OrcaOrderInputSetSupport.ClassMetadata(
                    IInfoModel.ENTITY_RADIOLOGY_ORDER,
                    RADIOLOGY_CLASS_NAMES.get(normalized));
        }
        return null;
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
