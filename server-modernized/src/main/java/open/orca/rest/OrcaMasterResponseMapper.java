package open.orca.rest;

import jakarta.enterprise.context.ApplicationScoped;
import java.time.Instant;
import open.dolphin.rest.dto.orca.OrcaAddressEntry;
import open.dolphin.rest.dto.orca.OrcaDrugMasterEntry;
import open.dolphin.rest.dto.orca.OrcaInsurerEntry;
import open.dolphin.rest.dto.orca.OrcaMasterMeta;
import open.dolphin.rest.dto.orca.OrcaTensuEntry;
import open.dolphin.rest.orca.AbstractOrcaRestResource;

@ApplicationScoped
class OrcaMasterResponseMapper {

    OrcaDrugMasterEntry toGenericClassEntry(OrcaMasterDao.GenericClassRecord entry,
            OrcaMasterService.LoadedFixture<?> fixture) {
        return buildDrugEntry(
                entry.classCode,
                entry.className,
                "generic",
                null,
                null,
                null,
                null,
                null,
                firstNonBlank(entry.startDate, OrcaMasterService.DEFAULT_VALID_FROM),
                firstNonBlank(entry.endDate, OrcaMasterService.DEFAULT_VALID_TO),
                entry.kanaName,
                fixture,
                false,
                false,
                false
        );
    }

    OrcaDrugMasterEntry toGenericClassEntry(OrcaMasterFixtureSupport.FixtureGenericClassEntry entry,
            OrcaMasterService.LoadedFixture<?> fixture) {
        return buildDrugEntry(
                entry.classCode,
                entry.className,
                "generic",
                null,
                null,
                null,
                null,
                null,
                firstNonBlank(entry.startDate, entry.validFrom, OrcaMasterService.DEFAULT_VALID_FROM),
                firstNonBlank(entry.endDate, entry.validTo, OrcaMasterService.DEFAULT_VALID_TO),
                entry.kanaName,
                fixture,
                false,
                fixture.origin == OrcaMasterService.DataOrigin.FALLBACK,
                fixture.origin == OrcaMasterService.DataOrigin.FALLBACK
        );
    }

    OrcaDrugMasterEntry toGenericPriceEntry(OrcaMasterFixtureSupport.FixtureGenericPriceEntry entry,
            OrcaMasterService.LoadedFixture<?> fixture) {
        return buildDrugEntry(
                firstNonBlank(entry.srycd, entry.code),
                firstNonBlank(entry.drugName, entry.name),
                "generic-price",
                firstNonBlank(entry.unit),
                firstNonBlankDouble(entry.price, entry.minPrice),
                null,
                null,
                null,
                firstNonBlank(entry.startDate, entry.validFrom, OrcaMasterService.DEFAULT_VALID_FROM),
                firstNonBlank(entry.endDate, entry.validTo, OrcaMasterService.DEFAULT_VALID_TO),
                null,
                fixture,
                false,
                false,
                fixture.origin == OrcaMasterService.DataOrigin.FALLBACK
        );
    }

    OrcaDrugMasterEntry toGenericPriceEntry(OrcaMasterDao.GenericPriceRecord entry,
            OrcaMasterService.LoadedFixture<?> fixture) {
        return buildDrugEntry(
                entry.srycd,
                entry.drugName,
                "generic-price",
                entry.unit,
                entry.price,
                null,
                null,
                null,
                firstNonBlank(entry.startDate, OrcaMasterService.DEFAULT_VALID_FROM),
                firstNonBlank(entry.endDate, OrcaMasterService.DEFAULT_VALID_TO),
                null,
                fixture,
                false,
                false,
                false
        );
    }

    OrcaDrugMasterEntry toDrugEntry(OrcaMasterDao.DrugRecord entry, OrcaMasterService.LoadedFixture<?> fixture) {
        return buildDrugEntry(
                entry.srycd,
                entry.drugName,
                "drug",
                entry.unit,
                entry.price,
                null,
                null,
                null,
                firstNonBlank(entry.startDate, OrcaMasterService.DEFAULT_VALID_FROM),
                firstNonBlank(entry.endDate, OrcaMasterService.DEFAULT_VALID_TO),
                entry.note,
                fixture,
                false,
                false,
                false
        );
    }

