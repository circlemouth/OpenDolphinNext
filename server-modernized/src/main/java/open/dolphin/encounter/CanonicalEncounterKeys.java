package open.dolphin.encounter;

public final class CanonicalEncounterKeys {

    private CanonicalEncounterKeys() {
    }

    public static String scheduleKey(String facilityId, String orcaAppointmentId) {
        String key = optionalScheduleKey(facilityId, orcaAppointmentId);
        if (key == null) {
            throw new IllegalArgumentException("scheduleKey source is required");
        }
        return key;
    }

    public static String encounterKey(String facilityId, String orcaAcceptanceId) {
        String key = optionalEncounterKey(facilityId, orcaAcceptanceId);
        if (key == null) {
            throw new IllegalArgumentException("encounterKey source is required");
        }
        return key;
    }

    public static String optionalScheduleKey(String facilityId, String orcaAppointmentId) {
        return optionalKey(facilityId, orcaAppointmentId);
    }

    public static String optionalEncounterKey(String facilityId, String orcaAcceptanceId) {
        return optionalKey(facilityId, orcaAcceptanceId);
    }

    private static String optionalKey(String facilityId, String durableId) {
        String normalizedFacilityId = normalize(facilityId);
        String normalizedDurableId = normalize(durableId);
        if (normalizedFacilityId == null || normalizedDurableId == null) {
            return null;
        }
        return normalizedFacilityId + ":" + normalizedDurableId;
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
