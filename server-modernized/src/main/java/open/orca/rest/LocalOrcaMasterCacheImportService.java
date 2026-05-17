package open.orca.rest;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import jakarta.transaction.Transactional;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Reader;
import java.math.BigDecimal;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.zip.GZIPInputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import open.dolphin.rest.masterupdate.MasterUpdateService;
import open.orca.master.LocalOrcaMasterCacheArtifactSpec;

/**
 * Import boundary for the OpenDolphin local ORCA-equivalent master cache.
 *
 * <p>This importer writes candidate/search projection rows only. It does not make ORCA code authority,
 * ORCA send success, billing completion, chart finalization, or prescription finalization decisions.</p>
 */
@ApplicationScoped
public class LocalOrcaMasterCacheImportService {

    public static final String DATASET_CODE = "local_orca_master_cache";

    private static final String SOURCE_SYSTEM = "OpenDolphinLocalMasterCache";
    private static final String DEFAULT_VALID_FROM = "00000000";
    private static final String DEFAULT_VALID_TO = "99991231";
    private static final String DEFAULT_MASTER_VERSION = "local-cache-import";
    private static final long MAX_EXTRACTED_BUNDLE_BYTES = 120L * 1024L * 1024L;
    private static final int MAX_BUNDLE_ENTRIES = 128;
    private static final ObjectMapper JSON = new ObjectMapper();

    private static final Set<String> REQUIRED_MASTER_TYPES = LocalOrcaMasterCacheArtifactSpec.REQUIRED_MASTER_TYPES;

    private static final Set<String> REQUIRED_CANONICAL_HEADERS =
            LocalOrcaMasterCacheArtifactSpec.CANONICAL_HEADERS.stream()
                    .map(LocalOrcaMasterCacheImportService::normalize)
                    .collect(java.util.stream.Collectors.toUnmodifiableSet());

    @PersistenceContext(unitName = "opendolphinPU")
    private EntityManager entityManager;

    public LocalOrcaMasterCacheImportService() {
    }

