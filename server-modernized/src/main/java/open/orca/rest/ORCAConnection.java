package open.orca.rest;

import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Tags;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.spi.CDI;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Set;
import java.util.logging.Level;
import java.util.logging.Logger;
import javax.naming.InitialContext;
import javax.naming.NamingException;
import javax.sql.DataSource;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.ServerRuntimeConfiguration;

/**
 * ORCA datasource access backed by typed runtime configuration.
 */
@ApplicationScoped
public class ORCAConnection {

    private static final Logger LOGGER = Logger.getLogger(ORCAConnection.class.getName());
    private static final Logger AUDIT_LOGGER = Logger.getLogger("open.dolphin.audit.external");
    private static final String ORCA_JNDI_NAME = "java:jboss/datasources/ORCADS";
    private static final String METRIC_LOOKUP_COUNTER = "opendolphin_orca_datasource_lookup_total";
    private static final String METRIC_CONNECTION_COUNTER = "opendolphin_orca_connection_total";
    private static final String OUTCOME_SUCCESS = "success";
    private static final String OUTCOME_FAILURE = "failure";

    @Inject
    ServerConfigurationResolver configurationResolver;

    private boolean datasourceAuditLogged;
    private boolean connectionAuditLogged;

    public ORCAConnection() {
    }

    ORCAConnection(ServerConfigurationResolver configurationResolver) {
        this.configurationResolver = configurationResolver;
    }

    public static ORCAConnection current() {
        try {
            return CDI.current().select(ORCAConnection.class).get();
        } catch (RuntimeException ex) {
            LOGGER.log(Level.FINE, "Falling back to direct ORCAConnection instantiation", ex);
            return new ORCAConnection(new ServerConfigurationResolver());
        }
    }

    public Connection getConnection() throws SQLException {
        try {
            DataSource ds = (DataSource) InitialContext.doLookup(ORCA_JNDI_NAME);
            if (ds == null) {
                auditDatasourceLookup("ORCA_DATASOURCE_LOOKUP_FAILURE", "datasource_null");
                throw new SQLException("ORCA datasource lookup returned null: " + ORCA_JNDI_NAME);
            }
            auditDatasourceLookup("ORCA_DATASOURCE_LOOKUP_SUCCESS", null);
            try {
                Connection connection = ds.getConnection();
                auditDatasourceConnection("ORCA_DATASOURCE_CONNECTION_SUCCESS", null);
                return connection;
            } catch (SQLException ex) {
                auditDatasourceConnection("ORCA_DATASOURCE_CONNECTION_FAILURE", ex.getClass().getSimpleName());
                throw ex;
            }
        } catch (NamingException e) {
            auditDatasourceLookup("ORCA_DATASOURCE_LOOKUP_FAILURE", e.getClass().getSimpleName());
            throw new SQLException("Failed to lookup ORCA datasource: " + ORCA_JNDI_NAME, e);
        }
    }

    public synchronized void validateDatasourceSecretsOrThrow() {
        ValidationResult result = ValidationResult.evaluate(resolveDatasourceSettings());
        if (!result.isValid()) {
            auditDatasourceLookup("ORCA_DATASOURCE_LOOKUP_FAILURE", "missing_config");
            throw new IllegalStateException("ORCA datasource secrets are missing for namespace "
                    + result.sourceLabel() + ": " + result.missingSummary());
        }
        auditDatasourceLookup("ORCA_DATASOURCE_LOOKUP_SUCCESS", null);
    }

