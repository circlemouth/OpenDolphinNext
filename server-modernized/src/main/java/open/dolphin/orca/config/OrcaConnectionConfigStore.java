package open.dolphin.orca.config;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.net.URI;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import open.dolphin.orca.transport.OrcaConnectionPolicyException;
import open.dolphin.orca.transport.OrcaTransportSecurityPolicy;
import open.dolphin.rest.AbstractResource;
import open.dolphin.runtime.RuntimeStateRepository;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.security.OrcaCredentialSecurityConfig;
import open.dolphin.security.totp.TotpSecretProtector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
@ApplicationScoped
public class OrcaConnectionConfigStore {
    private static final Logger LOGGER = LoggerFactory.getLogger(OrcaConnectionConfigStore.class);
    private static final String STATE_CATEGORY = "orca_connection_config";
    private static final String STATE_KEY = "default";
    public static final String REASON_CODE_FACILITY_CONFIGURATION_MISSING = "facility_configuration_missing";
    private static final int MULTI_FACILITY_FORMAT_VERSION = 2;
    private static final int DEFAULT_PORT_WEBORCA = 443;
    private static final int DEFAULT_PORT_ONPREM = 8000;
    private static final long DEFAULT_MAX_P12_BYTES = 10L * 1024L * 1024L;
    private static final long DEFAULT_MAX_CA_BYTES = 2L * 1024L * 1024L;
    private final ObjectMapper mapper = AbstractResource.getSerializeMapper();
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();
    @Inject
    private OrcaCredentialSecurityConfig orcaCredentialSecurityConfig;
    @Inject
    private RuntimeStateRepository stateRepository;
    @Inject
    private ServerConfigurationResolver configurationResolver;
    private TotpSecretProtector protector;
    private String defaultFacilityId;
    private Map<String, OrcaConnectionConfigRecord> facilities = new LinkedHashMap<>();
    public OrcaConnectionConfigStore() {}
    @PostConstruct
    public void init() {
        this.protector = orcaCredentialSecurityConfig != null ? orcaCredentialSecurityConfig.getCredentialProtector() : null;
        lock.writeLock().lock();
        try {
            StoredState state = loadState();
            this.defaultFacilityId = state != null ? normalizeFacilityId(state.defaultFacilityId()) : null;
            this.facilities = state != null ? new LinkedHashMap<>(state.facilities()) : new LinkedHashMap<>();
            if (state != null && !facilities.isEmpty()) {
                persistBestEffort(buildStorageRecord(facilities, defaultFacilityId));
            }
        } finally {
            lock.writeLock().unlock();
        }
    }
    public String getDefaultFacilityId() {
        lock.readLock().lock();
        try {
            if (defaultFacilityId != null) {
                return defaultFacilityId;
            }
            return configurationResolver != null ? normalizeFacilityId(configurationResolver.orcaRuntime().facilityId()) : null;
        } finally {
            lock.readLock().unlock();
        }
    }
    public OrcaConnectionConfigRecord getSnapshot() {
        return getSnapshot(null);
    }
    public OrcaConnectionConfigRecord getSnapshot(String facilityId) {
        lock.readLock().lock();
        try {
            return copyWithoutFacilities(selectRecordForFacilityLocked(facilityId));
        } finally {
            lock.readLock().unlock();
        }
    }

