package open.dolphin.rest.masterupdate;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.orca.transport.RestOrcaTransport;
import open.dolphin.runtime.config.ServerConfigurationResolver;

final class MasterUpdateArtifacts {

    private static final Pattern API_RESULT_PATTERN =
            Pattern.compile("<Api_Result\\b[^>]*>(.*?)</Api_Result>", Pattern.DOTALL);
    private static final Pattern API_MESSAGE_PATTERN =
            Pattern.compile("<Api_Result_Message\\b[^>]*>(.*?)</Api_Result_Message>", Pattern.DOTALL);
    private static final Pattern LAST_UPDATE_DATE_PATTERN =
            Pattern.compile("<(Last_Update_Date|Master_Update_Date)\\b[^>]*>(.*?)</(Last_Update_Date|Master_Update_Date)>", Pattern.DOTALL);

    private final RestOrcaTransport restOrcaTransport;
    private final ServerConfigurationResolver configurationResolver;
    private final HttpClient httpClient;

    MasterUpdateArtifacts(RestOrcaTransport restOrcaTransport,
                          ServerConfigurationResolver configurationResolver,
                          HttpClient httpClient) {
        this.restOrcaTransport = restOrcaTransport;
        this.configurationResolver = configurationResolver;
        this.httpClient = httpClient;
    }

    UpdateArtifact fetchDatasetArtifact(MasterUpdateStore store, String datasetCode) {
        if (isOrcaMasterLastUpdateDataset(datasetCode)) {
            return fetchOrcaMasterArtifact();
        }
        MasterUpdateStore.DatasetState state = MasterUpdateStateSupport.requireDataset(store.getSnapshot(), datasetCode);
        if (state.sourceUrl != null && state.sourceUrl.trim().startsWith("classpath:")) {
            return fetchClasspathArtifact(state.sourceUrl);
        }
        return fetchExternalArtifact(state.sourceUrl);
    }

    private static boolean isOrcaMasterLastUpdateDataset(String datasetCode) {
        return "orca_master_core".equals(datasetCode) || "disease_master".equals(datasetCode);
    }

    String writeArtifact(String datasetCode,
                         UpdateArtifact artifact,
                         String runId,
                         String triggerType) {
        if (artifact == null) {
            throw new MasterUpdateService.MasterUpdateException(500, "artifact_missing", "取得ファイルがありません。");
        }
        return writeArtifact(datasetCode, artifact.suggestedExtension, artifact.payload, artifact.tempFile, runId, triggerType);
    }

    String writeArtifact(String datasetCode,
                         String extension,
                         byte[] payload,
                         String runId,
                         String triggerType) {
        return writeArtifact(datasetCode, extension, payload, null, runId, triggerType);
    }

    private UpdateArtifact fetchOrcaMasterArtifact() {
        if (restOrcaTransport == null) {
            throw new MasterUpdateService.MasterUpdateException(503, "orca_transport_unavailable", "ORCA transport が利用できません。");
        }

        String facilityId = configurationResolver.orcaRuntime().facilityId();
        restOrcaTransport.reloadSettings(facilityId);
        String requestXml = String.join("\n",
                "<data>",
                "  <masterlastupdatev3req type=\"record\">",
                "    <Request_Number type=\"string\">01</Request_Number>",
                "  </masterlastupdatev3req>",
                "</data>");

        OrcaTransportResult result = restOrcaTransport.invoke(
                facilityId,
                OrcaEndpoint.MASTER_LAST_UPDATE,
                OrcaTransportRequest.post(requestXml)
        );
        if (result == null) {
            throw new MasterUpdateService.MasterUpdateException(502, "orca_empty_response", "ORCA から応答を取得できませんでした。");
        }
        if (result.getStatus() < 200 || result.getStatus() >= 300) {
            throw new MasterUpdateService.MasterUpdateException(
                    502,
                    "orca_http_error",
                    "ORCA masterlastupdatev3 が HTTP " + result.getStatus() + " を返しました。"
            );
        }

        String body = result.getBody() != null ? result.getBody() : "";
        String apiResult = extractFirst(API_RESULT_PATTERN, body);
        String apiMessage = extractFirst(API_MESSAGE_PATTERN, body);
        if (apiResult == null || !apiResult.matches("0+")) {
            throw new MasterUpdateService.MasterUpdateException(
                    502,
                    "orca_api_error",
                    "ORCA masterlastupdatev3 の Api_Result が異常です: " + (apiResult != null ? apiResult : "(null)")
                            + (apiMessage != null ? " / " + apiMessage : "")
            );
        }

        String lastUpdateDate = extractLastUpdateDate(body);
        long versionRecords = Math.max(1L, countMasterVersionNodes(body));
        byte[] payload = body.getBytes(StandardCharsets.UTF_8);

        UpdateArtifact artifact = new UpdateArtifact();
        artifact.payload = payload;
        artifact.hash = sha256(payload);
        artifact.recordCount = versionRecords;
        artifact.summary = "Api_Result=" + apiResult + " / Last_Update_Date=" + (lastUpdateDate != null ? lastUpdateDate : "-");
        artifact.note = apiMessage;
        artifact.suggestedExtension = "xml";
        artifact.sourceUrl = "orca:masterlastupdatev3";
        return artifact;
    }

