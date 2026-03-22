package open.orca.rest;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Locale;
import java.util.Objects;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * ORCA master DAO.
 * Supported schema contract is documented in docs/development/orca-master-supported-schema-contract.md.
 */
@ApplicationScoped
public class OrcaMasterDao {
    private static final Logger LOGGER = Logger.getLogger(OrcaMasterDao.class.getName());
    private final ORCAConnection orcaConnection;
    private final OrcaMasterQuerySupport querySupport = new OrcaMasterQuerySupport();
    private final OrcaMasterPagingSupport pagingSupport = new OrcaMasterPagingSupport();
    private final OrcaMasterGenericClassQueryService genericClassQueryService =
            new OrcaMasterGenericClassQueryService(querySupport, pagingSupport);
    private final OrcaMasterDrugQueryService drugQueryService = new OrcaMasterDrugQueryService(querySupport, pagingSupport);
    private final OrcaMasterYouhouQueryService youhouQueryService =
            new OrcaMasterYouhouQueryService(querySupport, pagingSupport);
    private final OrcaMasterKensaSortQueryService kensaSortQueryService =
            new OrcaMasterKensaSortQueryService(querySupport, pagingSupport);

    OrcaMasterDao() {
        this(null);
    }

    @Inject
    OrcaMasterDao(ORCAConnection orcaConnection) {
        this.orcaConnection = orcaConnection;
    }

