package open.orca.master;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Builds the versioned canonical artifact consumed by the local ORCA master cache importer.
 */
public final class LocalOrcaMasterCacheArtifactBuilder {

    private static final ObjectMapper JSON = new ObjectMapper()
            .enable(SerializationFeature.INDENT_OUTPUT);
    private static final long MAX_SOURCE_BYTES = 120L * 1024L * 1024L;

    public BuildResult build(BuildRequest request) {
        request.validate();
        CanonicalRows rows = loadRows(request.sourceDirectory());
        rows.requireComplete();

        byte[] csvPayload = rows.toCanonicalCsv();
        String csvHash = sha256(csvPayload);
        Map<String, Object> manifest = manifest(request, rows, csvPayload.length, csvHash);
        byte[] manifestPayload = toJson(manifest);

        try {
            Path output = request.outputPath().toAbsolutePath().normalize();
            Path parent = output.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            try (ZipOutputStream zip = new ZipOutputStream(Files.newOutputStream(output), StandardCharsets.UTF_8)) {
                writeZipEntry(zip, LocalOrcaMasterCacheArtifactSpec.MANIFEST_PATH, manifestPayload);
                writeZipEntry(zip, LocalOrcaMasterCacheArtifactSpec.CANONICAL_CSV_PATH, csvPayload);
            }
            return new BuildResult(output, rows.rowCount(), rows.masterTypeCounts(), csvHash);
        } catch (IOException ex) {
            throw new ArtifactBuildException("canonical artifact の書き込みに失敗しました。");
        }
    }

    public static void main(String[] args) {
        try {
            BuildRequest request = BuildRequest.fromArgs(args);
            BuildResult result = new LocalOrcaMasterCacheArtifactBuilder().build(request);
            System.out.println("canonical artifact written: " + result.outputPath());
            System.out.println("rows: " + result.rowCount());
            System.out.println("sha256: " + result.artifactSha256());
        } catch (ArtifactBuildException ex) {
            System.err.println(ex.getMessage());
            throw ex;
        }
    }

    private static CanonicalRows loadRows(Path sourceDirectory) {
        Path normalized = sourceDirectory.toAbsolutePath().normalize();
        if (!Files.isDirectory(normalized)) {
            throw new ArtifactBuildException("source directory が見つかりません。");
        }
        CanonicalRows rows = new CanonicalRows();
        Path singleCsv = normalized.resolve(LocalOrcaMasterCacheArtifactSpec.CANONICAL_CSV_PATH);
        if (Files.exists(singleCsv)) {
            readCanonicalCsv(singleCsv, rows);
            return rows;
        }

        Path mastersDirectory = normalized.resolve("masters");
        for (String masterType : LocalOrcaMasterCacheArtifactSpec.REQUIRED_MASTER_TYPES.stream().sorted().toList()) {
            Path source = mastersDirectory.resolve(masterType + ".csv");
            if (Files.exists(source)) {
                readCanonicalCsv(source, rows);
            }
        }
        return rows;
    }

