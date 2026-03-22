package open.dolphin.orca.support;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.ServerRuntimeConfiguration;

/**
 * Deduplicates ORCA push events by event id with optional persistence.
 */
public final class PushEventDeduplicator {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final int DEFAULT_CACHE_MAX = 10000;
    private static final long DEFAULT_TTL_DAYS = 30L;

    private final Path cachePath;
    private final int maxEntries;
    private final Duration ttl;
    private final LinkedHashMap<String, Long> seen = new LinkedHashMap<>();

    private PushEventDeduplicator(Path cachePath, int maxEntries, Duration ttl) {
        this.cachePath = cachePath;
        this.maxEntries = Math.max(100, maxEntries);
        this.ttl = ttl;
        load();
    }

    public static PushEventDeduplicator createDefault() {
        return createDefault(new ServerConfigurationResolver());
    }

    static PushEventDeduplicator createDefault(ServerConfigurationResolver resolver) {
        ServerRuntimeConfiguration.PushEventCacheSettings settings = resolver.orcaPushEventCache();
        ServerRuntimeConfiguration.RuntimeSettings runtimeSettings = resolver.runtime();
        Path configured = settings.cachePath();
        Path path;
        if (configured != null) {
            path = configured.toAbsolutePath().normalize();
        } else {
            String serverDataDir = runtimeSettings.serverDataDirectory();
            if (serverDataDir == null || serverDataDir.isBlank()) {
                throw new IllegalStateException(
                        "ORCA push event cache path requires orca.push-event-cache.path or jboss.server.data.dir");
            }
            path = Path.of(serverDataDir.trim()).toAbsolutePath().normalize()
                    .resolve("orca")
                    .resolve("pushevent-cache.json");
        }
        int max = settings.maxEntries() != null ? settings.maxEntries() : DEFAULT_CACHE_MAX;
        long ttlDays = settings.ttlDays() != null ? settings.ttlDays() : DEFAULT_TTL_DAYS;
        return new PushEventDeduplicator(path, max, Duration.ofDays(ttlDays));
    }

    public synchronized Result filter(String json) {
        if (json == null || json.isBlank()) {
            return Result.unmodified(json, 0, 0, 0, 0);
        }
        JsonNode root;
        try {
            root = JSON.readTree(json);
        } catch (IOException ex) {
            return Result.unmodified(json, 0, 0, 0, 0);
        }
        Optional<JsonNode> eventArray = findEventArray(root);
        if (eventArray.isEmpty() || !eventArray.get().isArray()) {
            return Result.unmodified(json, 0, 0, 0, 0);
        }
        pruneExpired();
        long now = Instant.now().toEpochMilli();
        JsonNode arrayNode = eventArray.get();
        List<JsonNode> kept = new ArrayList<>();
        int total = 0;
        int deduped = 0;
        int newlyAdded = 0;
        for (JsonNode node : arrayNode) {
            total++;
            String eventId = extractEventId(node);
            if (eventId == null || eventId.isBlank()) {
                kept.add(node);
                continue;
            }
            Long previous = seen.get(eventId);
            if (previous != null && !isExpired(previous, now)) {
                deduped++;
                continue;
            }
            seen.put(eventId, now);
            newlyAdded++;
            kept.add(node);
        }
        if (deduped == 0) {
            if (newlyAdded > 0) {
                trimToLimit();
                persistQuietly();
            }
            return Result.unmodified(json, total, kept.size(), deduped, newlyAdded);
        }
        trimToLimit();
        persistQuietly();
        applyArrayUpdate(arrayNode, kept);
        return Result.modified(root.toString(), total, kept.size(), deduped, newlyAdded);
    }

    private Optional<JsonNode> findEventArray(JsonNode node) {
        if (node == null) {
            return Optional.empty();
        }
        if (node.has("Event_Information")) {
            return Optional.ofNullable(node.get("Event_Information"));
        }
        for (JsonNode child : node) {
            Optional<JsonNode> found = findEventArray(child);
            if (found.isPresent()) {
                return found;
            }
        }
        return Optional.empty();
    }

