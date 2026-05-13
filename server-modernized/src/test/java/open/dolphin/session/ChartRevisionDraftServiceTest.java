package open.dolphin.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import jakarta.ws.rs.WebApplicationException;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import open.dolphin.infomodel.ChartDocumentModel;
import open.dolphin.infomodel.ChartRevisionModel;
import open.dolphin.infomodel.ChartRevisionStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ChartRevisionDraftServiceTest {

    private ChartRevisionDraftService service;
    private EntityManager em;
    private List<Object> persisted;

    @BeforeEach
    void setUp() throws Exception {
        service = new ChartRevisionDraftService();
        em = mock(EntityManager.class);
        persisted = new ArrayList<>();
        setField(service, "em", em);
        org.mockito.Mockito.doAnswer(invocation -> {
            Object entity = invocation.getArgument(0);
            if (entity instanceof ChartDocumentModel document) {
                document.setId(10L);
            }
            if (entity instanceof ChartRevisionModel revision) {
                revision.setId(11L);
            }
            persisted.add(entity);
            return null;
        }).when(em).persist(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void createDraftResolvesFacilityPatientAndActorServerSide() {
        stubKarteScope(501L, "F001");

        var response = service.createDraft(
                "F001",
                101L,
                """
                        {
                          "id": 999,
                          "facilityId": "F999",
                          "ownerId": 9999,
                          "role": "admin",
                          "digest": "client-digest",
                          "uri": "s3://attacker/object",
                          "objectKey": "../escape",
                          "karteBean": {"id": 201},
                          "userModel": {"id": 9999},
                          "docInfoModel": {"title": "SOAP draft"}
                        }
                        """);

        assertThat(response.getChartId()).isEqualTo(10L);
        assertThat(response.getRevisionId()).isEqualTo(11L);
        assertThat(response.getStatus()).isEqualTo("DRAFT");
        ChartDocumentModel document = persisted.stream()
                .filter(ChartDocumentModel.class::isInstance)
                .map(ChartDocumentModel.class::cast)
                .findFirst()
                .orElseThrow();
        ChartRevisionModel revision = persisted.stream()
                .filter(ChartRevisionModel.class::isInstance)
                .map(ChartRevisionModel.class::cast)
                .findFirst()
                .orElseThrow();

        assertThat(document.getFacilityId()).isEqualTo("F001");
        assertThat(document.getKarteId()).isEqualTo(201L);
        assertThat(document.getPatientId()).isEqualTo(501L);
        assertThat(document.getCreatedByUserId()).isEqualTo(101L);
        assertThat(revision.getStatus()).isEqualTo(ChartRevisionStatus.DRAFT);
        assertThat(revision.getTitle()).isEqualTo("SOAP draft");
        assertThat(revision.getEnteredByUserId()).isEqualTo(101L);
        verify(em, atLeastOnce()).flush();
    }

    @Test
    void createDraftRejectsCrossFacilityKarteEvenWhenPayloadClaimsFacility() {
        stubKarteScope(501L, "F002");

        assertThatThrownBy(() -> service.createDraft(
                "F001",
                101L,
                "{\"facilityId\":\"F001\",\"karteBean\":{\"id\":201},\"docInfoModel\":{\"title\":\"x\"}}"))
                .isInstanceOf(WebApplicationException.class)
                .satisfies(error -> assertThat(((WebApplicationException) error).getResponse().getStatus())
                        .isEqualTo(404));
    }

    private void stubKarteScope(long patientPk, String facilityId) {
        @SuppressWarnings("unchecked")
        TypedQuery<Object[]> query = mock(TypedQuery.class);
        when(em.createQuery(anyString(), eq(Object[].class))).thenReturn(query);
        when(query.setParameter(eq("karteId"), eq(201L))).thenReturn(query);
        when(query.getSingleResult()).thenReturn(new Object[] {patientPk, facilityId});
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
