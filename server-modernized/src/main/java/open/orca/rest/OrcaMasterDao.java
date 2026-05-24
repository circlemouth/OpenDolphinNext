package open.orca.rest;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

/**
 * ORCA master DAO.
 * Supported ORCA boundary is summarized in docs/security-and-orca.md.
 */
@ApplicationScoped
public class OrcaMasterDao {
    private final LocalOrcaMasterCacheRepository localMasterCacheRepository;

    OrcaMasterDao() {
        this(null);
    }

    @Inject
    OrcaMasterDao(LocalOrcaMasterCacheRepository localMasterCacheRepository) {
        this.localMasterCacheRepository = localMasterCacheRepository;
    }

    public GenericClassSearchResult searchGenericClass(GenericClassCriteria criteria) {
        if (criteria == null) {
            return null;
        }
        if (localMasterCacheRepository == null) {
            return null;
        }
        return localMasterCacheRepository.searchGenericClass(criteria);
    }


    public ListSearchResult<DrugRecord> searchDrug(DrugCriteria criteria) {
        if (criteria == null) {
            return null;
        }
        if (localMasterCacheRepository == null) {
            return null;
        }
        return localMasterCacheRepository.searchDrug(criteria);
    }

    public LookupResult<GenericPriceRecord> findGenericPrice(GenericPriceCriteria criteria) {
        if (criteria == null) {
            return null;
        }
        if (localMasterCacheRepository == null) {
            return null;
        }
        return localMasterCacheRepository.findGenericPrice(criteria);
    }

    public ListSearchResult<CommentRecord> searchComment(CommentCriteria criteria) {
        if (criteria == null) {
            return null;
        }
        if (localMasterCacheRepository == null) {
            return null;
        }
        return localMasterCacheRepository.searchComment(criteria);
    }

    public ListSearchResult<CommentRecord> searchBodypart(CommentCriteria criteria) {
        if (criteria == null) {
            return null;
        }
        if (localMasterCacheRepository == null) {
            return null;
        }
        return localMasterCacheRepository.searchBodypart(criteria);
    }

    public ListSearchResult<HokenjaRecord> searchHokenja(HokenjaCriteria criteria) {
        if (criteria == null) {
            return null;
        }
        if (localMasterCacheRepository == null) {
            return null;
        }
        return localMasterCacheRepository.searchHokenja(criteria);
    }

    public LookupResult<AddressRecord> findAddress(AddressCriteria criteria) {
        if (criteria == null) {
            return null;
        }
        if (localMasterCacheRepository == null) {
            return null;
        }
        return localMasterCacheRepository.findAddress(criteria);
    }

    public ListSearchResult<YouhouRecord> searchYouhou(YouhouCriteria criteria) {
        if (criteria == null) {
            return null;
        }
        if (localMasterCacheRepository == null) {
            return null;
        }
        return localMasterCacheRepository.searchYouhou(criteria);
    }

    public ListSearchResult<MaterialRecord> searchMaterial(MaterialCriteria criteria) {
        if (criteria == null) {
            return null;
        }
        if (localMasterCacheRepository == null) {
            return null;
        }
        return localMasterCacheRepository.searchMaterial(criteria);
    }

    public ListSearchResult<KensaSortRecord> searchKensaSort(KensaSortCriteria criteria) {
        if (criteria == null) {
            return null;
        }
        if (localMasterCacheRepository == null) {
            return null;
        }
        return localMasterCacheRepository.searchKensaSort(criteria);
    }

    public interface VersionedRecord {
        String version();
    }

    public static final class GenericClassCriteria extends OrcaMasterDaoTypes.GenericClassCriteriaBase {
    }

    public static final class DrugCriteria extends OrcaMasterDaoTypes.DrugCriteriaBase {
    }

    public static final class GenericPriceCriteria extends OrcaMasterDaoTypes.GenericPriceCriteriaBase {
    }

    public static final class CommentCriteria extends OrcaMasterDaoTypes.CommentCriteriaBase {
    }

    public static final class HokenjaCriteria extends OrcaMasterDaoTypes.HokenjaCriteriaBase {
    }

    public static final class AddressCriteria extends OrcaMasterDaoTypes.AddressCriteriaBase {
    }

    public static final class YouhouCriteria extends OrcaMasterDaoTypes.KeywordEffectiveCriteriaBase {
    }

    public static final class MaterialCriteria extends OrcaMasterDaoTypes.KeywordEffectiveCriteriaBase {
    }

    public static final class KensaSortCriteria extends OrcaMasterDaoTypes.KeywordEffectiveCriteriaBase {
    }

    public static final class GenericClassRecord extends OrcaMasterDaoTypes.GenericClassRecordBase implements VersionedRecord {
        @Override
        public String version() {
            return version;
        }
    }

    public static final class DrugRecord extends OrcaMasterDaoTypes.DrugRecordBase implements VersionedRecord {
        @Override
        public String version() {
            return version;
        }
    }

    public static final class GenericPriceRecord extends OrcaMasterDaoTypes.GenericPriceRecordBase implements VersionedRecord {
        @Override
        public String version() {
            return version;
        }
    }

    public static final class CommentRecord extends OrcaMasterDaoTypes.CommentRecordBase implements VersionedRecord {
        @Override
        public String version() {
            return version;
        }
    }

    public static final class HokenjaRecord extends OrcaMasterDaoTypes.HokenjaRecordBase implements VersionedRecord {
        @Override
        public String version() {
            return version;
        }
    }

    public static final class AddressRecord extends OrcaMasterDaoTypes.AddressRecordBase implements VersionedRecord {
        @Override
        public String version() {
            return version;
        }
    }

    public static final class YouhouRecord extends OrcaMasterDaoTypes.YouhouRecordBase implements VersionedRecord {
        @Override
        public String version() {
            return version;
        }
    }

    public static final class MaterialRecord extends OrcaMasterDaoTypes.MaterialRecordBase implements VersionedRecord {
        @Override
        public String version() {
            return version;
        }
    }

    public static final class KensaSortRecord extends OrcaMasterDaoTypes.KensaSortRecordBase implements VersionedRecord {
        @Override
        public String version() {
            return version;
        }
    }

    public static final class GenericClassSearchResult
            extends OrcaMasterDaoTypes.GenericClassSearchResultBase<GenericClassRecord> {
        public GenericClassSearchResult(java.util.List<GenericClassRecord> records, Integer totalCount, String version) {
            super(records, totalCount, version);
        }

        public GenericClassSearchResult(java.util.List<GenericClassRecord> records, Integer totalCount, String version,
                OrcaMasterCacheState cacheState) {
            super(records, totalCount, version, cacheState);
        }
    }

    public static final class ListSearchResult<T extends VersionedRecord>
            extends OrcaMasterDaoTypes.ListSearchResultBase<T> {
        public ListSearchResult(java.util.List<T> records, Integer totalCount, String version) {
            super(records, totalCount, version);
        }

        public ListSearchResult(java.util.List<T> records, Integer totalCount, String version,
                OrcaMasterCacheState cacheState) {
            super(records, totalCount, version, cacheState);
        }
    }

    public static final class LookupResult<T extends VersionedRecord> extends OrcaMasterDaoTypes.LookupResultBase<T> {
        public LookupResult(T record, String version, boolean found) {
            super(record, version, found);
        }

        public LookupResult(T record, String version, boolean found, OrcaMasterCacheState cacheState) {
            super(record, version, found, cacheState);
        }
    }
}