    public java.util.List<String> listConfiguredFacilityIds() {
        lock.readLock().lock();
        try {
            if (facilities == null || facilities.isEmpty()) {
                return java.util.List.of();
            }
            return java.util.List.copyOf(facilities.keySet());
        } finally {
            lock.readLock().unlock();
        }
    }
    public ResolvedOrcaConnection resolve(String facilityId) {
        OrcaConnectionConfigRecord snapshot = getSnapshot(facilityId);
        if (snapshot == null) {
            throw new OrcaConnectionPolicyException(
                    REASON_CODE_FACILITY_CONFIGURATION_MISSING,
                    "ORCA facility configuration is not available");
        }
        return resolveFromRecord(snapshot);
    }
    public OrcaConnectionConfigRecord update(UpdateRequest update, UploadedBinary clientCertificate,
            UploadedBinary caCertificate, String runId, String actor) {
        String activeDefault = getDefaultFacilityId();
        if (activeDefault == null) {
            throw new OrcaConnectionPolicyException(
                    REASON_CODE_FACILITY_CONFIGURATION_MISSING,
                    "ORCA default facility is not configured");
        }
        return update(activeDefault, update, clientCertificate, caCertificate, runId, actor);
    }
    public OrcaConnectionConfigRecord update(String facilityId, UpdateRequest update,
            UploadedBinary clientCertificate, UploadedBinary caCertificate, String runId, String actor) {
        Objects.requireNonNull(update, "update");
        String normalizedFacilityId = requireFacilityId(facilityId);

        lock.writeLock().lock();
        try {
            OrcaConnectionConfigRecord base = facilities.get(normalizedFacilityId);
            String now = Instant.now().toString();
            OrcaConnectionConfigRecord merged = mergeUpdatedRecord(
                    normalizedFacilityId, base, update, clientCertificate, caCertificate, now);
            merged = applyDefaults(merged);
            validateReadyForUpdate(merged);
            validateTlsMaterial(merged);
            Map<String, OrcaConnectionConfigRecord> nextFacilities = persistUpdatedFacility(normalizedFacilityId, merged);
            logUpdatedFacility(runId, actor, normalizedFacilityId, merged);
            return copyWithoutFacilities(nextFacilities.get(normalizedFacilityId));
        } finally {
            lock.writeLock().unlock();
        }
    }
    private OrcaConnectionConfigRecord mergeUpdatedRecord(String facilityId, OrcaConnectionConfigRecord base,
            UpdateRequest update, UploadedBinary clientCertificate, UploadedBinary caCertificate, String now) {
        OrcaConnectionConfigRecord merged = base != null ? copyWithoutFacilities(base) : new OrcaConnectionConfigRecord();
        merged.setFacilityId(facilityId);
        applyScalarUpdates(merged, update, now);
        applyClientCertificateUpdate(merged, clientCertificate, now);
        applyCaCertificateUpdate(merged, caCertificate, now);
        merged.setUpdatedAt(now);
        return merged;
    }
    private void applyScalarUpdates(OrcaConnectionConfigRecord merged, UpdateRequest update, String now) {
        Boolean useWeborca = update.useWeborca();
        if (useWeborca != null) {
            merged.setUseWeborca(useWeborca);
        }
        String serverUrl = trimToNull(update.serverUrl());
        if (serverUrl != null) {
            merged.setServerUrl(serverUrl);
        }
        Integer port = update.port();
        if (port != null) {
            merged.setPort(port);
        }
        String username = trimToNull(update.username());
        if (username != null) {
            merged.setUsername(username);
        }
        merged.setPushUrl(normalizePushUrl(update.pushUrl(), merged.getPushUrl()));
        merged.setPushTenantId(normalizePushTenantId(update.pushTenantId(), merged.getPushTenantId()));
        String passwordPlain = trimToNull(update.password());
        if (passwordPlain != null) {
            merged.setPasswordEncrypted(encryptText(passwordPlain));
            merged.setPasswordUpdatedAt(now);
        }
        Boolean clientAuthEnabled = update.clientAuthEnabled();
        if (clientAuthEnabled != null) {
            merged.setClientAuthEnabled(clientAuthEnabled);
        }
        String passphrasePlain = trimToNull(update.clientCertificatePassphrase());
        if (passphrasePlain != null) {
            merged.setClientCertificatePassphraseEncrypted(encryptText(passphrasePlain));
            merged.setClientCertificatePassphraseUpdatedAt(now);
        }
    }
    private void applyClientCertificateUpdate(OrcaConnectionConfigRecord merged, UploadedBinary clientCertificate,
            String now) {
        if (clientCertificate == null || clientCertificate.bytes == null || clientCertificate.bytes.length == 0) {
            return;
        }
        requireMaxBytes(clientCertificate.bytes.length, DEFAULT_MAX_P12_BYTES, "clientCertificate");
        String fileName = trimToNull(clientCertificate.fileName);
        if (fileName != null && !fileName.toLowerCase(Locale.ROOT).endsWith(".p12")
                && !fileName.toLowerCase(Locale.ROOT).endsWith(".pfx")) {
            throw new IllegalArgumentException("クライアント証明書は .p12（または .pfx）を指定してください。");
        }
        merged.setClientCertificateFileName(fileName);
        merged.setClientCertificateUploadedAt(now);
        merged.setClientCertificateP12Encrypted(encryptBytes(clientCertificate.bytes));
    }
    private void applyCaCertificateUpdate(OrcaConnectionConfigRecord merged, UploadedBinary caCertificate,
            String now) {
        if (caCertificate == null || caCertificate.bytes == null || caCertificate.bytes.length == 0) {
            return;
        }
        requireMaxBytes(caCertificate.bytes.length, DEFAULT_MAX_CA_BYTES, "caCertificate");
        String fileName = trimToNull(caCertificate.fileName);
        merged.setCaCertificateFileName(fileName);
        merged.setCaCertificateUploadedAt(now);
        merged.setCaCertificateEncrypted(encryptBytes(caCertificate.bytes));
    }
    private void validateTlsMaterial(OrcaConnectionConfigRecord merged) {
        if (Boolean.TRUE.equals(merged.getClientAuthEnabled())) {
            validateClientCertificate(merged);
            return;
        }
        if (merged.getCaCertificateEncrypted() != null && !merged.getCaCertificateEncrypted().isBlank()) {
            byte[] caBytes = decryptToBytes(merged.getCaCertificateEncrypted(), "caCertificateEncrypted");
            open.dolphin.orca.transport.OrcaTlsSupport.validateCaCertificateBundle(caBytes);
        }
    }
    private void validateClientCertificate(OrcaConnectionConfigRecord merged) {
        ResolvedOrcaConnection resolved = resolveFromRecord(merged);
        if (!resolved.clientAuthEnabled()) {
            return;
        }
        try {
            open.dolphin.orca.transport.OrcaTlsSupport.buildSslContext(
                    resolved.clientCertificateP12(),
                    resolved.clientCertificatePassphrase(),
                    resolved.caCertificate());
        } catch (RuntimeException ex) {
            throw new IllegalArgumentException("クライアント証明書またはパスフレーズが不正です。", ex);
        }
    }
    private Map<String, OrcaConnectionConfigRecord> persistUpdatedFacility(String facilityId,
            OrcaConnectionConfigRecord merged) {
        Map<String, OrcaConnectionConfigRecord> nextFacilities = new LinkedHashMap<>(facilities);
        nextFacilities.put(facilityId, copyWithoutFacilities(merged));
        persistStrict(buildStorageRecord(nextFacilities, defaultFacilityId));
        this.facilities = nextFacilities;
        return nextFacilities;
    }
    private void logUpdatedFacility(String runId, String actor, String facilityId, OrcaConnectionConfigRecord merged) {
        LOGGER.info("ORCA connection config updated. runId={} actor={} facilityId={} weborca={} clientAuthEnabled={} caProvided={} pushConfigured={}",
                safe(runId),
                maskActor(actor),
                facilityId,
                Boolean.TRUE.equals(merged.getUseWeborca()),
                Boolean.TRUE.equals(merged.getClientAuthEnabled()),
                merged.getCaCertificateEncrypted() != null && !merged.getCaCertificateEncrypted().isBlank(),
                trimToNull(merged.getPushUrl()) != null);
    }
    public String updateDefaultFacilityId(String facilityId, String runId, String actor) {
        String normalizedFacilityId = requireFacilityId(facilityId);

        lock.writeLock().lock();
        try {
            if (!facilities.containsKey(normalizedFacilityId)) {
                throw new OrcaConnectionPolicyException(
                        REASON_CODE_FACILITY_CONFIGURATION_MISSING,
                        "ORCA facility configuration is not available");
            }
            persistStrict(buildStorageRecord(facilities, normalizedFacilityId));
            this.defaultFacilityId = normalizedFacilityId;
            LOGGER.info("ORCA default facility updated. runId={} actor={} facilityId={}",
                    safe(runId),
                    maskActor(actor),
                    normalizedFacilityId);
            return normalizedFacilityId;
        } finally {
            lock.writeLock().unlock();
        }
    }
    private ResolvedOrcaConnection resolveFromRecord(OrcaConnectionConfigRecord record) {
        if (record == null) {
            throw new IllegalStateException("record is null");
        }
        validateReady(record);
        String baseUrl = buildBaseUrl(record.getServerUrl(), record.getPort(), Boolean.TRUE.equals(record.getUseWeborca()));
        OrcaTransportSecurityPolicy.validateBaseUrl(baseUrl, Boolean.TRUE.equals(record.getUseWeborca()));
        String password = decryptToText(record.getPasswordEncrypted(), "passwordEncrypted");
        boolean clientAuthEnabled = Boolean.TRUE.equals(record.getClientAuthEnabled());
        byte[] p12 = null;
        String passphrase = null;
        if (clientAuthEnabled) {
            p12 = decryptToBytes(record.getClientCertificateP12Encrypted(), "clientCertificateP12Encrypted");
            passphrase = decryptToText(record.getClientCertificatePassphraseEncrypted(), "clientCertificatePassphraseEncrypted");
        }
        byte[] ca = null;
        if (record.getCaCertificateEncrypted() != null && !record.getCaCertificateEncrypted().isBlank()) {
            ca = decryptToBytes(record.getCaCertificateEncrypted(), "caCertificateEncrypted");
        }
        return new ResolvedOrcaConnection(
                Boolean.TRUE.equals(record.getUseWeborca()),
                baseUrl,
                trimToNull(record.getUsername()),
                password,
                clientAuthEnabled,
                p12,
                passphrase,
                ca,
                resolvePushUrl(record),
                trimToNull(record.getPushTenantId())
        );
    }
    private StoredState loadState() {
        OrcaConnectionConfigRecord raw = loadRaw();
        if (raw == null) {
            return null;
        }
        if (hasConnectionPayload(raw)) {
            throw new IllegalStateException(
                    "Legacy single-record ORCA connection config is no longer supported. Migrate to the facilities format.");
        }

        Map<String, OrcaConnectionConfigRecord> loaded = new LinkedHashMap<>();
        Map<String, OrcaConnectionConfigRecord> mapped = raw.getFacilities();
        if (mapped != null && !mapped.isEmpty()) {
            for (Map.Entry<String, OrcaConnectionConfigRecord> entry : mapped.entrySet()) {
                if (entry == null || entry.getValue() == null) {
                    continue;
                }
                String key = requireFacilityId(entry.getKey());
                OrcaConnectionConfigRecord scoped = applyDefaults(copyWithoutFacilities(entry.getValue()));
                scoped.setFacilityId(key);
                loaded.put(key, scoped);
            }
        }
        if (loaded.isEmpty()) {
            return null;
        }

        String loadedDefaultFacilityId = normalizeFacilityId(raw.getDefaultFacilityId());
        if (loadedDefaultFacilityId != null && !loaded.containsKey(loadedDefaultFacilityId)) {
            throw new IllegalStateException("ORCA defaultFacilityId does not match any saved facility.");
        }
        return new StoredState(loaded, loadedDefaultFacilityId);
    }
    private OrcaConnectionConfigRecord loadRaw() {
        if (stateRepository == null) {
            LOGGER.warn("RuntimeStateRepository is unavailable. using empty ORCA connection config");
            return null;
        }
        return stateRepository.findPayload(STATE_CATEGORY, STATE_KEY)
                .map(payload -> {
                    try {
                        return mapper.readValue(payload, OrcaConnectionConfigRecord.class);
                    } catch (IOException ex) {
                        LOGGER.warn("Failed to parse ORCA connection config payload from DB: {}", ex.getMessage());
                        return null;
                    }
                })
                .orElse(null);
    }

