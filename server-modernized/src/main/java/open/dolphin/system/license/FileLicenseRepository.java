package open.dolphin.system.license;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.Properties;
import open.dolphin.runtime.config.ServerConfigurationResolver;

/**
 * ファイルシステム上の {@code license.properties} を扱う実装。
 */
@ApplicationScoped
public class FileLicenseRepository implements LicenseRepository {

    private static final String LICENSE_FILE_NAME = "license.properties";
    private static final String COMMENT = "OpenDolphinZero License";

    @Inject
    ServerConfigurationResolver configurationResolver;

    @Override
    public Properties load() throws IOException {
        File licenseFile = resolveLicenseFile();
        Properties properties = new Properties();
        try (InputStreamReader reader = new InputStreamReader(new FileInputStream(licenseFile), StandardCharsets.UTF_8)) {
            properties.load(reader);
        }
        return properties;
    }

    @Override
    public void store(Properties properties) throws IOException {
        File licenseFile = resolveLicenseFile();
        File parent = licenseFile.getParentFile();
        if (parent != null && !parent.exists() && !parent.mkdirs()) {
            throw new IOException("Failed to create license directory: " + parent);
        }
        try (OutputStreamWriter writer = new OutputStreamWriter(new FileOutputStream(licenseFile), StandardCharsets.UTF_8)) {
            properties.store(writer, COMMENT);
        }
    }

    private File resolveLicenseFile() throws IOException {
        ServerConfigurationResolver resolver = configurationResolver != null ? configurationResolver : new ServerConfigurationResolver();
        String home = resolver.license().directory() != null ? resolver.license().directory().toString() : null;
        if (home == null || home.isBlank()) {
            home = resolver.runtime().serverDataDirectory();
        }
        if (home == null || home.isBlank()) {
            throw new IOException("License directory is not configured. Set opendolphin.license.dir or jboss.server.data.dir.");
        }
        return new File(home, LICENSE_FILE_NAME);
    }
}
