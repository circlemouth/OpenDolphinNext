package open.orca.master;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.zip.GZIPInputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Compares a canonical artifact with a sanitized parity snapshot exported from a dev/staging ORCA DB container.
 */
public final class LocalOrcaMasterCacheParityVerifier {

    public ParityResult verify(Path artifactPath, Path paritySnapshotPath) {
        ArtifactSummary artifact = ArtifactSummary.fromArtifact(artifactPath);
        List<ParityExpectation> expectations = loadExpectations(paritySnapshotPath);
        List<String> mismatches = new ArrayList<>();
        for (ParityExpectation expectation : expectations) {
            long actualCount = artifact.counts().getOrDefault(expectation.masterType(), 0L);
            if (actualCount != expectation.rowCount()) {
                mismatches.add("count mismatch: " + expectation.masterType());
                continue;
            }
            if (!expectation.sampleCode().isBlank()) {
                CanonicalRow row = artifact.rowsByTypeAndCode()
                        .get(expectation.masterType() + "\u0000" + expectation.sampleCode());
                if (row == null) {
                    mismatches.add("sample missing: " + expectation.masterType());
                    continue;
                }
                if (!expectation.sampleName().isBlank() && !expectation.sampleName().equals(row.name())) {
                    mismatches.add("sample name mismatch: " + expectation.masterType());
                }
                if (!expectation.sampleValidFrom().isBlank()
                        && !expectation.sampleValidFrom().equals(row.validFrom())) {
                    mismatches.add("sample validFrom mismatch: " + expectation.masterType());
                }
                if (!expectation.sampleValidTo().isBlank()
                        && !expectation.sampleValidTo().equals(row.validTo())) {
                    mismatches.add("sample validTo mismatch: " + expectation.masterType());
                }
            }
        }
        if (!mismatches.isEmpty()) {
            throw new ParityVerificationException("local master cache parity verification failed: "
                    + String.join("; ", mismatches));
        }
        return new ParityResult(expectations.size(), artifact.rowCount());
    }

    public static void main(String[] args) {
        try {
            Map<String, String> parsed = parseArgs(args);
            Path artifact = requiredPath(parsed, "--artifact");
            Path snapshot = requiredPath(parsed, "--parity-snapshot");
            ParityResult result = new LocalOrcaMasterCacheParityVerifier().verify(artifact, snapshot);
            System.out.println("parity verification passed");
            System.out.println("expectations: " + result.expectationCount());
            System.out.println("artifact rows: " + result.artifactRowCount());
        } catch (ParityVerificationException ex) {
            System.err.println(ex.getMessage());
            throw ex;
        }
    }

