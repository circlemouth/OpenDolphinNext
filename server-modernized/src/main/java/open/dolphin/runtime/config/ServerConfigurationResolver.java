package open.dolphin.runtime.config;

import jakarta.enterprise.context.ApplicationScoped;
import java.time.Duration;
import java.nio.file.Path;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.eclipse.microprofile.config.Config;
import org.eclipse.microprofile.config.ConfigProvider;

/**
 * Resolves runtime settings from MicroProfile Config using explicit namespaces.
 */
@ApplicationScoped
public class ServerConfigurationResolver {

    private final Map<String, String> overrides;

    public static final String KEY_ENVIRONMENT = "opendolphin.environment";
    public static final String KEY_TIMEZONE = "opendolphin.timezone";
    public static final String KEY_SERVER_DATA_DIR = "jboss.server.data.dir";
    public static final String KEY_SINGLE_FACILITY_MODE = "opendolphin.single-facility-mode";
    public static final String KEY_FACILITY_ID = "opendolphin.facility-id";
    public static final String KEY_CLOUD_ZERO = "opendolphin.cloud.zero";
    public static final String KEY_PVT_LIST_CLEAR = "opendolphin.pvt.list-clear";
    public static final String KEY_PVT_ENABLED = "opendolphin.pvt.enabled";
    public static final String KEY_PVT_BIND_IP = "opendolphin.pvt.bind-ip";
    public static final String KEY_PVT_PORT = "opendolphin.pvt.port";
    public static final String KEY_PVT_ENCODING = "opendolphin.pvt.encoding";
    public static final String KEY_PVT_ACCEPT_TIMEOUT_MILLIS = "opendolphin.pvt.accept-timeout-millis";
    public static final String KEY_PVT_READ_TIMEOUT_MILLIS = "opendolphin.pvt.read-timeout-millis";
    public static final String KEY_PVT_MAX_THREADS = "opendolphin.pvt.max-threads";
    public static final String KEY_PVT_QUEUE_CAPACITY = "opendolphin.pvt.queue-capacity";
    public static final String KEY_PVT_RETRY_MAX = "opendolphin.pvt.retry.max";
    public static final String KEY_PVT_RETRY_BACKOFF_MILLIS = "opendolphin.pvt.retry.backoff-millis";
    public static final String KEY_PVT_IDEMPOTENCY_WINDOW_MILLIS = "opendolphin.pvt.idempotency-window-millis";
    public static final String KEY_PVT_POISON_QUEUE_CAPACITY = "opendolphin.pvt.poison-queue-capacity";
    public static final String KEY_PVT_WORKER_HEALTH_STALE_SUCCESS_SECONDS = "opendolphin.pvt.worker-health.stale-success-seconds";
    public static final String KEY_PVT_WORKER_HEALTH_MAX_PROCESSING_MILLIS = "opendolphin.pvt.worker-health.max-processing-millis";

    public static final String KEY_DB_HOST = "db.host";
    public static final String KEY_DB_PORT = "db.port";
    public static final String KEY_DB_NAME = "db.name";
    public static final String KEY_DB_USER = "db.user";
    public static final String KEY_DB_PASSWORD = "db.password";
    public static final String KEY_DB_SSLMODE = "db.sslmode";
    public static final String KEY_DB_SSLROOTCERT = "db.sslrootcert";

    public static final String KEY_ORCA_DB_HOST = "orca.db.host";
    public static final String KEY_ORCA_DB_PORT = "orca.db.port";
    public static final String KEY_ORCA_DB_NAME = "orca.db.name";
    public static final String KEY_ORCA_DB_USER = "orca.db.user";
    public static final String KEY_ORCA_DB_PASSWORD = "orca.db.password";
    public static final String KEY_ORCA_DB_SSLMODE = "orca.db.sslmode";
    public static final String KEY_ORCA_DB_SSLROOTCERT = "orca.db.sslrootcert";
    public static final String KEY_ORCA_DB_SECRET_REF = "orca.db.secret-ref";
    public static final String KEY_ORCA_DB_SECRET_VERSION = "orca.db.secret-version";

    public static final String KEY_FACTOR2_AES_KEY_B64 = "factor2.aes-key-b64";
    public static final String KEY_ORCA_CREDENTIALS_AES_KEY_B64 = "orca.credentials.aes-key-b64";

