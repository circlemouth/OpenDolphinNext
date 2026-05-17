package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import open.dolphin.orca.read.OrcaOrderInteractionReadService;
import open.dolphin.rest.dto.orca.OrcaOrderInteractionCheckResponse;
import open.orca.rest.LocalOrcaMasterCacheRepository;
import org.junit.jupiter.api.Test;

class OrcaOrderInteractionReadServiceTest {

    @Test
    void loadInteractionPairsDelegatesToLocalMasterCache() {
        OrcaOrderInteractionReadService service = new OrcaOrderInteractionReadService(new StubRepository(false));
        List<OrcaOrderInteractionCheckResponse.Pair> pairs = service.loadInteractionPairs(
                List.of("111", "222"),
                List.of("111", "222"));

        assertEquals(1, pairs.size());
        assertEquals("111", pairs.get(0).getCode1());
        assertEquals("222", pairs.get(0).getCode2());
        assertEquals("IX01", pairs.get(0).getInteractionCode());
    }

    @Test
    void sanitizeCodes_removesBlanksAndDuplicates() {
        OrcaOrderInteractionReadService service = new OrcaOrderInteractionReadService(new StubRepository(false));

        List<String> sanitized = service.sanitizeCodes(List.of("111", " ", "111", "222"));

        assertEquals(List.of("111", "222"), sanitized);
    }

    @Test
    void unavailableInteractionMasterIsNotReturnedAsEmptySafeResult() {
        OrcaOrderInteractionReadService service = new OrcaOrderInteractionReadService(new StubRepository(true));

        assertThrows(LocalOrcaMasterCacheRepository.LocalMasterUnavailableException.class,
                () -> service.loadInteractionPairs(List.of("111"), List.of("222")));
    }

    private static final class StubRepository extends LocalOrcaMasterCacheRepository {
        private final boolean unavailable;

        private StubRepository(boolean unavailable) {
            this.unavailable = unavailable;
        }

        @Override
        public List<OrcaOrderInteractionCheckResponse.Pair> findInteractionPairs(
                List<String> codes, List<String> existingCodes) {
            if (unavailable) {
                throw new LocalOrcaMasterCacheRepository.LocalMasterUnavailableException(null);
            }
            OrcaOrderInteractionCheckResponse.Pair pair = new OrcaOrderInteractionCheckResponse.Pair();
            pair.setCode1("111");
            pair.setCode2("222");
            pair.setInteractionCode("IX01");
            pair.setInteractionName("併用禁忌");
            return List.of(pair);
        }
    }
}
