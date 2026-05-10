package open.orca.rest;

final class OrcaDiseaseQuerySupport {

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
}
