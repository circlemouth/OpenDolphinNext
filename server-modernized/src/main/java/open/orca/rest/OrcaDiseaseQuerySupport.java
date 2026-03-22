package open.orca.rest;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import open.dolphin.infomodel.RegisteredDiagnosisModel;

final class OrcaDiseaseQuerySupport {

    private static final String PATIENT_ID_SQL = "select ptid, ptnum from tbl_ptnum where hospnum=? and ptnum=?";

    private OrcaDiseaseQuerySupport() {
    }

    static DiseaseRequest parseDiseaseRequest(
            String param,
            String fromQuery,
            String toQuery,
            String activeOnlyQuery,
            String ascendQuery,
            Normalizer normalizer,
            DefaultNow defaultNow,
            BooleanParser booleanParser) {
        String[] params = param != null ? param.split(",") : new String[0];
        String patientId;
        String from;
        String to;
        boolean ascend;
        boolean activeOnly;
        if (params.length >= 4) {
            patientId = params[0];
            from = params[1];
            to = params[2];
            ascend = Boolean.parseBoolean(params[3]);
            activeOnly = false;
        } else {
            patientId = param;
            from = normalizer.normalize(fromQuery);
            to = normalizer.normalize(toQuery);
            ascend = booleanParser.parse(ascendQuery, true);
            activeOnly = booleanParser.parse(activeOnlyQuery, false);
        }
        if (from == null || from.isBlank()) {
            from = "19000101";
        } else {
            from = normalizer.normalize(from);
        }
        if (to == null || to.isBlank()) {
            to = defaultNow.resolve(to);
        } else {
            to = normalizer.normalize(to);
        }
        return new DiseaseRequest(patientId, from, to, ascend, activeOnly);
    }

    static ActiveDiseaseRequest parseActiveDiseaseRequest(String param) {
        String[] params = param.split(",");
        return new ActiveDiseaseRequest(params[0], Boolean.parseBoolean(params[1]));
    }

    static String resolvePatientId(Connection connection, int hospNum, String patientId, DebugSink debug) throws SQLException {
        debug.log(PATIENT_ID_SQL);
        try (PreparedStatement pt = connection.prepareStatement(PATIENT_ID_SQL)) {
            pt.setInt(1, hospNum);
            pt.setString(2, patientId);
            try (ResultSet rs = pt.executeQuery()) {
                if (rs.next()) {
                    return rs.getString(1);
                }
            }
        }
        return null;
    }

    static ArrayList<RegisteredDiagnosisModel> loadDiagnoses(
            Connection connection,
            int hospNum,
            String ptid,
            DiseaseRequest request,
            DebugSink debug,
            DateFormatter dateFormatter,
            DiagnosisFlagWriter suspectedWriter,
            DiagnosisFlagWriter mainWriter,
            OutcomeWriter outcomeWriter) throws SQLException {
        String sql = buildDiseaseSql(hospNum > 0, request.ascend());
        debug.log(sql);
        try (PreparedStatement pt = connection.prepareStatement(sql)) {
            int idx = 1;
            if (hospNum > 0) {
                pt.setInt(idx++, hospNum);
            }
            pt.setInt(idx++, Integer.parseInt(ptid));
            pt.setString(idx++, request.from());
            pt.setString(idx++, request.to());
            pt.setString(idx, "1");
            try (ResultSet rs = pt.executeQuery()) {
                return mapDiagnosisRows(rs, dateFormatter, suspectedWriter, mainWriter, outcomeWriter);
            }
        }
    }

    static ArrayList<RegisteredDiagnosisModel> loadActiveDiagnoses(
            Connection connection,
            int hospNum,
            String ptid,
            ActiveDiseaseRequest request,
            DebugSink debug,
            DateFormatter dateFormatter,
            DiagnosisFlagWriter suspectedWriter,
            DiagnosisFlagWriter mainWriter,
            OutcomeWriter outcomeWriter) throws SQLException {
        String sql = buildActiveDiseaseSql(hospNum > 0, request.ascend());
        debug.log(sql);
        try (PreparedStatement pt = connection.prepareStatement(sql)) {
            int idx = 1;
            if (hospNum > 0) {
                pt.setInt(idx++, hospNum);
            }
            pt.setInt(idx++, Integer.parseInt(ptid));
            pt.setString(idx, "1");
            try (ResultSet rs = pt.executeQuery()) {
                return mapDiagnosisRows(rs, dateFormatter, suspectedWriter, mainWriter, outcomeWriter);
            }
        }
    }

