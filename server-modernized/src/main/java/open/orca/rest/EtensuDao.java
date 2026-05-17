package open.orca.rest;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.logging.Logger;
import open.dolphin.rest.dto.orca.OrcaEtensuAddition;
import open.dolphin.rest.dto.orca.OrcaEtensuBundlingMember;
import open.dolphin.rest.dto.orca.OrcaEtensuCalcUnit;
import open.dolphin.rest.dto.orca.OrcaEtensuConflict;
import open.dolphin.rest.dto.orca.OrcaEtensuSpecimen;

@ApplicationScoped
public class EtensuDao {
    private static final Logger LOGGER = Logger.getLogger(EtensuDao.class.getName());
    private final LocalOrcaMasterCacheRepository localMasterCacheRepository;

    EtensuDao() {
        this(null);
    }

    @Inject
    EtensuDao(LocalOrcaMasterCacheRepository localMasterCacheRepository) {
        this.localMasterCacheRepository = localMasterCacheRepository;
    }

    public EtensuSearchResult search(EtensuSearchCriteria criteria) {
        if (criteria == null) {
            LOGGER.warning("ETENSU search criteria was null");
            return new EtensuSearchResult(Collections.emptyList(), 0, null, 0, true);
        }
        if (localMasterCacheRepository == null) {
            return new EtensuSearchResult(Collections.emptyList(), 0, criteria.tensuVersion, 0, true,
                    OrcaMasterCacheState.notImported("etensu"));
        }
        return localMasterCacheRepository.searchEtensu(criteria);
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
        private final OrcaMasterCacheState cacheState;

        public EtensuSearchResult(List<EtensuRecord> records, Integer totalCount, String version) {
            this(records, totalCount, version, 0, false);
        }

        public EtensuSearchResult(List<EtensuRecord> records, Integer totalCount, String version, long dbTimeMs) {
            this(records, totalCount, version, dbTimeMs, false);
        }

        public EtensuSearchResult(List<EtensuRecord> records, Integer totalCount, String version, long dbTimeMs,
                boolean loadFailed) {
            this(records, totalCount, version, dbTimeMs, loadFailed, OrcaMasterCacheState.current("etensu", version));
        }

        public EtensuSearchResult(List<EtensuRecord> records, Integer totalCount, String version, long dbTimeMs,
                boolean loadFailed, OrcaMasterCacheState cacheState) {
            this.records = records == null ? List.of() : List.copyOf(records);
            this.totalCount = totalCount;
            this.version = version;
            this.dbTimeMs = dbTimeMs;
            this.loadFailed = loadFailed;
            this.cacheState = cacheState;
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

        public OrcaMasterCacheState getCacheState() {
            return cacheState;
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
