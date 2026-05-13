package open.dolphin.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.Query;
import jakarta.ws.rs.WebApplicationException;
import java.lang.reflect.Field;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ChartFinalizeSnapshotResolverTest {

    private ChartFinalizeSnapshotResolver resolver;
    private EntityManager em;

    @BeforeEach
    void setUp() throws Exception {
        resolver = new ChartFinalizeSnapshotResolver();
        em = mock(EntityManager.class);
        setField(resolver, "em", em);
    }

    @Test
    void buildManifestRecordsCompleteSnapshotReferencesAndHashes() {
        Query patient = query(row(101L, "ORCA", "patientgetv2", ts("2026-05-13T11:50:00Z"), "1".repeat(64),
                "CURRENT", "ORCA_PATIENT_FOUND", "{}"));
        Query acceptance = query(row(201L, "ORCA", "acceptlstv2", ts("2026-05-13T11:51:00Z"), "2".repeat(64),
                "CURRENT", "ACC-001", "2026-05-10", "01", "10001", "0001"));
        Query insurance = query(row(301L, "ORCA", "insuranceinf1v2", ts("2026-05-13T11:52:00Z"), "3".repeat(64),
                "CURRENT", "2026-05-10", "0001", 1, "{}"));
        Query diseaseCache = query(row(401L, "ORCA", "diseasegetv2", ts("2026-05-13T11:53:00Z"), "4".repeat(64),
                "202605", "[{\"code\":\"W\"}]", "[{\"kind\":\"ORCA_ONLY\"}]"));
        Query diseaseInsert = query(402L);
        Query prescription = query(row(501L, 502L, "FINAL", "5".repeat(64), "{\"status\":\"FINAL\"}"));
        Query candidate = query(row(601L, "LOCAL_PRESCRIPTION", ts("2026-05-13T11:54:00Z"), "READY_TO_SEND", true,
                "{\"prescriptionContentHash\":\"" + "5".repeat(64) + "\"}", "[]", 501L, 502L));
        Query operation = query(row(701L, "medicalmodv2", "ORCA_WARNING", "6".repeat(64), "7".repeat(64), true,
                ts("2026-05-13T11:55:00Z"), 702L, "ORCA_WARNING", "8".repeat(64),
                "ORCA_WARNING", "9".repeat(64), "NEEDS_REVIEW"));
        when(em.createNativeQuery(any(String.class))).thenReturn(patient, acceptance, insurance, diseaseCache,
                diseaseInsert, prescription, candidate, operation);

        String manifest = resolver.buildManifest(request());

        assertThat(manifest)
                .contains("\"snapshotVersion\":2")
                .contains("\"patientSnapshotStatus\":\"SNAPSHOT_RECORDED\"")
                .contains("\"patientSnapshotReference\":\"orca_patient_cache:101\"")
                .contains("\"acceptanceSnapshotReference\":\"orca_acceptance_cache:201\"")
                .contains("\"insuranceSnapshotReference\":\"orca_insurance_cache:301\"")
                .contains("\"diseaseSnapshotReference\":\"orca_disease_snapshot:402\"")
                .contains("\"prescriptionOrderId\":501")
                .contains("\"prescriptionCandidateSnapshotReference\":\"orca_medical_candidate:601\"")
                .contains("\"orcaOperationReference\":\"orca_operation:701\"")
                .contains("\"orcaTransmissionReference\":\"orca_transmission:702\"")
                .contains("\"orcaReconciliationStatus\":\"NEEDS_REVIEW\"")
                .contains("\"snapshotCompletenessStatus\":\"COMPLETE\"")
                .contains("\"orcaUnavailableStatus\":\"DENY_FINALIZE_ORCA_SNAPSHOT_UNAVAILABLE\"")
                .doesNotContain("IDENTIFIER_ONLY")
                .doesNotContain("PENDING_WORKER_INTEGRATION")
                .doesNotContain("Authorization")
                .doesNotContain("Cookie");
    }

    @Test
    void buildManifestRejectsMissingPatientSnapshot() {
        Query patientQuery = query(new NoResultException());
        when(em.createNativeQuery(any(String.class))).thenReturn(patientQuery);

        Throwable thrown = catchThrowable(() -> resolver.buildManifest(request()));

        assertThat(thrown).isInstanceOf(WebApplicationException.class);
        assertThat(((WebApplicationException) thrown).getResponse().getStatus()).isEqualTo(409);
    }

    private ChartFinalizeSnapshotResolver.FinalizeSnapshotRequest request() {
        return new ChartFinalizeSnapshotResolver.FinalizeSnapshotRequest(
                "F001",
                10L,
                20L,
                "00001",
                "ENC-001",
                LocalDate.parse("2026-05-10"),
                "ACC-001",
                null,
                "01",
                "10001",
                "0001",
                Instant.parse("2026-05-13T12:00:00Z"));
    }

    private Query query(Object result) {
        Query query = mock(Query.class);
        when(query.setParameter(anyInt(), any())).thenReturn(query);
        if (result instanceof RuntimeException ex) {
            when(query.getSingleResult()).thenThrow(ex);
        } else {
            when(query.getSingleResult()).thenReturn(result);
        }
        return query;
    }

    private Object[] row(Object... values) {
        return values;
    }

    private Timestamp ts(String value) {
        return Timestamp.from(Instant.parse(value));
    }

    private void setField(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }
}
