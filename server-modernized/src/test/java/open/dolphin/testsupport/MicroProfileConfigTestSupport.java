package open.dolphin.testsupport;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import org.eclipse.microprofile.config.Config;
import org.eclipse.microprofile.config.ConfigValue;
import org.eclipse.microprofile.config.spi.ConfigBuilder;
import org.eclipse.microprofile.config.spi.ConfigProviderResolver;
import org.eclipse.microprofile.config.spi.ConfigSource;
import org.eclipse.microprofile.config.spi.Converter;

public final class MicroProfileConfigTestSupport {

    private MicroProfileConfigTestSupport() {
    }

    public static AutoCloseable withConfig(String... entries) {
        if (entries == null || entries.length % 2 != 0) {
            throw new IllegalArgumentException("entries must be key/value pairs");
        }
        Map<String, String> values = new LinkedHashMap<>();
        for (int i = 0; i < entries.length; i += 2) {
            values.put(entries[i], entries[i + 1]);
        }
        ConfigProviderResolver resolver = ensureResolver();
        Config config = new MapBackedConfig(values);
        ClassLoader classLoader = Thread.currentThread().getContextClassLoader();
        resolver.registerConfig(config, classLoader);
        return () -> resolver.releaseConfig(config);
    }

    private static ConfigProviderResolver ensureResolver() {
        try {
            return ConfigProviderResolver.instance();
        } catch (IllegalStateException ex) {
            InMemoryConfigProviderResolver resolver = new InMemoryConfigProviderResolver();
            ConfigProviderResolver.setInstance(resolver);
            return resolver;
        }
    }

    private static final class MapBackedConfig implements Config {

        private final Map<String, String> values;

        private MapBackedConfig(Map<String, String> values) {
            this.values = values;
        }

        @Override
        public <T> T getValue(String propertyName, Class<T> propertyType) {
            return getOptionalValue(propertyName, propertyType)
                    .orElseThrow(() -> new NoSuchElementException(propertyName));
        }

        @Override
        public ConfigValue getConfigValue(String propertyName) {
            String value = values.get(propertyName);
            return new ConfigValue() {
                @Override
                public String getName() {
                    return propertyName;
                }

                @Override
                public String getValue() {
                    return value;
                }

                @Override
                public String getRawValue() {
                    return value;
                }

                @Override
                public String getSourceName() {
                    return "test";
                }

                @Override
                public int getSourceOrdinal() {
                    return 1000;
                }
            };
        }

        @Override
        public <T> Optional<T> getOptionalValue(String propertyName, Class<T> propertyType) {
            String value = values.get(propertyName);
            if (value == null) {
                return Optional.empty();
            }
            return Optional.of(convert(value, propertyType));
        }

        @Override
        public Iterable<String> getPropertyNames() {
            return values.keySet();
        }

        @Override
        public Iterable<ConfigSource> getConfigSources() {
            return java.util.List.of();
        }

        @Override
        public <T> Optional<Converter<T>> getConverter(Class<T> forType) {
            return Optional.empty();
        }

        @Override
        public <T> T unwrap(Class<T> type) {
            if (type.isInstance(this)) {
                return type.cast(this);
            }
            throw new IllegalArgumentException("Unsupported unwrap type: " + type.getName());
        }

        @SuppressWarnings("unchecked")
        private <T> T convert(String value, Class<T> propertyType) {
            if (String.class.equals(propertyType)) {
                return (T) value;
            }
            if (Integer.class.equals(propertyType)) {
                return (T) Integer.valueOf(value);
            }
            if (Long.class.equals(propertyType)) {
                return (T) Long.valueOf(value);
            }
            if (Boolean.class.equals(propertyType)) {
                return (T) Boolean.valueOf(value);
            }
            throw new IllegalArgumentException("Unsupported property type: " + propertyType.getName());
        }
    }

    private static final class InMemoryConfigProviderResolver extends ConfigProviderResolver {

        private final Map<ClassLoader, Config> configs = new LinkedHashMap<>();

        @Override
        public Config getConfig() {
            return getConfig(Thread.currentThread().getContextClassLoader());
        }

        @Override
        public Config getConfig(ClassLoader classLoader) {
            Config config = configs.get(classLoader);
            if (config == null) {
                throw new IllegalStateException("No config registered for classloader");
            }
            return config;
        }

        @Override
        public ConfigBuilder getBuilder() {
            throw new UnsupportedOperationException("builder is not used in tests");
        }

        @Override
        public void registerConfig(Config config, ClassLoader classLoader) {
            configs.put(classLoader, config);
        }

        @Override
        public void releaseConfig(Config config) {
            configs.values().removeIf(existing -> existing == config);
        }
    }
}