    OrcaInsurerEntry toInsurerEntry(OrcaMasterFixtureSupport.FixtureHokenjaEntry entry,
            OrcaMasterService.LoadedFixture<?> fixture) {
        String payerCode = firstNonBlank(entry.payerCode, entry.insurerNumber);
        String payerType = resolvePayerType(firstNonBlank(entry.payerType, entry.insurerType), payerCode);
        OrcaInsurerEntry response = new OrcaInsurerEntry();
        response.setPayerCode(payerCode);
        response.setPayerName(firstNonBlank(entry.payerName, entry.insurerName));
        response.setPayerType(payerType);
        response.setPayerRatio(resolvePayerRatio(entry.payerRatio, payerType));
        response.setPrefCode(firstNonBlank(entry.prefCode, entry.prefectureCode, derivePrefCode(payerCode)));
        response.setCityCode(firstNonBlank(entry.cityCode, deriveCityCode(response.getPrefCode())));
        response.setValidFrom(firstNonBlank(entry.startDate, entry.validFrom, OrcaMasterService.DEFAULT_VALID_FROM));
        response.setValidTo(firstNonBlank(entry.endDate, entry.validTo, OrcaMasterService.DEFAULT_VALID_TO));
        response.setMeta(buildMeta(fixture, false, false,
                fixture.origin == OrcaMasterService.DataOrigin.FALLBACK, null));
        return response;
    }

    OrcaInsurerEntry toInsurerEntry(OrcaMasterDao.HokenjaRecord entry,
            OrcaMasterService.LoadedFixture<?> fixture) {
        OrcaInsurerEntry response = new OrcaInsurerEntry();
        response.setPayerCode(entry.payerCode);
        response.setPayerName(entry.payerName);
        response.setPayerType(resolvePayerType(entry.payerType, entry.payerCode));
        response.setPayerRatio(resolvePayerRatio(entry.payerRatio, response.getPayerType()));
        response.setPrefCode(firstNonBlank(entry.prefCode, derivePrefCode(entry.payerCode)));
        response.setCityCode(firstNonBlank(entry.cityCode, deriveCityCode(response.getPrefCode())));
        response.setZip(entry.zip);
        response.setAddressLine(entry.addressLine);
        response.setPhone(entry.phone);
        response.setValidFrom(firstNonBlank(entry.validFrom, OrcaMasterService.DEFAULT_VALID_FROM));
        response.setValidTo(firstNonBlank(entry.validTo, OrcaMasterService.DEFAULT_VALID_TO));
        response.setMeta(buildMeta(fixture, false, false, false, null));
        return response;
    }

    OrcaAddressEntry toAddressEntry(OrcaMasterFixtureSupport.FixtureAddressEntry entry,
            OrcaMasterService.LoadedFixture<?> fixture) {
        OrcaAddressEntry response = new OrcaAddressEntry();
        response.setZip(firstNonBlank(entry.zip, entry.zipCode));
        response.setPrefCode(firstNonBlank(entry.prefCode, entry.prefectureCode));
        response.setCityCode(entry.cityCode);
        response.setCity(entry.city);
        response.setTown(entry.town);
        response.setFullAddress(firstNonBlank(entry.fullAddress, entry.addressLine, entry.address));
        response.setKana(entry.kana);
        response.setMeta(buildMeta(fixture, false, false,
                fixture.origin == OrcaMasterService.DataOrigin.FALLBACK, null));
        return response;
    }

    OrcaAddressEntry toAddressEntry(OrcaMasterDao.AddressRecord entry,
            OrcaMasterService.LoadedFixture<?> fixture) {
        OrcaAddressEntry response = new OrcaAddressEntry();
        response.setZip(entry.zip);
        response.setPrefCode(entry.prefCode);
        response.setCityCode(entry.cityCode);
        response.setCity(entry.city);
        response.setTown(entry.town);
        response.setKana(entry.kana);
        response.setRoman(entry.roman);
        response.setFullAddress(firstNonBlank(entry.fullAddress, joinAddress(entry.city, entry.town)));
        response.setMeta(buildMeta(fixture, false, false, false, null));
        return response;
    }

    OrcaTensuEntry toCommentEntry(OrcaMasterDao.CommentRecord entry, OrcaMasterService.LoadedFixture<?> fixture) {
        OrcaTensuEntry response = new OrcaTensuEntry();
        response.setTensuCode(entry.tensuCode);
        response.setName(entry.name);
        response.setKubun(entry.category);
        response.setUnit(entry.unit);
        response.setStartDate(firstNonBlank(entry.startDate, OrcaMasterService.DEFAULT_VALID_FROM));
        response.setEndDate(firstNonBlank(entry.endDate, OrcaMasterService.DEFAULT_VALID_TO));
        response.setTensuVersion(firstNonBlank(entry.version, OrcaMasterService.DEFAULT_VERSION));
        response.setMeta(buildMeta(fixture, false, false, false, null));
        return response;
    }

