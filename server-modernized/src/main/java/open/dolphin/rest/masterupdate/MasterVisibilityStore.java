package open.dolphin.rest.masterupdate;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import open.dolphin.rest.AbstractResource;
import open.dolphin.runtime.RuntimeStateRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Facility-wide UI visibility settings for ORCA master candidate surfaces.
 */
@ApplicationScoped
public class MasterVisibilityStore {

    private static final Logger LOGGER = LoggerFactory.getLogger(MasterVisibilityStore.class);
    private static final String STATE_CATEGORY = "master_visibility";
    private static final String STATE_KEY = "default";
    private static final String DEFAULT_PRESCRIPTION_DRUG_SEARCH_METHOD = "prefix";
    private static final Set<String> ALLOWED_PRESCRIPTION_DRUG_SEARCH_METHODS = Set.of("prefix", "partial");

    private static final List<CategoryDefinition> DEFINITIONS = List.of(
            new CategoryDefinition(
                    "prescription",
                    "処方候補",
                    List.of("drug", "youhou", "comment", "generic-price", "generic-class", "order-inputsets"),
                    List.of("処方入力", "処方薬剤候補", "用法候補", "請求コメント候補")
            ),
            new CategoryDefinition(
                    "injection",
                    "注射候補",
                    List.of("drug", "youhou", "etensu", "comment", "order-inputsets"),
                    List.of("注射入力", "注射薬剤候補", "注射手技候補", "投与指示候補")
            ),
            new CategoryDefinition(
                    "procedure",
                    "処置・手術候補",
                    List.of("etensu", "material", "bodypart", "comment", "order-inputsets"),
                    List.of("処置入力", "手術入力", "材料候補", "部位候補")
            ),
            new CategoryDefinition(
                    "test",
                    "検査候補",
                    List.of("etensu", "kensa-sort", "material", "comment", "order-inputsets"),
                    List.of("検査入力", "検査区分候補", "検体・材料候補")
            ),
            new CategoryDefinition(
                    "disease",
                    "病名候補",
                    List.of("disease-candidate"),
                    List.of("病名候補検索", "病名コード補助")
            ),
            new CategoryDefinition(
                    "patientSupport",
                    "患者補助候補",
                    List.of("address", "hokenja"),
                    List.of("住所補助", "保険者参照")
            )
    );

    private static final Set<String> ALLOWED_CODES = definitionCodes();

    private final ObjectMapper mapper = AbstractResource.getSerializeMapper();
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();

    @Inject
    private RuntimeStateRepository stateRepository;

    private Snapshot current;

    @PostConstruct
    public void init() {
        this.current = load();
        if (this.current == null) {
            this.current = defaultSnapshot();
        } else {
            this.current = applyDefaults(this.current);
        }
        persist(this.current);
    }

    public Map<String, Object> getVisibility(String runId) {
        Snapshot snapshot = getSnapshot();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("runId", runId);
        body.put("generatedAt", Instant.now().toString());
        body.put("categories", toCategoryRows(snapshot));
        body.put("updatedAt", snapshot.updatedAt);
        body.put("updatedBy", snapshot.updatedBy);
        body.put("defaultsVisible", true);
        body.put("prescriptionDrugSearchMethodDefault", snapshot.prescriptionDrugSearchMethodDefault);
        return body;
    }

    public UpdateResult updateVisibility(Map<String, Object> payload, String actor, String runId) {
        VisibilityPayload incoming = parsePayload(payload);
        String now = Instant.now().toString();
        return update(snapshot -> {
            Snapshot next = applyDefaults(snapshot);
            List<String> changed = new ArrayList<>();
            for (Map.Entry<String, Boolean> entry : incoming.categories().entrySet()) {
                CategoryState state = next.categories.get(entry.getKey());
                boolean before = state == null || state.visible == null || state.visible;
                boolean after = entry.getValue();
                if (state == null) {
                    state = new CategoryState();
                    state.code = entry.getKey();
                    next.categories.put(entry.getKey(), state);
                }
                if (before != after) {
                    changed.add(entry.getKey());
                }
                state.visible = after;
            }
            if (incoming.prescriptionDrugSearchMethodDefault() != null
                    && !incoming.prescriptionDrugSearchMethodDefault().equals(next.prescriptionDrugSearchMethodDefault)) {
                next.prescriptionDrugSearchMethodDefault = incoming.prescriptionDrugSearchMethodDefault();
            }
            next.updatedAt = now;
            next.updatedBy = actor;
            next.runId = runId;
            return new UpdateResult(toResponseBody(next, runId), changed);
        });
    }

