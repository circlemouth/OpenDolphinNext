package open.orca.rest;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.logging.Level;
import java.util.logging.Logger;
import open.dolphin.rest.dto.orca.OrcaOrderInputSetDetailResponse;
import open.dolphin.rest.dto.orca.OrcaOrderInputSetListResponse;
import open.dolphin.rest.dto.orca.OrcaOrderInteractionCheckResponse;

/**
 * Read-only query boundary for OpenDolphin local ORCA master cache/projection.
 */
@ApplicationScoped
public class LocalOrcaMasterCacheRepository {

    private static final Logger LOGGER = Logger.getLogger(LocalOrcaMasterCacheRepository.class.getName());
    private static final int MAX_PAGE_SIZE = 2000;

    @PersistenceContext(unitName = "opendolphinPU")
    private EntityManager entityManager;

    public LocalOrcaMasterCacheRepository() {
    }

    LocalOrcaMasterCacheRepository(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    OrcaMasterDao.GenericClassSearchResult searchGenericClass(OrcaMasterDao.GenericClassCriteria criteria) {
        String masterType = "generic-class";
        OrcaMasterCacheState state = loadState(masterType);
        if (state.isUnavailable()) {
            return new OrcaMasterDao.GenericClassSearchResult(List.of(), 0, state.masterVersion(), state);
        }
        try {
            List<Object[]> rows = queryEntryRows(masterType, criteria.getKeyword(), criteria.getEffective(), null,
                    null, null, criteria.getPage(), criteria.getSize());
            List<OrcaMasterDao.GenericClassRecord> records = new ArrayList<>(rows.size());
            for (Object[] row : rows) {
                OrcaMasterDao.GenericClassRecord record = new OrcaMasterDao.GenericClassRecord();
                record.classCode = asString(row[0]);
                record.className = asString(row[1]);
                record.kanaName = asString(row[2]);
                record.categoryCode = asString(row[3]);
                record.parentClassCode = asString(row[21]);
                record.startDate = asString(row[6]);
                record.endDate = asString(row[7]);
                record.version = firstNonBlank(asString(row[8]), state.masterVersion());
                records.add(record);
            }
            Integer total = criteria.isIncludeTotalCount()
                    ? countEntryRows(masterType, criteria.getKeyword(), criteria.getEffective(), null, null, null)
                    : null;
            return new OrcaMasterDao.GenericClassSearchResult(records, total, state.masterVersion(), state);
        } catch (RuntimeException ex) {
            logBackendFailure(masterType, ex);
            OrcaMasterCacheState failure = OrcaMasterCacheState.unavailable(masterType);
            return new OrcaMasterDao.GenericClassSearchResult(List.of(), 0, null, failure);
        }
    }

    OrcaMasterDao.ListSearchResult<OrcaMasterDao.DrugRecord> searchDrug(OrcaMasterDao.DrugCriteria criteria) {
        String masterType = "drug";
        OrcaMasterCacheState state = loadState(masterType);
        if (state.isUnavailable()) {
            return new OrcaMasterDao.ListSearchResult<>(List.of(), 0, state.masterVersion(), state);
        }
        try {
            List<Object[]> rows = queryEntryRows(masterType, criteria.getKeyword(), criteria.getEffective(), null,
                    null, null, criteria.getPage(), criteria.getSize());
            List<OrcaMasterDao.DrugRecord> records = new ArrayList<>(rows.size());
            for (Object[] row : rows) {
                OrcaMasterDao.DrugRecord record = new OrcaMasterDao.DrugRecord();
                record.srycd = asString(row[0]);
                record.drugName = asString(row[1]);
                record.kanaName = asString(row[2]);
                record.category = asString(row[3]);
                record.unit = asString(row[4]);
                record.price = asDouble(row[5]);
                record.startDate = asString(row[6]);
                record.endDate = asString(row[7]);
                record.version = firstNonBlank(asString(row[8]), state.masterVersion());
                record.note = asString(row[9]);
                records.add(record);
            }
            Integer total = criteria.isIncludeTotalCount()
                    ? countEntryRows(masterType, criteria.getKeyword(), criteria.getEffective(), null, null, null)
                    : null;
            return new OrcaMasterDao.ListSearchResult<>(records, total, state.masterVersion(), state);
        } catch (RuntimeException ex) {
            logBackendFailure(masterType, ex);
            OrcaMasterCacheState failure = OrcaMasterCacheState.unavailable(masterType);
            return new OrcaMasterDao.ListSearchResult<>(List.of(), 0, null, failure);
        }
    }

    OrcaMasterDao.LookupResult<OrcaMasterDao.GenericPriceRecord> findGenericPrice(
            OrcaMasterDao.GenericPriceCriteria criteria) {
        String masterType = "generic-price";
        OrcaMasterCacheState state = loadState(masterType);
        if (state.isUnavailable()) {
            return new OrcaMasterDao.LookupResult<>(null, state.masterVersion(), false, state);
        }
        try {
            Object[] row = findEntryByCode(masterType, criteria.getSrycd(), criteria.getEffective());
            if (row == null) {
                return new OrcaMasterDao.LookupResult<>(null, state.masterVersion(), false, state);
            }
            OrcaMasterDao.GenericPriceRecord record = new OrcaMasterDao.GenericPriceRecord();
            record.srycd = asString(row[0]);
            record.drugName = asString(row[1]);
            record.unit = asString(row[4]);
            record.price = asDouble(row[5]);
            record.startDate = asString(row[6]);
            record.endDate = asString(row[7]);
            record.version = firstNonBlank(asString(row[8]), state.masterVersion());
            return new OrcaMasterDao.LookupResult<>(record, state.masterVersion(), true, state);
        } catch (RuntimeException ex) {
            logBackendFailure(masterType, ex);
            OrcaMasterCacheState failure = OrcaMasterCacheState.unavailable(masterType);
            return new OrcaMasterDao.LookupResult<>(null, null, false, failure);
        }
    }

    OrcaMasterDao.ListSearchResult<OrcaMasterDao.CommentRecord> searchComment(
            OrcaMasterDao.CommentCriteria criteria) {
        return searchCommentLike("comment", criteria);
    }

    OrcaMasterDao.ListSearchResult<OrcaMasterDao.CommentRecord> searchBodypart(
            OrcaMasterDao.CommentCriteria criteria) {
        return searchCommentLike("bodypart", criteria);
    }

    OrcaMasterDao.ListSearchResult<OrcaMasterDao.HokenjaRecord> searchHokenja(OrcaMasterDao.HokenjaCriteria criteria) {
        String masterType = "hokenja";
        OrcaMasterCacheState state = loadState(masterType);
        if (state.isUnavailable()) {
            return new OrcaMasterDao.ListSearchResult<>(List.of(), 0, state.masterVersion(), state);
        }
        try {
            List<Object[]> rows = queryHokenjaRows(criteria, state);
            List<OrcaMasterDao.HokenjaRecord> records = new ArrayList<>(rows.size());
            for (Object[] row : rows) {
                OrcaMasterDao.HokenjaRecord record = new OrcaMasterDao.HokenjaRecord();
                record.payerCode = asString(row[0]);
                record.payerName = asString(row[1]);
                record.payerType = asString(row[3]);
                record.payerRatio = asDouble(row[22]);
                record.prefCode = asString(row[10]);
                record.cityCode = asString(row[11]);
                record.zip = asString(row[12]);
                record.addressLine = asString(row[13]);
                record.phone = asString(row[14]);
                record.validFrom = asString(row[6]);
                record.validTo = asString(row[7]);
                record.version = firstNonBlank(asString(row[8]), state.masterVersion());
                records.add(record);
            }
            Integer total = criteria.isIncludeTotalCount() ? countHokenjaRows(criteria) : null;
            return new OrcaMasterDao.ListSearchResult<>(records, total, state.masterVersion(), state);
        } catch (RuntimeException ex) {
            logBackendFailure(masterType, ex);
            OrcaMasterCacheState failure = OrcaMasterCacheState.unavailable(masterType);
            return new OrcaMasterDao.ListSearchResult<>(List.of(), 0, null, failure);
        }
    }

    OrcaMasterDao.LookupResult<OrcaMasterDao.AddressRecord> findAddress(OrcaMasterDao.AddressCriteria criteria) {
        String masterType = "address";
        OrcaMasterCacheState state = loadState(masterType);
        if (state.isUnavailable()) {
            return new OrcaMasterDao.LookupResult<>(null, state.masterVersion(), false, state);
        }
        try {
            Object[] row = findEntryByCode(masterType, criteria.getZip(), criteria.getEffective());
            if (row == null) {
                return new OrcaMasterDao.LookupResult<>(null, state.masterVersion(), false, state);
            }
            OrcaMasterDao.AddressRecord record = new OrcaMasterDao.AddressRecord();
            record.zip = asString(row[0]);
            record.prefCode = asString(row[10]);
            record.cityCode = asString(row[11]);
            record.city = asString(row[15]);
            record.town = asString(row[16]);
            record.kana = asString(row[17]);
            record.roman = asString(row[18]);
            record.fullAddress = firstNonBlank(asString(row[13]), asString(row[1]));
            record.version = firstNonBlank(asString(row[8]), state.masterVersion());
            return new OrcaMasterDao.LookupResult<>(record, state.masterVersion(), true, state);
        } catch (RuntimeException ex) {
            logBackendFailure(masterType, ex);
            OrcaMasterCacheState failure = OrcaMasterCacheState.unavailable(masterType);
            return new OrcaMasterDao.LookupResult<>(null, null, false, failure);
        }
    }

    OrcaMasterDao.ListSearchResult<OrcaMasterDao.YouhouRecord> searchYouhou(OrcaMasterDao.YouhouCriteria criteria) {
        String masterType = "youhou";
        OrcaMasterCacheState state = loadState(masterType);
        if (state.isUnavailable()) {
            return new OrcaMasterDao.ListSearchResult<>(List.of(), 0, state.masterVersion(), state);
        }
        try {
            List<Object[]> rows = queryEntryRows(masterType, criteria.getKeyword(), criteria.getEffective(), null,
                    null, null, 1, MAX_PAGE_SIZE);
            List<OrcaMasterDao.YouhouRecord> records = new ArrayList<>(rows.size());
            for (Object[] row : rows) {
                OrcaMasterDao.YouhouRecord record = new OrcaMasterDao.YouhouRecord();
                record.youhouCode = asString(row[0]);
                record.youhouName = asString(row[1]);
                record.kanaName = asString(row[2]);
                record.startDate = asString(row[6]);
                record.endDate = asString(row[7]);
                record.version = firstNonBlank(asString(row[8]), state.masterVersion());
                records.add(record);
            }
            return new OrcaMasterDao.ListSearchResult<>(records, records.size(), state.masterVersion(), state);
        } catch (RuntimeException ex) {
            logBackendFailure(masterType, ex);
            OrcaMasterCacheState failure = OrcaMasterCacheState.unavailable(masterType);
            return new OrcaMasterDao.ListSearchResult<>(List.of(), 0, null, failure);
        }
    }

    OrcaMasterDao.ListSearchResult<OrcaMasterDao.MaterialRecord> searchMaterial(OrcaMasterDao.MaterialCriteria criteria) {
        String masterType = "material";
        OrcaMasterCacheState state = loadState(masterType);
        if (state.isUnavailable()) {
            return new OrcaMasterDao.ListSearchResult<>(List.of(), 0, state.masterVersion(), state);
        }
        try {
            List<Object[]> rows = queryEntryRows(masterType, criteria.getKeyword(), criteria.getEffective(), null,
                    null, null, 1, MAX_PAGE_SIZE);
            List<OrcaMasterDao.MaterialRecord> records = new ArrayList<>(rows.size());
            for (Object[] row : rows) {
                OrcaMasterDao.MaterialRecord record = new OrcaMasterDao.MaterialRecord();
                record.materialCode = asString(row[0]);
                record.materialName = asString(row[1]);
                record.kanaName = asString(row[2]);
                record.category = asString(row[3]);
                record.materialCategory = asString(row[3]);
                record.unit = asString(row[4]);
                record.price = asDouble(row[5]);
                record.startDate = asString(row[6]);
                record.endDate = asString(row[7]);
                record.version = firstNonBlank(asString(row[8]), state.masterVersion());
                record.maker = asString(row[9]);
                records.add(record);
            }
            return new OrcaMasterDao.ListSearchResult<>(records, records.size(), state.masterVersion(), state);
        } catch (RuntimeException ex) {
            logBackendFailure(masterType, ex);
            OrcaMasterCacheState failure = OrcaMasterCacheState.unavailable(masterType);
            return new OrcaMasterDao.ListSearchResult<>(List.of(), 0, null, failure);
        }
    }

    OrcaMasterDao.ListSearchResult<OrcaMasterDao.KensaSortRecord> searchKensaSort(
            OrcaMasterDao.KensaSortCriteria criteria) {
        String masterType = "kensa-sort";
        OrcaMasterCacheState state = loadState(masterType);
        if (state.isUnavailable()) {
            return new OrcaMasterDao.ListSearchResult<>(List.of(), 0, state.masterVersion(), state);
        }
        try {
            List<Object[]> rows = queryEntryRows(masterType, criteria.getKeyword(), criteria.getEffective(), null,
                    null, null, 1, MAX_PAGE_SIZE);
            List<OrcaMasterDao.KensaSortRecord> records = new ArrayList<>(rows.size());
            for (Object[] row : rows) {
                OrcaMasterDao.KensaSortRecord record = new OrcaMasterDao.KensaSortRecord();
                record.kensaCode = asString(row[0]);
                record.kensaName = asString(row[1]);
                record.kanaName = asString(row[2]);
                record.classification = asString(row[3]);
                record.kensaSort = firstNonBlank(asString(row[19]), asString(row[3]));
                record.startDate = asString(row[6]);
                record.endDate = asString(row[7]);
                record.version = firstNonBlank(asString(row[8]), state.masterVersion());
                records.add(record);
            }
            return new OrcaMasterDao.ListSearchResult<>(records, records.size(), state.masterVersion(), state);
        } catch (RuntimeException ex) {
            logBackendFailure(masterType, ex);
            OrcaMasterCacheState failure = OrcaMasterCacheState.unavailable(masterType);
            return new OrcaMasterDao.ListSearchResult<>(List.of(), 0, null, failure);
        }
    }

    EtensuDao.EtensuSearchResult searchEtensu(EtensuDao.EtensuSearchCriteria criteria) {
        String masterType = "etensu";
        long start = System.nanoTime();
        OrcaMasterCacheState state = loadState(masterType);
        if (state.isUnavailable()) {
            return new EtensuDao.EtensuSearchResult(List.of(), 0, state.masterVersion(), elapsedMs(start), true, state);
        }
        try {
            List<Object[]> rows = queryEntryRows(masterType, criteria.getKeyword(), criteria.getAsOf(),
                    criteria.getCategory(), criteria.getPointsMin(), criteria.getPointsMax(), criteria.getPage(),
                    criteria.getSize());
            List<EtensuDao.EtensuRecord> records = new ArrayList<>(rows.size());
            for (Object[] row : rows) {
                EtensuDao.EtensuRecord record = new EtensuDao.EtensuRecord();
                record.tensuCode = asString(row[0]);
                record.name = asString(row[1]);
                record.kubun = asString(row[3]);
                record.tanka = asDouble(row[5]);
                record.points = record.tanka;
                record.unit = asString(row[4]);
                record.category = asString(row[3]);
                record.startDate = asString(row[6]);
                record.endDate = asString(row[7]);
                record.tensuVersion = firstNonBlank(criteria.getTensuVersion(), asString(row[8]), state.masterVersion());
                record.noticeDate = asString(row[20]);
                record.effectiveDate = record.startDate;
                records.add(record);
            }
            Integer total = criteria.isIncludeTotalCount()
                    ? countEntryRows(masterType, criteria.getKeyword(), criteria.getAsOf(), criteria.getCategory(),
                            criteria.getPointsMin(), criteria.getPointsMax())
                    : null;
            return new EtensuDao.EtensuSearchResult(records, total, state.masterVersion(), elapsedMs(start), false, state);
        } catch (RuntimeException ex) {
            logBackendFailure(masterType, ex);
            OrcaMasterCacheState failure = OrcaMasterCacheState.unavailable(masterType);
            return new EtensuDao.EtensuSearchResult(List.of(), 0, null, elapsedMs(start), true, failure);
        }
    }

    public List<OrcaOrderInputSetListResponse.Item> searchInputSetSummaries(String keyword, String effective,
            String claimClassSystem) {
        String masterType = "order-inputsets";
        OrcaMasterCacheState state = loadState(masterType);
        if (state.isUnavailable()) {
            throw new LocalMasterUnavailableException(state);
        }
        try {
            StringBuilder sql = new StringBuilder();
            sql.append("SELECT set_code, name, entity, kind, class_code, item_count, valid_from, valid_to ")
                    .append("FROM opendolphin.local_orca_master_inputset ")
                    .append("WHERE read_only = TRUE ");
            if (effective != null && !effective.isBlank()) {
                sql.append("AND valid_from <= :effective AND valid_to >= :effective ");
            }
            String normalizedKeyword = normalizeKeyword(keyword);
            if (normalizedKeyword != null) {
                sql.append("AND (LOWER(set_code) LIKE :keyword OR LOWER(name) LIKE :keyword) ");
            }
            sql.append("ORDER BY set_code");
            Query query = entityManager().createNativeQuery(sql.toString());
            if (effective != null && !effective.isBlank()) {
                query.setParameter("effective", effective);
            }
            if (normalizedKeyword != null) {
                query.setParameter("keyword", "%" + normalizedKeyword + "%");
            }
            @SuppressWarnings("unchecked")
            List<Object[]> rows = query.getResultList();
            List<OrcaOrderInputSetListResponse.Item> items = new ArrayList<>(rows.size());
            for (Object[] row : rows) {
                OrcaOrderInputSetListResponse.Item item = new OrcaOrderInputSetListResponse.Item();
                item.setSetCode(asString(row[0]));
                item.setName(asString(row[1]));
                item.setEntity(asString(row[2]));
                item.setKind(asString(row[3]));
                item.setClassCode(asString(row[4]));
                item.setClassCodeSystem(claimClassSystem);
                item.setItemCount(asInteger(row[5]));
                item.setValidFrom(asString(row[6]));
                item.setValidTo(asString(row[7]));
                items.add(item);
            }
            return items;
        } catch (RuntimeException ex) {
            logBackendFailure(masterType, ex);
            throw new LocalMasterUnavailableException(OrcaMasterCacheState.unavailable(masterType));
        }
    }

    public OrcaOrderInputSetDetailResponse.Bundle findInputSetDetail(String setCode, String effective,
            String requestedName, String bodyPartCodePrefix, String claimClassSystem) {
        String masterType = "order-inputsets";
        OrcaMasterCacheState state = loadState(masterType);
        if (state.isUnavailable()) {
            throw new LocalMasterUnavailableException(state);
        }
        try {
            Object[] header = findInputSetHeader(setCode, effective);
            if (header == null) {
                return null;
            }
            OrcaOrderInputSetDetailResponse.Bundle bundle = new OrcaOrderInputSetDetailResponse.Bundle();
            bundle.setSourceSetCode(asString(header[0]));
            bundle.setBundleName(firstNonBlank(requestedName, asString(header[1])));
            bundle.setBundleNumber("1");
            bundle.setEntity(asString(header[2]));
            bundle.setClassCode(asString(header[4]));
            bundle.setClassCodeSystem(claimClassSystem);
            bundle.setClassName(asString(header[5]));
            bundle.setStarted(toIsoDate(effective));
            List<OrcaOrderInputSetDetailResponse.Item> main = new ArrayList<>();
            List<OrcaOrderInputSetDetailResponse.Item> materials = new ArrayList<>();
            List<OrcaOrderInputSetDetailResponse.Item> comments = new ArrayList<>();
            for (Object[] row : queryInputSetItems(setCode, effective)) {
                OrcaOrderInputSetDetailResponse.Item item = new OrcaOrderInputSetDetailResponse.Item();
                item.setCode(asString(row[0]));
                item.setName(asString(row[1]));
                item.setQuantity(asString(row[2]));
                item.setUnit(asString(row[3]));
                item.setMemo(asString(row[4]));
                item.setRowRole(asString(row[5]));
                item.setRowSubtype(asString(row[6]));
                item.setCategory(asString(row[7]));
                String rowRole = firstNonBlank(item.getRowRole(), "main");
                if ("bodyPart".equals(rowRole) || (item.getCode() != null && item.getCode().startsWith(bodyPartCodePrefix))) {
                    OrcaOrderInputSetDetailResponse.BodyPart bodyPart = new OrcaOrderInputSetDetailResponse.BodyPart();
                    bodyPart.setCode(item.getCode());
                    bodyPart.setName(item.getName());
                    bodyPart.setQuantity(item.getQuantity());
                    bodyPart.setUnit(item.getUnit());
                    bodyPart.setMemo(item.getMemo());
                    bodyPart.setRowRole("bodyPart");
                    bundle.setBodyPart(bodyPart);
                } else if ("material".equals(rowRole)) {
                    materials.add(item);
                } else if ("comment".equals(rowRole)) {
                    comments.add(item);
                } else {
                    item.setRowRole("main");
                    main.add(item);
                }
            }
            bundle.setItems(main);
            bundle.setMaterialItems(materials);
            bundle.setCommentItems(comments);
            return bundle;
        } catch (RuntimeException ex) {
            logBackendFailure(masterType, ex);
            throw new LocalMasterUnavailableException(OrcaMasterCacheState.unavailable(masterType));
        }
    }

    public List<OrcaOrderInteractionCheckResponse.Pair> findInteractionPairs(List<String> codes,
            List<String> existingCodes) {
        return findInteractionPairs(codes, existingCodes, null);
    }

    public List<OrcaOrderInteractionCheckResponse.Pair> findInteractionPairs(List<String> codes,
            List<String> existingCodes, String effective) {
        String masterType = "order-interactions";
        OrcaMasterCacheState state = loadState(masterType);
        if (state.isUnavailable()) {
            throw new LocalMasterUnavailableException(state);
        }
        List<String> rightCodes = existingCodes == null || existingCodes.isEmpty() ? codes : existingCodes;
        if (codes == null || codes.isEmpty() || rightCodes.isEmpty()) {
            return List.of();
        }
        try {
            String leftIn = placeholders(codes.size());
            String rightIn = placeholders(rightCodes.size());
            String normalizedEffective = effective != null && !effective.isBlank() ? normalizeEffective(effective) : null;
            String sql = "SELECT code1, code2, interaction_code, interaction_name, message "
                    + "FROM opendolphin.local_orca_master_interaction "
                    + "WHERE read_only = TRUE AND ((code1 IN (" + leftIn + ") AND code2 IN (" + rightIn + ")) "
                    + "OR (code1 IN (" + rightIn + ") AND code2 IN (" + leftIn + "))) "
                    + (normalizedEffective != null ? "AND valid_from <= ? AND valid_to >= ? " : "")
                    + "ORDER BY code1, code2";
            Query query = entityManager().createNativeQuery(sql);
            int index = 1;
            for (String code : codes) {
                query.setParameter(index++, code);
            }
            for (String code : rightCodes) {
                query.setParameter(index++, code);
            }
            for (String code : rightCodes) {
                query.setParameter(index++, code);
            }
            for (String code : codes) {
                query.setParameter(index++, code);
            }
            if (normalizedEffective != null) {
                query.setParameter(index++, normalizedEffective);
                query.setParameter(index, normalizedEffective);
            }
            @SuppressWarnings("unchecked")
            List<Object[]> rows = query.getResultList();
            List<OrcaOrderInteractionCheckResponse.Pair> pairs = new ArrayList<>(rows.size());
            for (Object[] row : rows) {
                String left = asString(row[0]);
                String right = asString(row[1]);
                if (left == null || right == null || left.equals(right)) {
                    continue;
                }
                String first = left.compareTo(right) <= 0 ? left : right;
                String second = left.compareTo(right) <= 0 ? right : left;
                OrcaOrderInteractionCheckResponse.Pair pair = new OrcaOrderInteractionCheckResponse.Pair();
                pair.setCode1(first);
                pair.setCode2(second);
                pair.setInteractionCode(asString(row[2]));
                pair.setInteractionName(asString(row[3]));
                pair.setMessage(firstNonBlank(asString(row[4]), "相互作用が検出されました"));
                pairs.add(pair);
            }
            return pairs;
        } catch (RuntimeException ex) {
            logBackendFailure(masterType, ex);
            throw new LocalMasterUnavailableException(OrcaMasterCacheState.unavailable(masterType));
        }
    }

    public List<java.util.Map<String, Object>> queryDiseaseCandidates(String term, String referenceDate, boolean partial) {
        String masterType = "disease-candidate";
        OrcaMasterCacheState state = loadState(masterType);
        if (state.isUnavailable()) {
            throw new LocalMasterUnavailableException(state);
        }
        String keyword = term != null ? term.trim() : null;
        if (keyword == null || keyword.isBlank()) {
            return List.of();
        }
        try {
            String operator = partial ? "LIKE" : "=";
            String sql = "SELECT code, name, kana, payload_json ->> 'icdTen', valid_to "
                    + "FROM opendolphin.local_orca_master_entry WHERE master_type = :masterType AND read_only = TRUE "
                    + "AND (name " + operator + " :keyword OR kana " + operator + " :keyword) "
                    + "AND (valid_to IS NULL OR valid_to = '' OR valid_to = '00000000' OR valid_to >= :referenceDate) "
                    + "ORDER BY name LIMIT 20";
            Query query = entityManager().createNativeQuery(sql);
            query.setParameter("masterType", masterType);
            query.setParameter("keyword", partial ? keyword + "%" : keyword);
            query.setParameter("referenceDate", normalizeEffective(referenceDate));
            @SuppressWarnings("unchecked")
            List<Object[]> rows = query.getResultList();
            List<java.util.Map<String, Object>> result = new ArrayList<>(rows.size());
            for (Object[] row : rows) {
                java.util.Map<String, Object> entry = new java.util.LinkedHashMap<>();
                entry.put("code", asString(row[0]));
                entry.put("name", asString(row[1]));
                entry.put("kana", asString(row[2]));
                entry.put("icdTen", asString(row[3]));
                entry.put("disUseDate", asString(row[4]));
                entry.put("layer", "candidate");
                entry.put("readOnly", Boolean.TRUE);
                entry.put("candidateOnly", Boolean.TRUE);
                result.add(entry);
            }
            return result;
        } catch (RuntimeException ex) {
            logBackendFailure(masterType, ex);
            throw new LocalMasterUnavailableException(OrcaMasterCacheState.unavailable(masterType));
        }
    }

    public OrcaMasterCacheState loadState(String masterType) {
        try {
            Object[] row = (Object[]) entityManager().createNativeQuery(
                    "SELECT source_system, source_kind, source_api, source_file, master_type, master_version, "
                            + "effective_from, effective_to, imported_at, stale, unavailable_reason, cache_status "
                            + "FROM opendolphin.local_orca_master_dataset WHERE master_type = :masterType "
                            + "AND read_only = TRUE")
                    .setParameter("masterType", masterType)
                    .getSingleResult();
            return new OrcaMasterCacheState(
                    asString(row[0]),
                    asString(row[1]),
                    asString(row[2]),
                    asString(row[3]),
                    asString(row[4]),
                    asString(row[5]),
                    asString(row[6]),
                    asString(row[7]),
                    asInstantString(row[8]),
                    Boolean.TRUE.equals(row[9]),
                    asString(row[10]),
                    asString(row[11]));
        } catch (NoResultException ex) {
            return OrcaMasterCacheState.notImported(masterType);
        } catch (RuntimeException ex) {
            logBackendFailure(masterType, ex);
            return OrcaMasterCacheState.unavailable(masterType);
        }
    }

    private OrcaMasterDao.ListSearchResult<OrcaMasterDao.CommentRecord> searchCommentLike(String masterType,
            OrcaMasterDao.CommentCriteria criteria) {
        OrcaMasterCacheState state = loadState(masterType);
        if (state.isUnavailable()) {
            return new OrcaMasterDao.ListSearchResult<>(List.of(), 0, state.masterVersion(), state);
        }
        try {
            List<Object[]> rows = queryEntryRows(masterType, criteria.getKeyword(), criteria.getEffective(), null,
                    null, null, criteria.getPage(), criteria.getSize());
            List<OrcaMasterDao.CommentRecord> records = new ArrayList<>(rows.size());
            for (Object[] row : rows) {
                OrcaMasterDao.CommentRecord record = new OrcaMasterDao.CommentRecord();
                record.tensuCode = asString(row[0]);
                record.name = asString(row[1]);
                record.kanaName = asString(row[2]);
                record.category = asString(row[3]);
                record.unit = asString(row[4]);
                record.startDate = asString(row[6]);
                record.endDate = asString(row[7]);
                record.version = firstNonBlank(asString(row[8]), state.masterVersion());
                records.add(record);
            }
            Integer total = criteria.isIncludeTotalCount()
                    ? countEntryRows(masterType, criteria.getKeyword(), criteria.getEffective(), null, null, null)
                    : null;
            return new OrcaMasterDao.ListSearchResult<>(records, total, state.masterVersion(), state);
        } catch (RuntimeException ex) {
            logBackendFailure(masterType, ex);
            OrcaMasterCacheState failure = OrcaMasterCacheState.unavailable(masterType);
            return new OrcaMasterDao.ListSearchResult<>(List.of(), 0, null, failure);
        }
    }

    private List<Object[]> queryEntryRows(String masterType, String keyword, String effective, String category,
            Double pointsMin, Double pointsMax, int page, int size) {
        StringBuilder sql = baseEntrySelect();
        sql.append(" WHERE master_type = :masterType AND read_only = TRUE ");
        appendEntryFilters(sql, keyword, effective, category, pointsMin, pointsMax);
        sql.append(" ORDER BY name, code");
        Query query = entityManager().createNativeQuery(sql.toString());
        bindEntryFilters(query, masterType, keyword, effective, category, pointsMin, pointsMax);
        int safePage = Math.max(1, page);
        int safeSize = Math.min(Math.max(1, size), MAX_PAGE_SIZE);
        query.setFirstResult((safePage - 1) * safeSize);
        query.setMaxResults(safeSize);
        @SuppressWarnings("unchecked")
        List<Object[]> rows = query.getResultList();
        return rows;
    }

    private Integer countEntryRows(String masterType, String keyword, String effective, String category,
            Double pointsMin, Double pointsMax) {
        StringBuilder sql = new StringBuilder("SELECT count(*) FROM opendolphin.local_orca_master_entry ");
        sql.append("WHERE master_type = :masterType AND read_only = TRUE ");
        appendEntryFilters(sql, keyword, effective, category, pointsMin, pointsMax);
        Query query = entityManager().createNativeQuery(sql.toString());
        bindEntryFilters(query, masterType, keyword, effective, category, pointsMin, pointsMax);
        return asInteger(query.getSingleResult());
    }

    private Object[] findEntryByCode(String masterType, String code, String effective) {
        StringBuilder sql = baseEntrySelect();
        sql.append(" WHERE master_type = :masterType AND read_only = TRUE AND code = :code ");
        if (effective != null && !effective.isBlank()) {
            sql.append("AND valid_from <= :effective AND valid_to >= :effective ");
        }
        sql.append(" ORDER BY valid_to DESC, code LIMIT 1");
        Query query = entityManager().createNativeQuery(sql.toString());
        query.setParameter("masterType", masterType);
        query.setParameter("code", code);
        if (effective != null && !effective.isBlank()) {
            query.setParameter("effective", effective);
        }
        @SuppressWarnings("unchecked")
        List<Object[]> rows = query.getResultList();
        return rows.isEmpty() ? null : rows.get(0);
    }

    private StringBuilder baseEntrySelect() {
        return new StringBuilder("SELECT code, name, kana, category, unit, price, valid_from, valid_to, master_version, note, ")
                .append("payload_json ->> 'prefCode', payload_json ->> 'cityCode', payload_json ->> 'zip', ")
                .append("payload_json ->> 'addressLine', payload_json ->> 'phone', payload_json ->> 'city', ")
                .append("payload_json ->> 'town', payload_json ->> 'kanaAddress', payload_json ->> 'roman', ")
                .append("payload_json ->> 'kensaSort', payload_json ->> 'noticeDate', ")
                .append("payload_json ->> 'parentClassCode', payload_json ->> 'payerRatio' ")
                .append("FROM opendolphin.local_orca_master_entry");
    }

    private void appendEntryFilters(StringBuilder sql, String keyword, String effective, String category,
            Double pointsMin, Double pointsMax) {
        String normalizedKeyword = normalizeKeyword(keyword);
        if (normalizedKeyword != null) {
            sql.append("AND LOWER(search_text) LIKE :keyword ");
        }
        if (effective != null && !effective.isBlank()) {
            sql.append("AND valid_from <= :effective AND valid_to >= :effective ");
        }
        if (category != null && !category.isBlank()) {
            sql.append("AND (category = :category OR category LIKE :categoryPrefix OR :category LIKE category || '%') ");
        }
        if (pointsMin != null) {
            sql.append("AND price >= :pointsMin ");
        }
        if (pointsMax != null) {
            sql.append("AND price <= :pointsMax ");
        }
    }

    private void bindEntryFilters(Query query, String masterType, String keyword, String effective, String category,
            Double pointsMin, Double pointsMax) {
        query.setParameter("masterType", masterType);
        String normalizedKeyword = normalizeKeyword(keyword);
        if (normalizedKeyword != null) {
            query.setParameter("keyword", "%" + normalizedKeyword + "%");
        }
        if (effective != null && !effective.isBlank()) {
            query.setParameter("effective", effective);
        }
        if (category != null && !category.isBlank()) {
            query.setParameter("category", category);
            query.setParameter("categoryPrefix", category + "%");
        }
        if (pointsMin != null) {
            query.setParameter("pointsMin", pointsMin);
        }
        if (pointsMax != null) {
            query.setParameter("pointsMax", pointsMax);
        }
    }

    private List<Object[]> queryHokenjaRows(OrcaMasterDao.HokenjaCriteria criteria, OrcaMasterCacheState state) {
        StringBuilder sql = baseEntrySelect();
        sql.append(" WHERE master_type = 'hokenja' AND read_only = TRUE ");
        String keyword = normalizeKeyword(criteria.getKeyword());
        if (keyword != null) {
            sql.append("AND LOWER(search_text) LIKE :keyword ");
        }
        if (criteria.getPref() != null && !criteria.getPref().isBlank()) {
            sql.append("AND payload_json ->> 'prefCode' = :pref ");
        }
        if (criteria.getEffective() != null && !criteria.getEffective().isBlank()) {
            sql.append("AND valid_from <= :effective AND valid_to >= :effective ");
        }
        sql.append("ORDER BY code");
        Query query = entityManager().createNativeQuery(sql.toString());
        if (keyword != null) {
            query.setParameter("keyword", "%" + keyword + "%");
        }
        if (criteria.getPref() != null && !criteria.getPref().isBlank()) {
            query.setParameter("pref", criteria.getPref());
        }
        if (criteria.getEffective() != null && !criteria.getEffective().isBlank()) {
            query.setParameter("effective", criteria.getEffective());
        }
        query.setFirstResult((Math.max(1, criteria.getPage()) - 1) * Math.min(criteria.getSize(), MAX_PAGE_SIZE));
        query.setMaxResults(Math.min(Math.max(1, criteria.getSize()), MAX_PAGE_SIZE));
        @SuppressWarnings("unchecked")
        List<Object[]> rows = query.getResultList();
        return rows;
    }

    private Integer countHokenjaRows(OrcaMasterDao.HokenjaCriteria criteria) {
        StringBuilder sql = new StringBuilder("SELECT count(*) FROM opendolphin.local_orca_master_entry ")
                .append("WHERE master_type = 'hokenja' AND read_only = TRUE ");
        String keyword = normalizeKeyword(criteria.getKeyword());
        if (keyword != null) {
            sql.append("AND LOWER(search_text) LIKE :keyword ");
        }
        if (criteria.getPref() != null && !criteria.getPref().isBlank()) {
            sql.append("AND payload_json ->> 'prefCode' = :pref ");
        }
        if (criteria.getEffective() != null && !criteria.getEffective().isBlank()) {
            sql.append("AND valid_from <= :effective AND valid_to >= :effective ");
        }
        Query query = entityManager().createNativeQuery(sql.toString());
        if (keyword != null) {
            query.setParameter("keyword", "%" + keyword + "%");
        }
        if (criteria.getPref() != null && !criteria.getPref().isBlank()) {
            query.setParameter("pref", criteria.getPref());
        }
        if (criteria.getEffective() != null && !criteria.getEffective().isBlank()) {
            query.setParameter("effective", criteria.getEffective());
        }
        return asInteger(query.getSingleResult());
    }

    private Object[] findInputSetHeader(String setCode, String effective) {
        String sql = "SELECT set_code, name, entity, kind, class_code, class_name "
                + "FROM opendolphin.local_orca_master_inputset WHERE set_code = :setCode AND read_only = TRUE "
                + "AND valid_from <= :effective AND valid_to >= :effective ORDER BY valid_to DESC LIMIT 1";
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager().createNativeQuery(sql)
                .setParameter("setCode", setCode)
                .setParameter("effective", normalizeEffective(effective))
                .getResultList();
        return rows.isEmpty() ? null : rows.get(0);
    }

    private List<Object[]> queryInputSetItems(String setCode, String effective) {
        String sql = "SELECT code, name, quantity, unit, memo, row_role, row_subtype, category "
                + "FROM opendolphin.local_orca_master_inputset_item WHERE set_code = :setCode AND read_only = TRUE "
                + "AND valid_from <= :effective AND valid_to >= :effective ORDER BY seq";
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager().createNativeQuery(sql)
                .setParameter("setCode", setCode)
                .setParameter("effective", normalizeEffective(effective))
                .getResultList();
        return rows;
    }

    private EntityManager entityManager() {
        if (entityManager == null) {
            throw new IllegalStateException("Local master cache EntityManager is not configured");
        }
        return entityManager;
    }

    private void logBackendFailure(String masterType, RuntimeException ex) {
        LOGGER.log(Level.WARNING, "Local master cache is unavailable for masterType=" + masterType
                + " reason=" + ex.getClass().getSimpleName());
    }

    private long elapsedMs(long start) {
        return java.util.concurrent.TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);
    }