    private static String buildDiseaseSql(boolean hasHospNum, boolean ascend) {
        StringBuilder sb = new StringBuilder();
        sb.append("select sryymd,khnbyomeicd,utagaiflg,syubyoflg,tenkikbn,tenkiymd,byomei,sryka from tbl_ptbyomei where ");
        if (ascend) {
            sb.append(hasHospNum
                    ? "hospnum=? and ptid=? and sryymd >= ? and sryymd <= ? and dltflg!=? order by sryymd"
                    : "ptid=? and sryymd >= ? and sryymd <= ? and dltflg!=?  order by sryymd");
        } else {
            sb.append(hasHospNum
                    ? "hospnum=? and ptid=? and sryymd >= ? and sryymd <= ? and dltflg!=?  order by sryymd desc"
                    : "ptid=? and sryymd >= ? and sryymd <= ? and dltflg!=?  order by sryymd desc");
        }
        return sb.toString();
    }

    private static String buildActiveDiseaseSql(boolean hasHospNum, boolean ascend) {
        StringBuilder sb = new StringBuilder();
        sb.append("select sryymd,khnbyomeicd,utagaiflg,syubyoflg,tenkikbn,tenkiymd,byomei,sryka from tbl_ptbyomei where ");
        sb.append(hasHospNum ? "hospnum=? and ptid=? and dltflg!=? order by sryymd" : "ptid=? and dltflg!=? order by sryymd");
        if (!ascend) {
            sb.append(" desc");
        }
        return sb.toString();
    }

    private static ArrayList<RegisteredDiagnosisModel> mapDiagnosisRows(
            ResultSet rs,
            DateFormatter dateFormatter,
            DiagnosisFlagWriter suspectedWriter,
            DiagnosisFlagWriter mainWriter,
            OutcomeWriter outcomeWriter) throws SQLException {
        ArrayList<RegisteredDiagnosisModel> collection = new ArrayList<>();
        while (rs.next()) {
            RegisteredDiagnosisModel ord = new RegisteredDiagnosisModel();
            ord.setStartDate(dateFormatter.format(rs.getString(1)));
            ord.setDiagnosisCode(rs.getString(2));
            suspectedWriter.apply(ord, rs.getString(3));
            mainWriter.apply(ord, rs.getString(4));
            outcomeWriter.apply(ord, rs.getString(5));
            ord.setEndDate(dateFormatter.format(rs.getString(6)));
            ord.setDiagnosis(rs.getString(7));
            ord.setDepartment(rs.getString(8));
            ord.setStatus("ORCA");
            collection.add(ord);
        }
        return collection;
    }

    record DiseaseRequest(String patientId, String from, String to, boolean ascend, boolean activeOnly) {
    }

    record ActiveDiseaseRequest(String patientId, boolean ascend) {
    }

    @FunctionalInterface
    interface Normalizer {
        String normalize(String value);
    }

    @FunctionalInterface
    interface DefaultNow {
        String resolve(String value);
    }

    @FunctionalInterface
    interface BooleanParser {
        boolean parse(String value, boolean defaultValue);
    }

    @FunctionalInterface
    interface DateFormatter {
        String format(String value);
    }

    @FunctionalInterface
    interface DiagnosisFlagWriter {
        void apply(RegisteredDiagnosisModel model, String value);
    }

    @FunctionalInterface
    interface OutcomeWriter {
        void apply(RegisteredDiagnosisModel model, String value);
    }

    @FunctionalInterface
    interface DebugSink {
        void log(String message);
    }
}
