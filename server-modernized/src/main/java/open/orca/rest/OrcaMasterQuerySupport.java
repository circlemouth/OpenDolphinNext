package open.orca.rest;

import java.util.ArrayList;
import java.util.List;

final class OrcaMasterQuerySupport {
    private static final String DRUG_CODE_PREFIX = "6";
    private static final String MATERIAL_CODE_PREFIX = "7";
    private static final String COMMENT_CODE_REGEX = "^(008[1-6]|8[1-6]|098|099|98|99)";
    private static final String BODY_PART_NAME_TOKEN = "部位";

    Query buildGenericClassQuery(OrcaMasterDao.GenericClassCriteria criteria, String tableName,
            String codeColumn, String nameColumn, String kanaColumn, String startDateColumn, String endDateColumn) {
        return buildKeywordEffectiveQuery(criteria.getKeyword(), criteria.getEffective(), tableName,
                codeColumn, nameColumn, kanaColumn, startDateColumn, endDateColumn);
    }

    Query buildDrugQuery(OrcaMasterDao.DrugCriteria criteria, String tableName, String codeColumn, String nameColumn,
            String kanaColumn, String startDateColumn, String endDateColumn, String searchMethod) {
        StringBuilder where = new StringBuilder(" FROM ").append(tableName).append(" WHERE 1=1");
        List<Object> params = new ArrayList<>();
        where.append(" AND CAST(").append(codeColumn).append(" AS VARCHAR) LIKE ?");
        params.add(DRUG_CODE_PREFIX + "%");
        appendKeywordFilter(where, params, criteria.getKeyword(), codeColumn, nameColumn, kanaColumn, searchMethod);
        appendEffectiveFilter(where, params, criteria.getEffective(), startDateColumn, endDateColumn);
        return new Query(where.toString(), params);
    }

    Query buildMaterialQuery(OrcaMasterDao.MaterialCriteria criteria, String tableName, String codeColumn,
            String nameColumn, String kanaColumn, String startDateColumn, String endDateColumn) {
        StringBuilder where = new StringBuilder(" FROM ").append(tableName).append(" WHERE 1=1");
        List<Object> params = new ArrayList<>();
        where.append(" AND CAST(").append(codeColumn).append(" AS VARCHAR) LIKE ?");
        params.add(MATERIAL_CODE_PREFIX + "%");
        appendKeywordFilter(where, params, criteria.getKeyword(), codeColumn, nameColumn, kanaColumn, null);
        appendEffectiveFilter(where, params, criteria.getEffective(), startDateColumn, endDateColumn);
        return new Query(where.toString(), params);
    }

    Query buildCommentQuery(OrcaMasterDao.CommentCriteria criteria, String tableName, String codeColumn,
            String nameColumn, String kanaColumn, String startDateColumn, String endDateColumn) {
        StringBuilder where = new StringBuilder(" FROM ").append(tableName).append(" WHERE 1=1");
        List<Object> params = new ArrayList<>();
        where.append(" AND CAST(").append(codeColumn).append(" AS VARCHAR) ~ ?");
        params.add(COMMENT_CODE_REGEX);
        appendKeywordFilter(where, params, criteria.getKeyword(), codeColumn, nameColumn, kanaColumn, null);
        appendEffectiveFilter(where, params, criteria.getEffective(), startDateColumn, endDateColumn);
        return new Query(where.toString(), params);
    }

    Query buildBodypartQuery(OrcaMasterDao.CommentCriteria criteria, String tableName, String codeColumn,
            String nameColumn, String kanaColumn, String startDateColumn, String endDateColumn) {
        StringBuilder where = new StringBuilder(" FROM ").append(tableName).append(" WHERE 1=1");
        List<Object> params = new ArrayList<>();
        where.append(" AND CAST(").append(codeColumn).append(" AS VARCHAR) ~ ?");
        params.add(COMMENT_CODE_REGEX);
        where.append(" AND UPPER(CAST(").append(nameColumn).append(" AS VARCHAR)) LIKE ?");
        params.add("%" + BODY_PART_NAME_TOKEN + "%");
        appendKeywordFilter(where, params, criteria.getKeyword(), codeColumn, nameColumn, kanaColumn, null);
        appendEffectiveFilter(where, params, criteria.getEffective(), startDateColumn, endDateColumn);
        return new Query(where.toString(), params);
    }

    Query buildKensaSortJoinQuery(OrcaMasterDao.KensaSortCriteria criteria, String kensaSortTableName,
            String kensaSortCodeColumn, String kensaSortColumn, String tensuTableName, String tensuCodeColumn,
            String tensuNameColumn, String tensuKanaColumn, String tensuStartDateColumn, String tensuEndDateColumn) {
        final String sortAlias = "k";
        final String tensuAlias = "t";
        StringBuilder where = new StringBuilder(" FROM ").append(kensaSortTableName).append(' ').append(sortAlias)
                .append(" JOIN ").append(tensuTableName).append(' ').append(tensuAlias)
                .append(" ON ").append(tensuAlias).append('.').append(tensuCodeColumn)
                .append(" = ").append(sortAlias).append('.').append(kensaSortCodeColumn)
                .append(" WHERE 1=1");
        List<Object> params = new ArrayList<>();
        MasterSearchKeywordSupport.appendOrcaKeywordFilter(where, params, criteria.getKeyword(), null,
                sortAlias + "." + kensaSortCodeColumn,
                tensuAlias + "." + tensuNameColumn,
                tensuAlias + "." + tensuKanaColumn,
                kensaSortColumn != null ? sortAlias + "." + kensaSortColumn : null);
        appendEffectiveFilter(where, params, criteria.getEffective(),
                tensuStartDateColumn != null ? tensuAlias + "." + tensuStartDateColumn : null,
                tensuEndDateColumn != null ? tensuAlias + "." + tensuEndDateColumn : null);
        return new Query(where.toString(), params);
    }

    Query buildKeywordEffectiveQuery(String keyword, String effective, String tableName, String codeColumn,
            String nameColumn, String kanaColumn, String startDateColumn, String endDateColumn) {
        StringBuilder where = new StringBuilder(" FROM ").append(tableName).append(" WHERE 1=1");
        List<Object> params = new ArrayList<>();
        appendKeywordFilter(where, params, keyword, codeColumn, nameColumn, kanaColumn, null);
        appendEffectiveFilter(where, params, effective, startDateColumn, endDateColumn);
        return new Query(where.toString(), params);
    }

    private void appendKeywordFilter(StringBuilder where, List<Object> params, String keyword,
            String codeColumn, String nameColumn, String kanaColumn, String searchMethod) {
        MasterSearchKeywordSupport.appendOrcaKeywordFilter(where, params, keyword, searchMethod,
                codeColumn, nameColumn, kanaColumn);
    }

    private void appendEffectiveFilter(StringBuilder where, List<Object> params, String effective,
            String startDateColumn, String endDateColumn) {
        if (effective == null || effective.isBlank() || startDateColumn == null || endDateColumn == null) {
            return;
        }
        where.append(" AND ").append(startDateColumn).append(" <= ? AND ").append(endDateColumn).append(" >= ?");
        params.add(effective);
        params.add(effective);
    }

    static final class Query {
        final String whereClause;
        final List<Object> params;

        Query(String whereClause, List<Object> params) {
            this.whereClause = whereClause;
            this.params = params;
        }
    }
}