    private UpdateArtifact fetchClasspathArtifact(String sourceUrl) {
        String resourceName = sourceUrl != null ? sourceUrl.trim().substring("classpath:".length()) : "";
        if (resourceName.isBlank() || resourceName.startsWith("/")) {
            throw new MasterUpdateService.MasterUpdateException(400, "classpath_source_invalid", "classpath データ取得元が不正です。");
        }
        ClassLoader loader = Thread.currentThread().getContextClassLoader();
        if (loader == null) {
            loader = MasterUpdateArtifacts.class.getClassLoader();
        }
        try (InputStream input = loader.getResourceAsStream(resourceName)) {
            if (input == null) {
                throw new MasterUpdateService.MasterUpdateException(404, "classpath_source_not_found",
                        "classpath データ取得元が見つかりません。");
            }
            byte[] payload = input.readAllBytes();
            if (payload.length == 0) {
                throw new MasterUpdateService.MasterUpdateException(502, "classpath_source_empty",
                        "classpath データが空です。");
            }
            String extension = resolveExtension(resourceName, "text/csv");
            UpdateArtifact artifact = new UpdateArtifact();
            artifact.payload = payload;
            artifact.hash = sha256(payload);
            artifact.recordCount = estimateRecordCount(payload, extension, "text/csv");
            artifact.summary = "classpath resource / size=" + payload.length;
            artifact.note = "development/trial fixture source";
            artifact.suggestedExtension = extension;
            artifact.sourceUrl = "classpath:" + resourceName;
            return artifact;
        } catch (MasterUpdateService.MasterUpdateException ex) {
            throw ex;
        } catch (IOException ex) {
            throw new MasterUpdateService.MasterUpdateException(500, "classpath_source_read_failed",
                    "classpath データ取得に失敗しました。");
        }
    }

    private UpdateArtifact fetchExternalArtifact(String sourceUrl) {
        if (sourceUrl == null || sourceUrl.isBlank()) {
            throw new MasterUpdateService.MasterUpdateException(400, "source_url_missing", "取得元URLが未設定です。");
        }

        URI sourceUri;
        try {
            sourceUri = URI.create(sourceUrl.trim());
        } catch (IllegalArgumentException ex) {
            throw new MasterUpdateService.MasterUpdateException(400, "source_url_invalid", "取得元URLが不正です。");
        }

        HttpRequest request = HttpRequest.newBuilder(sourceUri)
                .GET()
                .timeout(Duration.ofSeconds(45))
                .header("User-Agent", "OpenDolphin-MasterUpdate/1.0")
                .build();

        HttpResponse<InputStream> response;
        try {
            response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new MasterUpdateService.MasterUpdateException(502, "external_fetch_failed", "外部データ取得に失敗しました。");
        } catch (IOException ex) {
            throw new MasterUpdateService.MasterUpdateException(502, "external_fetch_failed", "外部データ取得に失敗しました。");
        }

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new MasterUpdateService.MasterUpdateException(
                    502,
                    "external_http_error",
                    "外部データ取得が HTTP " + response.statusCode() + " で失敗しました。"
            );
        }

