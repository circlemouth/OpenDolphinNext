package open.orca.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Objects;
import org.junit.jupiter.api.Test;

class OrcaMasterQuerySupportTest {

    @Test
    void buildBodypartQueryUses002PrefixAndKeywordFilter() {
        OrcaMasterQuerySupport support = new OrcaMasterQuerySupport();
        OrcaMasterDao.CommentCriteria criteria = new OrcaMasterDao.CommentCriteria();
        criteria.setKeyword("膝");
        criteria.setEffective("20260125");

        OrcaMasterQuerySupport.Query query = support.buildBodypartQuery(
                criteria,
                "orca08_bodypart",
                "tensu_code",
                "tensu_name",
                "tensu_kana",
                "start_date",
                "end_date");

        assertTrue(query.whereClause.contains("CAST(tensu_code AS VARCHAR) LIKE ?"));
        assertFalse(query.whereClause.contains("~ ?"));
        assertFalse(query.whereClause.contains("部位"));
        assertEquals("002%", query.params.get(0));
        assertTrue(query.params.contains("%膝%"));
        assertTrue(query.params.stream().filter(Objects::nonNull).anyMatch("20260125"::equals));
    }
}
