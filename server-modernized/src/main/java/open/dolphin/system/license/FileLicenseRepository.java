package open.dolphin.system.license;

import jakarta.enterprise.context.ApplicationScoped;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.Properties;
import org.eclipse.microprofile.config.ConfigProvider;

/**
 * ファイルシステム上の {@code license.properties} を扱う実装。
 */
@ApplicationScoped
public class FileLicenseRepository implements LicenseRepository {

    private static final String LICENSE_FILE_NAME = "license.properties";
    private static final String COMMENT = "OpenDolphinZero License";

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
        String home = resolveConfigValue("opendolphin.license.dir");
        if (home == null || home.isBlank()) {
            home = resolveConfigValue("jboss.server.data.dir");
        }
        if (home == null || home.isBlank()) {
            throw new IOException("License directory is not configured. Set opendolphin.license.dir or jboss.server.data.dir.");
        }
        return new File(home, LICENSE_FILE_NAME);
    }

    private String resolveConfigValue(String key) {
        try {
            return ConfigProvider.getConfig()
                    .getOptionalValue(key, String.class)
                    .map(String::trim)
                    .filter(token -> !token.isEmpty())
                    .orElse(null);
        } catch (IllegalStateException ex) {
            return null;
        }
    }
}
