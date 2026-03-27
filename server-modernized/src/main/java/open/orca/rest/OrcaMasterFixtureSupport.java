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

    static final class FixtureGenericClassEntry {
        String classCode;
        String className;
        String kanaName;
        String startDate;
        String endDate;
        String validFrom;
        String validTo;
    }

    static final class FixtureGenericPriceEntry {
        String code;
        String srycd;
        String name;
        String drugName;
        String unit;
        Double price;
        Double minPrice;
        String startDate;
        String endDate;
        String validFrom;
        String validTo;
    }

    static final class FixtureHokenjaEntry {
        String payerCode;
        String insurerNumber;
        String payerName;
        String insurerName;
        String payerType;
        String insurerType;
        Double payerRatio;
        String prefCode;
        String prefectureCode;
        String cityCode;
        String startDate;
        String endDate;
        String validFrom;
        String validTo;
    }

    static final class FixtureAddressEntry {
        String zip;
        String zipCode;
        String prefCode;
        String prefectureCode;
        String cityCode;
        String city;
        String town;
        String kana;
        String fullAddress;
        String addressLine;
        String address;
    }

    static final class FixtureYouhouEntry {
        String youhouCode;
        String youhouName;
        String comment;
        String validFrom;
        String validTo;
    }

    static final class FixtureMaterialEntry {
        String materialCode;
        String materialName;
        String materialCategory;
        String unit;
        Double price;
        String maker;
        String startDate;
        String endDate;
        String validFrom;
        String validTo;
    }

    static final class FixtureKensaSortEntry {
        String kensaCode;
        String kensaName;
        String kensaSort;
        String classification;
        String validFrom;
        String validTo;
    }

    static final class FixtureEtensuEntry {
        String medicalFeeCode;
        String tensuCode;
        String name;
        String category;
        String etensuCategory;
        String kubun;
        Double points;
        Double tanka;
        String unit;
        String noticeDate;
        String effectiveDate;
        String startDate;
        String endDate;
        String validFrom;
        String validTo;
        String tensuVersion;
        String snapshotVersion;
        String version;
    }
}
