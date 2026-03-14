package open.orca.rest;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.regex.Pattern;
import open.dolphin.rest.dto.orca.OrcaEtensuAddition;
import open.dolphin.rest.dto.orca.OrcaEtensuBundlingMember;
import open.dolphin.rest.dto.orca.OrcaEtensuCalcUnit;
import open.dolphin.rest.dto.orca.OrcaEtensuConflict;
import open.dolphin.rest.dto.orca.OrcaEtensuSpecimen;

public class EtensuDao {
    private static final Logger LOGGER = Logger.getLogger(EtensuDao.class.getName());
    private static final Pattern TENSU_VERSION_PATTERN = Pattern.compile("\\d{6}");

    public EtensuSearchResult search(EtensuSearchCriteria criteria) {
        if (criteria == null) {
            LOGGER.warning("ETENSU search criteria was null");
            return new EtensuSearchResult(Collections.emptyList(), 0, null, 0, true);
        }
        long startTime = System.nanoTime();
        try (Connection connection = ORCAConnection.getInstance().getConnection()) {
            EtensuTableMeta meta = EtensuTableMeta.load(connection);
            EtensuQuery query = buildQuery(criteria, meta);
            Integer totalCount = maybeFetchTotalCount(connection, query, criteria.isIncludeTotalCount());
            if (Integer.valueOf(0).equals(totalCount)) {
                long elapsedMs = toMillis(startTime);
                return new EtensuSearchResult(Collections.emptyList(), totalCount, criteria.tensuVersion, elapsedMs, false);
            }
            List<EtensuRecord> records = fetchRecords(connection, query, criteria.page, criteria.size, meta);
            if (!records.isEmpty()) {
                populateDetails(connection, records, criteria.asOf, meta);
            }
            String version = resolveVersion(records, criteria.tensuVersion);
            long elapsedMs = toMillis(startTime);
            return new EtensuSearchResult(records, totalCount, version, elapsedMs, false);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "Failed to load ORCA ETENSU master", e);
            long elapsedMs = toMillis(startTime);
            return new EtensuSearchResult(Collections.emptyList(), 0, criteria.tensuVersion, elapsedMs, true);
        }
    }

    private EtensuQuery buildQuery(EtensuSearchCriteria criteria, EtensuTableMeta meta) {
        StringBuilder where = new StringBuilder(meta.fromClause).append(" WHERE 1=1");
        String srycdColumn = selectColumn(meta.srycdColumn);
        List<Object> params = new ArrayList<>();
        MasterSearchKeywordSupport.appendEtensuKeywordFilter(where, params, criteria.keyword, srycdColumn,
                meta.hasName ? meta.nameColumn : null);
        if (criteria.asOf != null && !criteria.asOf.isBlank()) {
            where.append(" AND ").append(meta.startDateColumn).append(" <= ? AND ")
                    .append(meta.endDateColumn).append(" >= ?");
            params.add(criteria.asOf);
            params.add(criteria.asOf);
        }
        if (criteria.tensuVersion != null && !criteria.tensuVersion.isBlank() && meta.hasTensuVersion) {
            where.append(" AND ").append(meta.tensuVersionColumn).append(" = ?");
            params.add(criteria.tensuVersion);
        }
        if (criteria.category != null && !criteria.category.isBlank()) {
            String categoryColumn = meta.categoryColumn();
            if (categoryColumn != null) {
                String normalizedCategory = "COALESCE(" + categoryColumn + ", '')";
                where.append(" AND (")
                        .append(normalizedCategory).append(" = ? OR (")
                        .append(normalizedCategory).append(" <> '' AND (")
                        .append(normalizedCategory).append(" LIKE ? || '%' OR ? LIKE ")
                        .append(normalizedCategory).append(" || '%')))");
                params.add(criteria.category);
                params.add(criteria.category);
                params.add(criteria.category);
            }
        }
        if (criteria.pointsMin != null) {
            where.append(" AND COALESCE(").append(selectColumn(meta.tankaColumn)).append(", 0) >= ?");
            params.add(criteria.pointsMin);
        }
        if (criteria.pointsMax != null) {
            where.append(" AND COALESCE(").append(selectColumn(meta.tankaColumn)).append(", 0) <= ?");
            params.add(criteria.pointsMax);
        }
        EtensuQuery query = new EtensuQuery(where.toString(), params);
        return query;
    }

    private int fetchTotalCount(Connection connection, EtensuQuery query) throws SQLException {
        String sql = "SELECT count(*)" + query.whereClause;
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            bindParams(ps, query.params, 1);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getInt(1) : 0;
            }
        }
    }

    private Integer maybeFetchTotalCount(Connection connection, EtensuQuery query, boolean includeTotalCount)
            throws SQLException {
        if (!includeTotalCount) {
            return null;
        }
        return fetchTotalCount(connection, query);
    }

    private List<EtensuRecord> fetchRecords(Connection connection, EtensuQuery query, int page, int size,
            EtensuTableMeta meta) throws SQLException {
        String sql = "SELECT "
                + selectColumn(meta.srycdColumn) + " AS srycd, "
                + selectColumn(meta.kubunColumn) + " AS kubun, "
                + selectColumn(meta.nameColumn) + " AS name, "
                + selectColumn(meta.tankaColumn) + " AS tanka, "
                + selectColumn(meta.unitColumn) + " AS unit, "
                + selectColumn(meta.categoryColumn()) + " AS category, "
                + selectColumn(meta.startDateColumn) + " AS startDate, "
                + selectColumn(meta.endDateColumn) + " AS endDate, "
                + selectColumn(meta.tensuVersionColumn) + " AS tensuVersion, "
                + selectColumn(meta.hTani1Column) + " AS hTani1, "
                + selectColumn(meta.hGroup1Column) + " AS hGroup1, "
                + selectColumn(meta.hTani2Column) + " AS hTani2, "
                + selectColumn(meta.hGroup2Column) + " AS hGroup2, "
                + selectColumn(meta.hTani3Column) + " AS hTani3, "
                + selectColumn(meta.hGroup3Column) + " AS hGroup3, "
                + selectColumn(meta.rDayColumn) + " AS rDay, "
                + selectColumn(meta.rMonthColumn) + " AS rMonth, "
                + selectColumn(meta.rSameColumn) + " AS rSame, "
                + selectColumn(meta.rWeekColumn) + " AS rWeek, "
                + selectColumn(meta.nGroupColumn) + " AS nGroup, "
                + selectColumn(meta.cKaisuColumn) + " AS cKaisu, "
                + selectColumn(meta.chgYmdColumn) + " AS chgYmd "
                + query.whereClause
                + " ORDER BY " + selectColumn(meta.srycdColumn);
        int safeSize = Math.min(size, 2000);
        int safePage = Math.max(1, page);
        int offset = (safePage - 1) * safeSize;
        sql = sql + " LIMIT ? OFFSET ?";
        List<EtensuRecord> records = new ArrayList<>(safeSize);
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            int index = bindParams(ps, query.params, 1);
            ps.setInt(index++, safeSize);
            ps.setInt(index, offset);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    EtensuRecord record = new EtensuRecord();
                    record.tensuCode = rs.getString("srycd");
                    record.kubun = rs.getString("kubun");
                    record.name = rs.getString("name");
                    record.tanka = getDouble(rs, "tanka");
                    record.unit = rs.getString("unit");
                    record.category = rs.getString("category");
                    record.startDate = rs.getString("startDate");
                    record.endDate = rs.getString("endDate");
                    record.tensuVersion = rs.getString("tensuVersion");
                    record.noticeDate = rs.getString("chgYmd");
                    record.effectiveDate = record.startDate;
                    record.points = record.tanka;
                    record.hTani1 = getInteger(rs, "hTani1");
                    record.hGroup1 = rs.getString("hGroup1");
                    record.hTani2 = getInteger(rs, "hTani2");
                    record.hGroup2 = rs.getString("hGroup2");
                    record.hTani3 = getInteger(rs, "hTani3");
                    record.hGroup3 = rs.getString("hGroup3");
                    record.rDay = getInteger(rs, "rDay");
                    record.rMonth = getInteger(rs, "rMonth");
                    record.rSame = getInteger(rs, "rSame");
                    record.rWeek = getInteger(rs, "rWeek");
                    record.nGroup = getInteger(rs, "nGroup");
                    record.cKaisu = getInteger(rs, "cKaisu");
                    records.add(record);
                }
            }
        }
        return records;
    }

    private void populateDetails(Connection connection, List<EtensuRecord> records, String asOf,
            EtensuTableMeta meta) throws SQLException {
        int expectedSize = expectedCapacity(records.size());
        Map<String, List<EtensuRecord>> recordsBySrycd = new HashMap<>(expectedSize);
        Set<String> conflictDay = new HashSet<>(expectedSize);
        Set<String> conflictMonth = new HashSet<>(expectedSize);
        Set<String> conflictSame = new HashSet<>(expectedSize);
        Set<String> conflictWeek = new HashSet<>(expectedSize);
        Set<String> calcUnitTargets = new HashSet<>(expectedSize);
        Set<Integer> additionGroups = new HashSet<>(expectedSize);
        Set<String> bundlingGroups = new HashSet<>(expectedSize);
        for (EtensuRecord record : records) {
            if (record.tensuCode == null) {
                continue;
            }
            recordsBySrycd.computeIfAbsent(record.tensuCode, key -> new ArrayList<>()).add(record);
            if (isRelated(record.rDay)) {
                conflictDay.add(record.tensuCode);
            }
            if (isRelated(record.rMonth)) {
                conflictMonth.add(record.tensuCode);
            }
            if (isRelated(record.rSame)) {
                conflictSame.add(record.tensuCode);
            }
            if (isRelated(record.rWeek)) {
                conflictWeek.add(record.tensuCode);
            }
            if (isRelated(record.cKaisu)) {
                calcUnitTargets.add(record.tensuCode);
            }
            if (record.nGroup != null && record.nGroup > 0) {
                additionGroups.add(record.nGroup);
            }
            if (record.hGroup1 != null && !record.hGroup1.isBlank()) {
                bundlingGroups.add(record.hGroup1);
            }
            if (record.hGroup2 != null && !record.hGroup2.isBlank()) {
                bundlingGroups.add(record.hGroup2);
            }
            if (record.hGroup3 != null && !record.hGroup3.isBlank()) {
                bundlingGroups.add(record.hGroup3);
            }
        }
        if (!conflictDay.isEmpty()) {
            loadConflicts(connection, "TBL_ETENSU_3_1", "day", conflictDay, asOf, recordsBySrycd);
        }
        if (!conflictMonth.isEmpty()) {
            loadConflicts(connection, "TBL_ETENSU_3_2", "month", conflictMonth, asOf, recordsBySrycd);
        }
        if (!conflictSame.isEmpty()) {
            loadConflicts(connection, "TBL_ETENSU_3_3", "same", conflictSame, asOf, recordsBySrycd);
        }
        if (!conflictWeek.isEmpty()) {
            loadConflicts(connection, "TBL_ETENSU_3_4", "week", conflictWeek, asOf, recordsBySrycd);
        }
        if (!additionGroups.isEmpty()) {
            loadAdditions(connection, additionGroups, asOf, records);
        }
        if (!calcUnitTargets.isEmpty()) {
            loadCalcUnits(connection, calcUnitTargets, asOf, recordsBySrycd);
        }
        if (!bundlingGroups.isEmpty()) {
            loadBundlingMembers(connection, bundlingGroups, asOf, records);
            loadSpecimens(connection, bundlingGroups, asOf, records);
        }
    }

    private int expectedCapacity(int size) {
        if (size <= 0) {
            return 16;
        }
        return Math.max(16, (int) (size / 0.75f) + 1);
    }

    private long toMillis(long startTime) {
        return java.util.concurrent.TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startTime);
    }

    private void loadConflicts(Connection connection, String table, String scope, Set<String> srycds, String asOf,
            Map<String, List<EtensuRecord>> recordsBySrycd) throws SQLException {
        if (!tableExists(connection, table)) {
            return;
        }
        String inClause = buildInClause(srycds.size());
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT SRYCD1, SRYCD2, YUKOSTYMD, YUKOEDYMD, HAIHAN, TOKUREI, CHGYMD FROM ")
                .append(table)
                .append(" WHERE (SRYCD1 IN (")
                .append(inClause)
                .append(") OR SRYCD2 IN (")
                .append(inClause)
                .append(") )");
        List<Object> params = new ArrayList<>();
        params.addAll(srycds);
        params.addAll(srycds);
        if (asOf != null && !asOf.isBlank()) {
            sql.append(" AND YUKOSTYMD <= ? AND YUKOEDYMD >= ?");
            params.add(asOf);
            params.add(asOf);
        }
        try (PreparedStatement ps = connection.prepareStatement(sql.toString())) {
            bindParams(ps, params, 1);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String left = rs.getString("SRYCD1");
                    String right = rs.getString("SRYCD2");
                    OrcaEtensuConflict conflict = new OrcaEtensuConflict();
                    conflict.setScope(scope);
                    conflict.setLeftSrycd(left);
                    conflict.setRightSrycd(right);
                    conflict.setRule(getInteger(rs, "HAIHAN"));
                    conflict.setSpecialCondition(getInteger(rs, "TOKUREI"));
                    attachConflict(recordsBySrycd, left, conflict, scope);
                    attachConflict(recordsBySrycd, right, conflict, scope);
                }
            }
        }
    }

    private void loadAdditions(Connection connection, Set<Integer> nGroups, String asOf, List<EtensuRecord> records)
            throws SQLException {
        if (!tableExists(connection, "TBL_ETENSU_4")) {
            return;
        }
        String inClause = buildInClause(nGroups.size());
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT N_GROUP, SRYCD, YUKOSTYMD, YUKOEDYMD, KASAN, CHGYMD FROM TBL_ETENSU_4 WHERE N_GROUP IN (")
                .append(inClause)
                .append(")");
        List<Object> params = new ArrayList<>(nGroups);
        if (asOf != null && !asOf.isBlank()) {
            sql.append(" AND YUKOSTYMD <= ? AND YUKOEDYMD >= ?");
            params.add(asOf);
            params.add(asOf);
        }
        Map<Integer, List<OrcaEtensuAddition>> additionsByGroup = new HashMap<>();
        try (PreparedStatement ps = connection.prepareStatement(sql.toString())) {
            bindParams(ps, params, 1);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Integer group = getInteger(rs, "N_GROUP");
                    if (group == null) {
                        continue;
                    }
                    OrcaEtensuAddition addition = new OrcaEtensuAddition();
                    addition.setNGroup(group);
                    addition.setSrycd(rs.getString("SRYCD"));
                    addition.setAdditionCode(getInteger(rs, "KASAN"));
                    additionsByGroup.computeIfAbsent(group, key -> new ArrayList<>()).add(addition);
                }
            }
        }
        for (EtensuRecord record : records) {
            if (record.nGroup == null) {
                continue;
            }
            List<OrcaEtensuAddition> additions = additionsByGroup.get(record.nGroup);
            if (additions != null && !additions.isEmpty()) {
                record.additions.addAll(additions);
            }
        }
    }

    private void loadCalcUnits(Connection connection, Set<String> srycds, String asOf,
            Map<String, List<EtensuRecord>> recordsBySrycd) throws SQLException {
        if (!tableExists(connection, "TBL_ETENSU_5")) {
            return;
        }
        String inClause = buildInClause(srycds.size());
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT SRYCD, YUKOSTYMD, YUKOEDYMD, TANICD, TANINAME, KAISU, TOKUREI, CHGYMD FROM TBL_ETENSU_5 WHERE SRYCD IN (")
                .append(inClause)
                .append(")");
        List<Object> params = new ArrayList<>(srycds);
        if (asOf != null && !asOf.isBlank()) {
            sql.append(" AND YUKOSTYMD <= ? AND YUKOEDYMD >= ?");
            params.add(asOf);
            params.add(asOf);
        }
        try (PreparedStatement ps = connection.prepareStatement(sql.toString())) {
            bindParams(ps, params, 1);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String srycd = rs.getString("SRYCD");
                    OrcaEtensuCalcUnit unit = new OrcaEtensuCalcUnit();
                    unit.setUnitCode(getInteger(rs, "TANICD"));
                    unit.setUnitName(rs.getString("TANINAME"));
                    unit.setMaxCount(getInteger(rs, "KAISU"));
                    unit.setSpecialCondition(getInteger(rs, "TOKUREI"));
                    List<EtensuRecord> targets = recordsBySrycd.get(srycd);
                    if (targets != null) {
                        for (EtensuRecord record : targets) {
                            record.calcUnits.add(unit);
                        }
                    }
                }
            }
        }
    }

    private void loadBundlingMembers(Connection connection, Set<String> groupCodes, String asOf, List<EtensuRecord> records)
            throws SQLException {
        Map<String, OrcaEtensuBundlingMember> memberMap = new HashMap<>();
        if (tableExists(connection, "TBL_ETENSU_2")) {
            String inClause = buildInClause(groupCodes.size());
            StringBuilder sql = new StringBuilder();
            sql.append("SELECT H_GROUP, SRYCD, YUKOSTYMD, YUKOEDYMD, TOKUREI, CHGYMD FROM TBL_ETENSU_2 WHERE H_GROUP IN (")
                    .append(inClause)
                    .append(")");
            List<Object> params = new ArrayList<>(groupCodes);
            if (asOf != null && !asOf.isBlank()) {
                sql.append(" AND YUKOSTYMD <= ? AND YUKOEDYMD >= ?");
                params.add(asOf);
                params.add(asOf);
            }
            try (PreparedStatement ps = connection.prepareStatement(sql.toString())) {
                bindParams(ps, params, 1);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        OrcaEtensuBundlingMember member = new OrcaEtensuBundlingMember();
                        member.setGroupCode(rs.getString("H_GROUP"));
                        member.setSrycd(rs.getString("SRYCD"));
                        member.setSpecialCondition(getInteger(rs, "TOKUREI"));
                        memberMap.put(memberKey(member.getGroupCode(), member.getSrycd()), member);
                    }
                }
            }
        }
        loadBundlingMembersJma(connection, groupCodes, asOf, memberMap);
        applyBundlingExclusions(connection, groupCodes, asOf, memberMap);
        for (EtensuRecord record : records) {
            attachBundlingMembers(record, memberMap);
        }
    }

    private void loadBundlingMembersJma(Connection connection, Set<String> groupCodes, String asOf,
            Map<String, OrcaEtensuBundlingMember> memberMap) throws SQLException {
        if (!tableExists(connection, "TBL_ETENSU_2_JMA")) {
            return;
        }
        String inClause = buildInClause(groupCodes.size());
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT H_GROUP, SRYCD, YUKOSTYMD, YUKOEDYMD, TOKUREI, CHGYMD FROM TBL_ETENSU_2_JMA WHERE H_GROUP IN (")
                .append(inClause)
                .append(")");
        List<Object> params = new ArrayList<>(groupCodes);
        if (asOf != null && !asOf.isBlank()) {
            sql.append(" AND YUKOSTYMD <= ? AND YUKOEDYMD >= ?");
            params.add(asOf);
            params.add(asOf);
        }
        try (PreparedStatement ps = connection.prepareStatement(sql.toString())) {
            bindParams(ps, params, 1);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    OrcaEtensuBundlingMember member = new OrcaEtensuBundlingMember();
                    member.setGroupCode(rs.getString("H_GROUP"));
                    member.setSrycd(rs.getString("SRYCD"));
                    member.setSpecialCondition(getInteger(rs, "TOKUREI"));
                    memberMap.putIfAbsent(memberKey(member.getGroupCode(), member.getSrycd()), member);
                }
            }
        }
    }

    private void applyBundlingExclusions(Connection connection, Set<String> groupCodes, String asOf,
            Map<String, OrcaEtensuBundlingMember> memberMap) throws SQLException {
        if (!tableExists(connection, "TBL_ETENSU_2_OFF")) {
            return;
        }
        String inClause = buildInClause(groupCodes.size());
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT H_GROUP, SRYCD, YUKOSTYMD, YUKOEDYMD FROM TBL_ETENSU_2_OFF WHERE H_GROUP IN (")
                .append(inClause)
                .append(")");
        List<Object> params = new ArrayList<>(groupCodes);
        if (asOf != null && !asOf.isBlank()) {
            sql.append(" AND YUKOSTYMD <= ? AND YUKOEDYMD >= ?");
            params.add(asOf);
            params.add(asOf);
        }
        try (PreparedStatement ps = connection.prepareStatement(sql.toString())) {
            bindParams(ps, params, 1);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String group = rs.getString("H_GROUP");
                    String srycd = rs.getString("SRYCD");
                    String key = memberKey(group, srycd);
                    OrcaEtensuBundlingMember member = memberMap.get(key);
                    if (member != null) {
                        member.setExcluded(Boolean.TRUE);
                    } else {
                        OrcaEtensuBundlingMember excluded = new OrcaEtensuBundlingMember();
                        excluded.setGroupCode(group);
                        excluded.setSrycd(srycd);
                        excluded.setExcluded(Boolean.TRUE);
                        memberMap.put(key, excluded);
                    }
                }
            }
        }
    }

    private void loadSpecimens(Connection connection, Set<String> groupCodes, String asOf, List<EtensuRecord> records)
            throws SQLException {
        if (!tableExists(connection, "TBL_ETENSU_2_SAMPLE")) {
            return;
        }
        String inClause = buildInClause(groupCodes.size());
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT H_GROUP, SRYCD, YUKOSTYMD, YUKOEDYMD, RENNUM, SAMPLECD, CHGYMD FROM TBL_ETENSU_2_SAMPLE WHERE H_GROUP IN (")
                .append(inClause)
                .append(")");
        List<Object> params = new ArrayList<>(groupCodes);
        if (asOf != null && !asOf.isBlank()) {
            sql.append(" AND YUKOSTYMD <= ? AND YUKOEDYMD >= ?");
            params.add(asOf);
            params.add(asOf);
        }
        Map<String, List<OrcaEtensuSpecimen>> specimensByGroup = new HashMap<>();
        try (PreparedStatement ps = connection.prepareStatement(sql.toString())) {
            bindParams(ps, params, 1);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    OrcaEtensuSpecimen specimen = new OrcaEtensuSpecimen();
                    specimen.setGroupCode(rs.getString("H_GROUP"));
                    specimen.setSrycd(rs.getString("SRYCD"));
                    specimen.setSeq(getInteger(rs, "RENNUM"));
                    specimen.setSampleCode(rs.getString("SAMPLECD"));
                    specimensByGroup.computeIfAbsent(specimen.getGroupCode(), key -> new ArrayList<>()).add(specimen);
                }
            }
        }
        for (EtensuRecord record : records) {
            attachSpecimens(record, specimensByGroup);
        }
    }

    private void attachConflict(Map<String, List<EtensuRecord>> recordsBySrycd, String srycd,
            OrcaEtensuConflict conflict, String scope) {
        if (srycd == null) {
            return;
        }
        List<EtensuRecord> records = recordsBySrycd.get(srycd);
        if (records == null) {
            return;
        }
        for (EtensuRecord record : records) {
            if (!record.isConflictScopeEnabled(scope)) {
                continue;
            }
            record.conflicts.add(conflict);
        }
    }

    private void attachBundlingMembers(EtensuRecord record, Map<String, OrcaEtensuBundlingMember> memberMap) {
        for (String group : record.groupCodes()) {
            for (Map.Entry<String, OrcaEtensuBundlingMember> entry : memberMap.entrySet()) {
                if (entry.getValue() == null || entry.getValue().getGroupCode() == null) {
                    continue;
                }
                if (entry.getValue().getGroupCode().equals(group)) {
                    record.bundlingMembers.add(entry.getValue());
                }
            }
        }
    }

    private void attachSpecimens(EtensuRecord record, Map<String, List<OrcaEtensuSpecimen>> specimensByGroup) {
        for (String group : record.groupCodes()) {
            List<OrcaEtensuSpecimen> specimens = specimensByGroup.get(group);
            if (specimens != null && !specimens.isEmpty()) {
                record.specimens.addAll(specimens);
            }
        }
    }

    private static boolean isRelated(Integer flag) {
        return flag != null && flag > 0;
    }

    private String resolveVersion(List<EtensuRecord> records, String fallback) {
        String numericVersion = null;
        Integer numericKey = null;
        String nonNumericVersion = firstNonBlank(fallback);
        Integer fallbackKey = parseVersionKey(fallback);
        if (fallbackKey != null) {
            numericVersion = fallback;
            numericKey = fallbackKey;
            nonNumericVersion = null;
        }
        for (EtensuRecord record : records) {
            if (record.tensuVersion == null || record.tensuVersion.isBlank()) {
                continue;
            }
            Integer candidateKey = parseVersionKey(record.tensuVersion);
            if (candidateKey != null) {
                if (numericKey == null || candidateKey > numericKey) {
                    numericKey = candidateKey;
                    numericVersion = record.tensuVersion;
                }
                continue;
            }
            if (nonNumericVersion == null) {
                nonNumericVersion = record.tensuVersion;
            }
        }
        return numericVersion != null ? numericVersion : nonNumericVersion;
    }

    private static String selectColumn(String column) {
        return column != null ? column : "null";
    }

    private static Integer parseVersionKey(String version) {
        if (version == null || version.isBlank()) {
            return null;
        }
        String trimmed = version.trim();
        if (!TENSU_VERSION_PATTERN.matcher(trimmed).matches()) {
            return null;
        }
        return Integer.parseInt(trimmed);
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private static int bindParams(PreparedStatement ps, List<Object> params, int startIndex) throws SQLException {
        int index = startIndex;
        for (Object param : params) {
            if (param == null) {
                ps.setObject(index++, null);
            } else if (param instanceof Integer) {
                ps.setInt(index++, (Integer) param);
            } else if (param instanceof Long) {
                ps.setLong(index++, (Long) param);
            } else if (param instanceof Double) {
                ps.setDouble(index++, (Double) param);
            } else {
                ps.setString(index++, param.toString());
            }
        }
        return index;
    }

    private static String buildInClause(int size) {
        if (size <= 0) {
            return "";
        }
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < size; i++) {
            if (i > 0) {
                builder.append(',');
            }
            builder.append('?');
        }
        return builder.toString();
    }

    private static boolean tableExists(Connection connection, String table) throws SQLException {
        if (connection == null || table == null || table.isBlank()) {
            return false;
        }
        String normalizedTable = table.toLowerCase(Locale.ROOT);
        try (PreparedStatement ps = connection.prepareStatement("SELECT to_regclass(?)")) {
            ps.setString(1, normalizedTable);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rs.getString(1) != null;
                }
            }
        }
        return false;
    }

    private static Integer getInteger(ResultSet rs, String column) throws SQLException {
        int value = rs.getInt(column);
        return rs.wasNull() ? null : value;
    }

    private static Double getDouble(ResultSet rs, String column) throws SQLException {
        double value = rs.getDouble(column);
        return rs.wasNull() ? null : value;
    }

    public static final class EtensuSearchCriteria {
        private String keyword;
        private String category;
        private String asOf;
        private String tensuVersion;
        private Double pointsMin;
        private Double pointsMax;
        private int page;
        private int size;
        private boolean includeTotalCount;

        public String getKeyword() {
            return keyword;
        }

        public void setKeyword(String keyword) {
            this.keyword = keyword;
        }

        public String getCategory() {
            return category;
        }

        public void setCategory(String category) {
            this.category = category;
        }

        public String getAsOf() {
            return asOf;
        }

        public void setAsOf(String asOf) {
            this.asOf = asOf;
        }

        public String getTensuVersion() {
            return tensuVersion;
        }

        public void setTensuVersion(String tensuVersion) {
            this.tensuVersion = tensuVersion;
        }

        public Double getPointsMin() {
            return pointsMin;
        }

        public void setPointsMin(Double pointsMin) {
            this.pointsMin = pointsMin;
        }

        public Double getPointsMax() {
            return pointsMax;
        }

        public void setPointsMax(Double pointsMax) {
            this.pointsMax = pointsMax;
        }

        public int getPage() {
            return page;
        }

        public void setPage(int page) {
            this.page = page;
        }

        public int getSize() {
            return size;
        }

        public void setSize(int size) {
            this.size = size;
        }

        public boolean isIncludeTotalCount() {
            return includeTotalCount;
        }

        public void setIncludeTotalCount(boolean includeTotalCount) {
            this.includeTotalCount = includeTotalCount;
        }
    }

    public static final class EtensuSearchResult {
        private final List<EtensuRecord> records;
        private final Integer totalCount;
        private final String version;
        private final long dbTimeMs;
        private final boolean loadFailed;

        public EtensuSearchResult(List<EtensuRecord> records, Integer totalCount, String version) {
            this(records, totalCount, version, 0, false);
        }

        public EtensuSearchResult(List<EtensuRecord> records, Integer totalCount, String version, long dbTimeMs) {
            this(records, totalCount, version, dbTimeMs, false);
        }

        public EtensuSearchResult(List<EtensuRecord> records, Integer totalCount, String version, long dbTimeMs,
                boolean loadFailed) {
            this.records = records;
            this.totalCount = totalCount;
            this.version = version;
            this.dbTimeMs = dbTimeMs;
            this.loadFailed = loadFailed;
        }

        public List<EtensuRecord> getRecords() {
            return records;
        }

        public Integer getTotalCount() {
            return totalCount;
        }

        public String getVersion() {
            return version;
        }

        public long getDbTimeMs() {
            return dbTimeMs;
        }

        public boolean isLoadFailed() {
            return loadFailed;
        }
    }

    public static final class EtensuRecord {
        private String tensuCode;
        private String name;
        private String kubun;
        private Double tanka;
        private Double points;
        private String unit;
        private String category;
        private String startDate;
        private String endDate;
        private String tensuVersion;
        private String noticeDate;
        private String effectiveDate;
        private Integer hTani1;
        private String hGroup1;
        private Integer hTani2;
        private String hGroup2;
        private Integer hTani3;
        private String hGroup3;
        private Integer rDay;
        private Integer rMonth;
        private Integer rSame;
        private Integer rWeek;
        private Integer nGroup;
        private Integer cKaisu;
        private final List<OrcaEtensuConflict> conflicts = new ArrayList<>();
        private final List<OrcaEtensuAddition> additions = new ArrayList<>();
        private final List<OrcaEtensuCalcUnit> calcUnits = new ArrayList<>();
        private final List<OrcaEtensuBundlingMember> bundlingMembers = new ArrayList<>();
        private final List<OrcaEtensuSpecimen> specimens = new ArrayList<>();

        public String getTensuCode() {
            return tensuCode;
        }

        public String getName() {
            return name;
        }

        public String getKubun() {
            return kubun;
        }

        public Double getTanka() {
            return tanka;
        }

        public Double getPoints() {
            return points;
        }

        public String getUnit() {
            return unit;
        }

        public String getCategory() {
            return category;
        }

        public String getStartDate() {
            return startDate;
        }

        public String getEndDate() {
            return endDate;
        }

        public String getTensuVersion() {
            return tensuVersion;
        }

        public String getNoticeDate() {
            return noticeDate;
        }

        public String getEffectiveDate() {
            return effectiveDate;
        }

        public List<OrcaEtensuConflict> getConflicts() {
            return conflicts;
        }

        public List<OrcaEtensuAddition> getAdditions() {
            return additions;
        }

        public List<OrcaEtensuCalcUnit> getCalcUnits() {
            return calcUnits;
        }

        public List<OrcaEtensuBundlingMember> getBundlingMembers() {
            return bundlingMembers;
        }

        public List<OrcaEtensuSpecimen> getSpecimens() {
            return specimens;
        }

        private boolean isConflictScopeEnabled(String scope) {
            if (scope == null) {
                return false;
            }
            switch (scope) {
                case "day":
                    return isRelated(rDay);
                case "month":
                    return isRelated(rMonth);
                case "same":
                    return isRelated(rSame);
                case "week":
                    return isRelated(rWeek);
                default:
                    return false;
            }
        }

        private List<String> groupCodes() {
            List<String> groups = new ArrayList<>();
            if (hGroup1 != null && !hGroup1.isBlank()) {
                groups.add(hGroup1);
            }
            if (hGroup2 != null && !hGroup2.isBlank()) {
                groups.add(hGroup2);
            }
            if (hGroup3 != null && !hGroup3.isBlank()) {
                groups.add(hGroup3);
            }
            return groups;
        }
    }

    private static final class EtensuQuery {
        private final String whereClause;
        private final List<Object> params;

        private EtensuQuery(String whereClause, List<Object> params) {
            this.whereClause = whereClause;
            this.params = params;
        }
    }

    private static final class EtensuTableMeta {
        private final String fromClause;
        private final String srycdColumn;
        private final String kubunColumn;
        private final String nameColumn;
        private final String tankaColumn;
        private final String unitColumn;
        private final String categoryColumn;
        private final String startDateColumn;
        private final String endDateColumn;
        private final String tensuVersionColumn;
        private final String hTani1Column;
        private final String hGroup1Column;
        private final String hTani2Column;
        private final String hGroup2Column;
        private final String hTani3Column;
        private final String hGroup3Column;
        private final String rDayColumn;
        private final String rMonthColumn;
        private final String rSameColumn;
        private final String rWeekColumn;
        private final String nGroupColumn;
        private final String cKaisuColumn;
        private final String chgYmdColumn;
        private final boolean hasName;
        private final boolean hasTensuVersion;

        private EtensuTableMeta(String fromClause, String srycdColumn,
                String kubunColumn, String nameColumn, String tankaColumn, String unitColumn,
                String categoryColumn, String startDateColumn, String endDateColumn, String tensuVersionColumn,
                String hTani1Column, String hGroup1Column, String hTani2Column, String hGroup2Column,
                String hTani3Column, String hGroup3Column, String rDayColumn, String rMonthColumn,
                String rSameColumn, String rWeekColumn, String nGroupColumn, String cKaisuColumn,
                String chgYmdColumn, boolean hasName, boolean hasTensuVersion) {
            this.fromClause = fromClause;
            this.srycdColumn = srycdColumn;
            this.kubunColumn = kubunColumn;
            this.nameColumn = nameColumn;
            this.tankaColumn = tankaColumn;
            this.unitColumn = unitColumn;
            this.categoryColumn = categoryColumn;
            this.startDateColumn = startDateColumn;
            this.endDateColumn = endDateColumn;
            this.tensuVersionColumn = tensuVersionColumn;
            this.hTani1Column = hTani1Column;
            this.hGroup1Column = hGroup1Column;
            this.hTani2Column = hTani2Column;
            this.hGroup2Column = hGroup2Column;
            this.hTani3Column = hTani3Column;
            this.hGroup3Column = hGroup3Column;
            this.rDayColumn = rDayColumn;
            this.rMonthColumn = rMonthColumn;
            this.rSameColumn = rSameColumn;
            this.rWeekColumn = rWeekColumn;
            this.nGroupColumn = nGroupColumn;
            this.cKaisuColumn = cKaisuColumn;
            this.chgYmdColumn = chgYmdColumn;
            this.hasName = hasName;
            this.hasTensuVersion = hasTensuVersion;
        }

        private static EtensuTableMeta load(Connection connection) throws SQLException {
            DatabaseMetaData meta = connection.getMetaData();
            String etensuTable = resolveTable(meta, "TBL_ETENSU_1", "tbl_etensu_1");
            if (etensuTable == null) {
                etensuTable = "TBL_ETENSU_1";
            }
            String srycd = columnOrNull(meta, etensuTable, "SRYCD");
            String kubun = columnOrNull(meta, etensuTable, "KUBUN");
            String name = columnOrNull(meta, etensuTable, "NAME");
            String tanka = columnOrNull(meta, etensuTable, "TANKA");
            String unit = columnOrNull(meta, etensuTable, "TANI");
            String category = columnOrNull(meta, etensuTable, "CATEGORY");
            String startDate = columnOrNull(meta, etensuTable, "YMD_START");
            String endDate = columnOrNull(meta, etensuTable, "YMD_END");
            if (startDate == null) {
                startDate = columnOrNull(meta, etensuTable, "YUKOSTYMD");
            }
            if (endDate == null) {
                endDate = columnOrNull(meta, etensuTable, "YUKOEDYMD");
            }
            String tensuVersion = columnOrNull(meta, etensuTable, "TENSU_VERSION");
            String hTani1 = columnOrNull(meta, etensuTable, "H_TANI1");
            String hGroup1 = columnOrNull(meta, etensuTable, "H_GROUP1");
            String hTani2 = columnOrNull(meta, etensuTable, "H_TANI2");
            String hGroup2 = columnOrNull(meta, etensuTable, "H_GROUP2");
            String hTani3 = columnOrNull(meta, etensuTable, "H_TANI3");
            String hGroup3 = columnOrNull(meta, etensuTable, "H_GROUP3");
            String rDay = columnOrNull(meta, etensuTable, "R_DAY");
            String rMonth = columnOrNull(meta, etensuTable, "R_MONTH");
            String rSame = columnOrNull(meta, etensuTable, "R_SAME");
            String rWeek = columnOrNull(meta, etensuTable, "R_WEEK");
            String nGroup = columnOrNull(meta, etensuTable, "N_GROUP");
            String cKaisu = columnOrNull(meta, etensuTable, "C_KAISU");
            String chgYmd = columnOrNull(meta, etensuTable, "CHGYMD");
            String tensuTable = resolveTable(meta, "TBL_TENSU_MASTER", "tbl_tensu_master");
            String tensuSrycd = null;
            String tensuName = null;
            String tensuKubun = null;
            String tensuCategory = null;
            String tensuTanka = null;
            String tensuUnit = null;
            String tensuStartDate = null;
            String tensuEndDate = null;
            String tensuChgYmd = null;
            if (tensuTable != null) {
                tensuSrycd = columnOrNull(meta, tensuTable, "SRYCD");
                tensuName = columnOrNull(meta, tensuTable, "NAME");
                tensuKubun = columnOrNull(meta, tensuTable, "SRYKBN");
                tensuCategory = columnOrNull(meta, tensuTable, "SRYSYUKBN");
                tensuTanka = columnOrNull(meta, tensuTable, "TEN", "TANKA");
                tensuUnit = columnOrNull(meta, tensuTable, "TANINAME", "TANI");
                tensuStartDate = columnOrNull(meta, tensuTable, "YUKOSTYMD");
                tensuEndDate = columnOrNull(meta, tensuTable, "YUKOEDYMD");
                tensuChgYmd = columnOrNull(meta, tensuTable, "CHGYMD");
            }
            String resolvedSrycd = firstNonBlank(srycd, "SRYCD");
            String resolvedStartDate = firstNonBlank(startDate, "YUKOSTYMD");
            String resolvedEndDate = firstNonBlank(endDate, "YUKOEDYMD");
            String fromClause = " FROM " + etensuTable + " e";
            if (tensuTable != null && tensuSrycd != null && tensuStartDate != null) {
                String tensuSortEnd = firstNonBlank(tensuEndDate, tensuStartDate);
                fromClause = fromClause
                        + " LEFT JOIN (SELECT DISTINCT ON (tm2." + tensuSrycd + ") tm2.* FROM " + tensuTable
                        + " tm2 ORDER BY tm2." + tensuSrycd + ", tm2." + tensuStartDate + " DESC, tm2."
                        + tensuSortEnd + " DESC) tm ON tm." + tensuSrycd + " = e." + resolvedSrycd;
            }
            EtensuTableMeta resolved = new EtensuTableMeta(
                    fromClause,
                    qualify("e", resolvedSrycd),
                    coalesceExpr(qualify("e", kubun), qualify("tm", tensuKubun)),
                    coalesceExpr(qualify("e", name), qualify("tm", tensuName)),
                    coalesceExpr(qualify("e", tanka), qualify("tm", tensuTanka)),
                    coalesceExpr(qualify("e", unit), qualify("tm", tensuUnit)),
                    coalesceExpr(qualify("e", category), qualify("tm", tensuCategory)),
                    coalesceExpr(qualify("e", resolvedStartDate), qualify("tm", tensuStartDate)),
                    coalesceExpr(qualify("e", resolvedEndDate), qualify("tm", tensuEndDate)),
                    qualify("e", tensuVersion),
                    qualify("e", firstNonBlank(hTani1, "H_TANI1")),
                    qualify("e", firstNonBlank(hGroup1, "H_GROUP1")),
                    qualify("e", firstNonBlank(hTani2, "H_TANI2")),
                    qualify("e", firstNonBlank(hGroup2, "H_GROUP2")),
                    qualify("e", firstNonBlank(hTani3, "H_TANI3")),
                    qualify("e", firstNonBlank(hGroup3, "H_GROUP3")),
                    qualify("e", firstNonBlank(rDay, "R_DAY")),
                    qualify("e", firstNonBlank(rMonth, "R_MONTH")),
                    qualify("e", firstNonBlank(rSame, "R_SAME")),
                    qualify("e", firstNonBlank(rWeek, "R_WEEK")),
                    qualify("e", firstNonBlank(nGroup, "N_GROUP")),
                    qualify("e", firstNonBlank(cKaisu, "C_KAISU")),
                    coalesceExpr(qualify("e", chgYmd), qualify("tm", tensuChgYmd)),
                    coalesceExpr(qualify("e", name), qualify("tm", tensuName)) != null,
                    tensuVersion != null
            );
            return resolved;
        }

        private static String columnOrNull(DatabaseMetaData meta, String table, String... candidates)
                throws SQLException {
            if (table == null || candidates == null) {
                return null;
            }
            for (String candidate : candidates) {
                if (candidate == null || candidate.isBlank()) {
                    continue;
                }
                String resolved = findColumn(meta, table, candidate);
                if (resolved != null) {
                    return resolved;
                }
                resolved = findColumn(meta, table.toLowerCase(Locale.ROOT), candidate.toLowerCase(Locale.ROOT));
                if (resolved != null) {
                    return resolved;
                }
            }
            return null;
        }

        private static String resolveTable(DatabaseMetaData meta, String... candidates) throws SQLException {
            if (candidates == null) {
                return null;
            }
            for (String candidate : candidates) {
                if (candidate == null || candidate.isBlank()) {
                    continue;
                }
                String resolved = findTable(meta, candidate);
                if (resolved != null) {
                    return resolved;
                }
                resolved = findTable(meta, candidate.toLowerCase(Locale.ROOT));
                if (resolved != null) {
                    return resolved;
                }
            }
            return null;
        }

        private static String findTable(DatabaseMetaData meta, String table) throws SQLException {
            try (ResultSet rs = meta.getTables(null, null, table, new String[] {"TABLE", "VIEW"})) {
                if (rs.next()) {
                    return rs.getString("TABLE_NAME");
                }
            }
            return null;
        }

        private static String findColumn(DatabaseMetaData meta, String table, String column) throws SQLException {
            try (ResultSet rs = meta.getColumns(null, null, table, column)) {
                if (rs.next()) {
                    return rs.getString("COLUMN_NAME");
                }
            }
            return null;
        }

        private static String qualify(String alias, String column) {
            if (column == null || column.isBlank()) {
                return null;
            }
            return alias + "." + column;
        }

        private static String coalesceExpr(String primary, String secondary) {
            if (primary != null && secondary != null) {
                return "COALESCE(" + primary + ", " + secondary + ")";
            }
            return primary != null ? primary : secondary;
        }

        private String categoryColumn() {
            if (categoryColumn != null) {
                return categoryColumn;
            }
            return kubunColumn;
        }
    }

    private static String memberKey(String groupCode, String srycd) {
        return (groupCode == null ? "" : groupCode) + "|" + (srycd == null ? "" : srycd);
    }
}
