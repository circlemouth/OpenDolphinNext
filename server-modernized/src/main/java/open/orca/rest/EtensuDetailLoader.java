package open.orca.rest;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import open.dolphin.rest.dto.orca.OrcaEtensuAddition;
import open.dolphin.rest.dto.orca.OrcaEtensuBundlingMember;
import open.dolphin.rest.dto.orca.OrcaEtensuCalcUnit;
import open.dolphin.rest.dto.orca.OrcaEtensuConflict;
import open.dolphin.rest.dto.orca.OrcaEtensuSpecimen;

final class EtensuDetailLoader {

    void populateDetails(Connection connection, List<EtensuDao.EtensuRecord> records, String asOf, EtensuTableMeta meta)
            throws SQLException {
        int expectedSize = expectedCapacity(records.size());
        Map<String, List<EtensuDao.EtensuRecord>> recordsBySrycd = new HashMap<>(expectedSize);
        Set<String> conflictDay = new HashSet<>(expectedSize);
        Set<String> conflictMonth = new HashSet<>(expectedSize);
        Set<String> conflictSame = new HashSet<>(expectedSize);
        Set<String> conflictWeek = new HashSet<>(expectedSize);
        Set<String> calcUnitTargets = new HashSet<>(expectedSize);
        Set<Integer> additionGroups = new HashSet<>(expectedSize);
        Set<String> bundlingGroups = new HashSet<>(expectedSize);
        for (EtensuDao.EtensuRecord record : records) {
            if (record.tensuCode == null) {
                continue;
            }
            recordsBySrycd.computeIfAbsent(record.tensuCode, key -> new ArrayList<>()).add(record);
            if (EtensuDaoSupport.isRelated(record.rDay)) {
                conflictDay.add(record.tensuCode);
            }
            if (EtensuDaoSupport.isRelated(record.rMonth)) {
                conflictMonth.add(record.tensuCode);
            }
            if (EtensuDaoSupport.isRelated(record.rSame)) {
                conflictSame.add(record.tensuCode);
            }
            if (EtensuDaoSupport.isRelated(record.rWeek)) {
                conflictWeek.add(record.tensuCode);
            }
            if (EtensuDaoSupport.isRelated(record.cKaisu)) {
                calcUnitTargets.add(record.tensuCode);
            }
            if (record.nGroup != null && record.nGroup > 0) {
                additionGroups.add(record.nGroup);
            }
            bundlingGroups.addAll(record.groupCodes());
        }
        if (!conflictDay.isEmpty()) {
            loadConflicts(connection, "TBL_ETENSU_3_1", "day", conflictDay, asOf, recordsBySrycd);
        }
        if (!conflictMonth.isEmpty()) {
            loadConflicts(connection, "TBL_ETENSU_3_2", "month", conflictMonth, asOf, recordsBySrycd);
        }
        if (!conflictSame.isEmpty()) {
            loadConflicts(connection, "TBL_ETENSU_3_3", "same", conflictSame, asOf, recordsBySrycd);
        }
        if (!conflictWeek.isEmpty()) {
            loadConflicts(connection, "TBL_ETENSU_3_4", "week", conflictWeek, asOf, recordsBySrycd);
        }
        if (!additionGroups.isEmpty()) {
            loadAdditions(connection, additionGroups, asOf, records);
        }
        if (!calcUnitTargets.isEmpty()) {
            loadCalcUnits(connection, calcUnitTargets, asOf, recordsBySrycd);
        }
        if (!bundlingGroups.isEmpty()) {
            loadBundlingMembers(connection, bundlingGroups, asOf, records);
            loadSpecimens(connection, bundlingGroups, asOf, records);
        }
    }

    int expectedCapacity(int size) {
        if (size <= 0) {
            return 16;
        }
        return Math.max(16, (int) (size / 0.75f) + 1);
    }

