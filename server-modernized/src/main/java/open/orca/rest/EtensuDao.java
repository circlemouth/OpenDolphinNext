package open.orca.rest;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;
import open.dolphin.rest.dto.orca.OrcaEtensuAddition;
import open.dolphin.rest.dto.orca.OrcaEtensuBundlingMember;
import open.dolphin.rest.dto.orca.OrcaEtensuCalcUnit;
import open.dolphin.rest.dto.orca.OrcaEtensuConflict;
import open.dolphin.rest.dto.orca.OrcaEtensuSpecimen;

@ApplicationScoped
public class EtensuDao {
    private static final Logger LOGGER = Logger.getLogger(EtensuDao.class.getName());
    private final ORCAConnection orcaConnection;
    private final EtensuDetailLoader detailLoader;

    EtensuDao() {
        this(null);
    }

    @Inject
    EtensuDao(ORCAConnection orcaConnection) {
        this(orcaConnection, new EtensuDetailLoader());
    }

    EtensuDao(ORCAConnection orcaConnection, EtensuDetailLoader detailLoader) {
        this.orcaConnection = orcaConnection;
        this.detailLoader = detailLoader;
    }

    public EtensuSearchResult search(EtensuSearchCriteria criteria) {
        if (criteria == null) {
            LOGGER.warning("ETENSU search criteria was null");
            return new EtensuSearchResult(Collections.emptyList(), 0, null, 0, true);
        }
        long startTime = System.nanoTime();
        try (Connection connection = openConnection()) {
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

    private Connection openConnection() throws SQLException {
        if (orcaConnection == null) {
            throw new SQLException("ORCAConnection is not configured");
        }
        return orcaConnection.getConnection();
    }

    private EtensuQuery buildQuery(EtensuSearchCriteria criteria, EtensuTableMeta meta) {
        StringBuilder where = new StringBuilder(meta.fromClause).append(" WHERE 1=1");
        String srycdColumn = EtensuDaoSupport.selectColumn(meta.srycdColumn);
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
            where.append(" AND COALESCE(").append(EtensuDaoSupport.selectColumn(meta.tankaColumn)).append(", 0) >= ?");
            params.add(criteria.pointsMin);
        }
        if (criteria.pointsMax != null) {
            where.append(" AND COALESCE(").append(EtensuDaoSupport.selectColumn(meta.tankaColumn)).append(", 0) <= ?");
            params.add(criteria.pointsMax);
        }
        EtensuQuery query = new EtensuQuery(where.toString(), params);
        return query;
    }

    private int fetchTotalCount(Connection connection, EtensuQuery query) throws SQLException {
        String sql = "SELECT count(*)" + query.whereClause;
        try (var ps = connection.prepareStatement(sql)) {
            EtensuDaoSupport.bindParams(ps, query.params, 1);
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
                + EtensuDaoSupport.selectColumn(meta.srycdColumn) + " AS srycd, "
                + EtensuDaoSupport.selectColumn(meta.kubunColumn) + " AS kubun, "
                + EtensuDaoSupport.selectColumn(meta.nameColumn) + " AS name, "
                + EtensuDaoSupport.selectColumn(meta.tankaColumn) + " AS tanka, "
                + EtensuDaoSupport.selectColumn(meta.unitColumn) + " AS unit, "
                + EtensuDaoSupport.selectColumn(meta.categoryColumn()) + " AS category, "
                + EtensuDaoSupport.selectColumn(meta.startDateColumn) + " AS startDate, "
                + EtensuDaoSupport.selectColumn(meta.endDateColumn) + " AS endDate, "
                + EtensuDaoSupport.selectColumn(meta.tensuVersionColumn) + " AS tensuVersion, "
                + EtensuDaoSupport.selectColumn(meta.hTani1Column) + " AS hTani1, "
                + EtensuDaoSupport.selectColumn(meta.hGroup1Column) + " AS hGroup1, "
                + EtensuDaoSupport.selectColumn(meta.hTani2Column) + " AS hTani2, "
                + EtensuDaoSupport.selectColumn(meta.hGroup2Column) + " AS hGroup2, "
                + EtensuDaoSupport.selectColumn(meta.hTani3Column) + " AS hTani3, "
                + EtensuDaoSupport.selectColumn(meta.hGroup3Column) + " AS hGroup3, "
                + EtensuDaoSupport.selectColumn(meta.rDayColumn) + " AS rDay, "
                + EtensuDaoSupport.selectColumn(meta.rMonthColumn) + " AS rMonth, "
                + EtensuDaoSupport.selectColumn(meta.rSameColumn) + " AS rSame, "
                + EtensuDaoSupport.selectColumn(meta.rWeekColumn) + " AS rWeek, "
                + EtensuDaoSupport.selectColumn(meta.nGroupColumn) + " AS nGroup, "
                + EtensuDaoSupport.selectColumn(meta.cKaisuColumn) + " AS cKaisu, "
                + EtensuDaoSupport.selectColumn(meta.chgYmdColumn) + " AS chgYmd "
                + query.whereClause
                + " ORDER BY " + EtensuDaoSupport.selectColumn(meta.srycdColumn);
        int safeSize = Math.min(size, 2000);
        int safePage = Math.max(1, page);
        int offset = (safePage - 1) * safeSize;
        sql = sql + " LIMIT ? OFFSET ?";
        List<EtensuRecord> records = new ArrayList<>(safeSize);
        try (var ps = connection.prepareStatement(sql)) {
            int index = EtensuDaoSupport.bindParams(ps, query.params, 1);
            ps.setInt(index++, safeSize);
            ps.setInt(index, offset);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    EtensuRecord record = new EtensuRecord();
                    record.tensuCode = rs.getString("srycd");
                    record.kubun = rs.getString("kubun");
                    record.name = rs.getString("name");
                    record.tanka = EtensuDaoSupport.getDouble(rs, "tanka");
                    record.unit = rs.getString("unit");
                    record.category = rs.getString("category");
                    record.startDate = rs.getString("startDate");
                    record.endDate = rs.getString("endDate");
                    record.tensuVersion = rs.getString("tensuVersion");
                    record.noticeDate = rs.getString("chgYmd");
                    record.effectiveDate = record.startDate;
                    record.points = record.tanka;
                    record.hGroup1 = rs.getString("hGroup1");
                    record.hGroup2 = rs.getString("hGroup2");
                    record.hGroup3 = rs.getString("hGroup3");
                    record.rDay = EtensuDaoSupport.getInteger(rs, "rDay");
                    record.rMonth = EtensuDaoSupport.getInteger(rs, "rMonth");
                    record.rSame = EtensuDaoSupport.getInteger(rs, "rSame");
                    record.rWeek = EtensuDaoSupport.getInteger(rs, "rWeek");
                    record.nGroup = EtensuDaoSupport.getInteger(rs, "nGroup");
                    record.cKaisu = EtensuDaoSupport.getInteger(rs, "cKaisu");
                    records.add(record);
                }
            }
        }
        return records;
    }