        String contentType = response.headers().firstValue("content-type").orElse(null);
        String extension = resolveExtension(sourceUrl, contentType);
        Path tempFile = null;
        try (InputStream body = response.body()) {
            if (body == null) {
                throw new MasterUpdateService.MasterUpdateException(502, "external_empty", "外部データが空です。");
            }
            tempFile = createArtifactTempFile(extension);
            StreamedArtifactData streamed = streamToFile(body, tempFile);
            if (streamed.size <= 0L) {
                throw new MasterUpdateService.MasterUpdateException(502, "external_empty", "外部データが空です。");
            }

            UpdateArtifact artifact = new UpdateArtifact();
            artifact.tempFile = tempFile;
            artifact.hash = streamed.hash;
            artifact.recordCount = estimateRecordCount(tempFile, extension, contentType);
            artifact.summary = "HTTP " + response.statusCode() + " / size=" + streamed.size;
            artifact.note = contentType;
            artifact.suggestedExtension = extension;
            artifact.sourceUrl = sanitizeSourceUrl(sourceUrl);
            return artifact;
        } catch (MasterUpdateService.MasterUpdateException ex) {
            deleteTempFileQuietly(tempFile);
            throw ex;
        } catch (IOException ex) {
            deleteTempFileQuietly(tempFile);
            throw new MasterUpdateService.MasterUpdateException(500, "artifact_stream_failed", "取得ファイルの一時保存に失敗しました。");
        }
    }

    private String writeArtifact(String datasetCode,
                                 String extension,
                                 byte[] payload,
                                 Path tempFile,
                                 String runId,
                                 String triggerType) {
        String safeExtension = extension != null && !extension.isBlank() ? extension : "bin";
        String timestamp = java.time.Instant.now().toString().replace(':', '-');
        String fileName = timestamp + "-" + triggerType.toLowerCase(Locale.ROOT) + "-" + runId + "." + safeExtension;
        Path datasetDirectory = resolveArtifactRoot().resolve(datasetCode);
        try {
            Files.createDirectories(datasetDirectory);
            Path path = datasetDirectory.resolve(fileName);
            if (tempFile != null) {
                Files.move(tempFile, path);
            } else {
                Files.write(path, payload);
            }
            return path.toString();
        } catch (IOException ex) {
            deleteTempFileQuietly(tempFile);
            throw new MasterUpdateService.MasterUpdateException(500, "artifact_write_failed", "取得ファイル保存に失敗しました: " + ex.getMessage());
        }
    }

    private Path resolveArtifactRoot() {
        String serverDataDirectory = configurationResolver != null ? configurationResolver.runtime().serverDataDirectory() : null;
        if (serverDataDirectory == null || serverDataDirectory.isBlank()) {
            throw new IllegalStateException("MasterUpdateService artifacts requires " + ServerConfigurationResolver.KEY_SERVER_DATA_DIR);
        }
        Path base = Path.of(serverDataDirectory).toAbsolutePath().normalize();
        try {
            Files.createDirectories(base);
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to create server data directory: " + base, ex);
        }
        return base.resolve("opendolphin").resolve("master-update-artifacts");
    }

    private Path createArtifactTempFile(String extension) throws IOException {
        String safeExtension = extension != null && !extension.isBlank() ? extension : "bin";
        Path tempDir = resolveArtifactRoot().resolve(".tmp");
        Files.createDirectories(tempDir);
        return Files.createTempFile(tempDir, "master-update-", "." + safeExtension);
    }

    static long estimateRecordCount(byte[] payload, String extension, String contentType) {
        if (payload == null || payload.length == 0) {
            return 0L;
        }
        String ext = extension != null ? extension.toLowerCase(Locale.ROOT) : "";
        String type = contentType != null ? contentType.toLowerCase(Locale.ROOT) : "";

        if ("zip".equals(ext) || type.contains("zip")) {
            long entries = 0L;
            try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(payload))) {
                ZipEntry entry;
                while ((entry = zip.getNextEntry()) != null) {
                    if (!entry.isDirectory()) {
                        entries++;
                    }
                }
                return Math.max(1L, entries);
            } catch (IOException ignore) {
                return 1L;
            }
        }

        if ("csv".equals(ext)
                || "txt".equals(ext)
                || "json".equals(ext)
                || "xml".equals(ext)
                || type.contains("text")
                || type.contains("csv")
                || type.contains("json")
                || type.contains("xml")) {
            String text = new String(payload, StandardCharsets.UTF_8);
            long lines = text.lines().count();
            return Math.max(1L, lines);
        }

        return 1L;
    }

    static long estimateRecordCount(Path artifactPath, String extension, String contentType) {
        if (artifactPath == null || !Files.exists(artifactPath)) {
            return 0L;
        }
        String ext = extension != null ? extension.toLowerCase(Locale.ROOT) : "";
        String type = contentType != null ? contentType.toLowerCase(Locale.ROOT) : "";

        if ("zip".equals(ext) || type.contains("zip")) {
            long entries = 0L;
            try (InputStream in = Files.newInputStream(artifactPath);
                 ZipInputStream zip = new ZipInputStream(in)) {
                ZipEntry entry;
                while ((entry = zip.getNextEntry()) != null) {
                    if (!entry.isDirectory()) {
                        entries++;
                    }
                }
                return Math.max(1L, entries);
            } catch (IOException ignore) {
                return 1L;
            }
        }

        if ("csv".equals(ext)
                || "txt".equals(ext)
                || "json".equals(ext)
                || "xml".equals(ext)
                || type.contains("text")
                || type.contains("csv")
                || type.contains("json")
                || type.contains("xml")) {
            try {
                long lines;
                try (java.util.stream.Stream<String> stream = Files.lines(artifactPath, StandardCharsets.UTF_8)) {
                    lines = stream.count();
                }
                return Math.max(1L, lines);
            } catch (IOException ignore) {
                return 1L;
            }
        }

        return 1L;
    }

    static StreamedArtifactData streamToFile(InputStream input, Path target) throws IOException {
        Objects.requireNonNull(input, "input");
        Objects.requireNonNull(target, "target");
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            long size = 0L;
            try (OutputStream out = Files.newOutputStream(target)) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    out.write(buffer, 0, read);
                    digest.update(buffer, 0, read);
                    size += read;
                }
            }
            return new StreamedArtifactData(size, HexFormat.of().formatHex(digest.digest()));
        } catch (IOException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IOException("Failed to hash streamed artifact", ex);
        }
    }

    static String resolveExtension(String source, String contentType) {
        if (source != null) {
            int queryIdx = source.indexOf('?');
            String path = queryIdx >= 0 ? source.substring(0, queryIdx) : source;
            int slashIdx = path.lastIndexOf('/');
            String fileName = slashIdx >= 0 ? path.substring(slashIdx + 1) : path;
            int dotIdx = fileName.lastIndexOf('.');
            if (dotIdx > 0 && dotIdx < fileName.length() - 1) {
                String ext = fileName.substring(dotIdx + 1).toLowerCase(Locale.ROOT);
                if (ext.matches("[a-z0-9]{1,8}")) {
                    return ext;
                }
            }
        }
        if (contentType != null) {
            String lowered = contentType.toLowerCase(Locale.ROOT);
            if (lowered.contains("json")) {
                return "json";
            }
            if (lowered.contains("xml")) {
                return "xml";
            }
            if (lowered.contains("csv")) {
                return "csv";
            }
            if (lowered.contains("zip")) {
                return "zip";
            }
            if (lowered.contains("pdf")) {
                return "pdf";
            }
            if (lowered.contains("text")) {
                return "txt";
            }
        }
        return "bin";
    }

    private static String sanitizeSourceUrl(String sourceUrl) {
        if (sourceUrl == null || sourceUrl.isBlank()) {
            return sourceUrl;
        }
        try {
            URI uri = URI.create(sourceUrl.trim());
            String scheme = uri.getScheme();
            String host = uri.getHost();
            if (scheme == null || host == null) {
                return sourceUrl.split("\\?", 2)[0];
            }
            StringBuilder sanitized = new StringBuilder();
            sanitized.append(scheme).append("://").append(host);
            if (uri.getPort() >= 0) {
                sanitized.append(':').append(uri.getPort());
            }
            String path = uri.getRawPath();
            if (path != null) {
                sanitized.append(path);
            }
            return sanitized.toString();
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static String sha256(byte[] payload) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(payload));
        } catch (Exception ex) {
            throw new IllegalStateException("SHA-256 hash generation failed", ex);
        }
    }

    private static String extractFirst(Pattern pattern, String text) {
        if (pattern == null || text == null || text.isBlank()) {
            return null;
        }
        Matcher matcher = pattern.matcher(text);
        if (!matcher.find()) {
            return null;
        }
        String value = matcher.group(1);
        return value != null ? value.trim() : null;
    }

    private static String extractLastUpdateDate(String xml) {
        if (xml == null || xml.isBlank()) {
            return null;
        }
        Matcher matcher = LAST_UPDATE_DATE_PATTERN.matcher(xml);
        if (!matcher.find()) {
            return null;
        }
        String value = matcher.group(2);
        return value != null ? value.trim() : null;
    }

    private static long countMasterVersionNodes(String xml) {
        if (xml == null || xml.isBlank()) {
            return 0L;
        }
        long count = 0L;
        int idx = 0;
        String token = "Master_Version_Information";
        while (true) {
            idx = xml.indexOf(token, idx);
            if (idx < 0) {
                break;
            }
            count++;
            idx += token.length();
        }
        return count;
    }

    private static void deleteTempFileQuietly(Path tempFile) {
        if (tempFile == null) {
            return;
        }
        try {
            Files.deleteIfExists(tempFile);
        } catch (IOException ignore) {
            // best effort cleanup
        }
    }

    static final class UpdateArtifact {
        byte[] payload;
        Path tempFile;
        String hash;
        long recordCount;
        String summary;
        String note;
        String suggestedExtension;
        String sourceUrl;
    }

    static final class StreamedArtifactData {
        final long size;
        final String hash;

        StreamedArtifactData(long size, String hash) {
            this.size = size;
            this.hash = hash;
        }
    }
}