    public static final String KEY_ORCA_API_BASE_URL = "orca.base-url";
    public static final String KEY_ORCA_API_MODE = "orca.mode";
    public static final String KEY_ORCA_API_HOST = "orca.api.host";
    public static final String KEY_ORCA_API_PORT = "orca.api.port";
    public static final String KEY_ORCA_API_SCHEME = "orca.api.scheme";
    public static final String KEY_ORCA_API_USER = "orca.api.user";
    public static final String KEY_ORCA_API_PASSWORD = "orca.api.password";
    public static final String KEY_ORCA_API_PATH_PREFIX = "orca.api.path-prefix";
    public static final String KEY_ORCA_API_WEBORCA = "orca.api.weborca";
    public static final String KEY_ORCA_API_RETRY_MAX = "orca.api.retry.max";
    public static final String KEY_ORCA_API_RETRY_BACKOFF_MS = "orca.api.retry.backoff-ms";
    public static final String KEY_ORCA_API_RETRY_NETWORK_MAX = "orca.api.retry.network.max";
    public static final String KEY_ORCA_API_RETRY_TRANSIENT_MAX = "orca.api.retry.transient.max";
    public static final String KEY_ORCA_API_RETRY_NETWORK_BACKOFF_MS = "orca.api.retry.network.backoff-ms";
    public static final String KEY_ORCA_API_RETRY_TRANSIENT_BACKOFF_MS = "orca.api.retry.transient.backoff-ms";
    public static final String KEY_ORCA_API_CONNECT_TIMEOUT_MS = "orca.api.connect-timeout-ms";
    public static final String KEY_ORCA_API_READ_TIMEOUT_MS = "orca.api.read-timeout-ms";
    public static final String KEY_ORCA_API_TOTAL_TIMEOUT_MS = "orca.api.total-timeout-ms";
    public static final String KEY_ORCA_HTTP_LOG_MODE = "orca.http.log-mode";
    public static final String KEY_ORCA_ALLOW_INSECURE_HTTP = "opendolphin.orca.allow.insecure.http";
    public static final String KEY_ORCA_TRANSPORT_CACHE_TTL_MS = "orca.transport.cache.ttl-ms";
    public static final String KEY_ORCA_FACILITY_JMARI_CODE = "orca.facility.jmari-code";
    public static final String KEY_ORCA_FACILITY_HEALTHCAREFACILITY_CODE = "orca.facility.healthcarefacility-code";
    public static final String KEY_ORCA_RP_DEFAULT_INOUT = "orca.rp.default-inout";
    public static final String KEY_ORCA_PROXY_FORWARD_X_ORCA_HEADERS = "orca.proxy.forward.x-orca-headers";
    public static final String KEY_ORCA_PROXY_FORWARD_API_RESULT_MESSAGE_HEADER =
            "orca.proxy.forward.api-result-message-header";
    public static final String KEY_ORCA_ACCEPTMOD_SUPPRESS_ACCEPTANCE_PUSH =
            "orca.acceptmod.suppress-acceptance-push";
    public static final String KEY_ORCA_PUSH_ENABLED = "orca.push.enabled";
    public static final String KEY_ORCA_PUSH_SHADOW_MODE = "orca.push.shadow-mode";
    public static final String KEY_ORCA_PUSH_RECEPTION_ENABLED = "orca.push.reception.enabled";
    public static final String KEY_ORCA_PUSH_MEDICAL_ENABLED = "orca.push.medical.enabled";
    public static final String KEY_ORCA_PUSH_CONNECT_TIMEOUT_MS = "orca.push.connect-timeout-ms";
    public static final String KEY_ORCA_PUSH_PING_INTERVAL_SECONDS = "orca.push.ping-interval-seconds";
    public static final String KEY_ORCA_PUSH_IDLE_TIMEOUT_SECONDS = "orca.push.idle-timeout-seconds";
    public static final String KEY_ORCA_PUSH_RECONNECT_INITIAL_DELAY_MS = "orca.push.reconnect.initial-delay-ms";
    public static final String KEY_ORCA_PUSH_RECONNECT_MAX_DELAY_MS = "orca.push.reconnect.max-delay-ms";
    public static final String KEY_ORCA_PUSH_RECOVERY_ENABLED = "orca.push.recovery.enabled";
    public static final String KEY_ORCA_PUSH_RECOVERY_USE_PUSHEVENTGET = "orca.push.recovery.use-pusheventget";
    public static final String KEY_ORCA_PUSH_RECOVERY_INTERVAL_MINUTES = "orca.push.recovery.interval-minutes";
    public static final String KEY_ORCA_PUSH_RECOVERY_INITIAL_LOOKBACK_MINUTES = "orca.push.recovery.initial-lookback-minutes";
    public static final String KEY_ORCA_PUSH_RECOVERY_OVERLAP_MINUTES = "orca.push.recovery.overlap-minutes";
    public static final String KEY_ORCA_PUSH_DEDUP_RETENTION_DAYS = "orca.push.dedup.retention-days";
    public static final String KEY_MASTER_UPDATE_SCHEDULER_ENABLED = "master-update.scheduler.enabled";
    public static final String KEY_METRICS_REGISTRY_JNDI = "metrics.registry.jndi";
    public static final String KEY_BIND_ADDRESS = "jboss.bind.address";
    public static final String KEY_SECURITY_TRUSTED_PROXIES = "security.trusted-proxies";
    public static final String KEY_TEMPLATES_DIR = "opendolphin.templates.dir";
    public static final String KEY_LICENSE_DIR = "opendolphin.license.dir";
    public static final String KEY_SMTP_HOST = "smtp.host";
    public static final String KEY_SMTP_PORT = "smtp.port";
    public static final String KEY_SMTP_AUTH = "smtp.auth";
    public static final String KEY_SMTP_USERNAME = "smtp.username";
    public static final String KEY_SMTP_PASSWORD = "smtp.password";
    public static final String KEY_SMTP_FROM = "smtp.from";
    public static final String KEY_SMTP_BCC = "smtp.bcc";
    public static final String KEY_SMTP_STARTTLS = "smtp.starttls";
    public static final String KEY_SMTP_ACTIVITY_TO = "smtp.activity.to";

