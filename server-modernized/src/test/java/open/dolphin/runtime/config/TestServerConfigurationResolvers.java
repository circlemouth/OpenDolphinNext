package open.dolphin.runtime.config;

import java.util.LinkedHashMap;
import java.util.Map;

public final class TestServerConfigurationResolvers {

    private TestServerConfigurationResolvers() {
    }

    public static ServerConfigurationResolver resolver(String... entries) {
        if (entries == null || entries.length == 0) {
            return new ServerConfigurationResolver(Map.of());
        }
        if (entries.length % 2 != 0) {
            throw new IllegalArgumentException("entries must be key/value pairs");
        }
        Map<String, String> values = new LinkedHashMap<>();
        for (int i = 0; i < entries.length; i += 2) {
            values.put(entries[i], entries[i + 1]);
        }
        return new ServerConfigurationResolver(values);
    }
}
