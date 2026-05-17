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

}
