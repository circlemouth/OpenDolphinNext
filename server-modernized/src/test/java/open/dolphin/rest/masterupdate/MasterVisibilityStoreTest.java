package open.dolphin.rest.masterupdate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import open.dolphin.runtime.RuntimeStateRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class MasterVisibilityStoreTest {

    private MasterVisibilityStore store;

    @BeforeEach
    void setUp() {
        store = new MasterVisibilityStore();
        store.init();
    }

    @Test
    void defaultsAllCategoriesToVisible() {
        Map<String, Object> body = store.getVisibility("RUN-VISIBILITY");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> categories = (List<Map<String, Object>>) body.get("categories");
        assertThat(categories).extracting(row -> row.get("code"))
                .containsExactly("prescription", "injection", "procedure", "test", "disease", "patientSupport");
        assertThat(categories).allSatisfy(row -> assertThat(row.get("visible")).isEqualTo(Boolean.TRUE));
    }

    @Test
    void appliesDefaultsToPersistedJsonWithMissingCategories() throws Exception {
        RuntimeStateRepository repository = Mockito.mock(RuntimeStateRepository.class);
        Mockito.when(repository.findPayload("master_visibility", "default"))
                .thenReturn(Optional.of("""
                        {
                          "updatedBy": "FACILITY:admin",
                          "categories": {
                            "prescription": { "code": "prescription", "visible": false }
                          }
                        }
                        """));
        MasterVisibilityStore persistedStore = new MasterVisibilityStore();
        setField(persistedStore, "stateRepository", repository);
        persistedStore.init();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> categories = (List<Map<String, Object>>) persistedStore.getVisibility("RUN-VISIBILITY").get("categories");

        Map<String, Object> prescription = categories.stream()
                .filter(row -> "prescription".equals(row.get("code")))
                .findFirst()
                .orElseThrow();
        Map<String, Object> injection = categories.stream()
                .filter(row -> "injection".equals(row.get("code")))
                .findFirst()
                .orElseThrow();
        assertThat(prescription.get("visible")).isEqualTo(Boolean.FALSE);
        assertThat(injection.get("visible")).isEqualTo(Boolean.TRUE);
    }

    @Test
    void updatesAllowedCategoriesAndReportsChangedCodes() {
        MasterVisibilityStore.UpdateResult result = store.updateVisibility(
                Map.of("categories", Map.of("prescription", false, "disease", true)),
                "FACILITY:admin",
                "RUN-VISIBILITY");

        assertThat(result.changedCategories()).containsExactly("prescription");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> categories = (List<Map<String, Object>>) result.body().get("categories");
        Map<String, Object> prescription = categories.stream()
                .filter(row -> "prescription".equals(row.get("code")))
                .findFirst()
                .orElseThrow();
        assertThat(prescription.get("visible")).isEqualTo(Boolean.FALSE);
        assertThat(prescription.get("masterTypes")).asList().contains("drug", "youhou", "order-inputsets");
    }

    @Test
    void rejectsUnsupportedCategoryInsteadOfSilentlyPersisting() {
        assertThatThrownBy(() -> store.updateVisibility(
                Map.of("categories", Map.of("rawRoute", true)),
                "FACILITY:admin",
                "RUN-VISIBILITY"))
                .isInstanceOf(MasterUpdateService.MasterUpdateException.class)
                .satisfies(ex -> assertThat(((MasterUpdateService.MasterUpdateException) ex).getCode())
                        .isEqualTo("visibility_category_unsupported"));
    }

    @Test
    void rejectsNonBooleanVisibilityValue() {
        assertThatThrownBy(() -> store.updateVisibility(
                Map.of("categories", Map.of("prescription", "false")),
                "FACILITY:admin",
                "RUN-VISIBILITY"))
                .isInstanceOf(MasterUpdateService.MasterUpdateException.class)
                .satisfies(ex -> assertThat(((MasterUpdateService.MasterUpdateException) ex).getCode())
                        .isEqualTo("visibility_category_invalid"));
    }

    private static void setField(Object target, String name, Object value) throws Exception {
        java.lang.reflect.Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }
}