    public static final String KEY_ATTACHMENT_STORAGE_MODE = "attachment.storage.mode";
    public static final String KEY_ATTACHMENT_STORAGE_DATABASE_LOB_TABLE = "attachment.storage.database.lob-table";
    public static final String KEY_ATTACHMENT_STORAGE_S3_BUCKET = "attachment.storage.s3.bucket";
    public static final String KEY_ATTACHMENT_STORAGE_S3_REGION = "attachment.storage.s3.region";
    public static final String KEY_ATTACHMENT_STORAGE_S3_ENDPOINT = "attachment.storage.s3.endpoint";
    public static final String KEY_ATTACHMENT_STORAGE_S3_BASE_PATH = "attachment.storage.s3.base-path";
    public static final String KEY_ATTACHMENT_STORAGE_S3_FORCE_PATH_STYLE = "attachment.storage.s3.force-path-style";
    public static final String KEY_ATTACHMENT_STORAGE_S3_SERVER_SIDE_ENCRYPTION = "attachment.storage.s3.server-side-encryption";
    public static final String KEY_ATTACHMENT_STORAGE_S3_KMS_KEY_ID = "attachment.storage.s3.kms-key-id";
    public static final String KEY_ATTACHMENT_STORAGE_S3_MULTIPART_THRESHOLD_MB = "attachment.storage.s3.multipart-threshold-mb";
    public static final String KEY_ATTACHMENT_STORAGE_S3_ACCESS_KEY = "attachment.storage.s3.access-key";
    public static final String KEY_ATTACHMENT_STORAGE_S3_SECRET_KEY = "attachment.storage.s3.secret-key";

    public static final String KEY_DOCUMENT_INTEGRITY_MODE = "document.integrity.mode";
    public static final String KEY_DOCUMENT_INTEGRITY_KEYRING_PATH = "document.integrity.keyring-path";
    public static final String KEY_PATIENT_IMAGES_ENABLED = "patient-images.enabled";
    public static final String KEY_PATIENT_IMAGES_MAX_BYTES = "patient-images.max-bytes";
    public static final String KEY_PATIENT_IMAGES_MAX_WIDTH = "patient-images.max-width";
    public static final String KEY_PATIENT_IMAGES_MAX_HEIGHT = "patient-images.max-height";
    public static final String KEY_ORCA_PATIENT_SYNC_ENABLED = "orca.patient-sync.enabled";
    public static final String KEY_ORCA_PATIENT_SYNC_INTERVAL_MINUTES = "orca.patient-sync.interval-minutes";
    public static final String KEY_ORCA_PATIENT_SYNC_INITIAL_LOOKBACK_DAYS = "orca.patient-sync.initial-lookback-days";
    public static final String KEY_ORCA_PATIENT_SYNC_INCLUDE_TEST_PATIENT = "orca.patient-sync.include-test-patient";
    public static final String KEY_ORCA_PATIENT_SYNC_INCLUDE_INSURANCE = "orca.patient-sync.include-insurance";
    public static final String KEY_CHART_EVENT_HISTORY_PURGE_ENABLED = "chart-event.history.purge.enabled";
    public static final String KEY_CHART_EVENT_HISTORY_PURGE_INTERVAL_MINUTES = "chart-event.history.purge.interval-minutes";
    public static final String KEY_CHART_EVENT_HISTORY_REPLAY_LIMIT = "chartEvent.history.replayLimit";
    public static final String KEY_CHART_EVENT_HISTORY_RETENTION_COUNT = "chartEvent.history.retentionCount";
    public static final String KEY_CHART_EVENT_HISTORY_RETENTION_HOURS = "chartEvent.history.retentionHours";

