package open.dolphin.orca.read;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import open.dolphin.rest.dto.orca.OrcaOrderInteractionCheckResponse;
import open.orca.rest.LocalOrcaMasterCacheRepository;

public class OrcaOrderInteractionReadService {

    private final LocalOrcaMasterCacheRepository repository;

    public OrcaOrderInteractionReadService(LocalOrcaMasterCacheRepository repository) {
        this.repository = repository;
    }

    public List<String> sanitizeCodes(List<String> source) {
        if (source == null || source.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (String value : source) {
            String normalized = trimToNull(value);
            if (normalized != null) {
                unique.add(normalized);
            }
        }
        return new ArrayList<>(unique);
    }

    public List<OrcaOrderInteractionCheckResponse.Pair> loadInteractionPairs(
            List<String> codes,
            List<String> existingCodes) {
        return repository().findInteractionPairs(codes, existingCodes);
    }

    private LocalOrcaMasterCacheRepository repository() {
        if (repository == null) {
            throw new LocalOrcaMasterCacheRepository.LocalMasterUnavailableException(null);
        }
        return repository;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
