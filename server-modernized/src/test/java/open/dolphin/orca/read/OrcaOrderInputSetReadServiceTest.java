package open.dolphin.orca.read;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.List;
import open.dolphin.rest.dto.orca.OrcaOrderInputSetDetailResponse;
import open.dolphin.rest.dto.orca.OrcaOrderInputSetListResponse;
import open.orca.rest.LocalOrcaMasterCacheRepository;
import org.junit.jupiter.api.Test;

class OrcaOrderInputSetReadServiceTest {

    @Test
    void loadInputSetDetailDelegatesToLocalMasterCache() {
        OrcaOrderInputSetReadService service = new OrcaOrderInputSetReadService(new StubRepository());

        OrcaOrderInputSetDetailResponse.Bundle bundle = service.loadInputSetDetail(
                "S60001",
                "20260309",
                "bacteria-set",
                "002",
                "Claim007",
                classCode -> new OrcaOrderInputSetReadService.ClassMetadata("testOrder", "Test"));

        assertNotNull(bundle);
        assertEquals("600", bundle.getClassCode());
        assertEquals("testOrder", bundle.getEntity());
        assertEquals(1, bundle.getItems().size());
        assertEquals(1, bundle.getMaterialItems().size());
        assertEquals(1, bundle.getCommentItems().size());
        assertEquals("160000010", bundle.getItems().get(0).getCode());
        assertEquals("main", bundle.getItems().get(0).getRowRole());
        assertEquals("700000031", bundle.getMaterialItems().get(0).getCode());
        assertEquals("material", bundle.getMaterialItems().get(0).getRowRole());
        assertEquals("0085001", bundle.getCommentItems().get(0).getCode());
        assertEquals("comment", bundle.getCommentItems().get(0).getRowRole());
    }

    @Test
    void normalizeClassCodeKeepsLegacyInputSetClassParsing() {
        assertEquals("600", OrcaOrderInputSetReadService.normalizeClassCode(".60001"));
    }

    private static final class StubRepository extends LocalOrcaMasterCacheRepository {
        @Override
        public List<OrcaOrderInputSetListResponse.Item> searchInputSetSummaries(
                String keyword, String effective, String claimClassSystem) {
            return List.of();
        }

        @Override
        public OrcaOrderInputSetDetailResponse.Bundle findInputSetDetail(
                String setCode, String effective, String requestedName, String bodyPartCodePrefix, String claimClassSystem) {
            OrcaOrderInputSetDetailResponse.Bundle bundle = new OrcaOrderInputSetDetailResponse.Bundle();
            bundle.setSourceSetCode(setCode);
            bundle.setBundleName(requestedName);
            bundle.setClassCode("600");
            bundle.setClassCodeSystem(claimClassSystem);
            bundle.setEntity("testOrder");

            OrcaOrderInputSetDetailResponse.Item main = item("160000010", "main");
            OrcaOrderInputSetDetailResponse.Item material = item("700000031", "material");
            OrcaOrderInputSetDetailResponse.Item comment = item("0085001", "comment");
            bundle.setItems(List.of(main));
            bundle.setMaterialItems(List.of(material));
            bundle.setCommentItems(List.of(comment));
            return bundle;
        }

        private OrcaOrderInputSetDetailResponse.Item item(String code, String role) {
            OrcaOrderInputSetDetailResponse.Item item = new OrcaOrderInputSetDetailResponse.Item();
            item.setCode(code);
            item.setRowRole(role);
            return item;
        }
    }
}