    private void populateDetails(Connection connection, List<EtensuRecord> records, String asOf,
            EtensuTableMeta meta) throws SQLException {
        detailLoader.populateDetails(connection, records, asOf, meta);
    }

    private long toMillis(long startTime) {
        return java.util.concurrent.TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startTime);
    }

    private static boolean isRelated(Integer flag) {
        return EtensuDaoSupport.isRelated(flag);
    }

    private String resolveVersion(List<EtensuRecord> records, String fallback) {
        String numericVersion = null;
        Integer numericKey = null;
        String nonNumericVersion = EtensuDaoSupport.firstNonBlank(fallback);
        Integer fallbackKey = EtensuDaoSupport.parseVersionKey(fallback);
        if (fallbackKey != null) {
            numericVersion = fallback;
            numericKey = fallbackKey;
            nonNumericVersion = null;
        }
        for (EtensuRecord record : records) {
            if (record.tensuVersion == null || record.tensuVersion.isBlank()) {
                continue;
            }
            Integer candidateKey = EtensuDaoSupport.parseVersionKey(record.tensuVersion);
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
            this.records = records == null ? List.of() : List.copyOf(records);
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
        String tensuCode;
        String name;
        String kubun;
        Double tanka;
        Double points;
        String unit;
        String category;
        String startDate;
        String endDate;
        String tensuVersion;
        String noticeDate;
        String effectiveDate;
        String hGroup1;
        String hGroup2;
        String hGroup3;
        Integer rDay;
        Integer rMonth;
        Integer rSame;
        Integer rWeek;
        Integer nGroup;
        Integer cKaisu;
        final List<OrcaEtensuConflict> conflicts = new ArrayList<>();
        final List<OrcaEtensuAddition> additions = new ArrayList<>();
        final List<OrcaEtensuCalcUnit> calcUnits = new ArrayList<>();
        final List<OrcaEtensuBundlingMember> bundlingMembers = new ArrayList<>();
        final List<OrcaEtensuSpecimen> specimens = new ArrayList<>();

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
            return List.copyOf(conflicts);
        }

        public List<OrcaEtensuAddition> getAdditions() {
            return List.copyOf(additions);
        }

        public List<OrcaEtensuCalcUnit> getCalcUnits() {
            return List.copyOf(calcUnits);
        }

        public List<OrcaEtensuBundlingMember> getBundlingMembers() {
            return List.copyOf(bundlingMembers);
        }

        public List<OrcaEtensuSpecimen> getSpecimens() {
            return List.copyOf(specimens);
        }

        boolean isConflictScopeEnabled(String scope) {
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

        List<String> groupCodes() {
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
}