    OrcaDrugMasterEntry toYouhouEntry(OrcaMasterDao.YouhouRecord entry, OrcaMasterService.LoadedFixture<?> fixture) {
        return buildDrugEntry(
                entry.youhouCode,
                entry.youhouName,
                "youhou",
                null,
                null,
                entry.youhouCode,
                null,
                null,
                firstNonBlank(entry.startDate, OrcaMasterService.DEFAULT_VALID_FROM),
                firstNonBlank(entry.endDate, OrcaMasterService.DEFAULT_VALID_TO),
                null,
                fixture,
                false,
                false,
                false
        );
    }

    OrcaDrugMasterEntry toYouhouEntry(OrcaMasterFixtureSupport.FixtureYouhouEntry entry,
            OrcaMasterService.LoadedFixture<?> fixture) {
        return buildDrugEntry(
                entry.youhouCode,
                entry.youhouName,
                "youhou",
                null,
                null,
                entry.youhouCode,
                null,
                null,
                firstNonBlank(entry.validFrom, OrcaMasterService.DEFAULT_VALID_FROM),
                firstNonBlank(entry.validTo, OrcaMasterService.DEFAULT_VALID_TO),
                entry.comment,
                fixture,
                false,
                false,
                fixture.origin == OrcaMasterService.DataOrigin.FALLBACK
        );
    }

    OrcaDrugMasterEntry toMaterialEntry(OrcaMasterDao.MaterialRecord entry, OrcaMasterService.LoadedFixture<?> fixture) {
        return buildDrugEntry(
                entry.materialCode,
                entry.materialName,
                "material",
                entry.unit,
                entry.price,
                null,
                entry.materialCategory,
                null,
                firstNonBlank(entry.startDate, OrcaMasterService.DEFAULT_VALID_FROM),
                firstNonBlank(entry.endDate, OrcaMasterService.DEFAULT_VALID_TO),
                entry.maker,
                fixture,
                false,
                false,
                false
        );
    }

    OrcaDrugMasterEntry toMaterialEntry(OrcaMasterFixtureSupport.FixtureMaterialEntry entry,
            OrcaMasterService.LoadedFixture<?> fixture) {
        return buildDrugEntry(
                entry.materialCode,
                entry.materialName,
                "material",
                firstNonBlank(entry.unit),
                firstNonBlankDouble(entry.price),
                null,
                entry.materialCategory,
                null,
                firstNonBlank(entry.startDate, entry.validFrom, OrcaMasterService.DEFAULT_VALID_FROM),
                firstNonBlank(entry.endDate, entry.validTo, OrcaMasterService.DEFAULT_VALID_TO),
                firstNonBlank(entry.maker),
                fixture,
                false,
                false,
                fixture.origin == OrcaMasterService.DataOrigin.FALLBACK
        );
    }

    OrcaDrugMasterEntry toKensaSortEntry(OrcaMasterDao.KensaSortRecord entry,
            OrcaMasterService.LoadedFixture<?> fixture) {
        return buildDrugEntry(
                entry.kensaCode,
                entry.kensaName,
                "kensa-sort",
                null,
                null,
                null,
                entry.classification,
                entry.kensaSort,
                firstNonBlank(entry.startDate, OrcaMasterService.DEFAULT_VALID_FROM),
                firstNonBlank(entry.endDate, OrcaMasterService.DEFAULT_VALID_TO),
                null,
                fixture,
                false,
                false,
                false
        );
    }

    OrcaDrugMasterEntry toKensaSortEntry(OrcaMasterFixtureSupport.FixtureKensaSortEntry entry,
            OrcaMasterService.LoadedFixture<?> fixture) {
        return buildDrugEntry(
                entry.kensaCode,
                entry.kensaName,
                "kensa-sort",
                null,
                null,
                null,
                firstNonBlank(entry.classification),
                firstNonBlank(entry.kensaSort),
                firstNonBlank(entry.validFrom, OrcaMasterService.DEFAULT_VALID_FROM),
                firstNonBlank(entry.validTo, OrcaMasterService.DEFAULT_VALID_TO),
                null,
                fixture,
                false,
                false,
                fixture.origin == OrcaMasterService.DataOrigin.FALLBACK
        );
    }

