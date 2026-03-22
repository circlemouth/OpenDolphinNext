package open.dolphin.storage.attachment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.TestServerConfigurationResolvers;
import org.junit.jupiter.api.Test;

class AttachmentStorageConfigLoaderTest {

    @Test
    void loadsDatabaseSettingsFromResolverKeys() {
        AttachmentStorageConfigLoader loader = new AttachmentStorageConfigLoader(TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE, "database",
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_DATABASE_LOB_TABLE, "d_attachment"));

        AttachmentStorageSettings settings = loader.load();

        assertThat(settings.getMode()).isEqualTo(AttachmentStorageMode.DATABASE);
        assertThat(settings.getDatabase().getLobTable()).isEqualTo("d_attachment");
        assertThat(settings.getS3()).isEmpty();
    }

    @Test
    void rejectsMissingS3CredentialWhenS3ModeIsEnabled() {
        AttachmentStorageConfigLoader loader = new AttachmentStorageConfigLoader(TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_MODE, "s3",
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_DATABASE_LOB_TABLE, "d_attachment",
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_BUCKET, "bucket-a",
                ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_REGION, "ap-northeast-1"));

        assertThatThrownBy(loader::load)
                .isInstanceOf(AttachmentStorageException.class)
                .hasMessageContaining(ServerConfigurationResolver.KEY_ATTACHMENT_STORAGE_S3_ACCESS_KEY);
    }
}
