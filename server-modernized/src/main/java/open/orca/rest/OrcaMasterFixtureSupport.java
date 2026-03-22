package open.orca.rest;

import java.util.Collections;
import java.util.List;

class OrcaMasterFixtureSupport {
    private final OrcaMasterService masterService;

    OrcaMasterFixtureSupport(OrcaMasterService masterService) {
        this.masterService = masterService;
    }

    <T> LoadedFixture<T> toResourceFixture(OrcaMasterService.LoadedFixture<T> fixture) {
        if (fixture == null) {
            return new LoadedFixture<>(Collections.emptyList(), null, null, DataOrigin.FALLBACK, false);
        }
        return new LoadedFixture<>(
                fixture.entries,
                fixture.snapshotVersion,
                fixture.version,
                DataOrigin.valueOf(fixture.origin.name()),
                fixture.loadFailed
        );
    }

    <T> OrcaMasterService.LoadedFixture<T> toServiceFixture(LoadedFixture<T> fixture) {
        if (fixture == null) {
            return new OrcaMasterService.LoadedFixture<>(Collections.emptyList(), null, null,
                    OrcaMasterService.DataOrigin.FALLBACK, false);
        }
        return new OrcaMasterService.LoadedFixture<>(
                fixture.entries,
                fixture.snapshotVersion,
                fixture.version,
                OrcaMasterService.DataOrigin.valueOf(fixture.origin.name()),
                fixture.loadFailed
        );
    }

    <T> LoadedFixture<T> buildDbFixture(List<T> entries, String version, boolean loadFailed) {
        return toResourceFixture(masterService.buildDbFixture(entries, version, loadFailed));
    }

    <T> LoadedFixture<T> unavailableFixture() {
        return new LoadedFixture<>(Collections.emptyList(), null, null, DataOrigin.FALLBACK, true);
    }

    enum DataOrigin {
        ORCA_DB,
        FALLBACK
    }

    static final class LoadedFixture<T> {
        final List<T> entries;
        final String snapshotVersion;
        final String version;
        final DataOrigin origin;
        final boolean loadFailed;

        LoadedFixture(List<T> entries, String snapshotVersion, String version, DataOrigin origin, boolean loadFailed) {
            this.entries = entries;
            this.snapshotVersion = snapshotVersion;
            this.version = version;
            this.origin = origin;
            this.loadFailed = loadFailed;
        }
    }

    static final class FixtureListResponse<T> {
        public List<T> list;
        public Integer totalCount;
        public String snapshotVersion;
        public String version;
    }

    static final class FixtureGenericClassEntry {
        public String classCode;
        public String className;
        public String kanaName;
        public String categoryCode;
        public String parentClassCode;
        public Boolean isLeaf;
        public String startDate;
        public String endDate;
        public String validFrom;
        public String validTo;
        public Boolean cacheHit;
        public Boolean missingMaster;
        public Boolean fallbackUsed;
    }

    static final class FixtureGenericPriceEntry {
        public String code;
        public String srycd;
        public String name;
        public String drugName;
        public String unit;
        public Double price;
        public Double minPrice;
        public String youhouCode;
        public String startDate;
        public String endDate;
        public String validFrom;
        public String validTo;
        public Boolean cacheHit;
        public Boolean missingMaster;
        public Boolean fallbackUsed;
    }

    static final class FixtureHokenjaEntry {
        public String payerCode;
        public String insurerNumber;
        public String payerName;
        public String insurerName;
        public String insurerKana;
        public String payerType;
        public String insurerType;
        public Double payerRatio;
        public String prefCode;
        public String prefectureCode;
        public String cityCode;
        public String zip;
        public String zipCode;
        public String addressLine;
        public String address;
        public String phone;
        public String startDate;
        public String endDate;
        public String validFrom;
        public String validTo;
        public Boolean cacheHit;
        public Boolean missingMaster;
        public Boolean fallbackUsed;
    }

    static final class FixtureAddressEntry {
        public String zip;
        public String zipCode;
        public String prefCode;
        public String prefectureCode;
        public String cityCode;
        public String city;
        public String town;
        public String kana;
        public String roman;
        public String fullAddress;
        public String addressLine;
        public String address;
        public String startDate;
        public String endDate;
        public String validFrom;
        public String validTo;
        public Boolean cacheHit;
        public Boolean missingMaster;
        public Boolean fallbackUsed;
    }

    static final class FixtureYouhouEntry {
        public String youhouCode;
        public String youhouName;
        public String timingCode;
        public String routeCode;
        public Integer daysLimit;
        public Integer dosePerDay;
        public String comment;
        public String validFrom;
        public String validTo;
        public Boolean cacheHit;
        public Boolean missingMaster;
        public Boolean fallbackUsed;
    }

    static final class FixtureMaterialEntry {
        public String materialCode;
        public String materialName;
        public String category;
        public String materialCategory;
        public String insuranceType;
        public String unit;
        public Double price;
        public String maker;
        public String startDate;
        public String endDate;
        public String validFrom;
        public String validTo;
        public Boolean cacheHit;
        public Boolean missingMaster;
        public Boolean fallbackUsed;
    }

    static final class FixtureKensaSortEntry {
        public String kensaCode;
        public String kensaName;
        public String sampleType;
        public String kensaSort;
        public String classification;
        public String insuranceCategory;
        public String category;
        public String departmentCode;
        public String startDate;
        public String endDate;
        public String validFrom;
        public String validTo;
        public Boolean cacheHit;
        public Boolean missingMaster;
        public Boolean fallbackUsed;
    }

    static final class FixtureEtensuEntry {
        public String medicalFeeCode;
        public String tensuCode;
        public String name;
        public String note;
        public String category;
        public String etensuCategory;
        public String kubun;
        public Double points;
        public Double tanka;
        public String unit;
        public String noticeDate;
        public String effectiveDate;
        public String startDate;
        public String endDate;
        public String validFrom;
        public String validTo;
        public String tensuVersion;
        public String snapshotVersion;
        public String version;
        public Boolean cacheHit;
        public Boolean missingMaster;
        public Boolean fallbackUsed;
    }
}