    private void persistBestEffort(OrcaConnectionConfigRecord record) {
        try {
            persistStrict(record);
        } catch (RuntimeException ex) {
            LOGGER.warn("Failed to persist ORCA connection config in init phase: {}", ex.getMessage());
        }
    }

    private void persistStrict(OrcaConnectionConfigRecord record) {
        if (record == null) {
            throw new IllegalStateException("ORCA connection config record is null");
        }
        if (stateRepository == null) {
            throw new IllegalStateException("RuntimeStateRepository is unavailable");
        }
        try {
            stateRepository.upsertPayload(STATE_CATEGORY, STATE_KEY, mapper.writeValueAsString(record), Instant.now());
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to serialize ORCA connection config", ex);
        }
    }

    private OrcaConnectionConfigRecord buildStorageRecord(Map<String, OrcaConnectionConfigRecord> byFacility, String activeDefaultFacilityId) {
        if (byFacility == null || byFacility.isEmpty()) {
            throw new IllegalStateException("ORCA connection facilities are empty");
        }

        OrcaConnectionConfigRecord root = new OrcaConnectionConfigRecord();
        Map<String, OrcaConnectionConfigRecord> serialized = new LinkedHashMap<>();
        for (Map.Entry<String, OrcaConnectionConfigRecord> entry : byFacility.entrySet()) {
            if (entry == null || entry.getValue() == null) {
                continue;
            }
            String facilityId = requireFacilityId(entry.getKey());
            OrcaConnectionConfigRecord scoped = applyDefaults(copyWithoutFacilities(entry.getValue()));
            scoped.setFacilityId(facilityId);
            scoped.setDefaultFacilityId(null);
            scoped.setFacilities(null);
            serialized.put(facilityId, scoped);
        }
        if (serialized.isEmpty()) {
            throw new IllegalStateException("ORCA connection facilities are empty");
        }

        String normalizedDefaultFacilityId = normalizeFacilityId(activeDefaultFacilityId);
        if (normalizedDefaultFacilityId != null && !serialized.containsKey(normalizedDefaultFacilityId)) {
            throw new IllegalStateException("ORCA default facility must reference a saved facility");
        }
        root.setVersion(MULTI_FACILITY_FORMAT_VERSION);
        root.setUpdatedAt(Instant.now().toString());
        root.setFacilityId(null);
        root.setDefaultFacilityId(normalizedDefaultFacilityId);
        root.setFacilities(serialized);
        return root;
    }

