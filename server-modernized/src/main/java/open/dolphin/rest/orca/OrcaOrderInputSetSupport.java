package open.dolphin.rest.orca;

import java.sql.SQLException;
import java.util.List;
import open.dolphin.orca.read.OrcaOrderInputSetReadService;
import open.dolphin.rest.dto.orca.OrcaOrderInputSetDetailResponse;
import open.dolphin.rest.dto.orca.OrcaOrderInputSetListResponse;
import open.orca.rest.ORCAConnection;

final class OrcaOrderInputSetSupport {

    private OrcaOrderInputSetSupport() {
    }

    static List<OrcaOrderInputSetListResponse.Item> loadInputSetSummaries(
            ORCAConnection orcaConnection,
            String keyword,
            String effective,
            String claimClassSystem,
            ClassMetadataResolver classMetadataResolver) throws SQLException {
        OrcaOrderInputSetReadService service = new OrcaOrderInputSetReadService(orcaConnection);
        return service.loadInputSetSummaries(keyword, effective, claimClassSystem,
                classCode -> {
                    ClassMetadata metadata = classMetadataResolver.resolve(classCode);
                    return new OrcaOrderInputSetReadService.ClassMetadata(metadata.entity(), metadata.className());
                });
    }

    static OrcaOrderInputSetDetailResponse.Bundle loadInputSetDetail(
            ORCAConnection orcaConnection,
            String setCode,
            String effective,
            String requestedName,
            String bodyPartCodePrefix,
            String claimClassSystem,
            ClassMetadataResolver classMetadataResolver) throws SQLException {
        OrcaOrderInputSetReadService service = new OrcaOrderInputSetReadService(orcaConnection);
        return service.loadInputSetDetail(setCode, effective, requestedName, bodyPartCodePrefix, claimClassSystem,
                classCode -> {
                    ClassMetadata metadata = classMetadataResolver.resolve(classCode);
                    return new OrcaOrderInputSetReadService.ClassMetadata(metadata.entity(), metadata.className());
                });
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
