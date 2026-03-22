package open.dolphin.rest.orca;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.rest.dto.orca.OrderBundleRecommendationResponse;

final class OrcaOrderBundleAggregationSupport {

    private OrcaOrderBundleAggregationSupport() {
    }

    static void upsert(Map<String, RecommendationAggregate> aggregates,
            String key,
            String entity,
            OrderBundleRecommendationResponse.OrderRecommendationTemplate template,
            Date usedAt) {
        RecommendationAggregate current = aggregates.get(key);
        if (current == null) {
            aggregates.put(key, new RecommendationAggregate(key, entity, template, 1, usedAt));
            return;
        }
        Date nextUsedAt = current.lastUsedAt();
        if (usedAt != null && (nextUsedAt == null || usedAt.after(nextUsedAt))) {
            nextUsedAt = usedAt;
        }
        aggregates.put(key, new RecommendationAggregate(
                current.key(),
                current.entity(),
                current.template(),
                current.count() + 1,
                nextUsedAt));
    }

    static List<RecommendationAggregate> sort(Map<String, RecommendationAggregate> aggregates) {
        Comparator<Date> dateComparator = Comparator.nullsLast(Comparator.naturalOrder());
        return aggregates.values().stream()
                .sorted((left, right) -> {
                    if (left.count() != right.count()) {
                        return Integer.compare(right.count(), left.count());
                    }
                    return dateComparator.compare(right.lastUsedAt(), left.lastUsedAt());
                })
                .toList();
    }

    static RecommendationSelection selectRecommendations(
            List<RecommendationAggregate> patientAggregates,
            List<RecommendationAggregate> facilityAggregates,
            int patientLimit,
            int facilityLimit) {
        List<OrderBundleRecommendationResponse.OrderRecommendationEntry> recommendations = new ArrayList<>();
        Map<String, Boolean> usedKeys = new HashMap<>();
        for (RecommendationAggregate aggregate : patientAggregates) {
            if (recommendations.size() >= patientLimit) {
                break;
            }
            recommendations.add(toEntry(aggregate, "patient"));
            usedKeys.put(aggregate.key(), Boolean.TRUE);
        }
        int facilityFallbackApplied = 0;
        for (RecommendationAggregate aggregate : facilityAggregates) {
            if (facilityFallbackApplied >= facilityLimit) {
                break;
            }
            if (usedKeys.containsKey(aggregate.key())) {
                continue;
            }
            recommendations.add(toEntry(aggregate, "facility"));
            usedKeys.put(aggregate.key(), Boolean.TRUE);
            facilityFallbackApplied++;
        }
        return new RecommendationSelection(recommendations, facilityFallbackApplied);
    }

    private static OrderBundleRecommendationResponse.OrderRecommendationEntry toEntry(
            RecommendationAggregate aggregate,
            String source) {
        OrderBundleRecommendationResponse.OrderRecommendationEntry entry =
                new OrderBundleRecommendationResponse.OrderRecommendationEntry();
        entry.setKey(aggregate.key());
        entry.setEntity(aggregate.entity());
        entry.setSource(source);
        entry.setCount(aggregate.count());
        entry.setLastUsedAt(OrcaOrderBundleRequestSupport.formatDate(aggregate.lastUsedAt()));
        entry.setTemplate(aggregate.template());
        return entry;
    }

    record RecommendationSelection(
            List<OrderBundleRecommendationResponse.OrderRecommendationEntry> recommendations,
            int facilityFallbackApplied) {
    }
}

record RecommendationAggregate(
        String key,
        String entity,
        OrderBundleRecommendationResponse.OrderRecommendationTemplate template,
        int count,
        Date lastUsedAt) {
}