    public static final String KEY_PLIVO_AUTH_ID = "plivo.auth.id";
    public static final String KEY_PLIVO_AUTH_TOKEN = "plivo.auth.token";
    public static final String KEY_PLIVO_SOURCE_NUMBER = "plivo.source.number";
    public static final String KEY_PLIVO_BASE_URL = "plivo.base-url";
    public static final String KEY_PLIVO_ENVIRONMENT = "plivo.environment";
    public static final String KEY_PLIVO_DEFAULT_COUNTRY = "plivo.default-country";
    public static final String KEY_PLIVO_LOG_LEVEL = "plivo.log.level";
    public static final String KEY_PLIVO_LOG_MESSAGE_CONTENT = "plivo.log.message-content";
    public static final String KEY_PLIVO_HTTP_CONNECT_TIMEOUT = "plivo.http.connect-timeout";
    public static final String KEY_PLIVO_HTTP_READ_TIMEOUT = "plivo.http.read-timeout";
    public static final String KEY_PLIVO_HTTP_WRITE_TIMEOUT = "plivo.http.write-timeout";
    public static final String KEY_PLIVO_HTTP_CALL_TIMEOUT = "plivo.http.call-timeout";
    public static final String KEY_PLIVO_HTTP_RETRY_ON_CONNECTION_FAILURE = "plivo.http.retry-on-connection-failure";

    public ServerConfigurationResolver() {
        this(Map.of());
    }

    public ServerConfigurationResolver(Map<String, String> overrides) {
        this.overrides = overrides == null ? Map.of() : Collections.unmodifiableMap(overrides);
    }

    public ServerRuntimeConfiguration.RuntimeSettings runtime() {
        String environment = optional(KEY_ENVIRONMENT).orElse(null);
        ZoneId timezone = optional(KEY_TIMEZONE)
                .map(this::resolveTimezone)
                .orElse(null);
        String serverDataDirectory = optional(KEY_SERVER_DATA_DIR).orElse(null);
        return new ServerRuntimeConfiguration.RuntimeSettings(environment, timezone, serverDataDirectory);
    }

    public ServerRuntimeConfiguration.LoginSettings login() {
        return new ServerRuntimeConfiguration.LoginSettings(
                optionalBoolean(KEY_SINGLE_FACILITY_MODE).orElse(false)
        );
    }

    public ServerRuntimeConfiguration.OrcaRuntimeSettings orcaRuntime() {
        return new ServerRuntimeConfiguration.OrcaRuntimeSettings(
                optional(KEY_FACILITY_ID).orElse(null),
                optionalBoolean(KEY_CLOUD_ZERO).orElse(false),
                new ServerRuntimeConfiguration.PvtListenerSettings(
                        optionalBoolean(KEY_PVT_ENABLED).orElse(false),
                        optional(KEY_PVT_BIND_IP).orElse(null),
                        optionalInteger(KEY_PVT_PORT).orElse(null),
                        optional(KEY_PVT_ENCODING).orElse(null),
                        optionalInteger(KEY_PVT_ACCEPT_TIMEOUT_MILLIS).orElse(null),
                        optionalInteger(KEY_PVT_READ_TIMEOUT_MILLIS).orElse(null),
                        optionalInteger(KEY_PVT_MAX_THREADS).orElse(null),
                        optionalInteger(KEY_PVT_QUEUE_CAPACITY).orElse(null),
                        optionalInteger(KEY_PVT_RETRY_MAX).orElse(null),
                        optionalInteger(KEY_PVT_RETRY_BACKOFF_MILLIS).orElse(null),
                        optionalLong(KEY_PVT_IDEMPOTENCY_WINDOW_MILLIS).orElse(null),
                        optionalInteger(KEY_PVT_POISON_QUEUE_CAPACITY).orElse(null)
                )
        );
    }

    public ServerRuntimeConfiguration.OrcaLegacySettings orcaLegacy() {
        return new ServerRuntimeConfiguration.OrcaLegacySettings(
                optional(KEY_ORCA_FACILITY_JMARI_CODE).orElse(null),
                optional(KEY_ORCA_FACILITY_HEALTHCAREFACILITY_CODE).orElse(null),
                optional(KEY_ORCA_RP_DEFAULT_INOUT).orElse(null)
        );
    }