    private static List<ParityExpectation> loadExpectations(Path paritySnapshotPath) {
        if (paritySnapshotPath == null || !Files.exists(paritySnapshotPath)) {
            throw new ParityVerificationException("parity snapshot が見つかりません。");
        }
        try (BufferedReader reader = Files.newBufferedReader(paritySnapshotPath, StandardCharsets.UTF_8)) {
            String headerLine = reader.readLine();
            if (headerLine == null || headerLine.isBlank()) {
                throw new ParityVerificationException("parity snapshot が空です。");
            }
            Map<String, Integer> headers = headerIndex(LocalOrcaMasterCacheArtifactBuilder.parseCsvLine(headerLine));
            List<ParityExpectation> expectations = new ArrayList<>();
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank() || line.stripLeading().startsWith("#")) {
                    continue;
                }
                List<String> values = LocalOrcaMasterCacheArtifactBuilder.parseCsvLine(line);
                String masterType = value(headers, values, "masterType");
                if (!LocalOrcaMasterCacheArtifactSpec.REQUIRED_MASTER_TYPES.contains(masterType)) {
                    throw new ParityVerificationException("parity snapshot の masterType が不正です。");
                }
                long rowCount = parseLong(value(headers, values, "rowCount"));
                expectations.add(new ParityExpectation(
                        masterType,
                        rowCount,
                        value(headers, values, "sampleCode"),
                        value(headers, values, "sampleName"),
                        value(headers, values, "sampleValidFrom"),
                        value(headers, values, "sampleValidTo")));
            }
            if (expectations.isEmpty()) {
                throw new ParityVerificationException("parity snapshot に検証行がありません。");
            }
            return expectations;
        } catch (ParityVerificationException ex) {
            throw ex;
        } catch (IOException | RuntimeException ex) {
            throw new ParityVerificationException("parity snapshot の形式が不正です。");
        }
    }

    private static Map<String, Integer> headerIndex(List<String> headers) {
        Map<String, Integer> index = new LinkedHashMap<>();
        for (int i = 0; i < headers.size(); i++) {
            index.put(normalize(headers.get(i)), i);
        }
        for (String required : List.of("masterType", "rowCount", "sampleCode", "sampleName",
                "sampleValidFrom", "sampleValidTo")) {
            if (!index.containsKey(normalize(required))) {
                throw new ParityVerificationException("parity snapshot の必須 header が不足しています。");
            }
        }
        return index;
    }

    private static String value(Map<String, Integer> headers, List<String> values, String header) {
        Integer index = headers.get(normalize(header));
        if (index == null || index >= values.size()) {
            return "";
        }
        return values.get(index).trim();
    }

    private static long parseLong(String value) {
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException ex) {
            throw new ParityVerificationException("parity snapshot の件数が不正です。");
        }
    }

    private static Map<String, String> parseArgs(String[] args) {
        Map<String, String> parsed = new LinkedHashMap<>();
        for (int i = 0; args != null && i < args.length; i++) {
            String key = args[i];
            if (!key.startsWith("--") || i + 1 >= args.length) {
                throw new ParityVerificationException("引数が不正です。");
            }
            parsed.put(key, args[++i]);
        }
        return parsed;
    }

    private static Path requiredPath(Map<String, String> args, String key) {
        String value = args.get(key);
        if (value == null || value.isBlank()) {
            throw new ParityVerificationException(key + " が必要です。");
        }
        return Path.of(value);
    }

    private static String normalize(String value) {
        return value != null ? value.trim().toLowerCase(Locale.ROOT) : "";
    }

    public record ParityResult(int expectationCount, long artifactRowCount) {
    }

    private record ParityExpectation(String masterType,
                                     long rowCount,
                                     String sampleCode,
                                     String sampleName,
                                     String sampleValidFrom,
                                     String sampleValidTo) {
    }

    private record CanonicalRow(String masterType,
                                String code,
                                String name,
                                String validFrom,
                                String validTo) {
    }

    private record ArtifactSummary(long rowCount,
                                   Map<String, Long> counts,
                                   Map<String, CanonicalRow> rowsByTypeAndCode) {

        static ArtifactSummary fromArtifact(Path artifactPath) {
            if (artifactPath == null || !Files.exists(artifactPath)) {
                throw new ParityVerificationException("canonical artifact が見つかりません。");
            }
            Path fileNamePath = artifactPath.getFileName();
            if (fileNamePath == null) {
                throw new ParityVerificationException("canonical artifact path が不正です。");
            }
            String fileName = fileNamePath.toString();
            String lowered = fileName.toLowerCase(Locale.ROOT);
            try {
                if (lowered.endsWith(".zip")) {
                    return fromZip(artifactPath);
                }
                if (lowered.endsWith(".gz")) {
                    try (GZIPInputStream gzip = new GZIPInputStream(Files.newInputStream(artifactPath));
                         BufferedReader reader = new BufferedReader(new InputStreamReader(gzip, StandardCharsets.UTF_8))) {
                        return fromCsv(reader);
                    }
                }
                try (BufferedReader reader = Files.newBufferedReader(artifactPath, StandardCharsets.UTF_8)) {
                    return fromCsv(reader);
                }
            } catch (ParityVerificationException ex) {
                throw ex;
            } catch (IOException | RuntimeException ex) {
                throw new ParityVerificationException("canonical artifact の形式が不正です。");
            }
        }

        private static ArtifactSummary fromZip(Path artifactPath) throws IOException {
            byte[] csvPayload = null;
            try (ZipInputStream zip = new ZipInputStream(Files.newInputStream(artifactPath), StandardCharsets.UTF_8)) {
                ZipEntry entry;
                while ((entry = zip.getNextEntry()) != null) {
                    if (!entry.isDirectory()
                            && LocalOrcaMasterCacheArtifactSpec.CANONICAL_CSV_PATH.equals(entry.getName())) {
                        csvPayload = zip.readAllBytes();
                    }
                }
            }
            if (csvPayload == null) {
                throw new ParityVerificationException("canonical CSV が artifact に含まれていません。");
            }
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                    new ByteArrayInputStream(csvPayload), StandardCharsets.UTF_8))) {
                return fromCsv(reader);
            }
        }

        private static ArtifactSummary fromCsv(BufferedReader reader) throws IOException {
            String headerLine = reader.readLine();
            if (headerLine == null || headerLine.isBlank()) {
                throw new ParityVerificationException("canonical CSV が空です。");
            }
            Map<String, Integer> headers = canonicalHeaderIndex(
                    LocalOrcaMasterCacheArtifactBuilder.parseCsvLine(headerLine));
            Map<String, Long> counts = new LinkedHashMap<>();
            Map<String, CanonicalRow> rows = new LinkedHashMap<>();
            long rowCount = 0L;
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank() || line.stripLeading().startsWith("#")) {
                    continue;
                }
                List<String> values = LocalOrcaMasterCacheArtifactBuilder.parseCsvLine(line);
                String recordType = normalize(value(headers, values, "recordType"));
                String masterType = masterTypeFor(recordType, values, headers);
                String code = codeFor(recordType, values, headers);
                String name = value(headers, values, "name");
                CanonicalRow row = new CanonicalRow(
                        masterType,
                        code,
                        name,
                        value(headers, values, "validFrom"),
                        value(headers, values, "validTo"));
                counts.merge(masterType, 1L, Long::sum);
                rows.putIfAbsent(masterType + "\u0000" + code, row);
                rowCount++;
            }
            return new ArtifactSummary(rowCount, counts, rows);
        }

        private static Map<String, Integer> canonicalHeaderIndex(List<String> headers) {
            Map<String, Integer> index = new LinkedHashMap<>();
            for (int i = 0; i < headers.size(); i++) {
                index.put(normalize(headers.get(i)), i);
            }
            for (String required : LocalOrcaMasterCacheArtifactSpec.CANONICAL_HEADERS) {
                if (!index.containsKey(normalize(required))) {
                    throw new ParityVerificationException("canonical CSV の必須 header が不足しています。");
                }
            }
            return index;
        }

        private static String masterTypeFor(String recordType, List<String> values, Map<String, Integer> headers) {
            return switch (recordType) {
                case "entry" -> value(headers, values, "masterType");
                case "inputset", "inputsetitem" -> "order-inputsets";
                case "interaction" -> "order-interactions";
                default -> throw new ParityVerificationException("canonical CSV の recordType が不正です。");
            };
        }

        private static String codeFor(String recordType, List<String> values, Map<String, Integer> headers) {
            if ("inputset".equals(recordType)) {
                return value(headers, values, "setCode");
            }
            return value(headers, values, "code");
        }
    }

    public static final class ParityVerificationException extends RuntimeException {
        ParityVerificationException(String message) {
            super(message);
        }
    }
}
