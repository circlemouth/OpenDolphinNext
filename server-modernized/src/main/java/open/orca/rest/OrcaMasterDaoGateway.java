package open.orca.rest;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class OrcaMasterDaoGateway implements OrcaMasterGateway {
    private final EtensuDao etensuDao;
    private final OrcaMasterDao masterDao;

    @Inject
    OrcaMasterDaoGateway(EtensuDao etensuDao, OrcaMasterDao masterDao) {
        this.etensuDao = etensuDao;
        this.masterDao = masterDao;
    }

    @Override
    public OrcaMasterDao.GenericClassSearchResult searchGenericClass(OrcaMasterDao.GenericClassCriteria criteria) {
        return masterDao.searchGenericClass(criteria);
    }

    @Override
    public OrcaMasterDao.LookupResult<OrcaMasterDao.GenericPriceRecord> findGenericPrice(OrcaMasterDao.GenericPriceCriteria criteria) {
        return masterDao.findGenericPrice(criteria);
    }

    @Override
    public OrcaMasterDao.ListSearchResult<OrcaMasterDao.DrugRecord> searchDrug(OrcaMasterDao.DrugCriteria criteria) {
        return masterDao.searchDrug(criteria);
    }

    @Override
    public OrcaMasterDao.ListSearchResult<OrcaMasterDao.HokenjaRecord> searchHokenja(OrcaMasterDao.HokenjaCriteria criteria) {
        return masterDao.searchHokenja(criteria);
    }

    @Override
    public OrcaMasterDao.LookupResult<OrcaMasterDao.AddressRecord> findAddress(OrcaMasterDao.AddressCriteria criteria) {
        return masterDao.findAddress(criteria);
    }

    @Override
    public OrcaMasterDao.ListSearchResult<OrcaMasterDao.CommentRecord> searchComment(OrcaMasterDao.CommentCriteria criteria) {
        return masterDao.searchComment(criteria);
    }

    @Override
    public OrcaMasterDao.ListSearchResult<OrcaMasterDao.CommentRecord> searchBodypart(OrcaMasterDao.CommentCriteria criteria) {
        return masterDao.searchBodypart(criteria);
    }

    @Override
    public OrcaMasterDao.ListSearchResult<OrcaMasterDao.YouhouRecord> searchYouhou(OrcaMasterDao.YouhouCriteria criteria) {
        return masterDao.searchYouhou(criteria);
    }

    @Override
    public OrcaMasterDao.ListSearchResult<OrcaMasterDao.MaterialRecord> searchMaterial(OrcaMasterDao.MaterialCriteria criteria) {
        return masterDao.searchMaterial(criteria);
    }

    @Override
    public OrcaMasterDao.ListSearchResult<OrcaMasterDao.KensaSortRecord> searchKensaSort(OrcaMasterDao.KensaSortCriteria criteria) {
        return masterDao.searchKensaSort(criteria);
    }

    @Override
    public EtensuDao.EtensuSearchResult searchEtensu(EtensuDao.EtensuSearchCriteria criteria) {
        return etensuDao.search(criteria);
    }
}