    private OrcaConnectionConfigRecord applyDefaults(OrcaConnectionConfigRecord record) {
        OrcaConnectionConfigRecord resolved = record != null ? record : new OrcaConnectionConfigRecord();
        if (resolved.getUseWeborca() == null) resolved.setUseWeborca(Boolean.FALSE);
        if (resolved.getClientAuthEnabled() == null) resolved.setClientAuthEnabled(Boolean.FALSE);

        String serverUrl = trimToNull(resolved.getServerUrl());
        if (serverUrl != null) {
            resolved.setServerUrl(serverUrl);
        }

        if (resolved.getPort() == null || resolved.getPort() <= 0) {
            int fallback = Boolean.TRUE.equals(resolved.getUseWeborca()) ? DEFAULT_PORT_WEBORCA : DEFAULT_PORT_ONPREM;
            URI uri = tryParseUri(serverUrl);
            if (uri != null && uri.getPort() > 0) {
                resolved.setPort(uri.getPort());
            } else {
                resolved.setPort(fallback);
            }
        }

        String username = trimToNull(resolved.getUsername());
        if (username != null) resolved.setUsername(username);
        String pushUrl = trimToNull(resolved.getPushUrl());
        if (pushUrl != null) {
            resolved.setPushUrl(pushUrl);
        }
        resolved.setPushTenantId(trimToNull(resolved.getPushTenantId()));

        resolved.setFacilityId(normalizeFacilityId(resolved.getFacilityId()));
        resolved.setDefaultFacilityId(null);
        resolved.setFacilities(null);

        if (resolved.getUpdatedAt() == null || resolved.getUpdatedAt().isBlank()) {
            resolved.setUpdatedAt(Instant.now().toString());
        }
        if (resolved.getVersion() <= 0) resolved.setVersion(1);
        return resolved;
    }

