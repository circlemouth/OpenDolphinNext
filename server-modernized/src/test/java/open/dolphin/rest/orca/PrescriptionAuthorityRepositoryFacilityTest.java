package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.Query;
import java.lang.reflect.Field;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class PrescriptionAuthorityRepositoryFacilityTest {

    @Test
    void finalizeFailsClosedWhenFacilityScopedLookupMissesOrder() throws Exception {
        EntityManager entityManager = mock(EntityManager.class);
        Query loadQuery = selfReturningQuery();
        when(entityManager.createNativeQuery(argThat(sql ->
                sql != null
                        && sql.contains("FROM opendolphin.prescription_order")
                        && sql.contains("facility_id = ?")
                        && sql.contains("FOR UPDATE"))))
                .thenReturn(loadQuery);
        when(loadQuery.getSingleResult()).thenThrow(new NoResultException("missing"));

        PrescriptionAuthorityRepository repository = new PrescriptionAuthorityRepository();
        setField(repository, "entityManager", entityManager);

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> repository.finalizeDraft("F002", 101L, "F002:doctor02", Instant.parse("2026-05-15T00:00:00Z")));

        assertEquals("prescription_order_not_found", ex.getMessage());
        verify(loadQuery).setParameter(1, 101L);
        verify(loadQuery).setParameter(2, "F002");
    }

    private static Query selfReturningQuery() {
        Query query = mock(Query.class);
        when(query.setParameter(org.mockito.ArgumentMatchers.anyInt(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(query);
        return query;
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
