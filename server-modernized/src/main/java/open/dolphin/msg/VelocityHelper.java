package open.dolphin.msg;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;
import java.util.logging.Logger;
import org.apache.velocity.VelocityContext;
import org.apache.velocity.app.Velocity;
import org.apache.velocity.runtime.resource.loader.ClasspathResourceLoader;
import open.dolphin.runtime.config.ServerConfigurationResolver;

/**
 *
 * @author kazushi
 */
public class VelocityHelper {
    
    static {
        
        try {
            // Velocity を初期化する
            Properties p = new Properties();
            p.setProperty("resource.loader", "file, classpath");
            p.setProperty("input.encoding", "UTF-8");
            p.setProperty("output.encoding", "UTF-8");
            p.setProperty("runtime.log.logsystem.class", "org.apache.velocity.runtime.log.NullLogChute");

            List<String> templatePaths = resolveTemplatePaths(new ServerConfigurationResolver(), Paths.get("").toAbsolutePath());

            p.setProperty("file.resource.loader.path", String.join(File.pathSeparator, templatePaths));
            p.setProperty("file.resource.loader.cache", "false");
            p.setProperty("classpath.resource.loader.class", ClasspathResourceLoader.class.getName());

            Velocity.init(p);

        } catch (Exception e) {
            Logger.getLogger("open.dolphin").warning(e.getMessage());
        }
    }
    
    public static VelocityContext getContext() {
        return new VelocityContext();
    }

    static List<String> resolveTemplatePaths(ServerConfigurationResolver resolver, Path workingDirectory) {
        List<String> templatePaths = new ArrayList<>();
        ServerConfigurationResolver activeResolver = resolver != null ? resolver : new ServerConfigurationResolver();
        if (activeResolver.templates().directory() != null) {
            templatePaths.add(activeResolver.templates().directory().toString());
        }

        String serverDataDir = activeResolver.runtime().serverDataDirectory();
        if (serverDataDir != null && !serverDataDir.isBlank()) {
            templatePaths.add(Paths.get(serverDataDir, "templates").toString());
        }

        Path baseDirectory = workingDirectory != null ? workingDirectory : Paths.get("").toAbsolutePath();
        Path repoTemplates = baseDirectory
                .resolve("server-modernized")
                .resolve("reporting")
                .resolve("templates");
        if (Files.isDirectory(repoTemplates)) {
            templatePaths.add(repoTemplates.toString());
        }

        if (templatePaths.isEmpty()) {
            templatePaths.add(baseDirectory.resolve("templates").toAbsolutePath().toString());
        }
        return templatePaths;
    }
}
