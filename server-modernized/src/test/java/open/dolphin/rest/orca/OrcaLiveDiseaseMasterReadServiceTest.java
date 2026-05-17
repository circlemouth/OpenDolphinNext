package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.Map;
import open.dolphin.orca.read.OrcaLiveDiseaseMasterReadService;
import open.orca.rest.LocalOrcaMasterCacheRepository;
import org.junit.jupiter.api.Test;

class OrcaLiveDiseaseMasterReadServiceTest {

    @Test
    void queryEntriesReturnsLocalCandidateRows() {
        OrcaLiveDiseaseMasterReadService service = new OrcaLiveDiseaseMasterReadService(new StubRepository(false));

        List<Map<String, Object>> rows = service.queryEntries("感冒", "2026-04-01", false);

        assertEquals(1, rows.size());
        assertEquals("D001", rows.get(0).get("code"));
        assertEquals("感冒", rows.get(0).get("name"));
        assertEquals("カンボウ", rows.get(0).get("kana"));
        assertEquals("J00", rows.get(0).get("icdTen"));
        assertEquals("99999999", rows.get(0).get("disUseDate"));
        assertEquals("candidate", rows.get(0).get("layer"));
        assertEquals(true, rows.get(0).get("readOnly"));
        assertEquals(true, rows.get(0).get("candidateOnly"));
    }

    @Test
    void unavailableDiseaseCandidateCacheIsNotBootstrapFallback() {
        OrcaLiveDiseaseMasterReadService service = new OrcaLiveDiseaseMasterReadService(new StubRepository(true));

        assertThrows(LocalOrcaMasterCacheRepository.LocalMasterUnavailableException.class,
                () -> service.queryEntries("高血圧", "2026-05-09", true));
    }

    private static final class StubRepository extends LocalOrcaMasterCacheRepository {
        private final boolean unavailable;

        private StubRepository(boolean unavailable) {
            this.unavailable = unavailable;
        }

        @Override
        public List<Map<String, Object>> queryDiseaseCandidates(String term, String referenceDate, boolean partial) {
            if (unavailable) {
                throw new LocalOrcaMasterCacheRepository.LocalMasterUnavailableException(null);
            }
            return List.of(Map.of(
                    "code", "D001",
                    "name", "感冒",
                    "kana", "カンボウ",
                    "icdTen", "J00",
                    "disUseDate", "99999999",
                    "layer", "candidate",
                    "readOnly", Boolean.TRUE,
                    "candidateOnly", Boolean.TRUE));
        }
    }
}