    private void validateReadyForUpdate(OrcaConnectionConfigRecord record) {
        if (record == null) {
            throw new IllegalArgumentException("設定が不正です。");
        }
        if (trimToNull(record.getServerUrl()) == null) {
            throw new IllegalArgumentException("サーバURLは必須です。");
        }
        if (record.getPort() == null || record.getPort() <= 0 || record.getPort() > 65535) {
            throw new IllegalArgumentException("ポート番号が不正です。");
        }
        if (trimToNull(record.getUsername()) == null) {
            throw new IllegalArgumentException("ユーザー名は必須です。");
        }
        String baseUrl = buildBaseUrl(record.getServerUrl(), record.getPort(), Boolean.TRUE.equals(record.getUseWeborca()));
        OrcaTransportSecurityPolicy.validateBaseUrl(baseUrl, Boolean.TRUE.equals(record.getUseWeborca()));
        validatePushConfiguration(record);
        if (record.getPasswordEncrypted() == null || record.getPasswordEncrypted().isBlank()) {
            throw new IllegalArgumentException("パスワードまたはAPIキーは必須です。");
        }
        boolean clientAuthEnabled = Boolean.TRUE.equals(record.getClientAuthEnabled());
        if (clientAuthEnabled) {
            if (record.getClientCertificateP12Encrypted() == null || record.getClientCertificateP12Encrypted().isBlank()) {
                throw new IllegalArgumentException("クライアント証明書（.p12）は必須です。");
            }
            if (record.getClientCertificatePassphraseEncrypted() == null
                    || record.getClientCertificatePassphraseEncrypted().isBlank()) {
                throw new IllegalArgumentException("クライアント証明書のパスフレーズは必須です。");
            }
        }
    }

