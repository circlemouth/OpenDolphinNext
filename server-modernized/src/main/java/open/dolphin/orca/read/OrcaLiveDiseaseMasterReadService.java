package open.dolphin.orca.read;

import java.util.List;
import java.util.Map;
import open.orca.rest.LocalOrcaMasterCacheRepository;

public class OrcaLiveDiseaseMasterReadService {

    private final LocalOrcaMasterCacheRepository repository;

    public OrcaLiveDiseaseMasterReadService(LocalOrcaMasterCacheRepository repository) {
        this.repository = repository;
    }

    public List<Map<String, Object>> queryEntries(String term, String referenceDate, boolean partial) {
        return repository().queryDiseaseCandidates(term, referenceDate, partial);
    }

    private LocalOrcaMasterCacheRepository repository() {
        if (repository == null) {
            throw new LocalOrcaMasterCacheRepository.LocalMasterUnavailableException(null);
        }
        return repository;
    }
}
