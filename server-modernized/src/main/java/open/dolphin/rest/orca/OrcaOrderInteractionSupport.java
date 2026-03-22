package open.dolphin.rest.orca;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import open.dolphin.rest.dto.orca.OrcaOrderInteractionCheckResponse;
import open.orca.rest.ORCAConnection;

final class OrcaOrderInteractionSupport {

    private OrcaOrderInteractionSupport() {
    }

    static List<String> sanitizeCodes(List<String> source) {
        if (source == null || source.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (String value : source) {
            String normalized = OrcaOrderBundleRequestSupport.trimToNull(value);
            if (normalized != null) {
                unique.add(normalized);
            }
        }
        return new ArrayList<>(unique);
    }

    static List<OrcaOrderInteractionCheckResponse.Pair> loadInteractionPairs(
            ORCAConnection orcaConnection,
            List<String> codes,
            List<String> existingCodes) throws SQLException {
        List<String> rightCodes = existingCodes.isEmpty() ? codes : existingCodes;
        if (codes.isEmpty() || rightCodes.isEmpty()) {
            return List.of();
        }
        Map<String, OrcaOrderInteractionCheckResponse.Pair> deduped = new LinkedHashMap<>();
        try (Connection connection = orcaConnection.getConnection()) {
            String leftInClause = codes.stream().map(code -> "?").collect(Collectors.joining(","));
            String rightInClause = rightCodes.stream().map(code -> "?").collect(Collectors.joining(","));
            String sql = "SELECT drugcd, drugcd2, TI.syojyoucd, syojyou "
                    + "FROM tbl_interact TI INNER JOIN tbl_sskijyo TS ON TI.syojyoucd = TS.syojyoucd "
                    + "WHERE ((drugcd IN (" + leftInClause + ") AND drugcd2 IN (" + rightInClause + ")) "
                    + "OR (drugcd IN (" + rightInClause + ") AND drugcd2 IN (" + leftInClause + ")))";
            try (PreparedStatement ps = connection.prepareStatement(sql)) {
                int index = 1;
                for (String code : codes) {
                    ps.setString(index++, code);
                }
                for (String code : rightCodes) {
                    ps.setString(index++, code);
                }
                for (String code : rightCodes) {
                    ps.setString(index++, code);
                }
                for (String code : codes) {
                    ps.setString(index++, code);
                }
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        String left = OrcaOrderBundleRequestSupport.trimToNull(rs.getString(1));
                        String right = OrcaOrderBundleRequestSupport.trimToNull(rs.getString(2));
                        if (left == null || right == null || left.equals(right)) {
                            continue;
                        }
                        String first = left.compareTo(right) <= 0 ? left : right;
                        String second = left.compareTo(right) <= 0 ? right : left;
                        String key = first + "|" + second + "|" + OrcaOrderBundleRequestSupport.trimToNull(rs.getString(3));
                        if (deduped.containsKey(key)) {
                            continue;
                        }
                        OrcaOrderInteractionCheckResponse.Pair pair = new OrcaOrderInteractionCheckResponse.Pair();
                        pair.setCode1(first);
                        pair.setCode2(second);
                        pair.setInteractionCode(OrcaOrderBundleRequestSupport.trimToNull(rs.getString(3)));
                        pair.setInteractionName(OrcaOrderBundleRequestSupport.trimToNull(rs.getString(4)));
                        pair.setMessage("相互作用が検出されました");
                        deduped.put(key, pair);
                    }
                }
            }
        }
        return new ArrayList<>(deduped.values());
    }
}
