package open.orca.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class MasterSearchKeywordSupportTest {

    @Test
    void appendOrcaKeywordFilter_codeLikeKeywordUsesCodePrefixOnly() {
        StringBuilder where = new StringBuilder(" WHERE 1=1");
        List<Object> params = new ArrayList<>();

        MasterSearchKeywordSupport.appendOrcaKeywordFilter(where, params, "113006810", null,
                "m.srycd", "m.name", "m.kana");

        assertEquals(" WHERE 1=1 AND (CAST(m.srycd AS VARCHAR) LIKE ?)", where.toString());
        assertEquals(List.of("113006810%"), params);
    }

    @Test
    void appendOrcaKeywordFilter_explicitPartialKeepsMultiColumnPartialSearch() {
        StringBuilder where = new StringBuilder(" WHERE 1=1");
        List<Object> params = new ArrayList<>();

        MasterSearchKeywordSupport.appendOrcaKeywordFilter(where, params, "ゲンタ", "partial",
                "m.srycd", "m.name", "m.kana");

        assertTrue(where.toString().contains("UPPER(CAST(m.srycd AS VARCHAR)) LIKE ?"));
        assertTrue(where.toString().contains("UPPER(CAST(m.name AS VARCHAR)) LIKE ?"));
        assertTrue(where.toString().contains("UPPER(CAST(m.kana AS VARCHAR)) LIKE ?"));
        assertEquals(List.of("%ゲンタ%", "%ゲンタ%", "%ゲンタ%"), params);
    }

    @Test
    void appendOrcaKeywordFilter_explicitPrefixUsesPrefixAcrossColumns() {
        StringBuilder where = new StringBuilder(" WHERE 1=1");
        List<Object> params = new ArrayList<>();

        MasterSearchKeywordSupport.appendOrcaKeywordFilter(where, params, "ab123", "prefix",
                "m.srycd", "m.name");

        assertTrue(where.toString().contains("UPPER(CAST(m.srycd AS VARCHAR)) LIKE ?"));
        assertTrue(where.toString().contains("UPPER(CAST(m.name AS VARCHAR)) LIKE ?"));
        assertEquals(List.of("AB123%", "AB123%"), params);
    }

    @Test
    void appendEtensuKeywordFilter_codeLikeKeywordUsesSrycdPrefixOnly() {
        StringBuilder where = new StringBuilder(" WHERE 1=1");
        List<Object> params = new ArrayList<>();

        MasterSearchKeywordSupport.appendEtensuKeywordFilter(where, params, "820183500",
                "s.srycd", "s.name");

        assertEquals(" WHERE 1=1 AND (s.srycd LIKE ?)", where.toString());
        assertEquals(List.of("820183500%"), params);
    }

    @Test
    void appendEtensuKeywordFilter_textKeywordKeepsNameSearch() {
        StringBuilder where = new StringBuilder(" WHERE 1=1");
        List<Object> params = new ArrayList<>();

        MasterSearchKeywordSupport.appendEtensuKeywordFilter(where, params, "カテーテル",
                "s.srycd", "s.name");

        assertTrue(where.toString().contains("UPPER(s.srycd) LIKE ?"));
        assertTrue(where.toString().contains("UPPER(COALESCE(s.name, '')) LIKE ?"));
        assertFalse(params.isEmpty());
        assertEquals(List.of("%カテーテル%", "%カテーテル%"), params);
    }
}