    private void validateReady(OrcaConnectionConfigRecord record) {
        validateReadyForUpdate(record);
    }

    private OrcaConnectionConfigRecord selectRecordForFacilityLocked(String facilityId) {
        if (facilities == null || facilities.isEmpty()) {
            return null;
        }
        String normalizedFacilityId = normalizeFacilityId(facilityId);
        if (normalizedFacilityId != null) {
            return facilities.get(normalizedFacilityId);
        }
        String activeDefaultFacilityId = normalizeFacilityId(defaultFacilityId);
        return activeDefaultFacilityId != null ? facilities.get(activeDefaultFacilityId) : null;
    }

    private String encryptText(String plainText) {
        if (plainText == null) {
            return null;
        }
        return requireProtector().encrypt(plainText);
    }

    private String encryptBytes(byte[] bytes) {
        if (bytes == null) {
            return null;
        }
        return encryptText(Base64.getEncoder().encodeToString(bytes));
    }

    private String decryptToText(String cipherText, String field) {
        if (cipherText == null || cipherText.isBlank()) {
            throw new IllegalStateException(field + " is missing");
        }
        return requireProtector().decrypt(cipherText);
    }

    private byte[] decryptToBytes(String cipherText, String field) {
        String base64 = decryptToText(cipherText, field);
        try {
            return Base64.getDecoder().decode(base64);
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("Failed to decode decrypted " + field + " as base64", ex);
        }
    }

    private TotpSecretProtector requireProtector() {
        if (protector == null) {
            throw new IllegalStateException("ORCA credential protector is not available");
        }
        return protector;
    }

    private static OrcaConnectionConfigRecord copyWithoutFacilities(OrcaConnectionConfigRecord record) {
        if (record == null) {
            return null;
        }
        OrcaConnectionConfigRecord copy = new OrcaConnectionConfigRecord();
        copyFlatFields(record, copy);
        copy.setFacilityId(normalizeFacilityId(record.getFacilityId()));
        copy.setDefaultFacilityId(null);
        copy.setFacilities(null);
        return copy;
    }

    private static void copyFlatFields(OrcaConnectionConfigRecord from, OrcaConnectionConfigRecord to) {
        if (from == null || to == null) {
            return;
        }
        to.setVersion(from.getVersion());
        to.setUpdatedAt(from.getUpdatedAt());
        to.setUseWeborca(from.getUseWeborca());
        to.setServerUrl(from.getServerUrl());
        to.setPort(from.getPort());
        to.setUsername(from.getUsername());
        to.setPushUrl(from.getPushUrl());
        to.setPushTenantId(from.getPushTenantId());
        to.setPasswordEncrypted(from.getPasswordEncrypted());
        to.setPasswordUpdatedAt(from.getPasswordUpdatedAt());
        to.setClientAuthEnabled(from.getClientAuthEnabled());
        to.setClientCertificateFileName(from.getClientCertificateFileName());
        to.setClientCertificateUploadedAt(from.getClientCertificateUploadedAt());
        to.setClientCertificateP12Encrypted(from.getClientCertificateP12Encrypted());
        to.setClientCertificatePassphraseEncrypted(from.getClientCertificatePassphraseEncrypted());
        to.setClientCertificatePassphraseUpdatedAt(from.getClientCertificatePassphraseUpdatedAt());
        to.setCaCertificateFileName(from.getCaCertificateFileName());
        to.setCaCertificateUploadedAt(from.getCaCertificateUploadedAt());
        to.setCaCertificateEncrypted(from.getCaCertificateEncrypted());
    }