    public ServerRuntimeConfiguration.DatasourceSettings orcaDatasource() {
        boolean orcaSpecific = hasAny(
                KEY_ORCA_DB_HOST,
                KEY_ORCA_DB_PORT,
                KEY_ORCA_DB_NAME,
                KEY_ORCA_DB_USER,
                KEY_ORCA_DB_PASSWORD,
                KEY_ORCA_DB_SSLMODE,
                KEY_ORCA_DB_SSLROOTCERT,
                KEY_ORCA_DB_SECRET_REF,
                KEY_ORCA_DB_SECRET_VERSION);
        String prefix = orcaSpecific ? "orca.db" : "db";
        return new ServerRuntimeConfiguration.DatasourceSettings(
                prefix,
                optional(orcaSpecific ? KEY_ORCA_DB_HOST : KEY_DB_HOST).orElse(null),
                optionalInteger(orcaSpecific ? KEY_ORCA_DB_PORT : KEY_DB_PORT).orElse(null),
                optional(orcaSpecific ? KEY_ORCA_DB_NAME : KEY_DB_NAME).orElse(null),
                optional(orcaSpecific ? KEY_ORCA_DB_USER : KEY_DB_USER).orElse(null),
                optional(orcaSpecific ? KEY_ORCA_DB_PASSWORD : KEY_DB_PASSWORD).orElse(null),
                optional(orcaSpecific ? KEY_ORCA_DB_SSLMODE : KEY_DB_SSLMODE).orElse(null),
                optionalPath(orcaSpecific ? KEY_ORCA_DB_SSLROOTCERT : KEY_DB_SSLROOTCERT).orElse(null),
                optional(KEY_ORCA_DB_SECRET_REF).orElse(null),
                optional(KEY_ORCA_DB_SECRET_VERSION).orElse(null)
        );
    }

    public ServerRuntimeConfiguration.Factor2Settings factor2() {
        return new ServerRuntimeConfiguration.Factor2Settings(optional(KEY_FACTOR2_AES_KEY_B64).orElse(null));
    }

    public ServerRuntimeConfiguration.OrcaSecretProtectionSettings orcaSecretProtection() {
        return new ServerRuntimeConfiguration.OrcaSecretProtectionSettings(
                optional(KEY_ORCA_CREDENTIALS_AES_KEY_B64).orElse(null));
    }

    public ServerRuntimeConfiguration.OrcaApiSettings orcaApi() {
        return new ServerRuntimeConfiguration.OrcaApiSettings(
                optional(KEY_ORCA_API_BASE_URL).orElse(null),
                optional(KEY_ORCA_API_MODE).orElse(null),
                optional(KEY_ORCA_API_HOST).orElse(null),
                optionalInteger(KEY_ORCA_API_PORT).orElse(null),
                optional(KEY_ORCA_API_SCHEME).orElse(null),
                optional(KEY_ORCA_API_USER).orElse(null),
                optional(KEY_ORCA_API_PASSWORD).orElse(null),
                optional(KEY_ORCA_API_PATH_PREFIX).orElse(null),
                optionalBoolean(KEY_ORCA_API_WEBORCA).orElse(null),
                optionalInteger(KEY_ORCA_API_RETRY_MAX).orElse(null),
                optionalLong(KEY_ORCA_API_RETRY_BACKOFF_MS).orElse(null)
        );
    }

    public ServerRuntimeConfiguration.OrcaTransportHttpSettings orcaTransportHttp() {
        return new ServerRuntimeConfiguration.OrcaTransportHttpSettings(
                optionalInteger(KEY_ORCA_API_RETRY_NETWORK_MAX).orElse(null),
                optionalInteger(KEY_ORCA_API_RETRY_TRANSIENT_MAX).orElse(null),
                optionalLong(KEY_ORCA_API_RETRY_NETWORK_BACKOFF_MS).orElse(null),
                optionalLong(KEY_ORCA_API_RETRY_TRANSIENT_BACKOFF_MS).orElse(null),
                optionalDuration(KEY_ORCA_API_CONNECT_TIMEOUT_MS).orElse(null),
                optionalDuration(KEY_ORCA_API_READ_TIMEOUT_MS).orElse(null),
                optionalDuration(KEY_ORCA_API_TOTAL_TIMEOUT_MS).orElse(null),
                optional(KEY_ORCA_HTTP_LOG_MODE).orElse(null),
                optionalBoolean(KEY_ORCA_ALLOW_INSECURE_HTTP).orElse(null),
                optionalLong(KEY_ORCA_TRANSPORT_CACHE_TTL_MS).orElse(null)
        );
    }

    public ServerRuntimeConfiguration.OrcaProxySettings orcaProxy() {
        return new ServerRuntimeConfiguration.OrcaProxySettings(
                optionalBoolean(KEY_ORCA_PROXY_FORWARD_X_ORCA_HEADERS).orElse(null),
                optionalBoolean(KEY_ORCA_PROXY_FORWARD_API_RESULT_MESSAGE_HEADER).orElse(null)
        );
    }

