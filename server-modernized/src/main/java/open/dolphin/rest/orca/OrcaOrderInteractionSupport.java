package open.dolphin.rest.orca;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import open.dolphin.orca.read.OrcaOrderInteractionReadService;
import open.dolphin.rest.dto.orca.OrcaOrderInteractionCheckResponse;
import open.orca.rest.LocalOrcaMasterCacheRepository;

final class OrcaOrderInteractionSupport {

    private OrcaOrderInteractionSupport() {
    }

    static List<String> sanitizeCodes(List<String> source) {
        if (source == null || source.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (String value : source) {
            String normalized = OrcaOrderBundleRequestSupport.trimToNull(value);
            if (normalized != null) {
                unique.add(normalized);
            }
        }
        return new ArrayList<>(unique);
    }

    static List<OrcaOrderInteractionCheckResponse.Pair> loadInteractionPairs(
            LocalOrcaMasterCacheRepository repository,
            List<String> codes,
            List<String> existingCodes) {
        return new OrcaOrderInteractionReadService(repository).loadInteractionPairs(codes, existingCodes);
    }
}
