package open.orca.rest;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
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
    private static final int MAX_PAGE_SIZE = 2000;
    private static final String DRUG_CODE_PREFIX = "6";
    private static final String MATERIAL_CODE_PREFIX = "7";
    private static final String COMMENT_CODE_REGEX = "^(008[1-6]|8[1-6]|098|099|98|99)";
    private static final String BODY_PART_NAME_TOKEN = "部位";
    private final ORCAConnection orcaConnection;

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
            GenericClassTableMeta meta = GenericClassTableMeta.SUPPORTED_CONTRACT;
            Query query = buildGenericClassQuery(criteria, meta);
            Integer totalCount = maybeFetchTotalCount(connection, meta.tableName, query, criteria.isIncludeTotalCount());
            if (Integer.valueOf(0).equals(totalCount)) {
                return new GenericClassSearchResult(Collections.emptyList(), totalCount, null);
            }
            List<GenericClassRecord> records = fetchGenericClassRecords(connection, meta, query,
                    criteria.page, criteria.size);
            String version = resolveVersion(records, null);
            return new GenericClassSearchResult(records, totalCount, version);
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
            DrugTableMeta meta = DrugTableMeta.SUPPORTED_CONTRACT;
            Query query = buildDrugQuery(criteria, meta);
            Integer totalCount = maybeFetchTotalCount(connection, meta.tableName, query, criteria.isIncludeTotalCount());
            if (Integer.valueOf(0).equals(totalCount)) {
                return new ListSearchResult<>(Collections.emptyList(), totalCount, null);
            }
            List<DrugRecord> records = fetchDrugRecords(connection, meta, query, criteria.page, criteria.size);
            String version = resolveVersion(records, null);
            return new ListSearchResult<>(records, totalCount, version);
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
            DrugTableMeta meta = DrugTableMeta.SUPPORTED_CONTRACT;
            Query query = buildCommentQuery(criteria, meta);
            Integer totalCount = maybeFetchTotalCount(connection, meta.tableName, query, criteria.isIncludeTotalCount());
            if (Integer.valueOf(0).equals(totalCount)) {
                return new ListSearchResult<>(Collections.emptyList(), totalCount, null);
            }
            List<CommentRecord> records = fetchCommentRecords(connection, meta, query, criteria.page, criteria.size);
            String version = resolveVersion(records, null);
            return new ListSearchResult<>(records, totalCount, version);
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
            DrugTableMeta meta = DrugTableMeta.SUPPORTED_CONTRACT;
            Query query = buildBodypartQuery(criteria, meta);
            Integer totalCount = maybeFetchTotalCount(connection, meta.tableName, query, criteria.isIncludeTotalCount());
            if (Integer.valueOf(0).equals(totalCount)) {
                return new ListSearchResult<>(Collections.emptyList(), totalCount, null);
            }
            List<CommentRecord> records = fetchCommentRecords(connection, meta, query, criteria.page, criteria.size);
            String version = resolveVersion(records, null);
            return new ListSearchResult<>(records, totalCount, version);
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
            YouhouTableMeta meta = YouhouTableMeta.SUPPORTED_CONTRACT;
            Query query = buildKeywordEffectiveQuery(criteria.keyword, criteria.effective, meta.tableName,
                    meta.codeColumn, meta.nameColumn, meta.kanaColumn, meta.startDateColumn, meta.endDateColumn);
            List<YouhouRecord> records = fetchYouhouRecords(connection, meta, query);
            String version = resolveVersion(records, null);
            return new ListSearchResult<>(records, records.size(), version);
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
            DrugTableMeta meta = DrugTableMeta.SUPPORTED_CONTRACT;
            Query query = buildMaterialQuery(criteria, meta);
            List<MaterialRecord> records = fetchMaterialRecordsFromTensu(connection, meta, query);
            String version = resolveVersion(records, null);
            return new ListSearchResult<>(records, records.size(), version);
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
            KensaSortTableMeta kensaSortMeta = KensaSortTableMeta.SUPPORTED_CONTRACT;
            DrugTableMeta tensuMeta = DrugTableMeta.SUPPORTED_CONTRACT;
            Query query = buildKensaSortJoinQuery(criteria, kensaSortMeta, tensuMeta);
            List<KensaSortRecord> records = fetchKensaSortRecordsFromTensu(connection, kensaSortMeta, tensuMeta, query);
            String version = resolveVersion(records, null);
            return new ListSearchResult<>(records, records.size(), version);
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


    private Query buildGenericClassQuery(GenericClassCriteria criteria, GenericClassTableMeta meta) {
        StringBuilder where = new StringBuilder(" FROM ").append(meta.tableName).append(" WHERE 1=1");
        List<Object> params = new ArrayList<>();
        appendKeywordFilter(where, params, criteria.keyword, meta.codeColumn, meta.nameColumn, meta.kanaColumn);
        appendEffectiveFilter(where, params, criteria.effective, meta.startDateColumn, meta.endDateColumn);
        return new Query(where.toString(), params);
    }


    private Query buildDrugQuery(DrugCriteria criteria, DrugTableMeta meta) {
        StringBuilder where = new StringBuilder(" FROM ").append(meta.tableName).append(" WHERE 1=1");
        List<Object> params = new ArrayList<>();
        where.append(" AND CAST(").append(meta.codeColumn).append(" AS VARCHAR) LIKE ?");
        params.add(DRUG_CODE_PREFIX + "%");
        appendKeywordFilter(where, params, criteria.keyword, meta.codeColumn, meta.nameColumn, meta.kanaColumn,
                criteria.searchMethod);
        appendDrugScopeFilter(where, params, criteria.scope);
        appendEffectiveFilter(where, params, criteria.effective, meta.startDateColumn, meta.endDateColumn);
        return new Query(where.toString(), params);
    }

    private Query buildMaterialQuery(MaterialCriteria criteria, DrugTableMeta meta) {
        StringBuilder where = new StringBuilder(" FROM ").append(meta.tableName).append(" WHERE 1=1");
        List<Object> params = new ArrayList<>();
        where.append(" AND CAST(").append(meta.codeColumn).append(" AS VARCHAR) LIKE ?");
        params.add(MATERIAL_CODE_PREFIX + "%");
        appendKeywordFilter(where, params, criteria.keyword, meta.codeColumn, meta.nameColumn, meta.kanaColumn);
        appendEffectiveFilter(where, params, criteria.effective, meta.startDateColumn, meta.endDateColumn);
        return new Query(where.toString(), params);
    }

    private Query buildCommentQuery(CommentCriteria criteria, DrugTableMeta meta) {
        StringBuilder where = new StringBuilder(" FROM ").append(meta.tableName).append(" WHERE 1=1");
        List<Object> params = new ArrayList<>();
        where.append(" AND CAST(").append(meta.codeColumn).append(" AS VARCHAR) ~ ?");
        params.add(COMMENT_CODE_REGEX);
        appendKeywordFilter(where, params, criteria.keyword, meta.codeColumn, meta.nameColumn, meta.kanaColumn);
        appendEffectiveFilter(where, params, criteria.effective, meta.startDateColumn, meta.endDateColumn);
        return new Query(where.toString(), params);
    }

    private Query buildKensaSortJoinQuery(KensaSortCriteria criteria, KensaSortTableMeta kensaSortMeta,
            DrugTableMeta tensuMeta) {
        final String sortAlias = "k";
        final String tensuAlias = "t";
        StringBuilder where = new StringBuilder(" FROM ").append(kensaSortMeta.tableName).append(' ').append(sortAlias)
                .append(" JOIN ").append(tensuMeta.tableName).append(' ').append(tensuAlias)
                .append(" ON ").append(tensuAlias).append('.').append(tensuMeta.codeColumn)
                .append(" = ").append(sortAlias).append('.').append(kensaSortMeta.codeColumn)
                .append(" WHERE 1=1");
        List<Object> params = new ArrayList<>();
        appendKensaSortKeywordFilter(where, params, criteria.keyword, sortAlias + "." + kensaSortMeta.codeColumn,
                tensuAlias + "." + tensuMeta.nameColumn, tensuAlias + "." + tensuMeta.kanaColumn,
                kensaSortMeta.kensaSortColumn != null ? sortAlias + "." + kensaSortMeta.kensaSortColumn : null);
        appendEffectiveFilter(where, params, criteria.effective,
                tensuMeta.startDateColumn != null ? tensuAlias + "." + tensuMeta.startDateColumn : null,
                tensuMeta.endDateColumn != null ? tensuAlias + "." + tensuMeta.endDateColumn : null);
        return new Query(where.toString(), params);
    }

    private void appendKensaSortKeywordFilter(StringBuilder where, List<Object> params, String keyword,
            String codeColumn, String nameColumn, String kanaColumn, String sortColumn) {
        MasterSearchKeywordSupport.appendOrcaKeywordFilter(where, params, keyword, null,
                codeColumn, nameColumn, kanaColumn, sortColumn);
    }

    private Query buildBodypartQuery(CommentCriteria criteria, DrugTableMeta meta) {
        StringBuilder where = new StringBuilder(" FROM ").append(meta.tableName).append(" WHERE 1=1");
        List<Object> params = new ArrayList<>();
        where.append(" AND CAST(").append(meta.codeColumn).append(" AS VARCHAR) ~ ?");
        params.add(COMMENT_CODE_REGEX);
        where.append(" AND UPPER(CAST(").append(meta.nameColumn).append(" AS VARCHAR)) LIKE ?");
        params.add("%" + BODY_PART_NAME_TOKEN.toUpperCase(Locale.ROOT) + "%");
        appendKeywordFilter(where, params, criteria.keyword, meta.codeColumn, meta.nameColumn, meta.kanaColumn);
        appendEffectiveFilter(where, params, criteria.effective, meta.startDateColumn, meta.endDateColumn);
        return new Query(where.toString(), params);
    }


    private Query buildKeywordEffectiveQuery(String keyword, String effective, String tableName, String codeColumn,
            String nameColumn, String kanaColumn, String startDateColumn, String endDateColumn) {
        StringBuilder where = new StringBuilder(" FROM ").append(tableName).append(" WHERE 1=1");
        List<Object> params = new ArrayList<>();
        appendKeywordFilter(where, params, keyword, codeColumn, nameColumn, kanaColumn);
        appendEffectiveFilter(where, params, effective, startDateColumn, endDateColumn);
        return new Query(where.toString(), params);
    }

    private void appendKeywordFilter(StringBuilder where, List<Object> params, String keyword,
            String codeColumn, String nameColumn, String kanaColumn) {
        appendKeywordFilter(where, params, keyword, codeColumn, nameColumn, kanaColumn, null);
    }

    private void appendKeywordFilter(StringBuilder where, List<Object> params, String keyword,
            String codeColumn, String nameColumn, String kanaColumn, String searchMethod) {
        MasterSearchKeywordSupport.appendOrcaKeywordFilter(where, params, keyword, searchMethod,
                codeColumn, nameColumn, kanaColumn);
    }

    private void appendDrugScopeFilter(StringBuilder where, List<Object> params, String scope) {
        if (scope == null || scope.isBlank()) {
            return;
        }
        String normalizedScope = scope.trim().toLowerCase(Locale.ROOT);
        if (!"outer".equals(normalizedScope)
                && !"in-hospital".equals(normalizedScope)
                && !"adopted".equals(normalizedScope)) {
            return;
        }
        // TODO(orca-master): map scope(outer/in-hospital/adopted) to concrete ORCA columns and filters.
    }

    private void appendEffectiveFilter(StringBuilder where, List<Object> params, String effective,
            String startDateColumn, String endDateColumn) {
        if (effective == null || effective.isBlank()) {
            return;
        }
        if (startDateColumn == null || endDateColumn == null) {
            return;
        }
        where.append(" AND ").append(startDateColumn).append(" <= ? AND ").append(endDateColumn).append(" >= ?");
        params.add(effective);
        params.add(effective);
    }

    private int fetchTotalCount(Connection connection, String tableName, Query query) throws SQLException {
        if (tableName == null) {
            return 0;
        }
        String sql = "SELECT count(*)" + query.whereClause;
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            bindParams(ps, query.params, 1);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getInt(1) : 0;
            }
        }
    }

    private Integer maybeFetchTotalCount(Connection connection, String tableName, Query query, boolean includeTotalCount)
            throws SQLException {
        if (!includeTotalCount) {
            return null;
        }
        return fetchTotalCount(connection, tableName, query);
    }

    private List<GenericClassRecord> fetchGenericClassRecords(Connection connection, GenericClassTableMeta meta,
            Query query, int page, int size) throws SQLException {
        String sql = "SELECT "
                + selectColumn(meta.codeColumn) + " AS code, "
                + selectColumn(meta.nameColumn) + " AS name, "
                + selectColumn(meta.kanaColumn) + " AS kana, "
                + selectColumn(meta.categoryColumn) + " AS category, "
                + selectColumn(meta.parentColumn) + " AS parent, "
                + selectColumn(meta.startDateColumn) + " AS startDate, "
                + selectColumn(meta.endDateColumn) + " AS endDate, "
                + selectColumn(meta.versionColumn) + " AS version "
                + query.whereClause
                + " ORDER BY " + meta.codeColumn;
        sql = applyPaging(sql);
        List<GenericClassRecord> records = new ArrayList<>();
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            int index = bindParams(ps, query.params, 1);
            applyPagingParams(ps, index, page, size);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    GenericClassRecord record = new GenericClassRecord();
                    record.classCode = rs.getString("code");
                    record.className = rs.getString("name");
                    record.kanaName = rs.getString("kana");
                    record.categoryCode = rs.getString("category");
                    record.parentClassCode = rs.getString("parent");
                    record.startDate = rs.getString("startDate");
                    record.endDate = rs.getString("endDate");
                    record.version = rs.getString("version");
                    records.add(record);
                }
            }
        }
        return records;
    }


    private List<DrugRecord> fetchDrugRecords(Connection connection, DrugTableMeta meta, Query query, int page, int size)
            throws SQLException {
        String sql = "SELECT "
                + selectColumn(meta.codeColumn) + " AS code, "
                + selectColumn(meta.nameColumn) + " AS name, "
                + selectColumn(meta.kanaColumn) + " AS kana, "
                + selectColumn(meta.categoryColumn) + " AS category, "
                + selectColumn(meta.unitColumn) + " AS unit, "
                + selectColumn(meta.priceColumn) + " AS price, "
                + selectColumn(meta.noteColumn) + " AS note, "
                + selectColumn(meta.startDateColumn) + " AS startDate, "
                + selectColumn(meta.endDateColumn) + " AS endDate, "
                + selectColumn(meta.versionColumn) + " AS version "
                + query.whereClause
                + " ORDER BY " + meta.codeColumn + ", " + meta.startDateColumn + " DESC";
        sql = applyPaging(sql);
        List<DrugRecord> records = new ArrayList<>();
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            int index = bindParams(ps, query.params, 1);
            applyPagingParams(ps, index, page, size);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    DrugRecord record = new DrugRecord();
                    record.srycd = rs.getString("code");
                    record.drugName = rs.getString("name");
                    record.kanaName = rs.getString("kana");
                    record.category = rs.getString("category");
                    record.unit = rs.getString("unit");
                    record.price = getDouble(rs, "price");
                    record.note = rs.getString("note");
                    record.startDate = rs.getString("startDate");
                    record.endDate = rs.getString("endDate");
                    record.version = rs.getString("version");
                    records.add(record);
                }
            }
        }
        return records;
    }

    private List<CommentRecord> fetchCommentRecords(Connection connection, DrugTableMeta meta, Query query, int page, int size)
            throws SQLException {
        String sql = "SELECT "
                + selectColumn(meta.codeColumn) + " AS code, "
                + selectColumn(meta.nameColumn) + " AS name, "
                + selectColumn(meta.kanaColumn) + " AS kana, "
                + selectColumn(meta.categoryColumn) + " AS category, "
                + selectColumn(meta.unitColumn) + " AS unit, "
                + selectColumn(meta.startDateColumn) + " AS startDate, "
                + selectColumn(meta.endDateColumn) + " AS endDate, "
                + selectColumn(meta.versionColumn) + " AS version "
                + query.whereClause
                + " ORDER BY " + meta.codeColumn + ", " + meta.startDateColumn + " DESC";
        sql = applyPaging(sql);
        List<CommentRecord> records = new ArrayList<>();
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            int index = bindParams(ps, query.params, 1);
            applyPagingParams(ps, index, page, size);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    CommentRecord record = new CommentRecord();
                    record.tensuCode = rs.getString("code");
                    record.name = rs.getString("name");
                    record.kanaName = rs.getString("kana");
                    record.category = rs.getString("category");
                    record.unit = rs.getString("unit");
                    record.startDate = rs.getString("startDate");
                    record.endDate = rs.getString("endDate");
                    record.version = rs.getString("version");
                    records.add(record);
                }
            }
        }
        return records;
    }

    private List<YouhouRecord> fetchYouhouRecords(Connection connection, YouhouTableMeta meta, Query query)
            throws SQLException {
        String sql = "SELECT "
                + selectColumn(meta.codeColumn) + " AS code, "
                + selectColumn(meta.nameColumn) + " AS name, "
                + selectColumn(meta.kanaColumn) + " AS kana, "
                + selectColumn(meta.startDateColumn) + " AS startDate, "
                + selectColumn(meta.endDateColumn) + " AS endDate, "
                + selectColumn(meta.versionColumn) + " AS version "
                + query.whereClause
                + " ORDER BY " + meta.codeColumn;
        List<YouhouRecord> records = new ArrayList<>();
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            bindParams(ps, query.params, 1);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    YouhouRecord record = new YouhouRecord();
                    record.youhouCode = rs.getString("code");
                    record.youhouName = rs.getString("name");
                    record.kanaName = rs.getString("kana");
                    record.startDate = rs.getString("startDate");
                    record.endDate = rs.getString("endDate");
                    record.version = rs.getString("version");
                    records.add(record);
                }
            }
        }
        return records;
    }

    private List<MaterialRecord> fetchMaterialRecords(Connection connection, MaterialTableMeta meta, Query query)
            throws SQLException {
        String sql = "SELECT "
                + selectColumn(meta.codeColumn) + " AS code, "
                + selectColumn(meta.nameColumn) + " AS name, "
                + selectColumn(meta.kanaColumn) + " AS kana, "
                + selectColumn(meta.categoryColumn) + " AS category, "
                + selectColumn(meta.materialCategoryColumn) + " AS materialCategory, "
                + selectColumn(meta.unitColumn) + " AS unit, "
                + selectColumn(meta.priceColumn) + " AS price, "
                + selectColumn(meta.makerColumn) + " AS maker, "
                + selectColumn(meta.startDateColumn) + " AS startDate, "
                + selectColumn(meta.endDateColumn) + " AS endDate, "
                + selectColumn(meta.versionColumn) + " AS version "
                + query.whereClause
                + " ORDER BY " + meta.codeColumn;
        List<MaterialRecord> records = new ArrayList<>();
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            bindParams(ps, query.params, 1);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    MaterialRecord record = new MaterialRecord();
                    record.materialCode = rs.getString("code");
                    record.materialName = rs.getString("name");
                    record.kanaName = rs.getString("kana");
                    record.category = rs.getString("category");
                    record.materialCategory = rs.getString("materialCategory");
                    record.unit = rs.getString("unit");
                    record.price = getDouble(rs, "price");
                    record.maker = rs.getString("maker");
                    record.startDate = rs.getString("startDate");
                    record.endDate = rs.getString("endDate");
                    record.version = rs.getString("version");
                    records.add(record);
                }
            }
        }
        return records;
    }

    private List<MaterialRecord> fetchMaterialRecordsFromTensu(Connection connection, DrugTableMeta meta, Query query)
            throws SQLException {
        String sql = "SELECT "
                + selectColumn(meta.codeColumn) + " AS code, "
                + selectColumn(meta.nameColumn) + " AS name, "
                + selectColumn(meta.kanaColumn) + " AS kana, "
                + selectColumn(meta.categoryColumn) + " AS category, "
                + selectColumn(meta.unitColumn) + " AS unit, "
                + selectColumn(meta.priceColumn) + " AS price, "
                + selectColumn(meta.startDateColumn) + " AS startDate, "
                + selectColumn(meta.endDateColumn) + " AS endDate, "
                + selectColumn(meta.versionColumn) + " AS version "
                + query.whereClause
                + " ORDER BY " + meta.codeColumn + ", " + meta.startDateColumn + " DESC";
        List<MaterialRecord> records = new ArrayList<>();
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            bindParams(ps, query.params, 1);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    MaterialRecord record = new MaterialRecord();
                    record.materialCode = rs.getString("code");
                    record.materialName = rs.getString("name");
                    record.kanaName = rs.getString("kana");
                    record.category = rs.getString("category");
                    record.materialCategory = rs.getString("category");
                    record.unit = rs.getString("unit");
                    record.price = getDouble(rs, "price");
                    record.maker = null;
                    record.startDate = rs.getString("startDate");
                    record.endDate = rs.getString("endDate");
                    record.version = rs.getString("version");
                    records.add(record);
                }
            }
        }
        return records;
    }

    private List<KensaSortRecord> fetchKensaSortRecords(Connection connection, KensaSortTableMeta meta, Query query)
            throws SQLException {
        String sql = "SELECT "
                + selectColumn(meta.codeColumn) + " AS code, "
                + selectColumn(meta.nameColumn) + " AS name, "
                + selectColumn(meta.kanaColumn) + " AS kana, "
                + selectColumn(meta.kensaSortColumn) + " AS kensaSort, "
                + selectColumn(meta.classificationColumn) + " AS classification, "
                + selectColumn(meta.startDateColumn) + " AS startDate, "
                + selectColumn(meta.endDateColumn) + " AS endDate, "
                + selectColumn(meta.versionColumn) + " AS version "
                + query.whereClause
                + " ORDER BY " + meta.codeColumn;
        List<KensaSortRecord> records = new ArrayList<>();
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            bindParams(ps, query.params, 1);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    KensaSortRecord record = new KensaSortRecord();
                    record.kensaCode = rs.getString("code");
                    record.kensaName = rs.getString("name");
                    record.kanaName = rs.getString("kana");
                    record.kensaSort = rs.getString("kensaSort");
                    record.classification = rs.getString("classification");
                    record.startDate = rs.getString("startDate");
                    record.endDate = rs.getString("endDate");
                    record.version = rs.getString("version");
                    records.add(record);
                }
            }
        }
        return records;
    }

    private List<KensaSortRecord> fetchKensaSortRecordsFromTensu(Connection connection, KensaSortTableMeta kensaSortMeta,
            DrugTableMeta tensuMeta, Query query) throws SQLException {
        final String sortAlias = "k";
        final String tensuAlias = "t";
        String versionColumn = kensaSortMeta.versionColumn != null
                ? sortAlias + "." + kensaSortMeta.versionColumn
                : null;
        String tensuVersionColumn = tensuMeta.versionColumn != null
                ? tensuAlias + "." + tensuMeta.versionColumn
                : null;
        String versionSelect;
        if (versionColumn != null && tensuVersionColumn != null) {
            versionSelect = "COALESCE(" + versionColumn + ", " + tensuVersionColumn + ")";
        } else if (versionColumn != null) {
            versionSelect = versionColumn;
        } else if (tensuVersionColumn != null) {
            versionSelect = tensuVersionColumn;
        } else {
            versionSelect = "null";
        }

        StringBuilder order = new StringBuilder(sortAlias).append('.').append(kensaSortMeta.codeColumn);
        if (tensuMeta.startDateColumn != null) {
            order.append(", ").append(tensuAlias).append('.').append(tensuMeta.startDateColumn).append(" DESC");
        }
        if (tensuMeta.endDateColumn != null) {
            order.append(", ").append(tensuAlias).append('.').append(tensuMeta.endDateColumn).append(" DESC");
        }

        String sql = "SELECT DISTINCT ON (" + sortAlias + "." + kensaSortMeta.codeColumn + ") "
                + selectColumn(sortAlias + "." + kensaSortMeta.codeColumn) + " AS code, "
                + selectColumn(tensuAlias + "." + tensuMeta.nameColumn) + " AS name, "
                + selectColumn(tensuAlias + "." + tensuMeta.kanaColumn) + " AS kana, "
                + selectColumn(sortAlias + "." + kensaSortMeta.kensaSortColumn) + " AS kensaSort, "
                + selectColumn(tensuAlias + "." + tensuMeta.categoryColumn) + " AS classification, "
                + selectColumn(tensuAlias + "." + tensuMeta.startDateColumn) + " AS startDate, "
                + selectColumn(tensuAlias + "." + tensuMeta.endDateColumn) + " AS endDate, "
                + versionSelect + " AS version "
                + query.whereClause
                + " ORDER BY " + order;
        List<KensaSortRecord> records = new ArrayList<>();
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            bindParams(ps, query.params, 1);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    KensaSortRecord record = new KensaSortRecord();
                    record.kensaCode = rs.getString("code");
                    record.kensaName = rs.getString("name");
                    record.kanaName = rs.getString("kana");
                    record.kensaSort = rs.getString("kensaSort");
                    record.classification = rs.getString("classification");
                    record.startDate = rs.getString("startDate");
                    record.endDate = rs.getString("endDate");
                    record.version = rs.getString("version");
                    records.add(record);
                }
            }
        }
        return records;
    }


    private static String applyPaging(String sql) {
        return sql + " LIMIT ? OFFSET ?";
    }

    private static void applyPagingParams(PreparedStatement ps, int index, int page, int size) throws SQLException {
        int safeSize = Math.min(MAX_PAGE_SIZE, Math.max(1, size));
        int safePage = Math.max(1, page);
        int offset = (safePage - 1) * safeSize;
        ps.setInt(index++, safeSize);
        ps.setInt(index, offset);
    }

    private static String prefFromLpub(String lpub) {
        if (lpub == null || lpub.length() < 2) {
            return null;
        }
        return lpub.substring(0, 2);
    }

    private static String cityFromLpub(String lpub) {
        if (lpub == null || lpub.isBlank()) {
            return null;
        }
        return lpub;
    }

    private static String buildAddressKana(String editKana, String prefKana, String cityKana, String townKana) {
        if (editKana != null && !editKana.isBlank()) {
            return editKana;
        }
        StringBuilder builder = new StringBuilder();
        appendWithSpace(builder, prefKana);
        appendWithSpace(builder, cityKana);
        appendWithSpace(builder, townKana);
        return builder.length() == 0 ? null : builder.toString();
    }

    private static String buildAddressName(String editName, String prefName, String cityName, String townName) {
        if (editName != null && !editName.isBlank()) {
            return editName;
        }
        StringBuilder builder = new StringBuilder();
        appendWithoutSpace(builder, prefName);
        appendWithoutSpace(builder, cityName);
        appendWithoutSpace(builder, townName);
        return builder.length() == 0 ? null : builder.toString();
    }

    private static void appendWithSpace(StringBuilder builder, String value) {
        if (value == null || value.isBlank()) {
            return;
        }
        if (builder.length() > 0) {
            builder.append(' ');
        }
        builder.append(value.trim());
    }

    private static void appendWithoutSpace(StringBuilder builder, String value) {
        if (value == null || value.isBlank()) {
            return;
        }
        builder.append(value.trim());
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

    private static String resolveVersion(List<? extends VersionedRecord> records, String fallback) {
        String version = fallback;
        for (VersionedRecord record : records) {
            if (record == null) {
                continue;
            }
            String candidate = record.version();
            if (candidate == null || candidate.isBlank()) {
                continue;
            }
            if (version == null || version.compareTo(candidate) < 0) {
                version = candidate;
            }
        }
        return version;
    }

    private static String selectColumn(String column) {
        return column != null ? column : "null";
    }

    private static int bindParams(PreparedStatement ps, List<Object> params, int startIndex) throws SQLException {
        int index = startIndex;
        for (Object param : params) {
            if (param == null) {
                ps.setObject(index++, null);
            } else if (param instanceof Integer) {
                ps.setInt(index++, (Integer) param);
            } else if (param instanceof Double) {
                ps.setDouble(index++, (Double) param);
            } else {
                ps.setString(index++, param.toString());
            }
        }
        return index;
    }

    private static Double getDouble(ResultSet rs, String column) throws SQLException {
        double value = rs.getDouble(column);
        return rs.wasNull() ? null : value;
    }

    private interface VersionedRecord {
        String version();
    }

    private static final class Query {
        private final String whereClause;
        private final List<Object> params;

        private Query(String whereClause, List<Object> params) {
            this.whereClause = whereClause;
            this.params = params;
        }
    }

    public static final class GenericClassCriteria {
        private String keyword;
        private String effective;
        private int page = 1;
        private int size = 100;
        private boolean includeTotalCount;

        public String getKeyword() {
            return keyword;
        }

        public void setKeyword(String keyword) {
            this.keyword = keyword;
        }

        public String getEffective() {
            return effective;
        }

        public void setEffective(String effective) {
            this.effective = effective;
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


    public static final class DrugCriteria {
        private String keyword;
        private String effective;
        private String searchMethod;
        private String scope;
        private int page = 1;
        private int size = 100;
        private boolean includeTotalCount;

        public String getKeyword() {
            return keyword;
        }

        public void setKeyword(String keyword) {
            this.keyword = keyword;
        }

        public String getEffective() {
            return effective;
        }

        public void setEffective(String effective) {
            this.effective = effective;
        }

        public String getSearchMethod() {
            return searchMethod;
        }

        public void setSearchMethod(String searchMethod) {
            this.searchMethod = searchMethod;
        }

        public String getScope() {
            return scope;
        }

        public void setScope(String scope) {
            this.scope = scope;
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

    public static final class CommentCriteria {
        private String keyword;
        private String effective;
        private int page = 1;
        private int size = 100;
        private boolean includeTotalCount;

        public String getKeyword() {
            return keyword;
        }

        public void setKeyword(String keyword) {
            this.keyword = keyword;
        }

        public String getEffective() {
            return effective;
        }

        public void setEffective(String effective) {
            this.effective = effective;
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

    public static final class YouhouCriteria {
        private String keyword;
        private String effective;

        public String getKeyword() {
            return keyword;
        }

        public void setKeyword(String keyword) {
            this.keyword = keyword;
        }

        public String getEffective() {
            return effective;
        }

        public void setEffective(String effective) {
            this.effective = effective;
        }
    }

    public static final class MaterialCriteria {
        private String keyword;
        private String effective;

        public String getKeyword() {
            return keyword;
        }

        public void setKeyword(String keyword) {
            this.keyword = keyword;
        }

        public String getEffective() {
            return effective;
        }

        public void setEffective(String effective) {
            this.effective = effective;
        }
    }

    public static final class KensaSortCriteria {
        private String keyword;
        private String effective;

        public String getKeyword() {
            return keyword;
        }

        public void setKeyword(String keyword) {
            this.keyword = keyword;
        }

        public String getEffective() {
            return effective;
        }

        public void setEffective(String effective) {
            this.effective = effective;
        }
    }


    public static final class GenericClassRecord implements VersionedRecord {
        public String classCode;
        public String className;
        public String kanaName;
        public String categoryCode;
        public String parentClassCode;
        public String startDate;
        public String endDate;
        public String version;

        public String getClassCode() {
            return classCode;
        }

        public String getClassName() {
            return className;
        }

        public String getKanaName() {
            return kanaName;
        }

        public String getCategoryCode() {
            return categoryCode;
        }

        public String getParentClassCode() {
            return parentClassCode;
        }

        public String getStartDate() {
            return startDate;
        }

        public String getEndDate() {
            return endDate;
        }

        public String getVersion() {
            return version;
        }

        @Override
        public String version() {
            return version;
        }
    }


    public static final class DrugRecord implements VersionedRecord {
        public String srycd;
        public String drugName;
        public String kanaName;
        public String category;
        public String unit;
        public Double price;
        public String note;
        public String startDate;
        public String endDate;
        public String version;

        public String getSrycd() {
            return srycd;
        }

        public String getDrugName() {
            return drugName;
        }

        public String getKanaName() {
            return kanaName;
        }

        public String getCategory() {
            return category;
        }

        public String getUnit() {
            return unit;
        }

        public Double getPrice() {
            return price;
        }

        public String getNote() {
            return note;
        }

        public String getStartDate() {
            return startDate;
        }

        public String getEndDate() {
            return endDate;
        }

        public String getVersion() {
            return version;
        }

        @Override
        public String version() {
            return version;
        }
    }

    public static final class CommentRecord implements VersionedRecord {
        public String tensuCode;
        public String name;
        public String kanaName;
        public String category;
        public String unit;
        public String startDate;
        public String endDate;
        public String version;

        public String getTensuCode() {
            return tensuCode;
        }

        public String getName() {
            return name;
        }

        public String getKanaName() {
            return kanaName;
        }

        public String getCategory() {
            return category;
        }

        public String getUnit() {
            return unit;
        }

        public String getStartDate() {
            return startDate;
        }

        public String getEndDate() {
            return endDate;
        }

        public String getVersion() {
            return version;
        }

        @Override
        public String version() {
            return version;
        }
    }

    public static final class YouhouRecord implements VersionedRecord {
        public String youhouCode;
        public String youhouName;
        public String kanaName;
        public String startDate;
        public String endDate;
        public String version;

        public String getYouhouCode() {
            return youhouCode;
        }

        public String getYouhouName() {
            return youhouName;
        }

        public String getKanaName() {
            return kanaName;
        }

        public String getStartDate() {
            return startDate;
        }

        public String getEndDate() {
            return endDate;
        }

        public String getVersion() {
            return version;
        }

        @Override
        public String version() {
            return version;
        }
    }

    public static final class MaterialRecord implements VersionedRecord {
        public String materialCode;
        public String materialName;
        public String kanaName;
        public String category;
        public String materialCategory;
        public String unit;
        public Double price;
        public String maker;
        public String startDate;
        public String endDate;
        public String version;

        public String getMaterialCode() {
            return materialCode;
        }

        public String getMaterialName() {
            return materialName;
        }

        public String getKanaName() {
            return kanaName;
        }

        public String getCategory() {
            return category;
        }

        public String getMaterialCategory() {
            return materialCategory;
        }

        public String getUnit() {
            return unit;
        }

        public Double getPrice() {
            return price;
        }

        public String getMaker() {
            return maker;
        }

        public String getStartDate() {
            return startDate;
        }

        public String getEndDate() {
            return endDate;
        }

        public String getVersion() {
            return version;
        }

        @Override
        public String version() {
            return version;
        }
    }

    public static final class KensaSortRecord implements VersionedRecord {
        public String kensaCode;
        public String kensaName;
        public String kanaName;
        public String kensaSort;
        public String classification;
        public String startDate;
        public String endDate;
        public String version;

        public String getKensaCode() {
            return kensaCode;
        }

        public String getKensaName() {
            return kensaName;
        }

        public String getKanaName() {
            return kanaName;
        }

        public String getKensaSort() {
            return kensaSort;
        }

        public String getClassification() {
            return classification;
        }

        public String getStartDate() {
            return startDate;
        }

        public String getEndDate() {
            return endDate;
        }

        public String getVersion() {
            return version;
        }

        @Override
        public String version() {
            return version;
        }
    }




    public static final class GenericClassSearchResult {
        private final List<GenericClassRecord> records;
        private final Integer totalCount;
        private final String version;

        public GenericClassSearchResult(List<GenericClassRecord> records, Integer totalCount, String version) {
            this.records = records;
            this.totalCount = totalCount;
            this.version = version;
        }

        public List<GenericClassRecord> getRecords() {
            return records;
        }

        public Integer getTotalCount() {
            return totalCount;
        }

        public String getVersion() {
            return version;
        }
    }

    public static final class ListSearchResult<T extends VersionedRecord> {
        private final List<T> records;
        private final Integer totalCount;
        private final String version;

        public ListSearchResult(List<T> records, Integer totalCount, String version) {
            this.records = records;
            this.totalCount = totalCount;
            this.version = version;
        }

        public List<T> getRecords() {
            return records;
        }

        public Integer getTotalCount() {
            return totalCount;
        }

        public String getVersion() {
            return version;
        }
    }

    public static final class LookupResult<T extends VersionedRecord> {
        private final T record;
        private final String version;
        private final boolean found;

        public LookupResult(T record, String version, boolean found) {
            this.record = record;
            this.version = version;
            this.found = found;
        }

        public T getRecord() {
            return record;
        }

        public String getVersion() {
            return version;
        }

        public boolean isFound() {
            return found;
        }
    }

    private static final class GenericClassTableMeta {
        private static final GenericClassTableMeta SUPPORTED_CONTRACT = new GenericClassTableMeta(
                "TBL_GENERIC_CLASS",
                "class_code",
                "class_name",
                "kana_name",
                "category_code",
                "parent_class_code",
                "start_date",
                "end_date",
                "upymd"
        );
        private final String tableName;
        private final String codeColumn;
        private final String nameColumn;
        private final String kanaColumn;
        private final String categoryColumn;
        private final String parentColumn;
        private final String startDateColumn;
        private final String endDateColumn;
        private final String versionColumn;

        private GenericClassTableMeta(String tableName, String codeColumn, String nameColumn, String kanaColumn,
                String categoryColumn, String parentColumn, String startDateColumn, String endDateColumn,
                String versionColumn) {
            this.tableName = tableName;
            this.codeColumn = codeColumn;
            this.nameColumn = nameColumn;
            this.kanaColumn = kanaColumn;
            this.categoryColumn = categoryColumn;
            this.parentColumn = parentColumn;
            this.startDateColumn = startDateColumn;
            this.endDateColumn = endDateColumn;
            this.versionColumn = versionColumn;
        }

    }


    private static final class DrugTableMeta {
        private static final DrugTableMeta SUPPORTED_CONTRACT = new DrugTableMeta(
                "TBL_TENSU_MASTER",
                "srycd",
                "name",
                "kananame",
                "srysyukbn",
                "taniname",
                "ten",
                "yakkakjncd",
                "yukostymd",
                "yukoedymd",
                "upymd"
        );
        private final String tableName;
        private final String codeColumn;
        private final String nameColumn;
        private final String kanaColumn;
        private final String categoryColumn;
        private final String unitColumn;
        private final String priceColumn;
        private final String noteColumn;
        private final String startDateColumn;
        private final String endDateColumn;
        private final String versionColumn;

        private DrugTableMeta(String tableName, String codeColumn, String nameColumn, String kanaColumn,
                String categoryColumn, String unitColumn, String priceColumn, String noteColumn,
                String startDateColumn, String endDateColumn, String versionColumn) {
            this.tableName = tableName;
            this.codeColumn = codeColumn;
            this.nameColumn = nameColumn;
            this.kanaColumn = kanaColumn;
            this.categoryColumn = categoryColumn;
            this.unitColumn = unitColumn;
            this.priceColumn = priceColumn;
            this.noteColumn = noteColumn;
            this.startDateColumn = startDateColumn;
            this.endDateColumn = endDateColumn;
            this.versionColumn = versionColumn;
        }

    }

    private static final class YouhouTableMeta {
        private static final YouhouTableMeta SUPPORTED_CONTRACT = new YouhouTableMeta(
                "TBL_YOUHOU",
                "youhoucode",
                "youhouname",
                "kana",
                "start_date",
                "end_date",
                "upymd"
        );
        private final String tableName;
        private final String codeColumn;
        private final String nameColumn;
        private final String kanaColumn;
        private final String startDateColumn;
        private final String endDateColumn;
        private final String versionColumn;

        private YouhouTableMeta(String tableName, String codeColumn, String nameColumn, String kanaColumn,
                String startDateColumn, String endDateColumn, String versionColumn) {
            this.tableName = tableName;
            this.codeColumn = codeColumn;
            this.nameColumn = nameColumn;
            this.kanaColumn = kanaColumn;
            this.startDateColumn = startDateColumn;
            this.endDateColumn = endDateColumn;
            this.versionColumn = versionColumn;
        }

    }

    private static final class MaterialTableMeta {
        private static final MaterialTableMeta SUPPORTED_CONTRACT = new MaterialTableMeta(
                "TBL_MATERIAL_H_M",
                "material_code",
                "material_name",
                "kana_name",
                "category",
                "material_category",
                "unit",
                "price",
                "maker",
                "start_date",
                "end_date",
                "upymd"
        );
        private final String tableName;
        private final String codeColumn;
        private final String nameColumn;
        private final String kanaColumn;
        private final String categoryColumn;
        private final String materialCategoryColumn;
        private final String unitColumn;
        private final String priceColumn;
        private final String makerColumn;
        private final String startDateColumn;
        private final String endDateColumn;
        private final String versionColumn;

        private MaterialTableMeta(String tableName, String codeColumn, String nameColumn, String kanaColumn,
                String categoryColumn, String materialCategoryColumn, String unitColumn, String priceColumn,
                String makerColumn, String startDateColumn, String endDateColumn, String versionColumn) {
            this.tableName = tableName;
            this.codeColumn = codeColumn;
            this.nameColumn = nameColumn;
            this.kanaColumn = kanaColumn;
            this.categoryColumn = categoryColumn;
            this.materialCategoryColumn = materialCategoryColumn;
            this.unitColumn = unitColumn;
            this.priceColumn = priceColumn;
            this.makerColumn = makerColumn;
            this.startDateColumn = startDateColumn;
            this.endDateColumn = endDateColumn;
            this.versionColumn = versionColumn;
        }

    }

    private static final class KensaSortTableMeta {
        private static final KensaSortTableMeta SUPPORTED_CONTRACT = new KensaSortTableMeta(
                "TBL_KENSASORT",
                "kensa_code",
                "kensa_name",
                "kana_name",
                "kensa_sort",
                "classification",
                "start_date",
                "end_date",
                "upymd"
        );
        private final String tableName;
        private final String codeColumn;
        private final String nameColumn;
        private final String kanaColumn;
        private final String kensaSortColumn;
        private final String classificationColumn;
        private final String startDateColumn;
        private final String endDateColumn;
        private final String versionColumn;

        private KensaSortTableMeta(String tableName, String codeColumn, String nameColumn, String kanaColumn,
                String kensaSortColumn, String classificationColumn, String startDateColumn, String endDateColumn,
                String versionColumn) {
            this.tableName = tableName;
            this.codeColumn = codeColumn;
            this.nameColumn = nameColumn;
            this.kanaColumn = kanaColumn;
            this.kensaSortColumn = kensaSortColumn;
            this.classificationColumn = classificationColumn;
            this.startDateColumn = startDateColumn;
            this.endDateColumn = endDateColumn;
            this.versionColumn = versionColumn;
        }

    }
}
