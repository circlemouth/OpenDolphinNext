package open.dolphin.orca.sync;

import jakarta.annotation.Resource;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import javax.sql.DataSource;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.ServerRuntimeConfiguration;
import open.dolphin.rest.dto.orca.PatientSyncRequest;

@ApplicationScoped
public class OrcaPatientSyncPlanner {
    public static final String STREAM_KIND = "patient";
    public static final String JOB_KIND = "patient_sync";
    private static final DateTimeFormatter RUN_TIMESTAMP =
            DateTimeFormatter.ofPattern("yyyyMMddHHmmss").withZone(ZoneOffset.UTC);
    private static final char[] HEX = "0123456789abcdef".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String SQL_SELECT_ENABLED = """
            SELECT facility_id, interval_minutes, initial_lookback_days
              FROM opendolphin.orca_job_schedule
             WHERE job_kind = ? AND enabled = TRUE
             ORDER BY facility_id
            """;

    @Resource(lookup = "java:jboss/datasources/PostgresDS")
    DataSource dataSource;

    @Inject
    OrcaSyncCursorStore cursorStore;

    @Inject
    OrcaSyncRunStore runStore;

    @Inject
    ServerConfigurationResolver configurationResolver;

    public List<PlannedSync> planDueRuns(LocalDate today, Instant now) {
        LocalDate effectiveToday = today != null ? today : LocalDate.now(resolveZone());
        Instant effectiveNow = now != null ? now : Instant.now();
        List<PlannedSync> plans = new ArrayList<>();
        try (Connection connection = requireDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement(SQL_SELECT_ENABLED)) {
            statement.setString(1, JOB_KIND);
            try (ResultSet resultSet = statement.executeQuery()) {
                while (resultSet.next()) {
                    String facilityId = normalize(resultSet.getString(1));
                    int intervalMinutes = Math.max(resultSet.getInt(2), 1);
                    int lookbackDays = Math.max(resultSet.getInt(3), 0);
                    if (facilityId == null || !isDue(facilityId, intervalMinutes, effectiveNow)) {
                        continue;
                    }
                    LocalDate startDate = resolveStartDate(facilityId, effectiveToday, lookbackDays);
                    PatientSyncRequest request = new PatientSyncRequest();
                    request.setStartDate(startDate);
                    request.setEndDate(effectiveToday);
                    request.setClassCode("01");
                    ServerRuntimeConfiguration.OrcaPatientSyncSettings settings = syncSettings();
                    request.setIncludeTestPatient(settings.includeTestPatient());
                    request.setIncludeInsurance(settings.includeInsurance());
                    plans.add(new PlannedSync(
                            facilityId,
                            request,
                            generateScheduledRunId(facilityId, effectiveNow),
                            intervalMinutes,
                            lookbackDays));
                }
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to load ORCA patient sync schedules", ex);
        }
        return plans;
    }

    static String generateScheduledRunId(String facilityId, Instant now) {
        String normalizedFacility = normalize(facilityId);
        if (normalizedFacility == null) {
            throw new IllegalArgumentException("facilityId is required");
        }
        Instant effectiveNow = now != null ? now : Instant.now();
        return "SYNC-" + normalizedFacility + "-" + RUN_TIMESTAMP.format(effectiveNow) + "-" + randomSuffix();
    }

    private boolean isDue(String facilityId, int intervalMinutes, Instant now) {
        OrcaSyncRunStore.RunRow latest = runStore != null ? runStore.findLatest(facilityId, STREAM_KIND) : null;
        if (latest == null || latest.requestedAt() == null) {
            return true;
        }
        return !latest.requestedAt().plusSeconds(intervalMinutes * 60L).isAfter(now);
    }

    private LocalDate resolveStartDate(String facilityId, LocalDate today, int lookbackDays) {
        OrcaSyncCursorStore.CursorRow cursor = cursorStore != null ? cursorStore.load(facilityId, STREAM_KIND) : null;
        if (cursor == null || !"date".equals(cursor.cursorType()) || cursor.cursorValue() == null || cursor.cursorValue().isBlank()) {
            return today.minusDays(lookbackDays);
        }
        return LocalDate.parse(cursor.cursorValue().trim());
    }

    private DataSource requireDataSource() {
        if (dataSource == null) {
            throw new IllegalStateException("PostgresDS is not available for ORCA patient sync planner");
        }
        return dataSource;
    }

    private ZoneId resolveZone() {
        if (configurationResolver == null) {
            configurationResolver = new ServerConfigurationResolver();
        }
        ZoneId configured = configurationResolver.runtime().timezone();
        return configured != null ? configured : ZoneId.of("Asia/Tokyo");
    }

    private ServerRuntimeConfiguration.OrcaPatientSyncSettings syncSettings() {
        if (configurationResolver == null) {
            configurationResolver = new ServerConfigurationResolver();
        }
        return configurationResolver.orcaPatientSync();
    }

    private static String randomSuffix() {
        char[] buffer = new char[8];
        for (int i = 0; i < buffer.length; i++) {
            buffer[i] = HEX[RANDOM.nextInt(HEX.length)];
        }
        return new String(buffer);
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public record PlannedSync(
            String facilityId,
            PatientSyncRequest request,
            String runId,
            int intervalMinutes,
            int initialLookbackDays
    ) {
    }
}
