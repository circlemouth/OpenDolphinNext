package open.dolphin.rest.orca;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import open.dolphin.orca.read.OrcaOrderInteractionReadService;
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
        return new OrcaOrderInteractionReadService(orcaConnection).loadInteractionPairs(codes, existingCodes);
    }
}