    private static void readCanonicalCsv(Path source, CanonicalRows rows) {
        try {
            if (Files.size(source) > MAX_SOURCE_BYTES) {
                throw new ArtifactBuildException("source CSV が大きすぎます。");
            }
            byte[] payload = Files.readAllBytes(source);
            if (payload.length >= 3
                    && payload[0] == (byte) 0xEF
                    && payload[1] == (byte) 0xBB
                    && payload[2] == (byte) 0xBF) {
                throw new ArtifactBuildException("source CSV は UTF-8 BOM なしである必要があります。");
            }
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                    new ByteArrayInputStream(payload), StandardCharsets.UTF_8))) {
                parseCsv(reader, rows);
            }
        } catch (ArtifactBuildException ex) {
            throw ex;
        } catch (IOException | RuntimeException ex) {
            throw new ArtifactBuildException("source CSV の形式が不正です。");
        }
    }

    private static void parseCsv(BufferedReader reader, CanonicalRows rows) throws IOException {
        String headerLine = reader.readLine();
        if (headerLine == null || headerLine.isBlank()) {
            throw new ArtifactBuildException("source CSV が空です。");
        }
        Map<String, Integer> headerIndex = headerIndex(parseCsvLine(headerLine));
        String line;
        while ((line = reader.readLine()) != null) {
            if (line.isBlank() || line.stripLeading().startsWith("#")) {
                continue;
            }
            List<String> values = parseCsvLine(line);
            Map<String, String> row = new LinkedHashMap<>();
            for (String header : LocalOrcaMasterCacheArtifactSpec.CANONICAL_HEADERS) {
                Integer index = headerIndex.get(normalize(header));
                row.put(header, index != null && index < values.size() ? values.get(index).trim() : "");
            }
            rows.add(row);
        }
    }

    private static Map<String, Integer> headerIndex(List<String> headers) {
        Map<String, Integer> index = new LinkedHashMap<>();
        for (int i = 0; i < headers.size(); i++) {
            index.put(normalize(headers.get(i)), i);
        }
        for (String required : LocalOrcaMasterCacheArtifactSpec.CANONICAL_HEADERS) {
            if (!index.containsKey(normalize(required))) {
                throw new ArtifactBuildException("source CSV の必須 header が不足しています。");
            }
        }
        return index;
    }

    static List<String> parseCsvLine(String line) {
        List<String> values = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (quoted) {
                if (ch == '"') {
                    if (i + 1 < line.length() && line.charAt(i + 1) == '"') {
                        current.append('"');
                        i++;
                    } else {
                        quoted = false;
                    }
                } else {
                    current.append(ch);
                }
            } else if (ch == '"') {
                quoted = true;
            } else if (ch == ',') {
                values.add(current.toString());
                current.setLength(0);
            } else {
                current.append(ch);
            }
        }
        if (quoted) {
            throw new ArtifactBuildException("source CSV の形式が不正です。");
        }
        values.add(current.toString());
        return values;
    }

    static String toCsvLine(List<String> values) {
        List<String> escaped = new ArrayList<>();
        for (String value : values) {
            String text = value != null ? value : "";
            if (text.contains(",") || text.contains("\"") || text.contains("\n") || text.contains("\r")) {
                escaped.add('"' + text.replace("\"", "\"\"") + '"');
            } else {
                escaped.add(text);
            }
        }
        return String.join(",", escaped);
    }

    private static Map<String, Object> manifest(BuildRequest request,
                                                CanonicalRows rows,
                                                long csvBytes,
                                                String csvHash) {
        Map<String, Object> file = new LinkedHashMap<>();
        file.put("path", LocalOrcaMasterCacheArtifactSpec.CANONICAL_CSV_PATH);
        file.put("sha256", csvHash);
        file.put("bytes", csvBytes);
        file.put("rowCount", rows.rowCount());

        Map<String, Object> manifest = new LinkedHashMap<>();
        manifest.put("schemaVersion", LocalOrcaMasterCacheArtifactSpec.SCHEMA_VERSION);
        manifest.put("generatedAt", request.generatedAt());
        manifest.put("sourceKind", request.sourceKind());
        manifest.put("sourceId", request.sourceId());
        manifest.put("masterVersion", request.masterVersion());
        manifest.put("artifactFile", LocalOrcaMasterCacheArtifactSpec.CANONICAL_CSV_PATH);
        manifest.put("artifactSha256", csvHash);
        manifest.put("requiredMasterTypes", LocalOrcaMasterCacheArtifactSpec.REQUIRED_MASTER_TYPES.stream().sorted().toList());
        manifest.put("masterTypeCounts", rows.masterTypeCounts());
        manifest.put("files", List.of(file));
        return manifest;
    }

    private static byte[] toJson(Map<String, Object> manifest) {
        try {
            return JSON.writeValueAsBytes(manifest);
        } catch (IOException ex) {
            throw new ArtifactBuildException("manifest 生成に失敗しました。");
        }
    }

    private static void writeZipEntry(ZipOutputStream zip, String path, byte[] payload) throws IOException {
        ZipEntry entry = new ZipEntry(path);
        zip.putNextEntry(entry);
        zip.write(payload);
        zip.closeEntry();
    }

    static String sha256(byte[] payload) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(payload));
        } catch (Exception ex) {
            throw new ArtifactBuildException("SHA-256 hash generation failed");
        }
    }

    private static String normalize(String value) {
        String text = value != null ? value.trim() : "";
        return text.toLowerCase(Locale.ROOT);
    }

    public record BuildRequest(Path sourceDirectory,
                               Path outputPath,
                               String sourceKind,
                               String sourceId,
                               String masterVersion,
                               String generatedAt) {

        public static BuildRequest fromArgs(String[] args) {
            Map<String, String> parsed = parseArgs(args);
            Path source = requiredPath(parsed, "--source-dir");
            Path output = requiredPath(parsed, "--output");
            String sourceKind = firstNonBlank(parsed.get("--source-kind"), "official-file");
            String sourceId = sanitizeSourceId(firstNonBlank(parsed.get("--source-id"), "official-source"));
            String masterVersion = safeToken(firstNonBlank(parsed.get("--master-version"), "official-master"));
            String generatedAt = firstNonBlank(parsed.get("--generated-at"), Instant.now().toString());
            return new BuildRequest(source, output, sourceKind, sourceId, masterVersion, generatedAt);
        }

        void validate() {
            if (sourceDirectory == null || outputPath == null) {
                throw new ArtifactBuildException("source directory と output が必要です。");
            }
            if (!Set.of("official-file", "official-api", "orca-db-container-artifact").contains(sourceKind)) {
                throw new ArtifactBuildException("sourceKind は official-file / official-api / orca-db-container-artifact に限定します。");
            }
            sanitizeSourceId(sourceId);
            safeToken(masterVersion);
            try {
                Instant.parse(generatedAt);
            } catch (RuntimeException ex) {
                throw new ArtifactBuildException("generatedAt は ISO-8601 instant にしてください。");
            }
        }

        private static Map<String, String> parseArgs(String[] args) {
            Map<String, String> parsed = new LinkedHashMap<>();
            List<String> tokens = args != null ? Arrays.asList(args) : List.of();
            for (int i = 0; i < tokens.size(); i++) {
                String key = tokens.get(i);
                if (!key.startsWith("--") || i + 1 >= tokens.size()) {
                    throw new ArtifactBuildException("引数が不正です。");
                }
                parsed.put(key, tokens.get(++i));
            }
            return parsed;
        }

        private static Path requiredPath(Map<String, String> args, String key) {
            String value = args.get(key);
            if (value == null || value.isBlank()) {
                throw new ArtifactBuildException(key + " が必要です。");
            }
            return Path.of(value);
        }

        static String sanitizeSourceId(String value) {
            String source = safeToken(value);
            if (looksSecretBearing(source)) {
                throw new ArtifactBuildException("sourceId に認証情報を含めることはできません。");
            }
            try {
                URI uri = URI.create(source);
                if (uri.getScheme() == null) {
                    return source;
                }
                if (uri.getUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null) {
                    throw new ArtifactBuildException("sourceId に認証情報、query、fragment を含めることはできません。");
                }
                if (!"https".equalsIgnoreCase(uri.getScheme())
                        && !"orca".equalsIgnoreCase(uri.getScheme())
                        && !"orca-db-container".equalsIgnoreCase(uri.getScheme())) {
                    throw new ArtifactBuildException("sourceId URL は https / orca / orca-db-container scheme に限定します。");
                }
                if ("https".equalsIgnoreCase(uri.getScheme()) && (uri.getHost() == null || uri.getHost().isBlank())) {
                    throw new ArtifactBuildException("sourceId URL が不正です。");
                }
                return source;
            } catch (IllegalArgumentException ex) {
                throw new ArtifactBuildException("sourceId が不正です。");
            }
        }

        private static String safeToken(String value) {
            String text = value != null ? value.trim() : "";
            if (text.isBlank() || text.length() > 256 || text.contains("\n") || text.contains("\r")) {
                throw new ArtifactBuildException("artifact metadata が不正です。");
            }
            return text;
        }

        private static boolean looksSecretBearing(String source) {
            String lowered = source.toLowerCase(Locale.ROOT);
            return lowered.contains("authorization:")
                    || lowered.contains("basic ")
                    || lowered.contains("password=")
                    || lowered.contains("passwd=")
                    || lowered.contains("token=")
                    || lowered.contains("apikey=")
                    || lowered.contains("api_key=");
        }

        private static String firstNonBlank(String value, String fallback) {
            return value != null && !value.isBlank() ? value.trim() : fallback;
        }
    }

    public record BuildResult(Path outputPath,
                              long rowCount,
                              Map<String, Long> masterTypeCounts,
                              String artifactSha256) {

        public BuildResult {
            masterTypeCounts = Map.copyOf(masterTypeCounts);
        }
    }

    static final class CanonicalRows {
        private final List<Map<String, String>> rows = new ArrayList<>();
        private final Map<String, Long> masterTypeCounts = new TreeMap<>();

        void add(Map<String, String> row) {
            String recordType = normalize(row.get("recordType"));
            String masterType = masterTypeFor(recordType, row);
            validateRow(recordType, masterType, row);
            rows.add(row);
            masterTypeCounts.merge(masterType, 1L, Long::sum);
        }

        void requireComplete() {
            if (rows.isEmpty()) {
                throw new ArtifactBuildException("canonical artifact に反映可能な行がありません。");
            }
            if (!masterTypeCounts.keySet().containsAll(LocalOrcaMasterCacheArtifactSpec.REQUIRED_MASTER_TYPES)) {
                throw new ArtifactBuildException("canonical artifact の必須 master type が不足しています。");
            }
            requireInputSetHeaders();
        }

        byte[] toCanonicalCsv() {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            StringBuilder builder = new StringBuilder();
            builder.append(toCsvLine(LocalOrcaMasterCacheArtifactSpec.CANONICAL_HEADERS)).append('\n');
            for (Map<String, String> row : rows) {
                List<String> values = new ArrayList<>();
                for (String header : LocalOrcaMasterCacheArtifactSpec.CANONICAL_HEADERS) {
                    values.add(row.getOrDefault(header, ""));
                }
                builder.append(toCsvLine(values)).append('\n');
            }
            byte[] payload = builder.toString().getBytes(StandardCharsets.UTF_8);
            output.writeBytes(payload);
            return output.toByteArray();
        }

        long rowCount() {
            return rows.size();
        }

        Map<String, Long> masterTypeCounts() {
            return new LinkedHashMap<>(masterTypeCounts);
        }

        private static String masterTypeFor(String recordType, Map<String, String> row) {
            return switch (recordType) {
                case "entry" -> normalize(row.get("masterType"));
                case "inputset", "inputsetitem" -> "order-inputsets";
                case "interaction" -> "order-interactions";
                default -> throw new ArtifactBuildException("canonical artifact の recordType が不正です。");
            };
        }

        private static void validateRow(String recordType, String masterType, Map<String, String> row) {
            if (!LocalOrcaMasterCacheArtifactSpec.REQUIRED_MASTER_TYPES.contains(masterType)) {
                throw new ArtifactBuildException("canonical artifact の masterType が不正です。");
            }
            if ("entry".equals(recordType)) {
                require(row, "code", recordType, masterType);
                require(row, "name", recordType, masterType);
            } else if ("inputset".equals(recordType)) {
                require(row, "setCode", recordType, masterType);
                require(row, "name", recordType, masterType);
            } else if ("inputsetitem".equals(recordType)) {
                require(row, "setCode", recordType, masterType);
                require(row, "seq", recordType, masterType);
                require(row, "code", recordType, masterType);
                require(row, "name", recordType, masterType);
            } else if ("interaction".equals(recordType)) {
                require(row, "code", recordType, masterType);
                require(row, "code2", recordType, masterType);
            }
            validatePayloadJson(row.get("payloadJson"));
        }

        private static void validatePayloadJson(String value) {
            String json = value != null && !value.isBlank() ? value.trim() : "{}";
            if (!json.startsWith("{") || !json.endsWith("}")) {
                throw new ArtifactBuildException("canonical artifact の payloadJson が不正です。");
            }
            try {
                if (!JSON.readTree(json).isObject()) {
                    throw new ArtifactBuildException("canonical artifact の payloadJson が不正です。");
                }
            } catch (IOException ex) {
                throw new ArtifactBuildException("canonical artifact の payloadJson が不正です。");
            }
        }

        private static void require(Map<String, String> row, String header, String recordType, String masterType) {
            String value = row.get(header);
            if (value == null || value.isBlank()) {
                String code = row.getOrDefault("code", "");
                throw new ArtifactBuildException("canonical artifact の必須値が不足しています。"
                        + " field=" + header
                        + " recordType=" + recordType
                        + " masterType=" + masterType
                        + " code=" + sanitizeDiagnostic(code));
            }
        }

        private static String sanitizeDiagnostic(String value) {
            String text = value != null ? value : "";
            text = text.replaceAll("[^A-Za-z0-9_.:-]", "_");
            return text.length() <= 64 ? text : text.substring(0, 64);
        }

        private void requireInputSetHeaders() {
            Set<String> headers = new LinkedHashSet<>();
            for (Map<String, String> row : rows) {
                if ("inputset".equals(normalize(row.get("recordType")))) {
                    headers.add(row.getOrDefault("setCode", ""));
                }
            }
            for (Map<String, String> row : rows) {
                if ("inputsetitem".equals(normalize(row.get("recordType")))
                        && !headers.contains(row.getOrDefault("setCode", ""))) {
                    throw new ArtifactBuildException("canonical artifact の入力セット header/item が不整合です。");
                }
            }
        }
    }

    public static final class ArtifactBuildException extends RuntimeException {
        ArtifactBuildException(String message) {
            super(message);
        }
    }
}