    private String extractEventId(JsonNode node) {
        if (node == null) {
            return null;
        }
        List<String> keys = List.of("Event_Id", "Event_ID", "event_id", "eventId");
        for (String key : keys) {
            if (node.has(key)) {
                JsonNode value = node.get(key);
                if (value != null && !value.isNull()) {
                    return value.asText(null);
                }
            }
        }
        return null;
    }

    private void applyArrayUpdate(JsonNode originalArray, List<JsonNode> values) {
        if (originalArray instanceof com.fasterxml.jackson.databind.node.ArrayNode array) {
            array.removeAll();
            for (JsonNode node : values) {
                array.add(node);
            }
        }
    }

    private void pruneExpired() {
        if (ttl == null || ttl.isZero() || ttl.isNegative()) {
            return;
        }
        long now = Instant.now().toEpochMilli();
        Iterator<Map.Entry<String, Long>> iterator = seen.entrySet().iterator();
        while (iterator.hasNext()) {
            Map.Entry<String, Long> entry = iterator.next();
            if (isExpired(entry.getValue(), now)) {
                iterator.remove();
            }
        }
    }

    private boolean isExpired(long timestamp, long now) {
        if (ttl == null || ttl.isZero() || ttl.isNegative()) {
            return false;
        }
        return now - timestamp > ttl.toMillis();
    }

    private void trimToLimit() {
        while (seen.size() > maxEntries) {
            Iterator<String> iterator = seen.keySet().iterator();
            if (!iterator.hasNext()) {
                break;
            }
            iterator.next();
            iterator.remove();
        }
    }

    private void load() {
        if (cachePath == null || !Files.exists(cachePath)) {
            return;
        }
        try {
            byte[] bytes = Files.readAllBytes(cachePath);
            if (bytes.length == 0) {
                return;
            }
            List<CacheEntry> entries = JSON.readValue(bytes, new TypeReference<List<CacheEntry>>() {
            });
            long now = Instant.now().toEpochMilli();
            for (CacheEntry entry : entries) {
                if (entry == null || entry.id == null || entry.id.isBlank()) {
                    continue;
                }
                if (!isExpired(entry.timestamp, now)) {
                    seen.put(entry.id, entry.timestamp);
                }
            }
        } catch (IOException ex) {
            // ignore
        }
    }

    private void persistQuietly() {
        if (cachePath == null) {
            return;
        }
        try {
            Path parent = cachePath.getParent();
            if (parent != null && !Files.exists(parent)) {
                Files.createDirectories(parent);
            }
            List<CacheEntry> entries = new ArrayList<>();
            for (Map.Entry<String, Long> entry : seen.entrySet()) {
                entries.add(new CacheEntry(entry.getKey(), entry.getValue()));
            }
            byte[] payload = JSON.writerWithDefaultPrettyPrinter()
                    .writeValueAsString(entries)
                    .getBytes(StandardCharsets.UTF_8);
            Files.write(cachePath, payload);
        } catch (IOException ex) {
            // ignore
        }
    }
    private static final class CacheEntry {
        public String id;
        public long timestamp;

        public CacheEntry() {
        }

        private CacheEntry(String id, long timestamp) {
            this.id = id;
            this.timestamp = timestamp;
        }
    }

    public static final class Result {
        private final String body;
        private final boolean modified;
        private final int total;
        private final int kept;
        private final int deduped;
        private final int newlyAdded;

        private Result(String body, boolean modified, int total, int kept, int deduped, int newlyAdded) {
            this.body = body;
            this.modified = modified;
            this.total = total;
            this.kept = kept;
            this.deduped = deduped;
            this.newlyAdded = newlyAdded;
        }

        public static Result unmodified(String body, int total, int kept, int deduped, int newlyAdded) {
            return new Result(body, false, total, kept, deduped, newlyAdded);
        }

        public static Result modified(String body, int total, int kept, int deduped, int newlyAdded) {
            return new Result(body, true, total, kept, deduped, newlyAdded);
        }

        public String body() {
            return body;
        }

        public boolean modified() {
            return modified;
        }

        public int total() {
            return total;
        }

        public int kept() {
            return kept;
        }

        public int deduped() {
            return deduped;
        }

        public int newlyAdded() {
            return newlyAdded;
        }
    }
}