    private void loadConflicts(Connection connection, String table, String scope, Set<String> srycds, String asOf,
            Map<String, List<EtensuDao.EtensuRecord>> recordsBySrycd) throws SQLException {
        if (!EtensuDaoSupport.tableExists(connection, table)) {
            return;
        }
        String inClause = EtensuDaoSupport.buildInClause(srycds.size());
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT SRYCD1, SRYCD2, YUKOSTYMD, YUKOEDYMD, HAIHAN, TOKUREI, CHGYMD FROM ")
                .append(table)
                .append(" WHERE (SRYCD1 IN (")
                .append(inClause)
                .append(") OR SRYCD2 IN (")
                .append(inClause)
                .append(") )");
        List<Object> params = new ArrayList<>();
        params.addAll(srycds);
        params.addAll(srycds);
        if (asOf != null && !asOf.isBlank()) {
            sql.append(" AND YUKOSTYMD <= ? AND YUKOEDYMD >= ?");
            params.add(asOf);
            params.add(asOf);
        }
        try (PreparedStatement ps = connection.prepareStatement(sql.toString())) {
            EtensuDaoSupport.bindParams(ps, params, 1);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String left = rs.getString("SRYCD1");
                    String right = rs.getString("SRYCD2");
                    OrcaEtensuConflict conflict = new OrcaEtensuConflict();
                    conflict.setScope(scope);
                    conflict.setLeftSrycd(left);
                    conflict.setRightSrycd(right);
                    conflict.setRule(EtensuDaoSupport.getInteger(rs, "HAIHAN"));
                    conflict.setSpecialCondition(EtensuDaoSupport.getInteger(rs, "TOKUREI"));
                    attachConflict(recordsBySrycd, left, conflict, scope);
                    attachConflict(recordsBySrycd, right, conflict, scope);
                }
            }
        }
    }

    private void loadAdditions(Connection connection, Set<Integer> nGroups, String asOf,
            List<EtensuDao.EtensuRecord> records) throws SQLException {
        if (!EtensuDaoSupport.tableExists(connection, "TBL_ETENSU_4")) {
            return;
        }
        String inClause = EtensuDaoSupport.buildInClause(nGroups.size());
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT N_GROUP, SRYCD, YUKOSTYMD, YUKOEDYMD, KASAN, CHGYMD FROM TBL_ETENSU_4 WHERE N_GROUP IN (")
                .append(inClause)
                .append(")");
        List<Object> params = new ArrayList<>(nGroups);
        if (asOf != null && !asOf.isBlank()) {
            sql.append(" AND YUKOSTYMD <= ? AND YUKOEDYMD >= ?");
            params.add(asOf);
            params.add(asOf);
        }
        Map<Integer, List<OrcaEtensuAddition>> additionsByGroup = new HashMap<>();
        try (PreparedStatement ps = connection.prepareStatement(sql.toString())) {
            EtensuDaoSupport.bindParams(ps, params, 1);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Integer group = EtensuDaoSupport.getInteger(rs, "N_GROUP");
                    if (group == null) {
                        continue;
                    }
                    OrcaEtensuAddition addition = new OrcaEtensuAddition();
                    addition.setNGroup(group);
                    addition.setSrycd(rs.getString("SRYCD"));
                    addition.setAdditionCode(EtensuDaoSupport.getInteger(rs, "KASAN"));
                    additionsByGroup.computeIfAbsent(group, key -> new ArrayList<>()).add(addition);
                }
            }
        }
        for (EtensuDao.EtensuRecord record : records) {
            if (record.nGroup == null) {
                continue;
            }
            List<OrcaEtensuAddition> additions = additionsByGroup.get(record.nGroup);
            if (additions != null && !additions.isEmpty()) {
                record.additions.addAll(additions);
            }
        }
    }

    private void loadCalcUnits(Connection connection, Set<String> srycds, String asOf,
            Map<String, List<EtensuDao.EtensuRecord>> recordsBySrycd) throws SQLException {
        if (!EtensuDaoSupport.tableExists(connection, "TBL_ETENSU_5")) {
            return;
        }
        String inClause = EtensuDaoSupport.buildInClause(srycds.size());
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT SRYCD, YUKOSTYMD, YUKOEDYMD, TANICD, TANINAME, KAISU, TOKUREI, CHGYMD FROM TBL_ETENSU_5 WHERE SRYCD IN (")
                .append(inClause)
                .append(")");
        List<Object> params = new ArrayList<>(srycds);
        if (asOf != null && !asOf.isBlank()) {
            sql.append(" AND YUKOSTYMD <= ? AND YUKOEDYMD >= ?");
            params.add(asOf);
            params.add(asOf);
        }
        try (PreparedStatement ps = connection.prepareStatement(sql.toString())) {
            EtensuDaoSupport.bindParams(ps, params, 1);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String srycd = rs.getString("SRYCD");
                    OrcaEtensuCalcUnit unit = new OrcaEtensuCalcUnit();
                    unit.setUnitCode(EtensuDaoSupport.getInteger(rs, "TANICD"));
                    unit.setUnitName(rs.getString("TANINAME"));
                    unit.setMaxCount(EtensuDaoSupport.getInteger(rs, "KAISU"));
                    unit.setSpecialCondition(EtensuDaoSupport.getInteger(rs, "TOKUREI"));
                    List<EtensuDao.EtensuRecord> targets = recordsBySrycd.get(srycd);
                    if (targets != null) {
                        for (EtensuDao.EtensuRecord record : targets) {
                            record.calcUnits.add(unit);
                        }
                    }
                }
            }
        }
    }

    private void loadBundlingMembers(Connection connection, Set<String> groupCodes, String asOf,
            List<EtensuDao.EtensuRecord> records) throws SQLException {
        Map<String, OrcaEtensuBundlingMember> memberMap = new HashMap<>();
        if (EtensuDaoSupport.tableExists(connection, "TBL_ETENSU_2")) {
            String inClause = EtensuDaoSupport.buildInClause(groupCodes.size());
            StringBuilder sql = new StringBuilder();
            sql.append("SELECT H_GROUP, SRYCD, YUKOSTYMD, YUKOEDYMD, TOKUREI, CHGYMD FROM TBL_ETENSU_2 WHERE H_GROUP IN (")
                    .append(inClause)
                    .append(")");
            List<Object> params = new ArrayList<>(groupCodes);
            if (asOf != null && !asOf.isBlank()) {
                sql.append(" AND YUKOSTYMD <= ? AND YUKOEDYMD >= ?");
                params.add(asOf);
                params.add(asOf);
            }
            try (PreparedStatement ps = connection.prepareStatement(sql.toString())) {
                EtensuDaoSupport.bindParams(ps, params, 1);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        OrcaEtensuBundlingMember member = new OrcaEtensuBundlingMember();
                        member.setGroupCode(rs.getString("H_GROUP"));
                        member.setSrycd(rs.getString("SRYCD"));
                        member.setSpecialCondition(EtensuDaoSupport.getInteger(rs, "TOKUREI"));
                        memberMap.put(EtensuDaoSupport.memberKey(member.getGroupCode(), member.getSrycd()), member);
                    }
                }
            }
        }
        loadBundlingMembersJma(connection, groupCodes, asOf, memberMap);
        applyBundlingExclusions(connection, groupCodes, asOf, memberMap);
        for (EtensuDao.EtensuRecord record : records) {
            attachBundlingMembers(record, memberMap);
        }
    }

    private void loadBundlingMembersJma(Connection connection, Set<String> groupCodes, String asOf,
            Map<String, OrcaEtensuBundlingMember> memberMap) throws SQLException {
        if (!EtensuDaoSupport.tableExists(connection, "TBL_ETENSU_2_JMA")) {
            return;
        }
        String inClause = EtensuDaoSupport.buildInClause(groupCodes.size());
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT H_GROUP, SRYCD, YUKOSTYMD, YUKOEDYMD, TOKUREI, CHGYMD FROM TBL_ETENSU_2_JMA WHERE H_GROUP IN (")
                .append(inClause)
                .append(")");
        List<Object> params = new ArrayList<>(groupCodes);
        if (asOf != null && !asOf.isBlank()) {
            sql.append(" AND YUKOSTYMD <= ? AND YUKOEDYMD >= ?");
            params.add(asOf);
            params.add(asOf);
        }
        try (PreparedStatement ps = connection.prepareStatement(sql.toString())) {
            EtensuDaoSupport.bindParams(ps, params, 1);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    OrcaEtensuBundlingMember member = new OrcaEtensuBundlingMember();
                    member.setGroupCode(rs.getString("H_GROUP"));
                    member.setSrycd(rs.getString("SRYCD"));
                    member.setSpecialCondition(EtensuDaoSupport.getInteger(rs, "TOKUREI"));
                    memberMap.putIfAbsent(EtensuDaoSupport.memberKey(member.getGroupCode(), member.getSrycd()), member);
                }
            }
        }
    }

    private void applyBundlingExclusions(Connection connection, Set<String> groupCodes, String asOf,
            Map<String, OrcaEtensuBundlingMember> memberMap) throws SQLException {
        if (!EtensuDaoSupport.tableExists(connection, "TBL_ETENSU_2_OFF")) {
            return;
        }
        String inClause = EtensuDaoSupport.buildInClause(groupCodes.size());
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT H_GROUP, SRYCD, YUKOSTYMD, YUKOEDYMD FROM TBL_ETENSU_2_OFF WHERE H_GROUP IN (")
                .append(inClause)
                .append(")");
        List<Object> params = new ArrayList<>(groupCodes);
        if (asOf != null && !asOf.isBlank()) {
            sql.append(" AND YUKOSTYMD <= ? AND YUKOEDYMD >= ?");
            params.add(asOf);
            params.add(asOf);
        }
        try (PreparedStatement ps = connection.prepareStatement(sql.toString())) {
            EtensuDaoSupport.bindParams(ps, params, 1);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String group = rs.getString("H_GROUP");
                    String srycd = rs.getString("SRYCD");
                    String key = EtensuDaoSupport.memberKey(group, srycd);
                    OrcaEtensuBundlingMember member = memberMap.get(key);
                    if (member != null) {
                        member.setExcluded(Boolean.TRUE);
                    } else {
                        OrcaEtensuBundlingMember excluded = new OrcaEtensuBundlingMember();
                        excluded.setGroupCode(group);
                        excluded.setSrycd(srycd);
                        excluded.setExcluded(Boolean.TRUE);
                        memberMap.put(key, excluded);
                    }
                }
            }
        }
    }

    private void loadSpecimens(Connection connection, Set<String> groupCodes, String asOf,
            List<EtensuDao.EtensuRecord> records) throws SQLException {
        if (!EtensuDaoSupport.tableExists(connection, "TBL_ETENSU_2_SAMPLE")) {
            return;
        }
        String inClause = EtensuDaoSupport.buildInClause(groupCodes.size());
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT H_GROUP, SRYCD, YUKOSTYMD, YUKOEDYMD, RENNUM, SAMPLECD, CHGYMD FROM TBL_ETENSU_2_SAMPLE WHERE H_GROUP IN (")
                .append(inClause)
                .append(")");
        List<Object> params = new ArrayList<>(groupCodes);
        if (asOf != null && !asOf.isBlank()) {
            sql.append(" AND YUKOSTYMD <= ? AND YUKOEDYMD >= ?");
            params.add(asOf);
            params.add(asOf);
        }
        Map<String, List<OrcaEtensuSpecimen>> specimensByGroup = new HashMap<>();
        try (PreparedStatement ps = connection.prepareStatement(sql.toString())) {
            EtensuDaoSupport.bindParams(ps, params, 1);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    OrcaEtensuSpecimen specimen = new OrcaEtensuSpecimen();
                    specimen.setGroupCode(rs.getString("H_GROUP"));
                    specimen.setSrycd(rs.getString("SRYCD"));
                    specimen.setSeq(EtensuDaoSupport.getInteger(rs, "RENNUM"));
                    specimen.setSampleCode(rs.getString("SAMPLECD"));
                    specimensByGroup.computeIfAbsent(specimen.getGroupCode(), key -> new ArrayList<>()).add(specimen);
                }
            }
        }
        for (EtensuDao.EtensuRecord record : records) {
            attachSpecimens(record, specimensByGroup);
        }
    }

    private void attachConflict(Map<String, List<EtensuDao.EtensuRecord>> recordsBySrycd, String srycd,
            OrcaEtensuConflict conflict, String scope) {
        if (srycd == null) {
            return;
        }
        List<EtensuDao.EtensuRecord> records = recordsBySrycd.get(srycd);
        if (records == null) {
            return;
        }
        for (EtensuDao.EtensuRecord record : records) {
            if (!record.isConflictScopeEnabled(scope)) {
                continue;
            }
            record.conflicts.add(conflict);
        }
    }

    private void attachBundlingMembers(EtensuDao.EtensuRecord record,
            Map<String, OrcaEtensuBundlingMember> memberMap) {
        for (String group : record.groupCodes()) {
            for (Map.Entry<String, OrcaEtensuBundlingMember> entry : memberMap.entrySet()) {
                OrcaEtensuBundlingMember member = entry.getValue();
                if (member == null || member.getGroupCode() == null) {
                    continue;
                }
                if (member.getGroupCode().equals(group)) {
                    record.bundlingMembers.add(member);
                }
            }
        }
    }

    private void attachSpecimens(EtensuDao.EtensuRecord record, Map<String, List<OrcaEtensuSpecimen>> specimensByGroup) {
        for (String group : record.groupCodes()) {
            List<OrcaEtensuSpecimen> specimens = specimensByGroup.get(group);
            if (specimens != null && !specimens.isEmpty()) {
                record.specimens.addAll(specimens);
            }
        }
    }
}
