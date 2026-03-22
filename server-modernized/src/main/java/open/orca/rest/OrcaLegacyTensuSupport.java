package open.orca.rest;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import open.dolphin.infomodel.CodeNamePack;
import open.dolphin.infomodel.TensuMaster;

final class OrcaLegacyTensuSupport {

    private static final String QUERY_FACILITYID_BY_1001 =
            "select kanritbl from tbl_syskanri where kanricd='1001'";
    private static final String QUERY_TENSU_BY_SHINKU =
            "select srycd,name,kananame,taniname,tensikibetu,ten,nyugaitekkbn,routekkbn,srysyukbn,hospsrykbn,ykzkbn,yakkakjncd,yukostymd,yukoedymd from tbl_tensu where srysyukbn ~ ? and yukostymd<= ? and yukoedymd>=?";
    private static final String QUERY_TENSU_BY_NAME =
            "select srycd,name,kananame,taniname,tensikibetu,ten,nyugaitekkbn,routekkbn,srysyukbn,hospsrykbn,ykzkbn,yakkakjncd,yukostymd,yukoedymd from tbl_tensu where (name ~ ? or kananame ~ ?) and yukostymd<= ? and yukoedymd>=?";
    private static final String QUERY_TENSU_BY_1_NAME =
            "select srycd,name,kananame,taniname,tensikibetu,ten,nyugaitekkbn,routekkbn,srysyukbn,hospsrykbn,ykzkbn,yakkakjncd,yukostymd,yukoedymd from tbl_tensu where (name = ? or kananame = ?) and yukostymd<= ? and yukoedymd>=?";
    private static final String QUERY_TENSU_BY_CODE =
            "select srycd,name,kananame,taniname,tensikibetu,ten,nyugaitekkbn,routekkbn,srysyukbn,hospsrykbn,ykzkbn,yakkakjncd,yukostymd,yukoedymd from tbl_tensu where srycd ~ ? and yukostymd<= ? and yukoedymd>=?";
    private static final String QUERY_GENERAL_NAME_BY_CODE =
            "select b.srycd,genericname from tbl_tensu b,tbl_genericname c where b.srycd=? and substring(b.yakkakjncd from 1 for 9)=c.yakkakjncd order by b.yukoedymd desc";
    private static final String QUERY_PATIENT_ID =
            "select ptid from tbl_ptnum where hospnum = ? and ptnum = ?";
    private static final String QUERY_HOSPNUM_BY_JMARI =
            "select hospnum, kanritbl from tbl_syskanri where kanricd='1001' and kanritbl like ?";
    private static final String QUERY_DB_VERSION =
            "select version from tbl_dbkanri where kanricd='ORCADB00'";

    private OrcaLegacyTensuSupport() {
    }

    static SetupParams resolveSetupParams(ConnectionProvider provider, String jmari, boolean rpOut) throws SQLException {
        int hospNum = 1;
        String dbVersion = null;
        if (jmari == null || jmari.isBlank()) {
            return new SetupParams(hospNum, dbVersion, rpOut);
        }
        try (Connection first = provider.get();
                PreparedStatement hospStmt = first.prepareStatement(QUERY_HOSPNUM_BY_JMARI)) {
            hospStmt.setString(1, "%" + jmari + "%");
            try (ResultSet rs = hospStmt.executeQuery()) {
                if (rs.next()) {
                    hospNum = rs.getInt(1);
                }
            }
        }
        try (Connection second = provider.get(); Statement versionStmt = second.createStatement();
                ResultSet rs = versionStmt.executeQuery(QUERY_DB_VERSION)) {
            if (rs.next()) {
                dbVersion = rs.getString(1);
            }
        }
        return new SetupParams(hospNum, dbVersion, rpOut);
    }

    static String resolveFacilityCodeBy1001(Connection connection) throws SQLException {
        StringBuilder ret = new StringBuilder();
        try (PreparedStatement ps = connection.prepareStatement(QUERY_FACILITYID_BY_1001);
                ResultSet rs = ps.executeQuery()) {
            if (rs.next()) {
                String line = rs.getString(1);
                ret.append(line.substring(0, 10));
                int index = line.indexOf("JPN");
                if (index > 0) {
                    ret.append(line, index, index + 15);
                }
            }
        }
        return ret.toString();
    }

    static ArrayList<TensuMaster> loadByShinku(Connection connection, String shinku, String now) throws SQLException {
        String normalized = shinku.startsWith("^") ? shinku : "^" + shinku;
        try (PreparedStatement ps = connection.prepareStatement(QUERY_TENSU_BY_SHINKU)) {
            ps.setString(1, normalized);
            ps.setString(2, now);
            ps.setString(3, now);
            return readTensuList(ps);
        }
    }

    static ArrayList<TensuMaster> loadByName(Connection connection, String name, String now, boolean partialMatch)
            throws SQLException {
        String normalized = StringTool.toZenkakuUpperLower(name);
        boolean one = normalized.length() == 1;
        String sql = one ? QUERY_TENSU_BY_1_NAME : QUERY_TENSU_BY_NAME;
        if (!one && !partialMatch) {
            normalized = "^" + normalized;
        }
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            ps.setString(1, normalized);
            ps.setString(2, normalized);
            ps.setString(3, now);
            ps.setString(4, now);
            return readTensuList(ps);
        }
    }

    static ArrayList<TensuMaster> loadByCode(Connection connection, String regExp, String now) throws SQLException {
        try (PreparedStatement ps = connection.prepareStatement(QUERY_TENSU_BY_CODE)) {
            ps.setString(1, "^" + regExp);
            ps.setString(2, now);
            ps.setString(3, now);
            return readTensuList(ps);
        }
    }

    static CodeNamePack resolveGeneralName(Connection connection, String code) throws SQLException {
        try (PreparedStatement ps = connection.prepareStatement(QUERY_GENERAL_NAME_BY_CODE)) {
            ps.setString(1, code);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return new CodeNamePack(code, rs.getString(2));
                }
            }
        }
        return null;
    }

    static long resolvePatientId(Connection connection, int hospNum, String patientId) throws SQLException {
        try (PreparedStatement ps = connection.prepareStatement(QUERY_PATIENT_ID)) {
            ps.setInt(1, hospNum);
            ps.setString(2, patientId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rs.getLong(1);
                }
            }
        }
        return 0L;
    }

    private static ArrayList<TensuMaster> readTensuList(PreparedStatement ps) throws SQLException {
        ArrayList<TensuMaster> list = new ArrayList<>();
        try (ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                list.add(mapTensu(rs));
            }
        }
        return list;
    }

    private static TensuMaster mapTensu(ResultSet rs) throws SQLException {
        TensuMaster t = new TensuMaster();
        t.setSrycd(rs.getString(1));
        t.setName(rs.getString(2));
        t.setKananame(rs.getString(3));
        t.setTaniname(rs.getString(4));
        t.setTensikibetu(rs.getString(5));
        t.setTen(rs.getString(6));
        t.setNyugaitekkbn(rs.getString(7));
        t.setRoutekkbn(rs.getString(8));
        t.setSrysyukbn(rs.getString(9));
        t.setHospsrykbn(rs.getString(10));
        t.setYkzkbn(rs.getString(11));
        t.setYakkakjncd(rs.getString(12));
        t.setYukostymd(rs.getString(13));
        t.setYukoedymd(rs.getString(14));
        return t;
    }

    @FunctionalInterface
    interface ConnectionProvider {
        Connection get() throws SQLException;
    }

    record SetupParams(int hospNum, String dbVersion, boolean rpOut) {
    }
}