    LocalOrcaMasterCacheImportService(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    public boolean supportsDataset(String datasetCode) {
        return DATASET_CODE.equals(normalize(datasetCode));
    }

    public PreviewResult previewArtifact(String datasetCode,
                                         Path artifactPath,
                                         String uploadedSha256,
                                         String runId) {
        if (!supportsDataset(datasetCode)) {
            throw new MasterUpdateService.MasterUpdateException(404, "local_master_cache_dataset_unsupported",
                    "local master cache import 対象外のデータセットです。");
        }
        if (artifactPath == null || !Files.exists(artifactPath)) {
            throw new MasterUpdateService.MasterUpdateException(400, "local_master_cache_artifact_missing",
                    "local master cache import の入力ファイルが見つかりません。");
        }
        String extension = extensionOf(artifactPath);
        if (!("zip".equals(extension) || "csv".equals(extension) || "txt".equals(extension) || "gz".equals(extension))) {
            throw new MasterUpdateService.MasterUpdateException(415, "local_master_cache_format_unsupported",
                    "local master cache import は CSV / ZIP / GZIP 形式のみ対応しています。");
        }
        ParsedImport parsed = parseArtifact(artifactPath, extension);
        if (parsed.importedRows() == 0) {
            throw new MasterUpdateService.MasterUpdateException(422, "local_master_cache_empty",
                    "local master cache import に反映可能な行がありません。");
        }
        parsed.requireAllMasterTypes();
        List<String> warnings = new ArrayList<>();
        if (!"zip".equals(extension)) {
            warnings.add("production では manifest 付き ZIP を使用してください。");
        }
        return new PreviewResult(
                true,
                uploadedSha256,
                parsed.importedRows(),
                parsed.affectedMasterTypes(),
                parsed.masterTypeCounts(),
                parsed.manifestSummary(),
                warnings,
                runId
        );
    }

    @Transactional
    public ImportResult importArtifact(String datasetCode,
                                       Path artifactPath,
                                       String sourceUrl,
                                       String triggerType,
                                       String runId) {
        if (!supportsDataset(datasetCode)) {
            throw new MasterUpdateService.MasterUpdateException(404, "local_master_cache_dataset_unsupported",
                    "local master cache import 対象外のデータセットです。");
        }
        if (artifactPath == null || !Files.exists(artifactPath)) {
            throw new MasterUpdateService.MasterUpdateException(400, "local_master_cache_artifact_missing",
                    "local master cache import の入力ファイルが見つかりません。");
        }
        String extension = extensionOf(artifactPath);
        if (!("csv".equals(extension) || "txt".equals(extension) || "zip".equals(extension) || "gz".equals(extension))) {
            throw new MasterUpdateService.MasterUpdateException(415, "local_master_cache_format_unsupported",
                    "local master cache import は CSV / ZIP / GZIP 形式のみ対応しています。");
        }

        ParsedImport parsed = parseArtifact(artifactPath, extension);
        if (parsed.importedRows() == 0) {
            throw new MasterUpdateService.MasterUpdateException(422, "local_master_cache_empty",
                    "local master cache import に反映可能な行がありません。");
        }
        parsed.requireAllMasterTypes();

        Instant importedAt = Instant.now();
        String sourceKind = resolveSourceKind(sourceUrl, triggerType);
        String sourceApi = resolveSourceApi(sourceUrl);
        String sourceFile = resolveSourceFile(sourceUrl, artifactPath, triggerType);

        try {
            applyImport(parsed, sourceKind, sourceApi, sourceFile, importedAt);
        } catch (MasterUpdateService.MasterUpdateException ex) {
            throw ex;
        } catch (RuntimeException ex) {
            throw new MasterUpdateService.MasterUpdateException(500, "local_master_cache_import_failed",
                    "local master cache import に失敗しました。");
        }

        return new ImportResult(parsed.importedRows(), parsed.affectedMasterTypes(),
                "local master cache rows imported", runId);
    }

    private void applyImport(ParsedImport parsed,
                             String sourceKind,
                             String sourceApi,
                             String sourceFile,
                             Instant importedAt) {
        for (String masterType : parsed.affectedMasterTypes()) {
            MasterTypeMetadata metadata = parsed.metadata(masterType);
            upsertDataset(masterType, sourceKind, sourceApi, sourceFile, metadata, importedAt);
        }

        for (String masterType : parsed.entryMasterTypes()) {
            deleteEntries(masterType);
        }
        for (EntryRecord entry : parsed.entries()) {
            insertEntry(entry);
        }

        if (parsed.hasInputSets()) {
            execute("DELETE FROM opendolphin.local_orca_master_inputset_item");
            execute("DELETE FROM opendolphin.local_orca_master_inputset");
            for (InputSetRecord inputSet : parsed.inputSets()) {
                insertInputSet(inputSet);
            }
            for (InputSetItemRecord item : parsed.inputSetItems()) {
                insertInputSetItem(item);
            }
        }

        if (parsed.hasInteractions()) {
            execute("DELETE FROM opendolphin.local_orca_master_interaction");
            for (InteractionRecord interaction : parsed.interactions()) {
                insertInteraction(interaction);
            }
        }
    }

    private void upsertDataset(String masterType,
                               String sourceKind,
                               String sourceApi,
                               String sourceFile,
                               MasterTypeMetadata metadata,
                               Instant importedAt) {
        String sql = "INSERT INTO opendolphin.local_orca_master_dataset ("
                + "master_type, source_system, source_kind, source_api, source_file, master_version, "
                + "effective_from, effective_to, imported_at, stale, unavailable_reason, cache_status, read_only) "
                + "VALUES (:masterType, :sourceSystem, :sourceKind, :sourceApi, :sourceFile, :masterVersion, "
                + ":effectiveFrom, :effectiveTo, :importedAt, FALSE, NULL, 'CURRENT', TRUE) "
                + "ON CONFLICT (master_type) DO UPDATE SET "
                + "source_system = EXCLUDED.source_system, source_kind = EXCLUDED.source_kind, "
                + "source_api = EXCLUDED.source_api, source_file = EXCLUDED.source_file, "
                + "master_version = EXCLUDED.master_version, effective_from = EXCLUDED.effective_from, "
                + "effective_to = EXCLUDED.effective_to, imported_at = EXCLUDED.imported_at, "
                + "stale = FALSE, unavailable_reason = NULL, cache_status = 'CURRENT', read_only = TRUE";
        entityManager().createNativeQuery(sql)
                .setParameter("masterType", masterType)
                .setParameter("sourceSystem", SOURCE_SYSTEM)
                .setParameter("sourceKind", sourceKind)
                .setParameter("sourceApi", sourceApi)
                .setParameter("sourceFile", sourceFile)
                .setParameter("masterVersion", metadata.masterVersion())
                .setParameter("effectiveFrom", metadata.effectiveFrom())
                .setParameter("effectiveTo", metadata.effectiveTo())
                .setParameter("importedAt", Timestamp.from(importedAt))
                .executeUpdate();
    }

    private void deleteEntries(String masterType) {
        entityManager().createNativeQuery(
                        "DELETE FROM opendolphin.local_orca_master_entry WHERE master_type = :masterType")
                .setParameter("masterType", masterType)
                .executeUpdate();
    }

    private void insertEntry(EntryRecord entry) {
        String sql = "INSERT INTO opendolphin.local_orca_master_entry ("
                + "master_type, code, name, kana, category, unit, price, valid_from, valid_to, "
                + "master_version, note, search_text, payload_json, read_only) "
                + "VALUES (:masterType, :code, :name, :kana, :category, :unit, :price, :validFrom, :validTo, "
                + ":masterVersion, :note, lower(:searchText), CAST(:payloadJson AS jsonb), TRUE) "
                + "ON CONFLICT (master_type, code, valid_from, valid_to) DO UPDATE SET "
                + "name = EXCLUDED.name, kana = EXCLUDED.kana, category = EXCLUDED.category, "
                + "unit = EXCLUDED.unit, price = EXCLUDED.price, master_version = EXCLUDED.master_version, "
                + "note = EXCLUDED.note, search_text = EXCLUDED.search_text, "
                + "payload_json = EXCLUDED.payload_json, read_only = TRUE";
        bindEntry(entityManager().createNativeQuery(sql), entry).executeUpdate();
    }

    private Query bindEntry(Query query, EntryRecord entry) {
        return query
                .setParameter("masterType", entry.masterType())
                .setParameter("code", entry.code())
                .setParameter("name", entry.name())
                .setParameter("kana", blankToNull(entry.kana()))
                .setParameter("category", blankToNull(entry.category()))
                .setParameter("unit", blankToNull(entry.unit()))
                .setParameter("price", decimalOrNull(entry.price()))
                .setParameter("validFrom", entry.validFrom())
                .setParameter("validTo", entry.validTo())
                .setParameter("masterVersion", entry.masterVersion())
                .setParameter("note", blankToNull(entry.note()))
                .setParameter("searchText", entry.searchText())
                .setParameter("payloadJson", safeJson(entry.payloadJson()));
    }

    private void insertInputSet(InputSetRecord inputSet) {
        String sql = "INSERT INTO opendolphin.local_orca_master_inputset ("
                + "set_code, name, entity, kind, class_code, class_name, item_count, valid_from, valid_to, "
                + "master_version, search_text, read_only) "
                + "VALUES (:setCode, :name, :entity, :kind, :classCode, :className, :itemCount, :validFrom, :validTo, "
                + ":masterVersion, lower(:searchText), TRUE) "
                + "ON CONFLICT (set_code) DO UPDATE SET "
                + "name = EXCLUDED.name, entity = EXCLUDED.entity, kind = EXCLUDED.kind, "
                + "class_code = EXCLUDED.class_code, class_name = EXCLUDED.class_name, "
                + "item_count = EXCLUDED.item_count, valid_from = EXCLUDED.valid_from, valid_to = EXCLUDED.valid_to, "
                + "master_version = EXCLUDED.master_version, search_text = EXCLUDED.search_text, read_only = TRUE";
        entityManager().createNativeQuery(sql)
                .setParameter("setCode", inputSet.setCode())
                .setParameter("name", inputSet.name())
                .setParameter("entity", blankToNull(inputSet.entity()))
                .setParameter("kind", blankToNull(inputSet.kind()))
                .setParameter("classCode", blankToNull(inputSet.classCode()))
                .setParameter("className", blankToNull(inputSet.className()))
                .setParameter("itemCount", inputSet.itemCount())
                .setParameter("validFrom", inputSet.validFrom())
                .setParameter("validTo", inputSet.validTo())
                .setParameter("masterVersion", inputSet.masterVersion())
                .setParameter("searchText", inputSet.searchText())
                .executeUpdate();
    }

    private void insertInputSetItem(InputSetItemRecord item) {
        String sql = "INSERT INTO opendolphin.local_orca_master_inputset_item ("
                + "set_code, seq, code, name, quantity, unit, memo, row_role, row_subtype, category, "
                + "valid_from, valid_to, read_only) "
                + "VALUES (:setCode, :seq, :code, :name, :quantity, :unit, :memo, :rowRole, :rowSubtype, :category, "
                + ":validFrom, :validTo, TRUE) "
                + "ON CONFLICT (set_code, seq) DO UPDATE SET "
                + "code = EXCLUDED.code, name = EXCLUDED.name, quantity = EXCLUDED.quantity, unit = EXCLUDED.unit, "
                + "memo = EXCLUDED.memo, row_role = EXCLUDED.row_role, row_subtype = EXCLUDED.row_subtype, "
                + "category = EXCLUDED.category, valid_from = EXCLUDED.valid_from, valid_to = EXCLUDED.valid_to, "
                + "read_only = TRUE";
        entityManager().createNativeQuery(sql)
                .setParameter("setCode", item.setCode())
                .setParameter("seq", item.seq())
                .setParameter("code", item.code())
                .setParameter("name", item.name())
                .setParameter("quantity", blankToNull(item.quantity()))
                .setParameter("unit", blankToNull(item.unit()))
                .setParameter("memo", blankToNull(item.memo()))
                .setParameter("rowRole", firstNonBlank(item.rowRole(), "main"))
                .setParameter("rowSubtype", blankToNull(item.rowSubtype()))
                .setParameter("category", blankToNull(item.category()))
                .setParameter("validFrom", item.validFrom())
                .setParameter("validTo", item.validTo())
                .executeUpdate();
    }

    private void insertInteraction(InteractionRecord interaction) {
        String sql = "INSERT INTO opendolphin.local_orca_master_interaction ("
                + "code1, code2, interaction_code, interaction_name, message, valid_from, valid_to, master_version, read_only) "
                + "VALUES (:code1, :code2, :interactionCode, :interactionName, :message, "
                + ":validFrom, :validTo, :masterVersion, TRUE) "
                + "ON CONFLICT (code1, code2, interaction_code) DO UPDATE SET "
                + "interaction_name = EXCLUDED.interaction_name, message = EXCLUDED.message, "
                + "valid_from = EXCLUDED.valid_from, valid_to = EXCLUDED.valid_to, "
                + "master_version = EXCLUDED.master_version, read_only = TRUE";
        entityManager().createNativeQuery(sql)
                .setParameter("code1", interaction.code1())
                .setParameter("code2", interaction.code2())
                .setParameter("interactionCode", blankToNull(interaction.interactionCode()))
                .setParameter("interactionName", blankToNull(interaction.interactionName()))
                .setParameter("message", blankToNull(interaction.message()))
                .setParameter("validFrom", interaction.validFrom())
                .setParameter("validTo", interaction.validTo())
                .setParameter("masterVersion", interaction.masterVersion())
                .executeUpdate();
    }

    private void execute(String sql) {
        entityManager().createNativeQuery(sql).executeUpdate();
    }

    private ParsedImport parseArtifact(Path artifactPath, String extension) {
        if ("zip".equals(extension)) {
            return parseZip(artifactPath);
        }
        if ("gz".equals(extension)) {
            return parseGzipCsv(artifactPath);
        }
        ParsedImport parsed = new ParsedImport();
        try (BufferedReader reader = Files.newBufferedReader(artifactPath, StandardCharsets.UTF_8)) {
            parseCsv(reader, parsed);
            parsed.validate();
            return parsed;
        } catch (MasterUpdateService.MasterUpdateException ex) {
            throw ex;
        } catch (IOException ex) {
            throw new MasterUpdateService.MasterUpdateException(500, "local_master_cache_read_failed",
                    "local master cache import の入力ファイルを読めませんでした。");
        } catch (RuntimeException ex) {
            throw new MasterUpdateService.MasterUpdateException(422, "local_master_cache_invalid_csv",
                    "local master cache import の CSV 形式が不正です。");
        }
    }

    private ParsedImport parseGzipCsv(Path artifactPath) {
        ParsedImport parsed = new ParsedImport();
        try (GZIPInputStream gzip = new GZIPInputStream(Files.newInputStream(artifactPath));
             BufferedReader reader = new BufferedReader(new InputStreamReader(gzip, StandardCharsets.UTF_8))) {
            parseCsv(reader, parsed);
            parsed.validate();
            return parsed;
        } catch (MasterUpdateService.MasterUpdateException ex) {
            throw ex;
        } catch (IOException ex) {
            throw new MasterUpdateService.MasterUpdateException(500, "local_master_cache_read_failed",
                    "local master cache import の入力ファイルを読めませんでした。");
        } catch (RuntimeException ex) {
            throw new MasterUpdateService.MasterUpdateException(422, "local_master_cache_invalid_csv",
                    "local master cache import の CSV 形式が不正です。");
        }
    }

    private ParsedImport parseZip(Path artifactPath) {
        ParsedImport parsed = new ParsedImport();
        int entryCount = 0;
        long extractedBytes = 0L;
        byte[] manifestPayload = null;
        Map<String, ZipCsvMetadata> csvMetadata = new LinkedHashMap<>();
        try (ZipInputStream zip = new ZipInputStream(Files.newInputStream(artifactPath), StandardCharsets.UTF_8)) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (entry.isDirectory()) {
                    continue;
                }
                entryCount++;
                if (entryCount > MAX_BUNDLE_ENTRIES) {
                    throw invalidCsv();
                }
                String name = entry.getName() != null ? entry.getName() : "";
                String lowered = name.toLowerCase(Locale.ROOT);
                if (LocalOrcaMasterCacheArtifactSpec.MANIFEST_PATH.equals(name)) {
                    manifestPayload = readZipEntry(zip, MAX_EXTRACTED_BUNDLE_BYTES - extractedBytes);
                    extractedBytes += manifestPayload.length;
                    continue;
                }
                if (!(lowered.endsWith(".csv") || lowered.endsWith(".txt"))) {
                    extractedBytes += drainZipEntry(zip, MAX_EXTRACTED_BUNDLE_BYTES - extractedBytes);
                    continue;
                }
                byte[] payload = readZipEntry(zip, MAX_EXTRACTED_BUNDLE_BYTES - extractedBytes);
                extractedBytes += payload.length;
                csvMetadata.put(name, new ZipCsvMetadata(sha256(payload), payload.length));
                try (Reader stringReader = new InputStreamReader(new ByteArrayInputStream(payload), StandardCharsets.UTF_8);
                     BufferedReader reader = new BufferedReader(stringReader)) {
                    parseCsv(reader, parsed);
                }
            }
            parsed.validate();
            parsed.manifestSummary(validateManifest(manifestPayload, csvMetadata, parsed));
            return parsed;
        } catch (MasterUpdateService.MasterUpdateException ex) {
            throw ex;
        } catch (IOException ex) {
            throw new MasterUpdateService.MasterUpdateException(500, "local_master_cache_read_failed",
                    "local master cache import の入力ファイルを読めませんでした。");
        } catch (RuntimeException ex) {
            throw new MasterUpdateService.MasterUpdateException(422, "local_master_cache_invalid_csv",
                    "local master cache import の CSV 形式が不正です。");
        }
    }

    private static ManifestSummary validateManifest(byte[] manifestPayload,
                                                    Map<String, ZipCsvMetadata> csvMetadata,
                                                    ParsedImport parsed) {
        if (manifestPayload == null || manifestPayload.length == 0) {
            throw manifestInvalid();
        }
        try {
            JsonNode root = JSON.readTree(manifestPayload);
            if (!root.isObject()) {
                throw manifestInvalid();
            }
            if (!LocalOrcaMasterCacheArtifactSpec.SCHEMA_VERSION.equals(text(root, "schemaVersion"))) {
                throw manifestInvalid();
            }
            if (!LocalOrcaMasterCacheArtifactSpec.CANONICAL_CSV_PATH.equals(text(root, "artifactFile"))) {
                throw manifestInvalid();
            }
            JsonNode requiredTypes = root.get("requiredMasterTypes");
            if (requiredTypes == null || !requiredTypes.isArray()) {
                throw manifestInvalid();
            }
            Set<String> declaredTypes = new LinkedHashSet<>();
            requiredTypes.forEach(node -> declaredTypes.add(normalize(node.asText())));
            if (!declaredTypes.containsAll(REQUIRED_MASTER_TYPES)) {
                throw manifestInvalid();
            }
            validateManifestCounts(root.get("masterTypeCounts"), parsed);
            validateManifestFiles(root.get("files"), csvMetadata);
            return new ManifestSummary(
                    text(root, "sourceKind"),
                    text(root, "sourceId"),
                    text(root, "masterVersion"),
                    text(root, "generatedAt"),
                    text(root, "artifactSha256")
            );
        } catch (MasterUpdateService.MasterUpdateException ex) {
            throw ex;
        } catch (IOException | RuntimeException ex) {
            throw manifestInvalid();
        }
    }

    private static void validateManifestCounts(JsonNode countsNode, ParsedImport parsed) {
        if (countsNode == null || !countsNode.isObject()) {
            throw manifestInvalid();
        }
        for (String masterType : REQUIRED_MASTER_TYPES) {
            JsonNode countNode = countsNode.get(masterType);
            if (countNode == null || !countNode.canConvertToLong()
                    || countNode.asLong() != parsed.masterTypeRowCount(masterType)) {
                throw manifestInvalid();
            }
        }
    }

    private static void validateManifestFiles(JsonNode filesNode, Map<String, ZipCsvMetadata> csvMetadata) {
        if (filesNode == null || !filesNode.isArray() || filesNode.isEmpty()) {
            throw manifestInvalid();
        }
        boolean canonicalCsvDeclared = false;
        for (JsonNode fileNode : filesNode) {
            String path = text(fileNode, "path");
            String declaredHash = text(fileNode, "sha256");
            JsonNode bytesNode = fileNode.get("bytes");
            ZipCsvMetadata actual = csvMetadata.get(path);
            if (actual == null || declaredHash == null || !declaredHash.equals(actual.sha256())
                    || bytesNode == null || !bytesNode.canConvertToLong()
                    || bytesNode.asLong() != actual.bytes()) {
                throw manifestInvalid();
            }
            if (LocalOrcaMasterCacheArtifactSpec.CANONICAL_CSV_PATH.equals(path)) {
                canonicalCsvDeclared = true;
            }
        }
        if (!canonicalCsvDeclared) {
            throw manifestInvalid();
        }
    }

    private void parseCsv(BufferedReader reader, ParsedImport parsed) throws IOException {
        if (parsed == null) {
            throw invalidCsv();
        }
        String headerLine = reader.readLine();
        if (headerLine == null || headerLine.isBlank()) {
            throw new MasterUpdateService.MasterUpdateException(422, "local_master_cache_empty",
                    "local master cache import に反映可能な行がありません。");
        }
        List<String> headers = parseCsvLine(headerLine);
        Map<String, Integer> headerIndex = headerIndex(headers);
        String line;
        int lineNumber = 1;
        while ((line = reader.readLine()) != null) {
            lineNumber++;
            if (line.isBlank() || line.stripLeading().startsWith("#")) {
                continue;
            }
            List<String> values = parseCsvLine(line);
            CsvRow row = new CsvRow(headerIndex, values, lineNumber);
            parseRow(parsed, row);
        }
    }

    private void parseRow(ParsedImport parsed, CsvRow row) {
        String recordType = normalize(row.value("recordType"));
        if (recordType == null) {
            return;
        }
        switch (recordType) {
            case "entry" -> parsed.addEntry(toEntry(row));
            case "inputset" -> parsed.addInputSet(toInputSet(row));
            case "inputsetitem" -> parsed.addInputSetItem(toInputSetItem(row));
            case "interaction" -> parsed.addInteraction(toInteraction(row));
            default -> throw invalidCsv();
        }
    }

    private EntryRecord toEntry(CsvRow row) {
        String masterType = require(row, "masterType");
        String code = require(row, "code");
        String name = require(row, "name");
        String validFrom = validDate(row.value("validFrom"), DEFAULT_VALID_FROM);
        String validTo = validDate(row.value("validTo"), DEFAULT_VALID_TO);
        String masterVersion = firstNonBlank(row.value("masterVersion"), DEFAULT_MASTER_VERSION);
        String searchText = firstNonBlank(row.value("searchText"), joinSearchText(code, name, row.value("kana")));
        return new EntryRecord(masterType, code, name, row.value("kana"), row.value("category"), row.value("unit"),
                row.value("price"), validFrom, validTo, masterVersion, row.value("note"), searchText,
                row.value("payloadJson"));
    }

    private InputSetRecord toInputSet(CsvRow row) {
        String setCode = require(row, "setCode");
        String name = require(row, "name");
        String validFrom = validDate(row.value("validFrom"), DEFAULT_VALID_FROM);
        String validTo = validDate(row.value("validTo"), DEFAULT_VALID_TO);
        String masterVersion = firstNonBlank(row.value("masterVersion"), DEFAULT_MASTER_VERSION);
        String searchText = firstNonBlank(row.value("searchText"), joinSearchText(setCode, name, row.value("className")));
        int itemCount = integerOrDefault(row.value("itemCount"), 0);
        return new InputSetRecord(setCode, name, row.value("entity"), row.value("kind"), row.value("classCode"),
                row.value("className"), itemCount, validFrom, validTo, masterVersion, searchText);
    }

    private InputSetItemRecord toInputSetItem(CsvRow row) {
        String setCode = require(row, "setCode");
        int seq = integerOrDefault(require(row, "seq"), 1);
        String validFrom = validDate(row.value("validFrom"), DEFAULT_VALID_FROM);
        String validTo = validDate(row.value("validTo"), DEFAULT_VALID_TO);
        return new InputSetItemRecord(setCode, seq, require(row, "code"), require(row, "name"),
                row.value("quantity"), row.value("unit"), row.value("memo"), row.value("rowRole"),
                row.value("rowSubtype"), row.value("category"), validFrom, validTo);
    }

    private InteractionRecord toInteraction(CsvRow row) {
        String validFrom = validDate(row.value("validFrom"), DEFAULT_VALID_FROM);
        String validTo = validDate(row.value("validTo"), DEFAULT_VALID_TO);
        String masterVersion = firstNonBlank(row.value("masterVersion"), DEFAULT_MASTER_VERSION);
        return new InteractionRecord(require(row, "code"), require(row, "code2"), row.value("interactionCode"),
                row.value("interactionName"), row.value("message"), validFrom, validTo, masterVersion);
    }

    private static List<String> parseCsvLine(String line) {
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
                continue;
            }
            if (ch == '"') {
                quoted = true;
            } else if (ch == ',') {
                values.add(current.toString().trim());
                current.setLength(0);
            } else {
                current.append(ch);
            }
        }
        values.add(current.toString().trim());
        if (quoted) {
            throw invalidCsv();
        }
        return values;
    }

    private static Map<String, Integer> headerIndex(List<String> headers) {
        Map<String, Integer> index = new LinkedHashMap<>();
        for (int i = 0; i < headers.size(); i++) {
            String key = normalize(headers.get(i));
            if (key != null) {
                index.put(key, i);
            }
        }
        if (!index.containsKey("recordtype")) {
            throw invalidCsv();
        }
        if (!index.keySet().containsAll(REQUIRED_CANONICAL_HEADERS)) {
            throw invalidCsv();
        }
        return index;
    }

    private static String require(CsvRow row, String name) {
        String value = row.value(name);
        if (value == null || value.isBlank()) {
            throw invalidCsv();
        }
        return value.trim();
    }

    private static String validDate(String value, String fallback) {
        String trimmed = value != null ? value.trim() : "";
        if (trimmed.matches("\\d{8}")) {
            return trimmed;
        }
        return fallback;
    }

    private static BigDecimal decimalOrNull(String value) {
        String trimmed = value != null ? value.trim() : "";
        if (trimmed.isEmpty()) {
            return null;
        }
        try {
            return new BigDecimal(trimmed);
        } catch (NumberFormatException ex) {
            throw invalidCsv();
        }
    }

    private static int integerOrDefault(String value, int fallback) {
        String trimmed = value != null ? value.trim() : "";
        if (trimmed.isEmpty()) {
            return fallback;
        }
        try {
            return Integer.parseInt(trimmed);
        } catch (NumberFormatException ex) {
            throw invalidCsv();
        }
    }

    private static String safeJson(String value) {
        String trimmed = value != null ? value.trim() : "";
        if (trimmed.isEmpty()) {
            return "{}";
        }
        if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
            throw invalidCsv();
        }
        try {
            JSON.readTree(trimmed);
        } catch (IOException ex) {
            throw invalidCsv();
        }
        return trimmed;
    }

    private static byte[] readZipEntry(ZipInputStream zip, long remainingBudget) throws IOException {
        if (remainingBudget <= 0L) {
            throw invalidCsv();
        }
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        long size = 0L;
        int read;
        while ((read = zip.read(buffer)) != -1) {
            size += read;
            if (size > remainingBudget) {
                throw invalidCsv();
            }
            output.write(buffer, 0, read);
        }
        return output.toByteArray();
    }

    private static long drainZipEntry(ZipInputStream zip, long remainingBudget) throws IOException {
        if (remainingBudget <= 0L) {
            throw invalidCsv();
        }
        byte[] buffer = new byte[8192];
        long size = 0L;
        int read;
        while ((read = zip.read(buffer)) != -1) {
            size += read;
            if (size > remainingBudget) {
                throw invalidCsv();
            }
            // drain entry
        }
        return size;
    }

    private static String sha256(byte[] payload) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(payload));
        } catch (Exception ex) {
            throw manifestInvalid();
        }
    }

    private static String text(JsonNode node, String fieldName) {
        if (node == null || fieldName == null) {
            return null;
        }
        JsonNode field = node.get(fieldName);
        if (field == null || !field.isTextual()) {
            return null;
        }
        String value = field.asText();
        return value != null ? value.trim() : null;
    }

    private static String extensionOf(Path path) {
        Path fileNamePath = path.getFileName();
        String fileName = fileNamePath != null ? fileNamePath.toString() : "";
        int dot = fileName.lastIndexOf('.');
        if (dot < 0 || dot == fileName.length() - 1) {
            return "";
        }
        return fileName.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private static String resolveSourceKind(String sourceUrl, String triggerType) {
        if ("UPLOAD".equalsIgnoreCase(triggerType)) {
            return "manual-upload";
        }
        String source = sourceUrl != null ? sourceUrl.trim().toLowerCase(Locale.ROOT) : "";
        if (source.startsWith("classpath:")) {
            return "fixture-dev";
        }
        if (source.startsWith("orca:")) {
            return "official-api";
        }
        return "official-file";
    }

    private static String resolveSourceApi(String sourceUrl) {
        String source = sourceUrl != null ? sourceUrl.trim() : "";
        if (source.startsWith("orca:")) {
            return truncate(source, 256);
        }
        if (source.startsWith("http://") || source.startsWith("https://")) {
            return truncate(sanitizeUri(source), 256);
        }
        return null;
    }

    private static String resolveSourceFile(String sourceUrl, Path artifactPath, String triggerType) {
        String source = sourceUrl != null ? sourceUrl.trim() : "";
        if (source.startsWith("classpath:")) {
            return truncate(source, 256);
        }
        Path fileNamePath = artifactPath != null ? artifactPath.getFileName() : null;
        if ("UPLOAD".equalsIgnoreCase(triggerType) && fileNamePath != null) {
            return truncate(fileNamePath.toString(), 256);
        }
        if (fileNamePath != null) {
            return truncate(fileNamePath.toString(), 256);
        }
        return null;
    }

    static String sanitizeUri(String source) {
        try {
            URI uri = URI.create(source);
            String scheme = uri.getScheme();
            String host = uri.getHost();
            if (scheme == null || host == null) {
                return truncate(source.split("\\?", 2)[0], 256);
            }
            int port = uri.getPort();
            String path = uri.getRawPath();
            StringBuilder sanitized = new StringBuilder();
            sanitized.append(scheme).append("://").append(host);
            if (port >= 0) {
                sanitized.append(':').append(port);
            }
            if (path != null) {
                sanitized.append(path);
            }
            return sanitized.toString();
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static String joinSearchText(String... values) {
        StringBuilder text = new StringBuilder();
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                if (text.length() > 0) {
                    text.append(' ');
                }
                text.append(value.trim());
            }
        }
        return text.toString();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String firstNonBlank(String first, String fallback) {
        return first != null && !first.isBlank() ? first.trim() : fallback;
    }

    private static String normalize(String value) {
        String trimmed = value != null ? value.trim() : "";
        return trimmed.isEmpty() ? null : trimmed.toLowerCase(Locale.ROOT);
    }

    private static String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }

    private static MasterUpdateService.MasterUpdateException invalidCsv() {
        return new MasterUpdateService.MasterUpdateException(422, "local_master_cache_invalid_csv",
                "local master cache import の CSV 形式が不正です。");
    }

    private static MasterUpdateService.MasterUpdateException manifestInvalid() {
        return new MasterUpdateService.MasterUpdateException(422, "local_master_cache_manifest_invalid",
                "local master cache import の manifest が不正です。");
    }

    private EntityManager entityManager() {
        if (entityManager == null) {
            throw new MasterUpdateService.MasterUpdateException(503, "local_master_cache_backend_unavailable",
                    "local master cache import backend が利用できません。");
        }
        return entityManager;
    }

    public static final class ImportResult {
        private final long importedRows;
        private final List<String> affectedMasterTypes;
        private final String summary;
        private final String runId;

        ImportResult(long importedRows, Set<String> affectedMasterTypes, String summary, String runId) {
            this.importedRows = importedRows;
            this.affectedMasterTypes = List.copyOf(affectedMasterTypes);
            this.summary = summary;
            this.runId = runId;
        }

        public long importedRows() {
            return importedRows;
        }

        public List<String> affectedMasterTypes() {
            return affectedMasterTypes;
        }

        public String summary() {
            return summary;
        }

        public Map<String, Object> toMap() {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("runId", runId);
            body.put("importedRows", importedRows);
            body.put("affectedMasterTypes", affectedMasterTypes);
            body.put("summary", summary);
            return body;
        }
    }

    public static final class PreviewResult {
        private final boolean importable;
        private final String uploadedSha256;
        private final long importedRows;
        private final List<String> affectedMasterTypes;
        private final Map<String, Long> masterTypeCounts;
        private final ManifestSummary manifest;
        private final List<String> warnings;
        private final String runId;

        PreviewResult(boolean importable,
                      String uploadedSha256,
                      long importedRows,
                      Set<String> affectedMasterTypes,
                      Map<String, Long> masterTypeCounts,
                      ManifestSummary manifest,
                      List<String> warnings,
                      String runId) {
            this.importable = importable;
            this.uploadedSha256 = uploadedSha256;
            this.importedRows = importedRows;
            this.affectedMasterTypes = List.copyOf(affectedMasterTypes);
            this.masterTypeCounts = Map.copyOf(masterTypeCounts);
            this.manifest = manifest;
            this.warnings = warnings == null ? List.of() : List.copyOf(warnings);
            this.runId = runId;
        }

        public Map<String, Object> toMap() {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("runId", runId);
            body.put("importable", importable);
            body.put("uploadedSha256", uploadedSha256);
            body.put("importedRows", importedRows);
            body.put("affectedMasterTypes", affectedMasterTypes);
            body.put("masterTypeCounts", masterTypeCounts);
            if (manifest != null) {
                body.put("manifest", manifest.toMap());
                body.put("sourceKind", manifest.sourceKind());
                body.put("sourceId", manifest.sourceId());
                body.put("masterVersion", manifest.masterVersion());
                body.put("generatedAt", manifest.generatedAt());
                body.put("artifactSha256", manifest.artifactSha256());
            }
            body.put("warnings", warnings);
            return body;
        }
    }

    private static final class ParsedImport {
        private final List<EntryRecord> entries = new ArrayList<>();
        private final List<InputSetRecord> inputSets = new ArrayList<>();
        private final List<InputSetItemRecord> inputSetItems = new ArrayList<>();
        private final List<InteractionRecord> interactions = new ArrayList<>();
        private final Set<String> affectedMasterTypes = new LinkedHashSet<>();
        private final Set<String> entryMasterTypes = new LinkedHashSet<>();
        private final Map<String, MasterTypeMetadata> metadata = new LinkedHashMap<>();
        private final Map<String, Long> masterTypeRowCounts = new LinkedHashMap<>();
        private ManifestSummary manifestSummary;

        void addEntry(EntryRecord entry) {
            entries.add(entry);
            entryMasterTypes.add(entry.masterType());
            affectedMasterTypes.add(entry.masterType());
            increment(entry.masterType());
            register(entry.masterType(), entry.masterVersion(), entry.validFrom(), entry.validTo());
        }

        void addInputSet(InputSetRecord inputSet) {
            inputSets.add(inputSet);
            affectedMasterTypes.add("order-inputsets");
            increment("order-inputsets");
            register("order-inputsets", inputSet.masterVersion(), inputSet.validFrom(), inputSet.validTo());
        }

        void addInputSetItem(InputSetItemRecord item) {
            inputSetItems.add(item);
            affectedMasterTypes.add("order-inputsets");
            increment("order-inputsets");
            register("order-inputsets", DEFAULT_MASTER_VERSION, item.validFrom(), item.validTo());
        }

        void addInteraction(InteractionRecord interaction) {
            interactions.add(interaction);
            affectedMasterTypes.add("order-interactions");
            increment("order-interactions");
            register("order-interactions", interaction.masterVersion(), interaction.validFrom(), interaction.validTo());
        }

        void validate() {
            if (!inputSetItems.isEmpty()) {
                Set<String> headers = new LinkedHashSet<>();
                for (InputSetRecord inputSet : inputSets) {
                    headers.add(inputSet.setCode());
                }
                for (InputSetItemRecord item : inputSetItems) {
                    if (!headers.contains(item.setCode())) {
                        throw invalidCsv();
                    }
                }
            }
        }

        void requireAllMasterTypes() {
            if (!affectedMasterTypes.containsAll(REQUIRED_MASTER_TYPES)) {
                throw new MasterUpdateService.MasterUpdateException(422, "local_master_cache_incomplete",
                        "local master cache import の必須 master type が不足しています。");
            }
        }

        long importedRows() {
            return entries.size() + inputSets.size() + inputSetItems.size() + interactions.size();
        }

        long masterTypeRowCount(String masterType) {
            return masterTypeRowCounts.getOrDefault(masterType, 0L);
        }

        Map<String, Long> masterTypeCounts() {
            return Collections.unmodifiableMap(masterTypeRowCounts);
        }

        ManifestSummary manifestSummary() {
            return manifestSummary;
        }

        void manifestSummary(ManifestSummary manifestSummary) {
            this.manifestSummary = manifestSummary;
        }

        List<EntryRecord> entries() {
            return Collections.unmodifiableList(entries);
        }

        List<InputSetRecord> inputSets() {
            return Collections.unmodifiableList(inputSets);
        }

        List<InputSetItemRecord> inputSetItems() {
            return Collections.unmodifiableList(inputSetItems);
        }

        List<InteractionRecord> interactions() {
            return Collections.unmodifiableList(interactions);
        }

        Set<String> affectedMasterTypes() {
            return Collections.unmodifiableSet(affectedMasterTypes);
        }

        Set<String> entryMasterTypes() {
            return Collections.unmodifiableSet(entryMasterTypes);
        }

        boolean hasInputSets() {
            return !inputSets.isEmpty() || !inputSetItems.isEmpty();
        }

        boolean hasInteractions() {
            return !interactions.isEmpty();
        }

        MasterTypeMetadata metadata(String masterType) {
            return metadata.getOrDefault(masterType,
                    new MasterTypeMetadata(DEFAULT_MASTER_VERSION, DEFAULT_VALID_FROM, DEFAULT_VALID_TO));
        }

        private void register(String masterType, String masterVersion, String effectiveFrom, String effectiveTo) {
            MasterTypeMetadata current = metadata.get(masterType);
            MasterTypeMetadata next = new MasterTypeMetadata(
                    firstNonBlank(masterVersion, current != null ? current.masterVersion() : DEFAULT_MASTER_VERSION),
                    minDate(current != null ? current.effectiveFrom() : null, effectiveFrom),
                    maxDate(current != null ? current.effectiveTo() : null, effectiveTo));
            metadata.put(masterType, next);
        }

        private void increment(String masterType) {
            masterTypeRowCounts.merge(masterType, 1L, Long::sum);
        }

        private static String minDate(String current, String value) {
            if (current == null || current.isBlank()) {
                return value;
            }
            return current.compareTo(value) <= 0 ? current : value;
        }

        private static String maxDate(String current, String value) {
            if (current == null || current.isBlank()) {
                return value;
            }
            return current.compareTo(value) >= 0 ? current : value;
        }
    }

    private static final class CsvRow {
        private final Map<String, Integer> headerIndex;
        private final List<String> values;

        CsvRow(Map<String, Integer> headerIndex, List<String> values, int lineNumber) {
            this.headerIndex = headerIndex;
            this.values = values;
        }

        String value(String header) {
            Integer index = headerIndex.get(normalize(header));
            if (index == null || index < 0 || index >= values.size()) {
                return null;
            }
            return values.get(index);
        }
    }

    private record MasterTypeMetadata(String masterVersion, String effectiveFrom, String effectiveTo) {
    }

    private record ZipCsvMetadata(String sha256, long bytes) {
    }

    private record ManifestSummary(String sourceKind,
                                   String sourceId,
                                   String masterVersion,
                                   String generatedAt,
                                   String artifactSha256) {
        Map<String, Object> toMap() {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("sourceKind", sourceKind);
            body.put("sourceId", sourceId);
            body.put("masterVersion", masterVersion);
            body.put("generatedAt", generatedAt);
            body.put("artifactSha256", artifactSha256);
            return body;
        }
    }

    private record EntryRecord(String masterType, String code, String name, String kana, String category, String unit,
                               String price, String validFrom, String validTo, String masterVersion, String note,
                               String searchText, String payloadJson) {
    }

    private record InputSetRecord(String setCode, String name, String entity, String kind, String classCode,
                                  String className, int itemCount, String validFrom, String validTo,
                                  String masterVersion, String searchText) {
    }

    private record InputSetItemRecord(String setCode, int seq, String code, String name, String quantity, String unit,
                                      String memo, String rowRole, String rowSubtype, String category,
                                      String validFrom, String validTo) {
    }

    private record InteractionRecord(String code1, String code2, String interactionCode, String interactionName,
                                     String message, String validFrom, String validTo, String masterVersion) {
    }
}
