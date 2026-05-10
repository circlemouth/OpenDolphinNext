package open.dolphin.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import open.dolphin.infomodel.ObservationModel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class KarteServiceBeanBatchWriteTest {

    private static final String QUERY_DELETE_OBSERVATIONS_BY_IDS =
            "delete from ObservationModel o where o.id in :ids";

    private KarteServiceBean service;
    private EntityManager em;
    private Query observationDeleteQuery;
    private KarteDiagnosisService karteDiagnosisService;
    private KarteObservationService karteObservationService;

    @BeforeEach
    void setUp() throws Exception {
        service = new KarteServiceBean();
        em = mock(EntityManager.class);
        observationDeleteQuery = deleteQuery();
        karteDiagnosisService = new KarteDiagnosisService();
        karteObservationService = new KarteObservationService();

        setField(service, "em", em);
        setField(karteDiagnosisService, "em", em);
        setField(karteObservationService, "em", em);
        setField(service, "karteDiagnosisService", karteDiagnosisService);
        setField(service, "karteObservationService", karteObservationService);

        when(em.createQuery(QUERY_DELETE_OBSERVATIONS_BY_IDS)).thenReturn(observationDeleteQuery);

        doAnswer(invocation -> {
            Object entity = invocation.getArgument(0);
            if (entity instanceof ObservationModel observation && observation.getId() <= 0L) {
                observation.setId(System.identityHashCode(observation));
            }
            return null;
        }).when(em).persist(any());

        when(em.merge(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void removeObservationsUsesBulkDeleteQuery() {
        assertThat(service.removeObservations(List.of(4L, 5L))).isEqualTo(3);

        verify(em).createQuery(QUERY_DELETE_OBSERVATIONS_BY_IDS);
        verify(observationDeleteQuery).setParameter("ids", List.of(4L, 5L));
    }

    @Test
    void updateObservationsFlushesAndClearsAtBatchBoundary() {
        int updatedObservations = service.updateObservations(observations(51));

        assertThat(updatedObservations).isEqualTo(51);
        verify(em, times(1)).flush();
        verify(em, times(1)).clear();
    }

    @SuppressWarnings("unchecked")
    private static Query deleteQuery() {
        Query query = mock(Query.class);
        when(query.setParameter(any(String.class), any())).thenReturn(query);
        when(query.executeUpdate()).thenReturn(3);
        return query;
    }

    private static List<ObservationModel> observations(int count) {
        List<ObservationModel> list = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            ObservationModel model = new ObservationModel();
            model.setId(i + 1L);
            list.add(model);
        }
        return list;
    }

    private static void setField(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }
}
