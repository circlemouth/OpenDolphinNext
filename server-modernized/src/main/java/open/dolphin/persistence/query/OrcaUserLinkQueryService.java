package open.dolphin.persistence.query;

import jakarta.persistence.EntityManager;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * ORCAユーザー連携テーブル向けの native SQL を集約する query service。
 */
public class OrcaUserLinkQueryService {

    private static final String TABLE_EXISTS_SQL =
            "select 1 from information_schema.tables where table_schema='opendolphin' and table_name='d_orca_user_link'";
    private static final String SELECT_BY_USER_PKS_SQL =
            "select ehr_user_pk, orca_user_id, updated_at from opendolphin.d_orca_user_link where ehr_user_pk in :ids";
    private static final String SELECT_ONE_BY_USER_PK_SQL =
            "select ehr_user_pk, orca_user_id, updated_at from opendolphin.d_orca_user_link where ehr_user_pk=:ehrUserPk";
    private static final String SELECT_OWNER_BY_ORCA_USER_SQL =
            "select ehr_user_pk from opendolphin.d_orca_user_link where orca_user_id=:orcaUserId";
    private static final String UPSERT_SQL =
            "insert into opendolphin.d_orca_user_link (ehr_user_pk, orca_user_id, created_at, updated_at, updated_by) "
                    + "values (:ehrUserPk, :orcaUserId, :createdAt, :updatedAt, :updatedBy) "
                    + "on conflict (ehr_user_pk) do update set "
                    + "orca_user_id=excluded.orca_user_id, updated_at=excluded.updated_at, updated_by=excluded.updated_by";
    private static final String DELETE_BY_EHR_USER_PK_SQL =
            "delete from opendolphin.d_orca_user_link where ehr_user_pk=:ehrUserPk";
    private static final String DELETE_BY_ORCA_USER_AND_FACILITY_SQL =
            "delete from opendolphin.d_orca_user_link l using opendolphin.d_users u "
                    + "where l.ehr_user_pk=u.id and l.orca_user_id=:orcaUserId and u.userid like :facilityPrefix";
    private static final String SELECT_BY_FACILITY_SQL =
            "select l.orca_user_id, u.userid, u.commonname "
                    + "from opendolphin.d_orca_user_link l "
                    + "join opendolphin.d_users u on u.id=l.ehr_user_pk "
                    + "where u.userid like :facilityPrefix";

    private final EntityManager em;

    public OrcaUserLinkQueryService(EntityManager em) {
        this.em = em;
    }

    public boolean isLinkTablePresent() {
        List<?> rows = em.createNativeQuery(TABLE_EXISTS_SQL)
                .setMaxResults(1)
                .getResultList();
        return !rows.isEmpty();
    }

    public boolean isTableAvailable() {
        return isLinkTablePresent();
    }

    public Map<Long, OrcaLinkRow> findLinksByUserPks(List<Long> userPks) {
        if (userPks == null || userPks.isEmpty()) {
            return Map.of();
        }
        List<?> rows = em.createNativeQuery(SELECT_BY_USER_PKS_SQL)
                .setParameter("ids", userPks)
                .getResultList();

        Map<Long, OrcaLinkRow> map = new LinkedHashMap<>();
        for (Object rowObj : rows) {
            if (!(rowObj instanceof Object[] row) || row.length < 3) {
                continue;
            }
            Long userPk = asLong(row[0]);
            String orcaUserId = trimToNull(asString(row[1]));
            if (userPk == null || orcaUserId == null) {
                continue;
            }
            map.put(userPk, new OrcaLinkRow(userPk, orcaUserId, asInstant(row[2])));
        }
        return map;
    }

    public OrcaLinkRow findLinkByUserPk(long userPk) {
        List<?> rows = em.createNativeQuery(SELECT_ONE_BY_USER_PK_SQL)
                .setParameter("ehrUserPk", userPk)
                .setMaxResults(1)
                .getResultList();
        if (rows.isEmpty()) {
            return null;
        }
        Object rowObj = rows.get(0);
        if (!(rowObj instanceof Object[] row) || row.length < 3) {
            return null;
        }
        Long foundPk = asLong(row[0]);
        String orcaUserId = trimToNull(asString(row[1]));
        if (foundPk == null || orcaUserId == null) {
            return null;
        }
        return new OrcaLinkRow(foundPk, orcaUserId, asInstant(row[2]));
    }

    public Long findOwnerByOrcaUserId(String orcaUserId) {
        List<?> rows = em.createNativeQuery(SELECT_OWNER_BY_ORCA_USER_SQL)
                .setParameter("orcaUserId", orcaUserId)
                .setMaxResults(1)
                .getResultList();
        if (rows.isEmpty()) {
            return null;
        }
        return asLong(rows.get(0));
    }

    public Long findEhrUserPkByOrcaUserId(String orcaUserId) {
        return findOwnerByOrcaUserId(orcaUserId);
    }

    public void upsertLink(long ehrUserPk, String orcaUserId, Instant now, String updatedBy) {
        em.createNativeQuery(UPSERT_SQL)
                .setParameter("ehrUserPk", ehrUserPk)
                .setParameter("orcaUserId", orcaUserId)
                .setParameter("createdAt", Timestamp.from(now))
                .setParameter("updatedAt", Timestamp.from(now))
                .setParameter("updatedBy", updatedBy)
                .executeUpdate();
    }

    public void deleteByEhrUserPk(long ehrUserPk) {
        em.createNativeQuery(DELETE_BY_EHR_USER_PK_SQL)
                .setParameter("ehrUserPk", ehrUserPk)
                .executeUpdate();
    }

    public int deleteByOrcaUserIdAndFacilityPrefix(String orcaUserId, String facilityPrefix) {
        return em.createNativeQuery(DELETE_BY_ORCA_USER_AND_FACILITY_SQL)
                .setParameter("orcaUserId", orcaUserId)
                .setParameter("facilityPrefix", facilityPrefix)
                .executeUpdate();
    }

    public Map<String, OrcaFacilityLinkRow> findLinksByFacilityPrefix(String facilityPrefix) {
        List<?> rows = em.createNativeQuery(SELECT_BY_FACILITY_SQL)
                .setParameter("facilityPrefix", facilityPrefix)
                .getResultList();

        Map<String, OrcaFacilityLinkRow> map = new LinkedHashMap<>();
        for (Object rowObj : rows) {
            if (!(rowObj instanceof Object[] row) || row.length < 3) {
                continue;
            }
            String orcaUserId = trimToNull(asString(row[0]));
            String ehrUserId = trimToNull(asString(row[1]));
            String ehrDisplayName = trimToNull(asString(row[2]));
            if (orcaUserId == null || ehrUserId == null) {
                continue;
            }
            map.put(orcaUserId, new OrcaFacilityLinkRow(orcaUserId, ehrUserId, ehrDisplayName));
        }
        return map;
    }

    private static Long asLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value == null) {
            return null;
        }
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static Instant asInstant(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Instant instant) {
            return instant;
        }
        if (value instanceof java.util.Date date) {
            return date.toInstant();
        }
        try {
            return Instant.parse(String.valueOf(value));
        } catch (Exception ex) {
            return null;
        }
    }

    public record OrcaLinkRow(Long ehrUserPk, String orcaUserId, Instant updatedAt) {
    }

    public record OrcaFacilityLinkRow(String orcaUserId, String ehrUserId, String ehrDisplayName) {
    }
}
