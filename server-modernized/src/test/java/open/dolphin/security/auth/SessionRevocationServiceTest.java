package open.dolphin.security.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.lang.reflect.Field;
import java.time.Instant;
import java.util.Map;
import javax.sql.DataSource;
import open.dolphin.rest.AuthSessionSupport;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class SessionRevocationServiceTest {

    @Test
    void revokeAllForUserRevokesActiveSessionsAndRecordsAudit() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);

            AuthSessionRegistryRepository registryRepository = new AuthSessionRegistryRepository();
            UserSecurityStateRepository securityStateRepository = new UserSecurityStateRepository();
            SessionAuditDispatcher auditDispatcher = mock(SessionAuditDispatcher.class);
            SessionRevocationService service = new SessionRevocationService();
            setField(registryRepository, "dataSource", dataSource);
            setField(securityStateRepository, "dataSource", dataSource);
            setField(service, "authSessionRegistryRepository", registryRepository);
            setField(service, "userSecurityStateRepository", securityStateRepository);
            setField(service, "sessionAuditDispatcher", auditDispatcher);

            Instant issuedAt = Instant.parse("2026-03-25T10:00:00Z");
            registryRepository.upsertAuthenticatedSession("sess-1", 501L, "F001:admin", "F001", "client-1", "password",
                    issuedAt, issuedAt, 0L, 0L);
            registryRepository.upsertAuthenticatedSession("sess-2", 501L, "F001:admin", "F001", "client-2", "password",
                    issuedAt, issuedAt, 0L, 0L);

            HttpServletRequest request = mock(HttpServletRequest.class);
            whenRequest(request, "F001:admin", "/api/admin/access/users/501/password-reset", "trace-501", "req-501");

            int revokedCount = service.revokeAllForUser(
                    501L,
                    "F001",
                    SessionRevocationService.REASON_PASSWORD_RESET,
                    request);

            assertThat(revokedCount).isEqualTo(2);
            assertThat(registryRepository.findBySessionId("sess-1").orElseThrow().revocationReason())
                    .isEqualTo(SessionRevocationService.REASON_PASSWORD_RESET);
            assertThat(registryRepository.findBySessionId("sess-2").orElseThrow().revocationReason())
                    .isEqualTo(SessionRevocationService.REASON_PASSWORD_RESET);

            ArgumentCaptor<AuditEventPayload> captor = ArgumentCaptor.forClass(AuditEventPayload.class);
            verify(auditDispatcher).record(captor.capture(), org.mockito.ArgumentMatchers.eq(AuditEventEnvelope.Outcome.SUCCESS), isNull(), isNull());
            assertThat(captor.getValue().getAction()).isEqualTo("SESSION_REVOKED");
            assertThat(captor.getValue().getDetails()).containsAllEntriesOf(Map.of(
                    "facilityId", "F001",
                    "targetUserPk", 501L,
                    "reason", SessionRevocationService.REASON_PASSWORD_RESET,
                    "revokedCount", 2,
                    "requestId", "req-501",
                    "traceId", "trace-501"));
        }
    }

    @Test
    void incrementedSessionEpochCausesNextValidationToRevokeSession() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);

            AuthSessionRegistryRepository registryRepository = new AuthSessionRegistryRepository();
            UserSecurityStateRepository securityStateRepository = new UserSecurityStateRepository();
            AuthSessionRegistryService registryService = new AuthSessionRegistryService();
            setField(registryRepository, "dataSource", dataSource);
            setField(securityStateRepository, "dataSource", dataSource);
            setField(registryService, "authSessionRegistryRepository", registryRepository);
            setField(registryService, "userSecurityStateRepository", securityStateRepository);

            securityStateRepository.ensureRow(777L);
            Instant issuedAt = Instant.parse("2026-03-25T11:00:00Z");
            registryRepository.upsertAuthenticatedSession("sess-epoch", 777L, "F001:user01", "F001", "client-1", "password",
                    issuedAt, issuedAt, 0L, 0L);
            securityStateRepository.incrementSessionEpoch(777L, Instant.parse("2026-03-25T11:05:00Z"));

            HttpSession session = mock(HttpSession.class);
            org.mockito.Mockito.when(session.getId()).thenReturn("sess-epoch");
            org.mockito.Mockito.when(session.getAttribute(AuthSessionSupport.AUTH_ACTOR_ID)).thenReturn("F001:user01");

            AuthSessionRegistryService.SessionValidationResult validation = registryService.validateCurrentSession(session);

            assertThat(validation.valid()).isFalse();
            assertThat(validation.sessionRow()).isNull();
        }
    }

    @Test
    void revokeAllForSecurityStateChangeAdvancesSessionAndCredentialEpochs() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource);

            AuthSessionRegistryRepository registryRepository = new AuthSessionRegistryRepository();
            UserSecurityStateRepository securityStateRepository = new UserSecurityStateRepository();
            SessionAuditDispatcher auditDispatcher = mock(SessionAuditDispatcher.class);
            SessionRevocationService service = new SessionRevocationService();
            setField(registryRepository, "dataSource", dataSource);
            setField(securityStateRepository, "dataSource", dataSource);
            setField(service, "authSessionRegistryRepository", registryRepository);
            setField(service, "userSecurityStateRepository", securityStateRepository);
            setField(service, "sessionAuditDispatcher", auditDispatcher);

            securityStateRepository.ensureRow(901L);
            Instant issuedAt = Instant.parse("2026-03-25T12:00:00Z");
            registryRepository.upsertAuthenticatedSession("sess-policy", 901L, "F001:user01", "F001", "client-1", "password",
                    issuedAt, issuedAt, 0L, 0L);

            HttpServletRequest request = mock(HttpServletRequest.class);
            whenRequest(request, "F001:admin", "/api/admin/access/users/901", "trace-901", "req-901");

            int revokedCount = service.revokeAllForSecurityStateChange(
                    901L,
                    "F001",
                    SessionRevocationService.REASON_PRIVILEGE_CHANGE,
                    request);

            assertThat(revokedCount).isEqualTo(1);
            assertThat(securityStateRepository.currentSessionEpoch(901L)).isEqualTo(1L);
            assertThat(securityStateRepository.currentCredentialEpoch(901L)).isEqualTo(1L);
            assertThat(registryRepository.findBySessionId("sess-policy").orElseThrow().revocationReason())
                    .isEqualTo(SessionRevocationService.REASON_PRIVILEGE_CHANGE);
        }
    }

    private static void migrate(DataSource dataSource) {
        Flyway.configure()
                .dataSource(dataSource)
                .defaultSchema("opendolphin")
                .schemas("opendolphin")
                .locations("classpath:db/migration")
                .load()
                .migrate();
    }

    private static void whenRequest(HttpServletRequest request, String remoteUser, String requestUri, String traceId, String requestId) {
        org.mockito.Mockito.when(request.getRemoteUser()).thenReturn(remoteUser);
        org.mockito.Mockito.when(request.getRequestURI()).thenReturn(requestUri);
        org.mockito.Mockito.when(request.getHeader("X-Request-Id")).thenReturn(requestId);
        org.mockito.Mockito.when(request.getHeader("X-Trace-Id")).thenReturn(traceId);
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
