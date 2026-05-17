package open.dolphin.rest.orca;

import java.util.List;
import open.dolphin.orca.read.OrcaOrderInputSetReadService;
import open.dolphin.rest.dto.orca.OrcaOrderInputSetDetailResponse;
import open.dolphin.rest.dto.orca.OrcaOrderInputSetListResponse;
import open.orca.rest.LocalOrcaMasterCacheRepository;

final class OrcaOrderInputSetSupport {

    private OrcaOrderInputSetSupport() {
    }

    static List<OrcaOrderInputSetListResponse.Item> loadInputSetSummaries(
            LocalOrcaMasterCacheRepository repository,
            String keyword,
            String effective,
            String claimClassSystem,
            ClassMetadataResolver classMetadataResolver) {
        return repository.searchInputSetSummaries(keyword, effective, claimClassSystem);
    }

    static OrcaOrderInputSetDetailResponse.Bundle loadInputSetDetail(
            LocalOrcaMasterCacheRepository repository,
            String setCode,
            String effective,
            String requestedName,
            String bodyPartCodePrefix,
            String claimClassSystem,
            ClassMetadataResolver classMetadataResolver) {
        return repository.findInputSetDetail(setCode, effective, requestedName, bodyPartCodePrefix, claimClassSystem);
    }

    static String normalizeClassCode(String inputCode) {
        return OrcaOrderInputSetReadService.normalizeClassCode(inputCode);
    }

    static OrcaOrderInputSetDetailResponse.BodyPart toBodyPart(OrcaOrderInputSetDetailResponse.Item item) {
        return OrcaOrderInputSetReadService.toBodyPart(item);
    }

    @FunctionalInterface
    interface ClassMetadataResolver {
        ClassMetadata resolve(String classCode);
    }

    record ClassMetadata(String entity, String className) {
    }
}