    public Snapshot getSnapshot() {
        lock.readLock().lock();
        try {
            return deepCopy(current);
        } finally {
            lock.readLock().unlock();
        }
    }

    private <T> T update(java.util.function.Function<Snapshot, T> updater) {
        lock.writeLock().lock();
        try {
            if (current == null) {
                current = defaultSnapshot();
            }
            T result = updater.apply(current);
            current = applyDefaults(current);
            persist(current);
            return result;
        } finally {
            lock.writeLock().unlock();
        }
    }

    private Map<String, Object> toResponseBody(Snapshot snapshot, String runId) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("runId", runId);
        body.put("ok", true);
        body.put("generatedAt", Instant.now().toString());
        body.put("categories", toCategoryRows(snapshot));
        body.put("updatedAt", snapshot.updatedAt);
        body.put("updatedBy", snapshot.updatedBy);
        body.put("defaultsVisible", true);
        body.put("prescriptionDrugSearchMethodDefault", snapshot.prescriptionDrugSearchMethodDefault);
        return body;
    }

    private List<Map<String, Object>> toCategoryRows(Snapshot snapshot) {
        Snapshot resolved = applyDefaults(snapshot);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (CategoryDefinition definition : DEFINITIONS) {
            CategoryState state = resolved.categories.get(definition.code());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("code", definition.code());
            row.put("label", definition.label());
            row.put("visible", state == null || state.visible == null || state.visible);
            row.put("masterTypes", definition.masterTypes());
            row.put("affectedSurfaces", definition.affectedSurfaces());
            rows.add(row);
        }
        return rows;
    }

    private VisibilityPayload parsePayload(Map<String, Object> payload) {
        if (payload == null || payload.isEmpty()) {
            throw invalid("visibility_payload_empty", "設定内容が空です。");
        }
        Object categoriesObj = payload.get("categories");
        Map<String, Boolean> parsed = new LinkedHashMap<>();
        if (categoriesObj != null) {
            if (!(categoriesObj instanceof Map<?, ?> rawCategories)) {
                throw invalid("visibility_categories_required", "categories オブジェクトが必要です。");
            }
            for (Map.Entry<?, ?> entry : rawCategories.entrySet()) {
                String code = entry.getKey() instanceof String text ? text.trim() : String.valueOf(entry.getKey()).trim();
                if (!ALLOWED_CODES.contains(code)) {
                    throw invalid("visibility_category_unsupported", "未対応のマスタ表示カテゴリです: " + code);
                }
                Object value = entry.getValue();
                if (!(value instanceof Boolean bool)) {
                    throw invalid("visibility_category_invalid", "visible は boolean で指定してください: " + code);
                }
                parsed.put(code, bool);
            }
        }
        String prescriptionDrugSearchMethodDefault = null;
        if (payload.containsKey("prescriptionDrugSearchMethodDefault")) {
            Object raw = payload.get("prescriptionDrugSearchMethodDefault");
            if (!(raw instanceof String text) || !ALLOWED_PRESCRIPTION_DRUG_SEARCH_METHODS.contains(text.trim())) {
                throw invalid("visibility_prescription_search_method_invalid", "処方薬剤検索方法は prefix または partial で指定してください。");
            }
            prescriptionDrugSearchMethodDefault = text.trim();
        }
        if (parsed.isEmpty() && prescriptionDrugSearchMethodDefault == null) {
            throw invalid("visibility_categories_empty", "更新対象カテゴリがありません。");
        }
        return new VisibilityPayload(parsed, prescriptionDrugSearchMethodDefault);
    }

    private MasterUpdateService.MasterUpdateException invalid(String code, String message) {
        return new MasterUpdateService.MasterUpdateException(400, code, message);
    }

    private Snapshot load() {
        if (stateRepository == null) {
            LOGGER.warn("RuntimeStateRepository is unavailable. returning default master visibility snapshot");
            return null;
        }
        return stateRepository.findPayload(STATE_CATEGORY, STATE_KEY)
                .map(payload -> {
                    try {
                        return mapper.readValue(payload, Snapshot.class);
                    } catch (IOException ex) {
                        LOGGER.warn("Failed to parse master visibility payload from DB: {}", ex.getMessage());
                        return null;
                    }
                })
                .orElse(null);
    }

    private void persist(Snapshot snapshot) {
        if (snapshot == null || stateRepository == null) {
            return;
        }
        try {
            stateRepository.upsertPayload(STATE_CATEGORY, STATE_KEY, mapper.writeValueAsString(snapshot), Instant.now());
        } catch (IOException ex) {
            LOGGER.warn("Failed to serialize master visibility state for DB persistence: {}", ex.getMessage());
        } catch (RuntimeException ex) {
            LOGGER.warn("Failed to persist master visibility state in DB: {}", ex.getMessage());
        }
    }

    private Snapshot defaultSnapshot() {
        Snapshot snapshot = new Snapshot();
        snapshot.categories = new LinkedHashMap<>();
        for (CategoryDefinition definition : DEFINITIONS) {
            CategoryState state = new CategoryState();
            state.code = definition.code();
            state.visible = Boolean.TRUE;
            snapshot.categories.put(definition.code(), state);
        }
        snapshot.updatedAt = Instant.now().toString();
        snapshot.prescriptionDrugSearchMethodDefault = DEFAULT_PRESCRIPTION_DRUG_SEARCH_METHOD;
        return snapshot;
    }

    private Snapshot applyDefaults(Snapshot snapshot) {
        Snapshot resolved = snapshot != null ? snapshot : new Snapshot();
        if (resolved.categories == null) {
            resolved.categories = new LinkedHashMap<>();
        }
        Map<String, CategoryState> next = new LinkedHashMap<>();
        for (CategoryDefinition definition : DEFINITIONS) {
            CategoryState state = resolved.categories.get(definition.code());
            CategoryState normalized = new CategoryState();
            normalized.code = definition.code();
            normalized.visible = state == null || state.visible == null ? Boolean.TRUE : state.visible;
            next.put(definition.code(), normalized);
        }
        resolved.categories = next;
        if (resolved.updatedAt == null || resolved.updatedAt.isBlank()) {
            resolved.updatedAt = Instant.now().toString();
        }
        if (!ALLOWED_PRESCRIPTION_DRUG_SEARCH_METHODS.contains(resolved.prescriptionDrugSearchMethodDefault)) {
            resolved.prescriptionDrugSearchMethodDefault = DEFAULT_PRESCRIPTION_DRUG_SEARCH_METHOD;
        }
        return resolved;
    }

    private Snapshot deepCopy(Snapshot snapshot) {
        if (snapshot == null) {
            return null;
        }
        return mapper.convertValue(snapshot, Snapshot.class);
    }

    private static Set<String> definitionCodes() {
        Set<String> codes = new LinkedHashSet<>();
        for (CategoryDefinition definition : DEFINITIONS) {
            codes.add(definition.code());
        }
        return Set.copyOf(codes);
    }

    public record UpdateResult(Map<String, Object> body, List<String> changedCategories) {
        public UpdateResult {
            changedCategories = changedCategories == null ? List.of() : List.copyOf(changedCategories);
        }
    }

    private record CategoryDefinition(String code, String label, List<String> masterTypes, List<String> affectedSurfaces) {
        private CategoryDefinition {
            Objects.requireNonNull(code, "code");
            Objects.requireNonNull(label, "label");
            masterTypes = masterTypes == null ? List.of() : List.copyOf(masterTypes);
            affectedSurfaces = affectedSurfaces == null ? List.of() : List.copyOf(affectedSurfaces);
        }
    }

    private record VisibilityPayload(
            Map<String, Boolean> categories,
            String prescriptionDrugSearchMethodDefault) {
    }

    public static final class Snapshot {
        public Map<String, CategoryState> categories = new LinkedHashMap<>();
        public String prescriptionDrugSearchMethodDefault = DEFAULT_PRESCRIPTION_DRUG_SEARCH_METHOD;
        public String updatedAt;
        public String updatedBy;
        public String runId;
    }

    public static final class CategoryState {
        public String code;
        public Boolean visible;
    }
}