    OrcaTensuEntry toEtensuEntry(OrcaMasterFixtureSupport.FixtureEtensuEntry entry,
            OrcaMasterService.LoadedFixture<?> fixture) {
        OrcaTensuEntry response = new OrcaTensuEntry();
        response.setTensuCode(firstNonBlank(entry.tensuCode, entry.medicalFeeCode));
        response.setName(firstNonBlank(entry.name));
        response.setKubun(firstNonBlank(entry.kubun, entry.category));
        response.setNoticeDate(firstNonBlank(entry.noticeDate, entry.tensuVersion, entry.version));
        response.setEffectiveDate(firstNonBlank(entry.effectiveDate, entry.startDate, entry.validFrom,
                OrcaMasterService.DEFAULT_VALID_FROM));
        response.setPoints(firstNonBlankDouble(entry.points, entry.tanka));
        response.setTanka(firstNonBlankDouble(entry.tanka, entry.points));
        response.setUnit(entry.unit);
        response.setCategory(firstNonBlank(entry.category, entry.etensuCategory));
        response.setStartDate(firstNonBlank(entry.startDate, entry.validFrom, OrcaMasterService.DEFAULT_VALID_FROM));
        response.setEndDate(firstNonBlank(entry.endDate, entry.validTo, OrcaMasterService.DEFAULT_VALID_TO));
        response.setTensuVersion(firstNonBlank(entry.tensuVersion, entry.version, entry.snapshotVersion));
        response.setMeta(buildMeta(fixture, false,
                fixture.origin == OrcaMasterService.DataOrigin.FALLBACK,
                fixture.origin == OrcaMasterService.DataOrigin.FALLBACK, null));
        return response;
    }

    OrcaTensuEntry toEtensuEntry(EtensuDao.EtensuRecord record, OrcaMasterService.LoadedFixture<?> fixture) {
        OrcaTensuEntry response = new OrcaTensuEntry();
        response.setTensuCode(record.getTensuCode());
        response.setName(record.getName());
        response.setKubun(record.getKubun());
        response.setNoticeDate(firstNonBlank(record.getNoticeDate(), record.getTensuVersion()));
        response.setEffectiveDate(firstNonBlank(record.getEffectiveDate(), record.getStartDate(),
                OrcaMasterService.DEFAULT_VALID_FROM));
        response.setPoints(firstNonBlankDouble(record.getPoints(), record.getTanka()));
        response.setTanka(firstNonBlankDouble(record.getTanka(), record.getPoints()));
        response.setUnit(record.getUnit());
        response.setCategory(record.getCategory());
        response.setStartDate(firstNonBlank(record.getStartDate(), OrcaMasterService.DEFAULT_VALID_FROM));
        response.setEndDate(firstNonBlank(record.getEndDate(), OrcaMasterService.DEFAULT_VALID_TO));
        response.setTensuVersion(record.getTensuVersion());
        response.setConflicts(record.getConflicts().isEmpty() ? null : record.getConflicts());
        response.setAdditions(record.getAdditions().isEmpty() ? null : record.getAdditions());
        response.setCalcUnits(record.getCalcUnits().isEmpty() ? null : record.getCalcUnits());
        response.setBundlingMembers(record.getBundlingMembers().isEmpty() ? null : record.getBundlingMembers());
        response.setSpecimens(record.getSpecimens().isEmpty() ? null : record.getSpecimens());
        response.setMeta(buildMeta(fixture, false, false, false, null));
        return response;
    }

    OrcaMasterMeta buildMeta(OrcaMasterService.DataOrigin origin, String snapshotVersion, String version,
            boolean cacheHit, boolean missingMaster, boolean fallbackUsed, Boolean validationError) {
        OrcaMasterMeta meta = new OrcaMasterMeta();
        meta.setVersion(firstNonBlank(version, OrcaMasterService.DEFAULT_VERSION));
        meta.setRunId(AbstractOrcaRestResource.resolveRunIdValue((String) null));
        meta.setSnapshotVersion(snapshotVersion);
        meta.setDataSource(dataSourceForOrigin(origin));
        meta.setCacheHit(cacheHit);
        meta.setMissingMaster(missingMaster);
        meta.setFallbackUsed(fallbackUsed);
        meta.setValidationError(validationError);
        meta.setFetchedAt(Instant.now().toString());
        if (version != null) {
            meta.setMasterVersion(version);
        }
        if (fixtureState(origin, version) != null) {
            fixtureState(origin, version).applyTo(meta);
        }
        return meta;
    }