    public ServerRuntimeConfiguration.OrcaPushSettings orcaPush() {
        return new ServerRuntimeConfiguration.OrcaPushSettings(
                optionalBoolean(KEY_ORCA_PUSH_ENABLED).orElse(false),
                optionalBoolean(KEY_ORCA_PUSH_SHADOW_MODE).orElse(false),
                optionalBoolean(KEY_ORCA_PUSH_RECEPTION_ENABLED).orElse(true),
                optionalBoolean(KEY_ORCA_PUSH_MEDICAL_ENABLED).orElse(false),
                optionalInteger(KEY_ORCA_PUSH_CONNECT_TIMEOUT_MS).orElse(null),
                optionalInteger(KEY_ORCA_PUSH_PING_INTERVAL_SECONDS).orElse(null),
                optionalInteger(KEY_ORCA_PUSH_IDLE_TIMEOUT_SECONDS).orElse(null),
                optionalInteger(KEY_ORCA_PUSH_RECONNECT_INITIAL_DELAY_MS).orElse(null),
                optionalInteger(KEY_ORCA_PUSH_RECONNECT_MAX_DELAY_MS).orElse(null),
                optionalBoolean(KEY_ORCA_PUSH_RECOVERY_ENABLED).orElse(false),
                optionalBoolean(KEY_ORCA_PUSH_RECOVERY_USE_PUSHEVENTGET).orElse(false),
                optionalInteger(KEY_ORCA_PUSH_RECOVERY_INTERVAL_MINUTES).orElse(null),
                optionalInteger(KEY_ORCA_PUSH_RECOVERY_INITIAL_LOOKBACK_MINUTES).orElse(null),
                optionalInteger(KEY_ORCA_PUSH_RECOVERY_OVERLAP_MINUTES).orElse(null),
                optionalInteger(KEY_ORCA_PUSH_DEDUP_RETENTION_DAYS).orElse(null)
        );
    }

    public boolean orcaAcceptmodSuppressAcceptancePush() {
        return optionalBoolean(KEY_ORCA_ACCEPTMOD_SUPPRESS_ACCEPTANCE_PUSH).orElse(false);
    }

    public ServerRuntimeConfiguration.MasterUpdateSchedulerSettings masterUpdateScheduler() {
        return new ServerRuntimeConfiguration.MasterUpdateSchedulerSettings(
                optionalBoolean(KEY_MASTER_UPDATE_SCHEDULER_ENABLED).orElse(false)
        );
    }

    public ServerRuntimeConfiguration.MetricsSettings metrics() {
        return new ServerRuntimeConfiguration.MetricsSettings(
                optional(KEY_METRICS_REGISTRY_JNDI).orElse(null)
        );
    }

    public ServerRuntimeConfiguration.SystemNetworkSettings systemNetwork() {
        return new ServerRuntimeConfiguration.SystemNetworkSettings(
                optional(KEY_BIND_ADDRESS).orElse(null)
        );
    }

    public ServerRuntimeConfiguration.SecuritySettings security() {
        return new ServerRuntimeConfiguration.SecuritySettings(parseList(optional(KEY_SECURITY_TRUSTED_PROXIES).orElse(null)));
    }

    public ServerRuntimeConfiguration.TemplatesSettings templates() {
        return new ServerRuntimeConfiguration.TemplatesSettings(
                optionalPath(KEY_TEMPLATES_DIR).orElse(null)
        );
    }

    public ServerRuntimeConfiguration.LicenseSettings license() {
        return new ServerRuntimeConfiguration.LicenseSettings(
                optionalPath(KEY_LICENSE_DIR).orElse(null)
        );
    }

    public ServerRuntimeConfiguration.PvtOperationSettings pvtOperations() {
        return new ServerRuntimeConfiguration.PvtOperationSettings(
                optionalBoolean(KEY_PVT_LIST_CLEAR).orElse(false)
        );
    }

    public ServerRuntimeConfiguration.SmtpSettings smtp() {
        return new ServerRuntimeConfiguration.SmtpSettings(
                optional(KEY_SMTP_HOST).orElse(null),
                optional(KEY_SMTP_PORT).orElse(null),
                optionalBoolean(KEY_SMTP_AUTH).orElse(null),
                optional(KEY_SMTP_USERNAME).orElse(null),
                optional(KEY_SMTP_PASSWORD).orElse(null),
                optional(KEY_SMTP_FROM).orElse(null),
                optional(KEY_SMTP_BCC).orElse(null),
                optionalBoolean(KEY_SMTP_STARTTLS).orElse(null),
                optional(KEY_SMTP_ACTIVITY_TO).orElse(null)
        );
    }

