package open.orca.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

class EtensuRefactorSupportTest {

    @Test
    void parseVersionKey_numericVersionReturnsComparableKey() {
        assertEquals(202404, EtensuDaoSupport.parseVersionKey("202404"));
    }

    @Test
    void parseVersionKey_nonNumericVersionReturnsNull() {
        assertNull(EtensuDaoSupport.parseVersionKey("current"));
    }

    @Test
    void expectedCapacity_positiveSizeExpandsForHashCollections() {
        assertEquals(27, new EtensuDetailLoader().expectedCapacity(20));
    }

    @Test
    void expectedCapacity_zeroSizeKeepsMinimumCapacity() {
        assertEquals(16, new EtensuDetailLoader().expectedCapacity(0));
    }
}
