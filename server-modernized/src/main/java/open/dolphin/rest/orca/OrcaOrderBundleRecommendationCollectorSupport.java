package open.dolphin.rest.orca;

import jakarta.persistence.EntityManager;
import java.util.Date;
import java.util.List;
import java.util.Map;
import open.dolphin.infomodel.BundleDolphin;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.ModuleInfoBean;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.rest.dto.orca.OrderBundleRecommendationResponse;
import org.slf4j.Logger;

final class OrcaOrderBundleRecommendationCollectorSupport {

    private OrcaOrderBundleRecommendationCollectorSupport() {
    }

    static int collectFromPatient(
            EntityManager entityManager,
            Logger logger,
            String facilityId,
            String patientId,
            KarteBean karte,
            String entity,
            Date fromDate,
            int scanLimit,
            Map<String, RecommendationAggregate> aggregates,
            DocumentResolver documentResolver,
            BundleDecoder bundleDecoder,
            BundleNameResolver bundleNameResolver) {
        if (entityManager != null && scanLimit > 0) {
            try {
                StringBuilder jpql = new StringBuilder(
                        "SELECT m FROM ModuleModel m JOIN m.karte k JOIN k.patient p "
                                + "WHERE p.facilityId = :facilityId AND p.patientId = :patientId");
                if (entity != null) {
                    jpql.append(" AND m.moduleInfo.entity = :entity");
                }
                if (fromDate != null) {
                    jpql.append(" AND m.started >= :fromDate");
                }
                jpql.append(" ORDER BY m.started DESC");
                var query = entityManager.createQuery(jpql.toString(), ModuleModel.class)
                        .setParameter("facilityId", facilityId)
                        .setParameter("patientId", patientId)
                        .setMaxResults(scanLimit);
                if (entity != null) {
                    query.setParameter("entity", entity);
                }
                if (fromDate != null) {
                    query.setParameter("fromDate", fromDate);
                }
                return collectFromModules(query.getResultList(), entity, aggregates, bundleDecoder, bundleNameResolver);
            } catch (RuntimeException ex) {
                logger.warn(
                        "Failed to load patient order recommendation rows with JPQL, falling back to document scan (facilityId={}, patientId={}, entity={})",
                        facilityId,
                        patientId,
                        entity,
                        ex);
            }
        }
        return collectFromDocuments(
                documentResolver.resolve(karte, fromDate, scanLimit),
                entity,
                aggregates,
                bundleDecoder,
                bundleNameResolver);
    }

    static int collectFromFacility(
            EntityManager entityManager,
            Logger logger,
            String facilityId,
            String patientId,
            String entity,
            Date fromDate,
            int scanLimit,
            Map<String, RecommendationAggregate> aggregates,
            BundleDecoder bundleDecoder,
            BundleNameResolver bundleNameResolver) {
        if (entityManager == null || scanLimit <= 0) {
            return 0;
        }
        StringBuilder jpql = new StringBuilder(
                "SELECT m FROM ModuleModel m JOIN m.karte k JOIN k.patient p "
                        + "WHERE p.facilityId = :facilityId AND p.patientId <> :patientId");
        if (entity != null) {
            jpql.append(" AND m.moduleInfo.entity = :entity");
        }
        if (fromDate != null) {
            jpql.append(" AND m.started >= :fromDate");
        }
        jpql.append(" ORDER BY m.started DESC");
        try {
            var query = entityManager.createQuery(jpql.toString(), ModuleModel.class)
                    .setParameter("facilityId", facilityId)
                    .setParameter("patientId", patientId)
                    .setMaxResults(scanLimit);
            if (entity != null) {
                query.setParameter("entity", entity);
            }
            if (fromDate != null) {
                query.setParameter("fromDate", fromDate);
            }
            return collectFromModules(query.getResultList(), entity, aggregates, bundleDecoder, bundleNameResolver);
        } catch (RuntimeException ex) {
            logger.warn("Failed to load facility order recommendation rows (facilityId={}, patientId={}, entity={})",
                    facilityId, patientId, entity, ex);
            return 0;
        }
    }

