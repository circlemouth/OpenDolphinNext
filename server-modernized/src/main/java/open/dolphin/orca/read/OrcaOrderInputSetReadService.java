package open.dolphin.orca.read;

import java.util.List;
import open.dolphin.rest.dto.orca.OrcaOrderInputSetDetailResponse;
import open.dolphin.rest.dto.orca.OrcaOrderInputSetListResponse;
import open.orca.rest.LocalOrcaMasterCacheRepository;

public class OrcaOrderInputSetReadService {

    private final LocalOrcaMasterCacheRepository repository;

    public OrcaOrderInputSetReadService(LocalOrcaMasterCacheRepository repository) {
        this.repository = repository;
    }

    public List<OrcaOrderInputSetListResponse.Item> loadInputSetSummaries(
            String keyword,
            String effective,
            String claimClassSystem,
            ClassMetadataResolver classMetadataResolver) {
        return repository().searchInputSetSummaries(keyword, effective, claimClassSystem);
    }

    public OrcaOrderInputSetDetailResponse.Bundle loadInputSetDetail(
            String setCode,
            String effective,
            String requestedName,
            String bodyPartCodePrefix,
            String claimClassSystem,
            ClassMetadataResolver classMetadataResolver) {
        return repository().findInputSetDetail(setCode, effective, requestedName, bodyPartCodePrefix, claimClassSystem);
    }

    public static String normalizeClassCode(String inputCode) {
        if (inputCode == null || inputCode.isBlank()) {
            return null;
        }
        String normalized = inputCode.startsWith(".") ? inputCode.substring(1) : inputCode;
        if (normalized.length() > 3) {
            return normalized.substring(0, 3);
        }
        return normalized;
    }

    public static OrcaOrderInputSetDetailResponse.BodyPart toBodyPart(OrcaOrderInputSetDetailResponse.Item item) {
        OrcaOrderInputSetDetailResponse.BodyPart bodyPart = new OrcaOrderInputSetDetailResponse.BodyPart();
        bodyPart.setCode(item.getCode());
        bodyPart.setName(item.getName());
        bodyPart.setQuantity(item.getQuantity());
        bodyPart.setUnit(item.getUnit());
        bodyPart.setMemo(item.getMemo());
        return bodyPart;
    }

    private LocalOrcaMasterCacheRepository repository() {
        if (repository == null) {
            throw new LocalOrcaMasterCacheRepository.LocalMasterUnavailableException(null);
        }
        return repository;
    }

    @FunctionalInterface
    public interface ClassMetadataResolver {
        ClassMetadata resolve(String classCode);
    }

    public record ClassMetadata(String entity, String className) {
    }
}