    private String normalizeKeyword(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return null;
        }
        return keyword.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeEffective(String effective) {
        if (effective == null || effective.isBlank()) {
            return "99999999";
        }
        String digits = effective.replaceAll("[^0-9]", "");
        return digits.length() == 8 ? digits : "99999999";
    }

    private String toIsoDate(String effective) {
        String normalized = normalizeEffective(effective);
        if (normalized.length() == 8 && !"99999999".equals(normalized)) {
            return normalized.substring(0, 4) + "-" + normalized.substring(4, 6) + "-" + normalized.substring(6, 8);
        }
        return null;
    }

    private String placeholders(int count) {
        return java.util.stream.IntStream.range(0, count).mapToObj(index -> "?").collect(java.util.stream.Collectors.joining(","));
    }

    private String asString(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Timestamp timestamp) {
            return timestamp.toInstant().toString();
        }
        if (value instanceof Instant instant) {
            return instant.toString();
        }
        String text = String.valueOf(value);
        return text.isBlank() ? null : text;
    }

    private String asInstantString(Object value) {
        return asString(value);
    }

    private Double asDouble(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof BigDecimal decimal) {
            return decimal.doubleValue();
        }
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private Integer asInteger(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private String firstNonBlank(String... values) {
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

    public static final class LocalMasterUnavailableException extends RuntimeException {
        private final OrcaMasterCacheState cacheState;

        public LocalMasterUnavailableException(OrcaMasterCacheState cacheState) {
            super(cacheState != null ? cacheState.cacheStatus() : OrcaMasterCacheState.STATUS_UNAVAILABLE);
            this.cacheState = cacheState != null ? cacheState : OrcaMasterCacheState.unavailable("master");
        }

        public OrcaMasterCacheState getCacheState() {
            return cacheState;
        }
    }
}