    public ServerRuntimeConfiguration.AttachmentStorageSettings attachmentStorage() {
        return new ServerRuntimeConfiguration.AttachmentStorageSettings(
                optional(KEY_ATTACHMENT_STORAGE_MODE).orElse(null),
                optional(KEY_ATTACHMENT_STORAGE_DATABASE_LOB_TABLE).orElse(null),
                new ServerRuntimeConfiguration.S3StorageSettings(
                        optional(KEY_ATTACHMENT_STORAGE_S3_BUCKET).orElse(null),
                        optional(KEY_ATTACHMENT_STORAGE_S3_REGION).orElse(null),
                        optional(KEY_ATTACHMENT_STORAGE_S3_ENDPOINT).orElse(null),
                        optional(KEY_ATTACHMENT_STORAGE_S3_BASE_PATH).orElse(null),
                        optionalBoolean(KEY_ATTACHMENT_STORAGE_S3_FORCE_PATH_STYLE).orElse(null),
                        optional(KEY_ATTACHMENT_STORAGE_S3_SERVER_SIDE_ENCRYPTION).orElse(null),
                        optional(KEY_ATTACHMENT_STORAGE_S3_KMS_KEY_ID).orElse(null),
                        optionalInteger(KEY_ATTACHMENT_STORAGE_S3_MULTIPART_THRESHOLD_MB).orElse(null),
                        optional(KEY_ATTACHMENT_STORAGE_S3_ACCESS_KEY).orElse(null),
                        optional(KEY_ATTACHMENT_STORAGE_S3_SECRET_KEY).orElse(null)
                )
        );
    }

    public ServerRuntimeConfiguration.DocumentIntegritySettings documentIntegrity() {
        return new ServerRuntimeConfiguration.DocumentIntegritySettings(
                optional(KEY_DOCUMENT_INTEGRITY_MODE).orElse(null),
                optionalPath(KEY_DOCUMENT_INTEGRITY_KEYRING_PATH).orElse(null)
        );
    }

    public ServerRuntimeConfiguration.PatientImagesSettings patientImages() {
        return new ServerRuntimeConfiguration.PatientImagesSettings(
                optionalBoolean(KEY_PATIENT_IMAGES_ENABLED).orElse(false),
                optionalLong(KEY_PATIENT_IMAGES_MAX_BYTES).orElse(null),
                optionalInteger(KEY_PATIENT_IMAGES_MAX_WIDTH).orElse(null),
                optionalInteger(KEY_PATIENT_IMAGES_MAX_HEIGHT).orElse(null)
        );
    }

    public ServerRuntimeConfiguration.OrcaPatientSyncSettings orcaPatientSync() {
        return new ServerRuntimeConfiguration.OrcaPatientSyncSettings(
                optionalBoolean(KEY_ORCA_PATIENT_SYNC_ENABLED).orElse(false),
                optionalInteger(KEY_ORCA_PATIENT_SYNC_INTERVAL_MINUTES).orElse(null),
                optionalInteger(KEY_ORCA_PATIENT_SYNC_INITIAL_LOOKBACK_DAYS).orElse(null),
                optionalBoolean(KEY_ORCA_PATIENT_SYNC_INCLUDE_TEST_PATIENT).orElse(false),
                optionalBoolean(KEY_ORCA_PATIENT_SYNC_INCLUDE_INSURANCE).orElse(false)
        );
    }

    public ServerRuntimeConfiguration.ChartEventHistoryPurgeSettings chartEventHistoryPurge() {
        return new ServerRuntimeConfiguration.ChartEventHistoryPurgeSettings(
                optionalBoolean(KEY_CHART_EVENT_HISTORY_PURGE_ENABLED).orElse(false),
                optionalInteger(KEY_CHART_EVENT_HISTORY_PURGE_INTERVAL_MINUTES).orElse(null)
        );
    }

    public ServerRuntimeConfiguration.ChartEventHistorySettings chartEventHistory() {
        Integer retentionHours = optionalInteger(KEY_CHART_EVENT_HISTORY_RETENTION_HOURS).orElse(null);
        return new ServerRuntimeConfiguration.ChartEventHistorySettings(
                optionalInteger(KEY_CHART_EVENT_HISTORY_REPLAY_LIMIT).orElse(null),
                optionalInteger(KEY_CHART_EVENT_HISTORY_RETENTION_COUNT).orElse(null),
                retentionHours != null ? Duration.ofHours(retentionHours.longValue()) : null
        );
    }

    public ServerRuntimeConfiguration.PvtWorkerHealthSettings pvtWorkerHealth() {
        return new ServerRuntimeConfiguration.PvtWorkerHealthSettings(
                optionalLong(KEY_PVT_WORKER_HEALTH_STALE_SUCCESS_SECONDS).orElse(null),
                optionalLong(KEY_PVT_WORKER_HEALTH_MAX_PROCESSING_MILLIS).orElse(null)
        );
    }