    private static boolean hasConnectionPayload(OrcaConnectionConfigRecord record) {
        if (record == null) {
            return false;
        }
        return trimToNull(record.getServerUrl()) != null
                || record.getPort() != null
                || trimToNull(record.getUsername()) != null
                || trimToNull(record.getPushUrl()) != null
                || trimToNull(record.getPushTenantId()) != null
                || (record.getPasswordEncrypted() != null && !record.getPasswordEncrypted().isBlank())
                || record.getUseWeborca() != null
                || record.getClientAuthEnabled() != null
                || (record.getClientCertificateP12Encrypted() != null && !record.getClientCertificateP12Encrypted().isBlank())
                || (record.getCaCertificateEncrypted() != null && !record.getCaCertificateEncrypted().isBlank());
    }

    private static String requireFacilityId(String facilityId) {
        String normalized = normalizeFacilityId(facilityId);
        if (normalized == null) {
            throw new IllegalArgumentException("facilityId is required");
        }
        return normalized;
    }

    private static String normalizeFacilityId(String facilityId) {
        return trimToNull(facilityId);
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static URI tryParseUri(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) {
            return null;
        }
        try {
            String trimmed = baseUrl.trim();
            if (!trimmed.contains("://")) {
                return null;
            }
            return URI.create(trimmed);
        } catch (Exception ex) {
            return null;
        }
    }

    private static void validatePushConfiguration(OrcaConnectionConfigRecord record) {
        String pushUrl = trimToNull(record.getPushUrl());
        String pushTenantId = trimToNull(record.getPushTenantId());
        if (pushTenantId != null && pushUrl == null) {
            throw new IllegalArgumentException("Push URL が未設定のため pushTenantId は保存できません。");
        }
        if (pushUrl != null) {
            record.setPushUrl(buildPushUrl(pushUrl));
        }
        record.setPushTenantId(pushTenantId);
    }

    private static String resolvePushUrl(OrcaConnectionConfigRecord record) {
        String pushUrl = trimToNull(record.getPushUrl());
        if (pushUrl == null) {
            return null;
        }
        return buildPushUrl(pushUrl);
    }

    private static String buildPushUrl(String pushUrl) {
        String normalized = trimToNull(pushUrl);
        if (normalized == null) {
            throw new IllegalArgumentException("pushUrl is required");
        }
        URI uri;
        try {
            uri = URI.create(normalized);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Push URL が不正です。", ex);
        }
        String scheme = trimToNull(uri.getScheme());
        String host = trimToNull(uri.getHost());
        if (scheme == null || host == null) {
            throw new IllegalArgumentException("Push URL は絶対 URI で指定してください。");
        }
        String normalizedScheme = scheme.toLowerCase(Locale.ROOT);
        if (!"ws".equals(normalizedScheme) && !"wss".equals(normalizedScheme)) {
            throw new IllegalArgumentException("Push URL は ws:// または wss:// のみ指定できます。");
        }
        if (trimToNull(uri.getUserInfo()) != null) {
            throw new IllegalArgumentException("Push URL に userinfo は指定できません。");
        }
        if (uri.getPort() < -1 || uri.getPort() == 0 || uri.getPort() > 65535) {
            throw new IllegalArgumentException("Push URL のポート番号が不正です。");
        }
        if (trimToNull(uri.getFragment()) != null) {
            throw new IllegalArgumentException("Push URL に fragment は指定できません。");
        }
        return uri.normalize().toASCIIString();
    }

    private static String normalizePushUrl(String requestedPushUrl, String currentPushUrl) {
        if (requestedPushUrl != null) {
            String requested = trimToNull(requestedPushUrl);
            return requested == null ? null : buildPushUrl(requested);
        }
        return currentPushUrl != null ? trimToNull(currentPushUrl) : null;
    }