    private synchronized void auditDatasourceLookup(String event, String reason) {
        recordMetric(METRIC_LOOKUP_COUNTER, event, reason);
        if (datasourceAuditLogged && reason == null) {
            return;
        }
        ValidationResult result = ValidationResult.evaluate(resolveDatasourceSettings());
        StringBuilder builder = new StringBuilder();
        builder.append("event=").append(event);
        builder.append(" jndiName=").append(ORCA_JNDI_NAME);
        builder.append(" source=").append(result.sourceLabel());
        if (!result.secretRef.isBlank()) {
            builder.append(" secretRef=").append(result.secretRef);
        }
        if (!result.secretVersion.isBlank()) {
            builder.append(" secretVersion=").append(result.secretVersion);
        }
        if (reason != null) {
            builder.append(" reason=").append(reason);
        }
        if (!result.missingConfig.isEmpty()) {
            builder.append(" missingConfig=").append(result.missingSummary());
        }
        AUDIT_LOGGER.log(reason == null ? Level.INFO : Level.WARNING, builder.toString());
        if (reason == null) {
            datasourceAuditLogged = true;
        }
    }

    private synchronized void auditDatasourceConnection(String event, String reason) {
        recordMetric(METRIC_CONNECTION_COUNTER, event, reason);
        if (connectionAuditLogged && reason == null) {
            return;
        }
        ValidationResult result = ValidationResult.evaluate(resolveDatasourceSettings());
        StringBuilder builder = new StringBuilder();
        builder.append("event=").append(event);
        builder.append(" jndiName=").append(ORCA_JNDI_NAME);
        builder.append(" source=").append(result.sourceLabel());
        if (!result.secretRef.isBlank()) {
            builder.append(" secretRef=").append(result.secretRef);
        }
        if (!result.secretVersion.isBlank()) {
            builder.append(" secretVersion=").append(result.secretVersion);
        }
        if (reason != null) {
            builder.append(" reason=").append(reason);
        }
        AUDIT_LOGGER.log(reason == null ? Level.INFO : Level.WARNING, builder.toString());
        if (reason == null) {
            connectionAuditLogged = true;
        }
    }

    private static void recordMetric(String metric, String event, String reason) {
        String outcome = event != null && event.endsWith("SUCCESS") ? OUTCOME_SUCCESS : OUTCOME_FAILURE;
        String resolvedReason = (reason == null || reason.isBlank()) ? "none" : reason;
        Metrics.counter(metric, Tags.of("outcome", outcome, "reason", resolvedReason)).increment();
    }

    private ServerRuntimeConfiguration.DatasourceSettings resolveDatasourceSettings() {
        if (configurationResolver == null) {
            configurationResolver = new ServerConfigurationResolver();
        }
        return configurationResolver.orcaDatasource();
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static final class ValidationResult {
        private final boolean orcaOverrides;
        private final Set<String> missingConfig;
        private final String secretRef;
        private final String secretVersion;

        private ValidationResult(boolean orcaOverrides, Set<String> missingConfig, String secretRef, String secretVersion) {
            this.orcaOverrides = orcaOverrides;
            this.missingConfig = missingConfig;
            this.secretRef = secretRef != null ? secretRef : "";
            this.secretVersion = secretVersion != null ? secretVersion : "";
        }

        private static ValidationResult evaluate(ServerRuntimeConfiguration.DatasourceSettings settings) {
            boolean useOrca = settings != null && "orca.db".equals(settings.namespace());
            return new ValidationResult(
                    useOrca,
                    collectMissing(settings),
                    settings != null ? settings.secretRef() : null,
                    settings != null ? settings.secretVersion() : null
            );
        }

        private static Set<String> collectMissing(ServerRuntimeConfiguration.DatasourceSettings settings) {
            Set<String> missing = new java.util.LinkedHashSet<>();
            if (settings == null || isBlank(settings.host())) {
                missing.add("host");
            }
            if (settings == null || isBlank(settings.database())) {
                missing.add("database");
            }
            if (settings == null || isBlank(settings.user())) {
                missing.add("user");
            }
            if (settings == null || isBlank(settings.password())) {
                missing.add("password");
            }
            return missing;
        }

        private boolean isValid() {
            return missingConfig.isEmpty();
        }

        private String sourceLabel() {
            return orcaOverrides ? "orca.db" : "db";
        }

        private String missingSummary() {
            if (missingConfig.isEmpty()) {
                return "";
            }
            return String.join(",", missingConfig);
        }
    }
}