    public ServerRuntimeConfiguration.PlivoSettings plivo() {
        return new ServerRuntimeConfiguration.PlivoSettings(
                optional(KEY_PLIVO_AUTH_ID).orElse(null),
                optional(KEY_PLIVO_AUTH_TOKEN).orElse(null),
                optional(KEY_PLIVO_SOURCE_NUMBER).orElse(null),
                optional(KEY_PLIVO_BASE_URL).orElse(null),
                optional(KEY_PLIVO_ENVIRONMENT).orElse(null),
                optional(KEY_PLIVO_DEFAULT_COUNTRY).orElse(null),
                optional(KEY_PLIVO_LOG_LEVEL).orElse(null),
                optionalBoolean(KEY_PLIVO_LOG_MESSAGE_CONTENT).orElse(null),
                optionalDuration(KEY_PLIVO_HTTP_CONNECT_TIMEOUT).orElse(null),
                optionalDuration(KEY_PLIVO_HTTP_READ_TIMEOUT).orElse(null),
                optionalDuration(KEY_PLIVO_HTTP_WRITE_TIMEOUT).orElse(null),
                optionalDuration(KEY_PLIVO_HTTP_CALL_TIMEOUT).orElse(null),
                optionalBoolean(KEY_PLIVO_HTTP_RETRY_ON_CONNECTION_FAILURE).orElse(null)
        );
    }

    public String raw(String key) {
        return key == null || key.isBlank() ? null : optional(key).orElse(null);
    }

    Optional<String> optional(String key) {
        if (key == null || key.isBlank()) {
            return Optional.empty();
        }
        String override = overrides.get(key);
        if (override != null) {
            String trimmed = override.trim();
            return trimmed.isEmpty() ? Optional.empty() : Optional.of(trimmed);
        }
        Config config = resolveConfig();
        if (config != null) {
            try {
                return config.getOptionalValue(key, String.class)
                        .map(String::trim)
                        .filter(token -> !token.isEmpty());
            } catch (RuntimeException ignored) {
                return Optional.empty();
            }
        }
        return Optional.empty();
    }

    private Optional<Integer> optionalInteger(String key) {
        return optional(key).map(Integer::valueOf);
    }

    private Optional<Long> optionalLong(String key) {
        return optional(key).map(Long::valueOf);
    }

    private Optional<Boolean> optionalBoolean(String key) {
        return optional(key).map(this::parseBoolean);
    }

    private Optional<Path> optionalPath(String key) {
        return optional(key).map(value -> Path.of(value).toAbsolutePath().normalize());
    }

    private Optional<Duration> optionalDuration(String key) {
        return optional(key).map(this::parseDuration);
    }

    private boolean hasAny(String... keys) {
        for (String key : keys) {
            if (optional(key).isPresent()) {
                return true;
            }
        }
        return false;
    }

    private List<String> parseList(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(token -> !token.isEmpty())
                .collect(Collectors.toList());
    }

    Config resolveConfig() {
        try {
            return ConfigProvider.getConfig();
        } catch (IllegalStateException ex) {
            return null;
        }
    }

    private Boolean parseBoolean(String value) {
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "1", "true", "yes", "y", "on" -> Boolean.TRUE;
            case "0", "false", "no", "n", "off" -> Boolean.FALSE;
            default -> throw new IllegalArgumentException("Unsupported boolean value: " + value);
        };
    }

    private Duration parseDuration(String value) {
        String trimmed = value.trim();
        try {
            return Duration.parse(trimmed);
        } catch (DateTimeParseException ex) {
            try {
                if (trimmed.endsWith("ms") || trimmed.endsWith("MS")) {
                    return Duration.ofMillis(Long.parseLong(trimmed.substring(0, trimmed.length() - 2).trim()));
                }
                if (trimmed.endsWith("s") || trimmed.endsWith("S")) {
                    return Duration.ofSeconds(Long.parseLong(trimmed.substring(0, trimmed.length() - 1).trim()));
                }
                if (trimmed.endsWith("m") || trimmed.endsWith("M")) {
                    return Duration.ofMinutes(Long.parseLong(trimmed.substring(0, trimmed.length() - 1).trim()));
                }
                return Duration.ofSeconds(Long.parseLong(trimmed));
            } catch (NumberFormatException inner) {
                throw new IllegalArgumentException("Unsupported duration value: " + value, inner);
            }
        }
    }

    private ZoneId resolveTimezone(String value) {
        try {
            return ZoneId.of(value);
        } catch (RuntimeException ex) {
            return null;
        }
    }
}
