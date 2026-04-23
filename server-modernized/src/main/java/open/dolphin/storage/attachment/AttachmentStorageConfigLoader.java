package open.dolphin.storage.attachment;

import java.net.URI;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.ServerRuntimeConfiguration;

/**
 * typed runtime config から attachment storage 設定を解決する。
 */
@ApplicationScoped
public class AttachmentStorageConfigLoader {

    @Inject
    ServerConfigurationResolver configurationResolver;

    public AttachmentStorageConfigLoader() {
    }

    AttachmentStorageConfigLoader(ServerConfigurationResolver configurationResolver) {
        this.configurationResolver = configurationResolver;
    }

    public AttachmentStorageSettings load() {
        ServerRuntimeConfiguration.AttachmentStorageSettings configuration = configuration();
        AttachmentStorageMode mode = resolveMode(configuration.mode());
        rejectDatabaseLobTable(configuration.databaseLobTable());

        AttachmentStorageSettings.S3Settings s3Settings = null;
        if (mode.isS3()) {
            s3Settings = buildS3Settings(configuration.s3());
        } else if (mode.isDisabled()) {
            rejectS3SettingsForDisabledMode(configuration.s3());
        }

        return new AttachmentStorageSettings(mode, null, s3Settings, null);
    }

    private ServerRuntimeConfiguration.AttachmentStorageSettings configuration() {
        if (configurationResolver == null) {
            configurationResolver = new ServerConfigurationResolver();
        }
        return configurationResolver.attachmentStorage();
    }

    private AttachmentStorageMode resolveMode(String rawMode) {
        if (rawMode == null || rawMode.isBlank()) {
            throw new AttachmentStorageException(ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE + " is required");
        }
        try {
            return AttachmentStorageMode.from(rawMode);
        } catch (IllegalArgumentException ex) {
            throw new AttachmentStorageException(ex.getMessage(), ex);
        }
    }

    private void rejectDatabaseLobTable(String databaseLobTable) {
        if (blankToNull(databaseLobTable) != null) {
            throw new AttachmentStorageException(
                    ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_DATABASE_LOB_TABLE + " is not supported");
        }
    }

    private void rejectS3SettingsForDisabledMode(ServerRuntimeConfiguration.S3StorageSettings settings) {
        if (settings == null) {
            return;
        }
        boolean configured = blankToNull(settings.bucket()) != null
                || blankToNull(settings.region()) != null
                || blankToNull(settings.endpoint()) != null
                || blankToNull(settings.basePath()) != null
                || settings.forcePathStyle() != null
                || blankToNull(settings.serverSideEncryption()) != null
                || blankToNull(settings.kmsKeyId()) != null
                || settings.multipartThresholdMb() != null
                || blankToNull(settings.accessKey()) != null
                || blankToNull(settings.secretKey()) != null;
        if (configured) {
            throw new AttachmentStorageException(
                    "attachment.storage.s3.* must not be configured when "
                            + ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE + "=disabled");
        }
    }

    private AttachmentStorageSettings.S3Settings buildS3Settings(ServerRuntimeConfiguration.S3StorageSettings settings) {
        if (settings == null) {
            throw new AttachmentStorageException("S3 settings are required for s3 mode");
        }
        String endpointRaw = blankToNull(settings.endpoint());
        URI endpoint = endpointRaw == null || endpointRaw.isBlank() ? null : URI.create(endpointRaw);

        return new AttachmentStorageSettings.S3Settings(
                requireNonBlank(settings.bucket(), ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_BUCKET),
                requireNonBlank(settings.region(), ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_REGION),
                endpoint,
                blankToNull(settings.basePath()) != null ? settings.basePath().trim() : "attachments",
                settings.forcePathStyle() != null ? settings.forcePathStyle() : Boolean.TRUE,
                blankToNull(settings.serverSideEncryption()),
                blankToNull(settings.kmsKeyId()),
                settings.multipartThresholdMb() != null ? settings.multipartThresholdMb() : 64,
                requireNonBlank(settings.accessKey(), ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_ACCESS_KEY + " is required for s3 mode"),
                requireNonBlank(settings.secretKey(), ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_SECRET_KEY + " is required for s3 mode")
        );
    }

    private String requireNonBlank(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new AttachmentStorageException(message);
        }
        return value.trim();
    }

    private String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