    static List<RecommendationAggregate> sortAggregates(Map<String, RecommendationAggregate> aggregates) {
        return OrcaOrderBundleAggregationSupport.sort(aggregates);
    }

    static int clampLimit(Integer value, int fallback, int maxLimit) {
        if (value == null) {
            return fallback;
        }
        return Math.max(1, Math.min(maxLimit, value));
    }

    static int clampOptionalLimit(Integer value, int fallback, int maxLimit) {
        if (value == null) {
            return Math.max(0, Math.min(maxLimit, fallback));
        }
        return Math.max(0, Math.min(maxLimit, value));
    }

    static int clampScanLimit(Integer value, int fallback, int maxLimit) {
        if (value == null) {
            return fallback;
        }
        return Math.max(1, Math.min(maxLimit, value));
    }

    private static int collectFromDocuments(
            List<DocumentModel> documents,
            String entity,
            Map<String, RecommendationAggregate> aggregates,
            BundleDecoder bundleDecoder,
            BundleNameResolver bundleNameResolver) {
        if (documents == null || documents.isEmpty()) {
            return 0;
        }
        int scanned = 0;
        for (DocumentModel document : documents) {
            if (document.getModules() == null || document.getModules().isEmpty()) {
                continue;
            }
            for (ModuleModel module : document.getModules()) {
                scanned += collectModule(document, module, entity, aggregates, bundleDecoder, bundleNameResolver);
            }
        }
        return scanned;
    }

    private static int collectFromModules(
            List<ModuleModel> modules,
            String entity,
            Map<String, RecommendationAggregate> aggregates,
            BundleDecoder bundleDecoder,
            BundleNameResolver bundleNameResolver) {
        if (modules == null || modules.isEmpty()) {
            return 0;
        }
        int scanned = 0;
        for (ModuleModel module : modules) {
            scanned += collectModule(null, module, entity, aggregates, bundleDecoder, bundleNameResolver);
        }
        return scanned;
    }

    private static int collectModule(
            DocumentModel document,
            ModuleModel module,
            String entity,
            Map<String, RecommendationAggregate> aggregates,
            BundleDecoder bundleDecoder,
            BundleNameResolver bundleNameResolver) {
        String moduleEntity = module.getModuleInfoBean() != null ? module.getModuleInfoBean().getEntity() : null;
        if (!OrcaOrderBundleRequestSupport.hasText(moduleEntity)
                || !OrcaOrderBundleRequestSupport.isValidEntity(moduleEntity)) {
            return 0;
        }
        if (entity != null && !entity.equals(moduleEntity)) {
            return 0;
        }
        BundleDolphin bundle = bundleDecoder.decode(module);
        if (bundle == null) {
            return 0;
        }
        OrderBundleRecommendationResponse.OrderRecommendationTemplate template =
                OrcaOrderBundleRecommendationSupport.toRecommendationTemplate(
                        bundleNameResolver.resolve(bundle, module.getModuleInfoBean()),
                        bundle,
                        moduleEntity);
        String key = OrcaOrderBundleRecommendationSupport.buildRecommendationKey(moduleEntity, template);
        Date usedAt = module.getStarted() != null ? module.getStarted() : document != null ? document.getStarted() : null;
        OrcaOrderBundleAggregationSupport.upsert(aggregates, key, moduleEntity, template, usedAt);
        return 1;
    }

    @FunctionalInterface
    interface DocumentResolver {
        List<DocumentModel> resolve(KarteBean karte, Date fromDate, int limit);
    }

    @FunctionalInterface
    interface BundleDecoder {
        BundleDolphin decode(ModuleModel module);
    }

    @FunctionalInterface
    interface BundleNameResolver {
        String resolve(BundleDolphin bundle, ModuleInfoBean info);
    }
}