    public GenericClassSearchResult searchGenericClass(GenericClassCriteria criteria) {
        if (criteria == null) {
            return null;
        }
        try (Connection connection = openConnection()) {
            OrcaMasterDaoTableMeta.GenericClassTableMeta meta = OrcaMasterDaoTableMeta.GenericClassTableMeta.SUPPORTED_CONTRACT;
            return genericClassQueryService.searchGenericClass(connection, criteria, meta.tableName, meta.codeColumn,
                    meta.nameColumn, meta.kanaColumn, meta.categoryColumn, meta.parentColumn, meta.startDateColumn,
                    meta.endDateColumn, meta.versionColumn);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "Failed to load ORCA-05 generic class master", e);
            return null;
        }
    }


    public ListSearchResult<DrugRecord> searchDrug(DrugCriteria criteria) {
        if (criteria == null) {
            return null;
        }
        try (Connection connection = openConnection()) {
            OrcaMasterDaoTableMeta.DrugTableMeta meta = OrcaMasterDaoTableMeta.DrugTableMeta.SUPPORTED_CONTRACT;
            return drugQueryService.searchDrug(connection, criteria, meta.tableName, meta.codeColumn, meta.nameColumn,
                    meta.kanaColumn, meta.categoryColumn, meta.unitColumn, meta.priceColumn, meta.noteColumn,
                    meta.startDateColumn, meta.endDateColumn, meta.versionColumn);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "Failed to load ORCA-08 drug master", e);
            return null;
        }
    }

    public ListSearchResult<CommentRecord> searchComment(CommentCriteria criteria) {
        if (criteria == null) {
            return null;
        }
        try (Connection connection = openConnection()) {
            OrcaMasterDaoTableMeta.DrugTableMeta meta = OrcaMasterDaoTableMeta.DrugTableMeta.SUPPORTED_CONTRACT;
            return drugQueryService.searchComment(connection, criteria, meta.tableName, meta.codeColumn, meta.nameColumn,
                    meta.kanaColumn, meta.categoryColumn, meta.unitColumn, meta.startDateColumn, meta.endDateColumn,
                    meta.versionColumn, false);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "Failed to load ORCA-08 comment master", e);
            return null;
        }
    }

    public ListSearchResult<CommentRecord> searchBodypart(CommentCriteria criteria) {
        if (criteria == null) {
            return null;
        }
        try (Connection connection = openConnection()) {
            OrcaMasterDaoTableMeta.DrugTableMeta meta = OrcaMasterDaoTableMeta.DrugTableMeta.SUPPORTED_CONTRACT;
            return drugQueryService.searchComment(connection, criteria, meta.tableName, meta.codeColumn, meta.nameColumn,
                    meta.kanaColumn, meta.categoryColumn, meta.unitColumn, meta.startDateColumn, meta.endDateColumn,
                    meta.versionColumn, true);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "Failed to load ORCA-08 bodypart master", e);
            return null;
        }
    }

    public ListSearchResult<YouhouRecord> searchYouhou(YouhouCriteria criteria) {
        if (criteria == null) {
            return null;
        }
        try (Connection connection = openConnection()) {
            OrcaMasterDaoTableMeta.YouhouTableMeta meta = OrcaMasterDaoTableMeta.YouhouTableMeta.SUPPORTED_CONTRACT;
            return youhouQueryService.searchYouhou(connection, criteria, meta.tableName, meta.codeColumn,
                    meta.nameColumn, meta.kanaColumn, meta.startDateColumn, meta.endDateColumn, meta.versionColumn);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "Failed to load ORCA-05 youhou master", e);
            return null;
        }
    }

    public ListSearchResult<MaterialRecord> searchMaterial(MaterialCriteria criteria) {
        if (criteria == null) {
            return null;
        }
        try (Connection connection = openConnection()) {
            OrcaMasterDaoTableMeta.DrugTableMeta meta = OrcaMasterDaoTableMeta.DrugTableMeta.SUPPORTED_CONTRACT;
            return drugQueryService.searchMaterial(connection, criteria, meta.tableName, meta.codeColumn, meta.nameColumn,
                    meta.kanaColumn, meta.categoryColumn, meta.unitColumn, meta.priceColumn, meta.startDateColumn,
                    meta.endDateColumn, meta.versionColumn);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "Failed to load ORCA-08 material master", e);
            return null;
        }
    }

    public ListSearchResult<KensaSortRecord> searchKensaSort(KensaSortCriteria criteria) {
        if (criteria == null) {
            return null;
        }
        try (Connection connection = openConnection()) {
            OrcaMasterDaoTableMeta.KensaSortTableMeta kensaSortMeta = OrcaMasterDaoTableMeta.KensaSortTableMeta.SUPPORTED_CONTRACT;
            OrcaMasterDaoTableMeta.DrugTableMeta tensuMeta = OrcaMasterDaoTableMeta.DrugTableMeta.SUPPORTED_CONTRACT;
            return kensaSortQueryService.searchKensaSort(connection, criteria, kensaSortMeta.tableName,
                    kensaSortMeta.codeColumn, kensaSortMeta.kensaSortColumn, kensaSortMeta.versionColumn,
                    tensuMeta.tableName, tensuMeta.codeColumn, tensuMeta.nameColumn, tensuMeta.kanaColumn,
                    tensuMeta.categoryColumn, tensuMeta.startDateColumn, tensuMeta.endDateColumn, tensuMeta.versionColumn);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "Failed to load ORCA-08 kensa sort master", e);
            return null;
        }
    }

    private Connection openConnection() throws SQLException {
        if (orcaConnection == null) {
            throw new SQLException("ORCAConnection is not configured");
        }
        return orcaConnection.getConnection();
    }

    public interface VersionedRecord {
        String version();
    }

    public static final class GenericClassCriteria extends OrcaMasterDaoTypes.GenericClassCriteriaBase {
    }

    public static final class DrugCriteria extends OrcaMasterDaoTypes.DrugCriteriaBase {
    }

    public static final class CommentCriteria extends OrcaMasterDaoTypes.CommentCriteriaBase {
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

    public static final class CommentRecord extends OrcaMasterDaoTypes.CommentRecordBase implements VersionedRecord {
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
    }

    public static final class ListSearchResult<T extends VersionedRecord>
            extends OrcaMasterDaoTypes.ListSearchResultBase<T> {
        public ListSearchResult(java.util.List<T> records, Integer totalCount, String version) {
            super(records, totalCount, version);
        }
    }

    public static final class LookupResult<T extends VersionedRecord> extends OrcaMasterDaoTypes.LookupResultBase<T> {
        public LookupResult(T record, String version, boolean found) {
            super(record, version, found);
        }
    }
}
