package open.dolphin.rest.orca;

import jakarta.persistence.EntityManager;
import open.dolphin.infomodel.BundleDolphin;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.ModuleInfoBean;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.UserModel;
import org.slf4j.Logger;

final class OrcaOrderBundleDisplaySupport {

    private OrcaOrderBundleDisplaySupport() {
    }

    static BundleDolphin decodeBundle(EntityManager entityManager, Logger logger, ModuleModel module) {
        if (module == null) {
            return null;
        }
        if (module.getModel() instanceof BundleDolphin bundle) {
            return bundle;
        }
        Object decoded = ModelUtils.decodeModule(module);
        if (decoded instanceof BundleDolphin bundle) {
            return bundle;
        }
        return decodeBundleFromDatabase(entityManager, logger, module);
    }

    static String resolveBundleName(BundleDolphin bundle, ModuleInfoBean info) {
        if (bundle.getOrderName() != null && !bundle.getOrderName().isBlank()) {
            return bundle.getOrderName();
        }
        if (info != null && info.getStampName() != null && !info.getStampName().isBlank()) {
            return info.getStampName();
        }
        return "—";
    }

    static UserModel resolveEnteredByUser(ModuleModel module, DocumentModel document) {
        if (module != null && module.getUserModel() != null) {
            return module.getUserModel();
        }
        if (document != null) {
            return document.getUserModel();
        }
        return null;
    }

    static String resolveEnteredByName(UserModel user) {
        if (user == null) {
            return null;
        }
        if (OrcaOrderBundleRequestSupport.hasText(user.getCommonName())) {
            return user.getCommonName().trim();
        }
        if (OrcaOrderBundleRequestSupport.hasText(user.getUserId())) {
            return user.getUserId().trim();
        }
        return null;
    }

    static String resolveEnteredByRole(UserModel user) {
        if (user != null && user.getLicenseModel() != null) {
            if (OrcaOrderBundleRequestSupport.hasText(user.getLicenseModel().getLicenseDesc())) {
                return user.getLicenseModel().getLicenseDesc().trim();
            }
            if (OrcaOrderBundleRequestSupport.hasText(user.getLicenseModel().getLicense())) {
                return user.getLicenseModel().getLicense().trim();
            }
        }
        return "医師";
    }

    private static BundleDolphin decodeBundleFromDatabase(EntityManager entityManager, Logger logger, ModuleModel module) {
        if (entityManager == null || module == null || module.getId() <= 0) {
            return null;
        }
        Object row;
        try {
            row = entityManager
                    .createNativeQuery("SELECT CAST(bean_json AS text) FROM d_module WHERE id = ?1")
                    .setParameter(1, module.getId())
                    .getSingleResult();
        } catch (Exception ex) {
            logger.warn("Failed to fetch module payload for order bundle id={}", module.getId(), ex);
            return null;
        }
        return decodeBundleFromJson(row != null ? row.toString() : null);
    }

    private static BundleDolphin decodeBundleFromJson(String beanJsonRaw) {
        if (beanJsonRaw == null || beanJsonRaw.isBlank()) {
            return null;
        }
        Object decoded = ModelUtils.decodeModuleJson(beanJsonRaw);
        if (decoded instanceof BundleDolphin bundle) {
            return bundle;
        }
        return null;
    }
}
