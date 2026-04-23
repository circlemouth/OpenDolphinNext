package open.dolphin.storage.attachment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.TestServerConfigurationResolvers;
import org.junit.jupiter.api.Test;

class AttachmentStorageConfigLoaderTest {

    @Test
    void rejectsDatabaseMode() {
        AttachmentStorageConfigLoader loader = new AttachmentStorageConfigLoader(TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE, "database"));

        assertThatThrownBy(loader::load)
                .isInstanceOf(AttachmentStorageException.class)
                .hasMessageContaining(ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE);
    }

    @Test
    void acceptsDisabledModeWithoutS3Settings() {
        AttachmentStorageConfigLoader loader = new AttachmentStorageConfigLoader(TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE, "disabled"));

        AttachmentStorageSettings settings = loader.load();

        assertThat(settings.getMode()).isEqualTo(AttachmentStorageMode.DISABLED);
        assertThat(settings.getS3()).isEmpty();
    }

    @Test
    void rejectsS3SettingsWhenDisabledModeIsEnabled() {
        AttachmentStorageConfigLoader loader = new AttachmentStorageConfigLoader(TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE, "disabled",
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_BUCKET, "bucket-a"));

        assertThatThrownBy(loader::load)
                .isInstanceOf(AttachmentStorageException.class)
                .hasMessageContaining("attachment.storage.s3.*");
    }

    @Test
    void rejectsDatabaseLobTableWhenS3ModeIsEnabled() {
        AttachmentStorageConfigLoader loader = new AttachmentStorageConfigLoader(TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE, "s3",
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_DATABASE_LOB_TABLE, "d_attachment",
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_BUCKET, "bucket-a",
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_REGION, "ap-northeast-1"));

        assertThatThrownBy(loader::load)
                .isInstanceOf(AttachmentStorageException.class)
                .hasMessageContaining(ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_DATABASE_LOB_TABLE);
    }

    @Test
    void rejectsMissingS3CredentialWhenS3ModeIsEnabled() {
        AttachmentStorageConfigLoader loader = new AttachmentStorageConfigLoader(TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE, "s3",
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_BUCKET, "bucket-a",
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_REGION, "ap-northeast-1"));

        assertThatThrownBy(loader::load)
                .isInstanceOf(AttachmentStorageException.class)
                .hasMessageContaining(ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_ACCESS_KEY);
    }
}
