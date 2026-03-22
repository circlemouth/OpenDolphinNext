package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.rest.dto.orca.OrderBundleRecommendationResponse;
import org.junit.jupiter.api.Test;

class OrcaOrderBundleAggregationSupportTest {

    @Test
    void upsertAndSortPreferHigherCountThenNewerUsage() {
        Map<String, RecommendationAggregate> aggregates = new LinkedHashMap<>();
        OrderBundleRecommendationResponse.OrderRecommendationTemplate template =
                new OrderBundleRecommendationResponse.OrderRecommendationTemplate();

        OrcaOrderBundleAggregationSupport.upsert(aggregates, "a", "medOrder", template, new Date(1000L));
        OrcaOrderBundleAggregationSupport.upsert(aggregates, "b", "medOrder", template, new Date(3000L));
        OrcaOrderBundleAggregationSupport.upsert(aggregates, "a", "medOrder", template, new Date(2000L));

        List<RecommendationAggregate> sorted = OrcaOrderBundleAggregationSupport.sort(aggregates);

        assertEquals(2, sorted.size());
        assertEquals("a", sorted.get(0).key());
        assertEquals(2, sorted.get(0).count());
        assertEquals(new Date(2000L), sorted.get(0).lastUsedAt());
        assertEquals("b", sorted.get(1).key());
    }

    @Test
    void selectRecommendationsSkipsDuplicateFacilityKeys() {
        OrderBundleRecommendationResponse.OrderRecommendationTemplate template =
                new OrderBundleRecommendationResponse.OrderRecommendationTemplate();
        RecommendationAggregate patient = new RecommendationAggregate("shared", "medOrder", template, 2, new Date(2000L));
        RecommendationAggregate facilityDuplicate = new RecommendationAggregate("shared", "medOrder", template, 5, new Date(3000L));
        RecommendationAggregate facilityUnique = new RecommendationAggregate("facility-only", "medOrder", template, 1, new Date(1000L));

        OrcaOrderBundleAggregationSupport.RecommendationSelection selection =
                OrcaOrderBundleAggregationSupport.selectRecommendations(
                        List.of(patient),
                        List.of(facilityDuplicate, facilityUnique),
                        8,
                        2);

        assertEquals(2, selection.recommendations().size());
        assertEquals("patient", selection.recommendations().get(0).getSource());
        assertEquals("shared", selection.recommendations().get(0).getKey());
        assertEquals("facility", selection.recommendations().get(1).getSource());
        assertEquals("facility-only", selection.recommendations().get(1).getKey());
        assertEquals(1, selection.facilityFallbackApplied());
    }
}
