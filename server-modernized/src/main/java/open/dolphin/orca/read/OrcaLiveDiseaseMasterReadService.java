package open.dolphin.orca.read;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;
import open.orca.rest.ORCAConnection;

public class OrcaLiveDiseaseMasterReadService {

    private static final Logger LOGGER = Logger.getLogger(OrcaLiveDiseaseMasterReadService.class.getName());
    private static final int MAX_ROWS = 20;
    private static final String QUERY_EXACT =
            "select byomeicd, byomei, byomeikana, icd10_1, haisiymd from tbl_byomei "
                    + "where (byomei = ? or byomeikana = ?) "
                    + "and (haisiymd is null or haisiymd = '' or haisiymd = '00000000' or haisiymd >= ?) "
                    + "order by byomei limit ?";
    private static final String QUERY_PREFIX =
            "select byomeicd, byomei, byomeikana, icd10_1, haisiymd from tbl_byomei "
                    + "where (byomei like ? or byomeikana like ?) "
                    + "and (haisiymd is null or haisiymd = '' or haisiymd = '00000000' or haisiymd >= ?) "
                    + "order by byomei limit ?";

    private record BootstrapDiseaseMasterEntry(String code, String name, String kana, String icdTen, String disUseDate) {}

    private static final List<BootstrapDiseaseMasterEntry> BOOTSTRAP_CANDIDATES = List.of(
            new BootstrapDiseaseMasterEntry("8839001", "高血圧症", "コウケツアツショウ", "I10", "99999999"),
            new BootstrapDiseaseMasterEntry("8839222", "高血圧性心疾患", "コウケツアツセイシンシッカン", "I11", "99999999"),
            new BootstrapDiseaseMasterEntry("8839301", "本態性高血圧", "ホンタイセイコウケツアツ", "I10", "99999999"));

    private final ORCAConnection orcaConnection;

    public OrcaLiveDiseaseMasterReadService(ORCAConnection orcaConnection) {
        this.orcaConnection = orcaConnection;
    }

    public List<Map<String, Object>> queryEntries(String term, String referenceDate, boolean partial) {
        if (term == null || term.isBlank()) {
            return List.of();
        }
        List<Map<String, Object>> entries = new ArrayList<>();
        String sql = partial ? QUERY_PREFIX : QUERY_EXACT;
        String effectiveTerm = partial ? term + "%" : term;
        String effectiveReferenceDate = normalizeReferenceDate(referenceDate);
        try (Connection connection = orcaConnection.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, effectiveTerm);
            statement.setString(2, effectiveTerm);
            statement.setString(3, effectiveReferenceDate);
            statement.setInt(4, MAX_ROWS);
            try (ResultSet resultSet = statement.executeQuery()) {
                while (resultSet.next()) {
                    Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("code", resultSet.getString(1));
                    entry.put("name", resultSet.getString(2));
                    entry.put("kana", resultSet.getString(3));
                    entry.put("icdTen", resultSet.getString(4));
                    entry.put("disUseDate", resultSet.getString(5));
                    entry.put("layer", "candidate");
                    entry.put("readOnly", Boolean.TRUE);
                    entry.put("candidateOnly", Boolean.TRUE);
                    entries.add(entry);
                }
            }
        } catch (SQLException ex) {
            if (isMissingDiseaseMasterTable(ex) || isDiseaseMasterSourceUnavailable(ex)) {
                LOGGER.log(Level.WARNING, "ORCA disease master source is unavailable; using bootstrap candidate set");
                return bootstrapCandidates(term, effectiveReferenceDate, partial);
            }
            LOGGER.log(Level.WARNING, "ORCA disease master lookup failed");
            return List.of();
        }
        return entries;
    }

    private static String normalizeReferenceDate(String referenceDate) {
        if (referenceDate == null || referenceDate.isBlank()) {
            return "99999999";
        }
        String digits = referenceDate.replaceAll("[^0-9]", "");
        if (digits.length() == 8) {
            return digits;
        }
        return "99999999";
    }

    private static boolean isMissingDiseaseMasterTable(SQLException ex) {
        String sqlState = ex.getSQLState();
        if ("42P01".equals(sqlState) || "42S02".equals(sqlState)) {
            return true;
        }
        String message = ex.getMessage();
        return message != null && message.toLowerCase().contains("tbl_byomei");
    }

    private static boolean isDiseaseMasterSourceUnavailable(SQLException ex) {
        String sqlState = ex.getSQLState();
        if (sqlState != null && sqlState.startsWith("08")) {
            return true;
        }
        Throwable cause = ex;
        while (cause != null) {
            String className = cause.getClass().getName();
            if (className.contains("UnknownHostException") || className.contains("ConnectException")) {
                return true;
            }
            cause = cause.getCause();
        }
        return false;
    }

    private static List<Map<String, Object>> bootstrapCandidates(String term, String referenceDate, boolean partial) {
        List<Map<String, Object>> entries = new ArrayList<>();
        for (BootstrapDiseaseMasterEntry candidate : BOOTSTRAP_CANDIDATES) {
            if (!matchesCandidate(candidate, term, partial) || !isActive(candidate.disUseDate(), referenceDate)) {
                continue;
            }
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("code", candidate.code());
            entry.put("name", candidate.name());
            entry.put("kana", candidate.kana());
            entry.put("icdTen", candidate.icdTen());
            entry.put("disUseDate", candidate.disUseDate());
            entry.put("layer", "candidate");
            entry.put("readOnly", Boolean.TRUE);
            entry.put("candidateOnly", Boolean.TRUE);
            entries.add(entry);
        }
        return entries;
    }

    private static boolean matchesCandidate(BootstrapDiseaseMasterEntry candidate, String term, boolean partial) {
        if (partial) {
            return candidate.name().startsWith(term) || candidate.kana().startsWith(term);
        }
        return candidate.name().equals(term) || candidate.kana().equals(term);
    }

    private static boolean isActive(String disUseDate, String referenceDate) {
        return disUseDate == null || disUseDate.isBlank() || "00000000".equals(disUseDate) || disUseDate.compareTo(referenceDate) >= 0;
    }
}