    OrcaMasterMeta buildMeta(OrcaMasterService.LoadedFixture<?> fixture, boolean cacheHit, boolean missingMaster,
            boolean fallbackUsed, Boolean validationError) {
        OrcaMasterMeta meta = buildMeta(fixture.origin, fixture.snapshotVersion, fixture.version, cacheHit,
                missingMaster, fallbackUsed, validationError);
        if (fixture.cacheState != null) {
            fixture.cacheState.applyTo(meta);
        }
        return meta;
    }

    OrcaDrugMasterEntry buildDrugEntry(String code, String name, String category, String unit, Double minPrice,
            String youhouCode, String materialCategory, String kensaSort, String validFrom, String validTo, String note,
            OrcaMasterService.LoadedFixture<?> fixture, Boolean cacheHit, Boolean missingMaster, Boolean fallbackUsed) {
        OrcaDrugMasterEntry entry = new OrcaDrugMasterEntry();
        entry.setCode(code);
        entry.setName(name);
        entry.setCategory(category);
        entry.setUnit(unit);
        entry.setMinPrice(minPrice);
        entry.setYouhouCode(youhouCode);
        entry.setMaterialCategory(materialCategory);
        entry.setKensaSort(kensaSort);
        entry.setValidFrom(validFrom);
        entry.setValidTo(validTo);
        entry.setNote(note);
        boolean missing = Boolean.TRUE.equals(missingMaster);
        boolean fallback = Boolean.TRUE.equals(fallbackUsed) || missing
                || fixture.origin == OrcaMasterService.DataOrigin.FALLBACK;
        entry.setMeta(buildMeta(fixture, Boolean.TRUE.equals(cacheHit), missing, fallback, null));
        return entry;
    }

    private OrcaMasterCacheState fixtureState(OrcaMasterService.DataOrigin origin, String version) {
        if (origin == OrcaMasterService.DataOrigin.FALLBACK) {
            return OrcaMasterCacheState.unavailable("master");
        }
        return OrcaMasterCacheState.current("master", version);
    }

    private String dataSourceForOrigin(OrcaMasterService.DataOrigin origin) {
        if (origin == OrcaMasterService.DataOrigin.FALLBACK) {
            return "fallback";
        }
        if (origin == OrcaMasterService.DataOrigin.ORCA_DB || origin == OrcaMasterService.DataOrigin.LOCAL_CACHE) {
            return "server";
        }
        return "snapshot";
    }

    private String resolvePayerType(String rawType, String payerCode) {
        String source = rawType != null ? rawType : "";
        if (source.contains("国保")) {
            return "national_health";
        }
        if (source.contains("船員")) {
            return "seamen";
        }
        if (source.contains("共済")) {
            return "mutual_aid";
        }
        if (source.contains("後期")) {
            return "late_elderly";
        }
        if (source.contains("社保") || source.contains("健保") || source.contains("協会")) {
            return "social_insurance";
        }
        if (payerCode != null && payerCode.startsWith("39")) {
            return "late_elderly";
        }
        return "other";
    }

    private Double resolvePayerRatio(Double ratio, String payerType) {
        if (ratio != null) {
            return ratio;
        }
        return "late_elderly".equals(payerType) ? 0.1 : 0.3;
    }

    private String derivePrefCode(String payerCode) {
        if (payerCode == null || payerCode.length() < 2) {
            return null;
        }
        return payerCode.substring(0, 2);
    }

    private String deriveCityCode(String prefCode) {
        if (prefCode == null || prefCode.isBlank()) {
            return null;
        }
        return prefCode + "000";
    }

    private String firstNonBlank(String... candidates) {
        if (candidates == null) {
            return null;
        }
        for (String candidate : candidates) {
            if (candidate != null && !candidate.isBlank()) {
                return candidate;
            }
        }
        return null;
    }

    private Double firstNonBlankDouble(Double... candidates) {
        if (candidates == null) {
            return null;
        }
        for (Double candidate : candidates) {
            if (candidate != null) {
                return candidate;
            }
        }
        return null;
    }

    private String joinAddress(String city, String town) {
        String left = firstNonBlank(city);
        String right = firstNonBlank(town);
        if (left == null) {
            return right;
        }
        if (right == null) {
            return left;
        }
        return left + right;
    }
}
