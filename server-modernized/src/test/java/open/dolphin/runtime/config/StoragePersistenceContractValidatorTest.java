package open.dolphin.runtime.config;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class StoragePersistenceContractValidatorTest {

    @Test
    void rejectsModulePayloadTablePresence() {
        StoragePersistenceContractValidator validator = validatorWithResults(
                "opendolphin.d_module_payload",
                0L,
                0L);

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validateOrThrow);

        org.assertj.core.api.Assertions.assertThat(ex.getMessage()).contains("d_module_payload");
    }

    @Test
    void rejectsExternalOnlyContractViolations() {
        StoragePersistenceContractValidator validator = validatorWithResults(
                null,
                2L,
                1L);

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validateOrThrow);

        org.assertj.core.api.Assertions.assertThat(ex.getMessage())
                .contains("d_attachment")
                .contains("d_image");
    }

    @Test
    void passesWhenNoViolationsExist() {
        StoragePersistenceContractValidator validator = validatorWithResults(
                null,
                0L,
                0L);

        assertDoesNotThrow(validator::validateOrThrow);
    }

    private static StoragePersistenceContractValidator validatorWithResults(
            Object tableExistsResult,
            long attachmentViolations,
            long imageViolations) {
        EntityManager entityManager = Mockito.mock(EntityManager.class);
        Query query = Mockito.mock(Query.class);
        when(entityManager.createNativeQuery(anyString())).thenReturn(query);
        when(query.getSingleResult())
                .thenReturn(tableExistsResult)
                .thenReturn(attachmentViolations)
                .thenReturn(imageViolations);

        StoragePersistenceContractValidator validator = new StoragePersistenceContractValidator();
        validator.entityManager = entityManager;
        return validator;
    }
}