    private static String normalizePushTenantId(String requestedPushTenantId, String currentPushTenantId) {
        if (requestedPushTenantId != null) {
            return trimToNull(requestedPushTenantId);
        }
        return currentPushTenantId != null ? trimToNull(currentPushTenantId) : null;
    }

    private static String buildBaseUrl(String serverUrl, Integer port, boolean useWeborca) {
        String normalized = trimToNull(serverUrl);
        if (normalized == null) {
            throw new IllegalArgumentException("serverUrl is required");
        }
        String withScheme = normalized.contains("://")
                ? normalized
                : (useWeborca ? "https://" : "http://") + normalized;
        URI uri;
        try {
            uri = URI.create(withScheme);
        } catch (Exception ex) {
            throw new IllegalArgumentException("サーバURLが不正です。", ex);
        }
        String scheme = uri.getScheme() != null ? uri.getScheme() : "https";
        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            host = uri.getAuthority();
        }
        if (host == null || host.isBlank()) {
            throw new IllegalArgumentException("サーバURLが不正です。");
        }
        int resolvedPort = port != null && port > 0 ? port : uri.getPort();
        String path = uri.getRawPath();
        StringBuilder builder = new StringBuilder();
        builder.append(scheme).append("://").append(host);
        if (resolvedPort > 0 && !isDefaultPort(scheme, resolvedPort)) {
            builder.append(":").append(resolvedPort);
        }
        if (path != null && !path.isBlank() && !"/".equals(path)) {
            if (!path.startsWith("/")) {
                builder.append("/");
            }
            builder.append(trimTrailingSlash(path));
        }
        return builder.toString();
    }

    private static boolean isDefaultPort(String scheme, int port) {
        if (scheme == null) {
            return false;
        }
        String normalized = scheme.toLowerCase(Locale.ROOT);
        return ("https".equals(normalized) && port == 443) || ("http".equals(normalized) && port == 80);
    }

    private static String trimTrailingSlash(String path) {
        if (path == null) {
            return null;
        }
        String resolved = path;
        while (resolved.endsWith("/") && resolved.length() > 1) {
            resolved = resolved.substring(0, resolved.length() - 1);
        }
        return resolved;
    }

    private static void requireMaxBytes(long actual, long limit, String field) {
        if (limit > 0 && actual > limit) {
            throw new IllegalArgumentException(field + " が大きすぎます。最大 " + limit + " bytes までです。");
        }
    }

    private static String safe(String value) {
        return value != null ? value : "";
    }

    private static String maskActor(String actor) {
        if (actor == null || actor.isBlank()) {
            return "unknown";
        }
        String trimmed = actor.trim();
        if (trimmed.length() <= 4) {
            return "***";
        }
        return trimmed.substring(0, 2) + "***" + trimmed.substring(trimmed.length() - 2);
    }

    public record UpdateRequest(
            Boolean useWeborca,
            String serverUrl,
            Integer port,
            String username,
            String pushUrl,
            String pushTenantId,
            String password,
            Boolean clientAuthEnabled,
            String clientCertificatePassphrase
    ) {}

    public static final class UploadedBinary {
        private final String fileName;
        private final byte[] bytes;
        public UploadedBinary(String fileName, byte[] bytes) {
            this.fileName = fileName;
            this.bytes = bytes;
        }
    }
    public record ResolvedOrcaConnection(
            boolean useWeborca,
            String baseUrl,
            String username,
            String password,
            boolean clientAuthEnabled,
            byte[] clientCertificateP12,
            String clientCertificatePassphrase,
            byte[] caCertificate,
            String pushUrl,
            String pushTenantId
    ) {
        public ResolvedOrcaConnection(
                boolean useWeborca,
                String baseUrl,
                String username,
                String password,
                boolean clientAuthEnabled,
                byte[] clientCertificateP12,
                String clientCertificatePassphrase,
                byte[] caCertificate) {
            this(useWeborca, baseUrl, username, password, clientAuthEnabled,
                    clientCertificateP12, clientCertificatePassphrase, caCertificate, null, null);
        }
    }

    private record StoredState(
            Map<String, OrcaConnectionConfigRecord> facilities,
            String defaultFacilityId
    ) {}
}
