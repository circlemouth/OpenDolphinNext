package open.dolphin.rest;

import static org.mockito.Mockito.RETURNS_SELF;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.lang.reflect.Field;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class ChartEventHistoryRepositoryImplTest {

    @Test
    void purgeUsesFacilityScopedDeleteForRetentionDurationAndCount() throws Exception {
        ChartEventHistoryRepositoryImpl repository = new ChartEventHistoryRepositoryImpl();
        EntityManager em = mock(EntityManager.class);

        Query durationDeleteQuery = mock(Query.class, RETURNS_SELF);
        Query thresholdQuery = mock(Query.class, RETURNS_SELF);
        Query countDeleteQuery = mock(Query.class, RETURNS_SELF);

        when(em.createNativeQuery("delete from chart_event_history where facility_id = ? and created_at < ?"))
                .thenReturn(durationDeleteQuery);
        when(em.createNativeQuery("select event_id from chart_event_history where facility_id = ? order by event_id desc"))
                .thenReturn(thresholdQuery);
        when(em.createNativeQuery("delete from chart_event_history where facility_id = ? and event_id < ?"))
                .thenReturn(countDeleteQuery);
        when(thresholdQuery.getResultList()).thenReturn(List.of(500L));

        setField(repository, "em", em);

        Instant now = Instant.parse("2026-02-21T03:27:45Z");
        repository.purge("facility-001", 100, Duration.ofDays(30), now);

        verify(em).createNativeQuery("delete from chart_event_history where facility_id = ? and created_at < ?");
        verify(durationDeleteQuery).setParameter(1, "facility-001");
        verify(durationDeleteQuery).setParameter(2, java.sql.Timestamp.from(now.minus(Duration.ofDays(30))));
        verify(durationDeleteQuery).executeUpdate();

        verify(countDeleteQuery).setParameter(1, "facility-001");
        verify(countDeleteQuery).setParameter(2, 500L);
        verify(countDeleteQuery).executeUpdate();

        verify(em, never()).createNativeQuery("delete from chart_event_history where created_at < ?");
    }

    @Test
    void purgeSkipsWhenFacilityIdMissing() throws Exception {
        ChartEventHistoryRepositoryImpl repository = new ChartEventHistoryRepositoryImpl();
        EntityManager em = mock(EntityManager.class);
        setField(repository, "em", em);

        repository.purge(" ", 100, Duration.ofDays(7), Instant.parse("2026-02-21T03:27:45Z"));

        verify(em, never()).createNativeQuery(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void purgeAllUsesGlobalAgeDeleteAndPerFacilityCountTrim() throws Exception {
        ChartEventHistoryRepositoryImpl repository = new ChartEventHistoryRepositoryImpl();
        EntityManager em = mock(EntityManager.class);

        Query durationDeleteQuery = mock(Query.class, RETURNS_SELF);
        Query countDeleteQuery = mock(Query.class, RETURNS_SELF);

        when(em.createNativeQuery("delete from chart_event_history where created_at < ?"))
                .thenReturn(durationDeleteQuery);
        when(em.createNativeQuery(
                "delete from chart_event_history where event_id in ("
                        + "select event_id from ("
                        + "select event_id, row_number() over (partition by facility_id order by event_id desc) as rn "
                        + "from chart_event_history"
                        + ") ranked where rn > ?)"))
                .thenReturn(countDeleteQuery);

        setField(repository, "em", em);

        Instant now = Instant.parse("2026-02-21T03:27:45Z");
        repository.purgeAll(100, Duration.ofDays(30), now);

        verify(durationDeleteQuery).setParameter(1, java.sql.Timestamp.from(now.minus(Duration.ofDays(30))));
        verify(durationDeleteQuery).executeUpdate();
        verify(countDeleteQuery).setParameter(1, 100);
        verify(countDeleteQuery).executeUpdate();
        verify(em, never()).createNativeQuery("delete from chart_event_history where facility_id = ? and created_at < ?");
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = ChartEventHistoryRepositoryImpl.class.getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
