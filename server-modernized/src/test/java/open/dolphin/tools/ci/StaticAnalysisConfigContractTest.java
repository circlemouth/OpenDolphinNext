package open.dolphin.tools.ci;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import javax.xml.parsers.DocumentBuilderFactory;
import org.junit.jupiter.api.Test;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

class StaticAnalysisConfigContractTest {

    @Test
    void checkstyleConfigDefinesFileAndMethodLengthThresholds() throws Exception {
        Path configPath = findRepoRoot().resolve("server-modernized/config/static-analysis/checkstyle.xml");

        assertThat(Files.exists(configPath)).isTrue();

        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(false);
        Document document = factory.newDocumentBuilder().parse(configPath.toFile());

        assertThat(findModuleProperty(document, "FileLength", "max")).isEqualTo("700");
        assertThat(findModuleProperty(document, "MethodLength", "max")).isEqualTo("80");
    }

    private static String findModuleProperty(Document document, String moduleName, String propertyName) {
        NodeList modules = document.getElementsByTagName("module");
        for (int index = 0; index < modules.getLength(); index++) {
            Element module = (Element) modules.item(index);
            if (!moduleName.equals(module.getAttribute("name"))) {
                continue;
            }
            NodeList properties = module.getElementsByTagName("property");
            for (int propertyIndex = 0; propertyIndex < properties.getLength(); propertyIndex++) {
                Element property = (Element) properties.item(propertyIndex);
                if (propertyName.equals(property.getAttribute("name"))) {
                    return property.getAttribute("value");
                }
            }
        }
        return null;
    }

    private static Path findRepoRoot() {
        Path cursor = Path.of("").toAbsolutePath().normalize();
        while (cursor != null) {
            if (Files.exists(cursor.resolve("pom.server-modernized.xml"))) {
                return cursor;
            }
            cursor = cursor.getParent();
        }
        throw new IllegalStateException("Repository root not found");
    }
}
