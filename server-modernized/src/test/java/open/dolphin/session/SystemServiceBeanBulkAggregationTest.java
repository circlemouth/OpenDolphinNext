package open.dolphin.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.RETURNS_SELF;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.lang.reflect.Field;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.infomodel.ActivityModel;
import open.dolphin.infomodel.FacilityModel;
import open.dolphin.msg.OidSender;
import open.dolphin.runtime.config.TestServerConfigurationResolvers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SystemServiceBeanBulkAggregationTest {

    private static final String DB_SIZE_SQL = "select pg_size_pretty(pg_database_size('dolphin'))";

    private TestSystemServiceBean service;
    private EntityManager em;
    private Map<String, Query> queryByMarker;
    private Query facilityListQuery;
    private Query dbSizeQuery;
    private List<FacilityModel> facilities;

    @BeforeEach
    void setUp() throws Exception {
        service = new TestSystemServiceBean();
        em = mock(EntityManager.class);
        queryByMarker = new LinkedHashMap<>();
        facilityListQuery = mock(Query.class, RETURNS_SELF);
        dbSizeQuery = mock(Query.class, RETURNS_SELF);
        facilities = List.of(
                facility("F001", "Alpha", "100-0001", "Tokyo", "03-0000-0001", "03-0000-0002"),
                facility("F002", "Beta", "150-0002", "Osaka", "06-0000-0001", "06-0000-0002"));

        setField(service, "em", em);
        when(em.createQuery(anyString())).thenAnswer(invocation -> resolveQuery(invocation.getArgument(0, String.class)));
        when(em.createNativeQuery(DB_SIZE_SQL)).thenReturn(dbSizeQuery);
        when(dbSizeQuery.getSingleResult()).thenReturn("42 MB");
        when(facilityListQuery.getResultList()).thenReturn(facilities);
        setField(service, "configurationResolver",
                TestServerConfigurationResolvers.resolver("jboss.bind.address", "127.0.0.1"));
    }

    @Test
    void countTotalActivitiesBulk_buildsSkeletonAndReadsDbSizeOnce() {
        stubGroupedResults("from UserModel u where u.memberType", rows(
                row("F001", 3L),
                row("F002", 1L)));
        stubGroupedResults("from PatientModel p group by p.facilityId", rows(
                row("F001", 10L)));
        stubGroupedResults("from PatientVisitModel p where p.status!=:status", rows(
                row("F001", 20L),
                row("F002", 5L)));
        stubGroupedResults("from DocumentModel d where d.status='F'", rows(
                row("F001", 7L)));
        stubGroupedResults("from SchemaModel s where s.status='F'", rows(
                row("F002", 8L)));
        stubGroupedResults("from AttachmentModel a where a.status='F'", rows(
                row("F001", 4L)));
        stubGroupedResults("from RegisteredDiagnosisModel r", rows(
                row("F001", 9L),
                row("F002", 2L)));
        stubGroupedResults("from LetterModule l where l.status='F'", rows(
                row("F001", 2L)));
        stubGroupedResults("from NLaboModule l", rows(
                row("F002", 6L)));

        Map<String, ActivityModel> totals = service.countTotalActivitiesBulk(facilities);

        assertThat(totals).containsOnlyKeys("F001", "F002");
        ActivityModel alpha = totals.get("F001");
        assertThat(alpha.getFacilityName()).isEqualTo("Alpha");
        assertThat(alpha.getFacilityZip()).isEqualTo("100-0001");
        assertThat(alpha.getFacilityAddress()).isEqualTo("Tokyo");
        assertThat(alpha.getFacilityTelephone()).isEqualTo("03-0000-0001");
        assertThat(alpha.getFacilityFacimile()).isEqualTo("03-0000-0002");
        assertThat(alpha.getNumOfUsers()).isEqualTo(3L);
        assertThat(alpha.getNumOfPatients()).isEqualTo(10L);
        assertThat(alpha.getNumOfPatientVisits()).isEqualTo(20L);
        assertThat(alpha.getNumOfKarte()).isEqualTo(7L);
        assertThat(alpha.getNumOfImages()).isZero();
        assertThat(alpha.getNumOfAttachments()).isEqualTo(4L);
        assertThat(alpha.getNumOfDiagnosis()).isEqualTo(9L);
        assertThat(alpha.getNumOfLetters()).isEqualTo(2L);
        assertThat(alpha.getNumOfLabTests()).isZero();
        assertThat(alpha.getDbSize()).isEqualTo("42 MB");
        assertThat(alpha.getBindAddress()).isEqualTo("127.0.0.1");

        ActivityModel beta = totals.get("F002");
        assertThat(beta.getFacilityName()).isEqualTo("Beta");
        assertThat(beta.getNumOfUsers()).isEqualTo(1L);
        assertThat(beta.getNumOfPatients()).isZero();
        assertThat(beta.getNumOfPatientVisits()).isEqualTo(5L);
        assertThat(beta.getNumOfImages()).isEqualTo(8L);
        assertThat(beta.getNumOfDiagnosis()).isEqualTo(2L);
        assertThat(beta.getNumOfLabTests()).isEqualTo(6L);
        assertThat(beta.getDbSize()).isEqualTo("42 MB");
        assertThat(beta.getBindAddress()).isEqualTo("127.0.0.1");

        verify(em).createNativeQuery(DB_SIZE_SQL);
    }

    @Test
    void countMonthlyActivitiesBulk_populatesMonthlyCountsPerFacility() {
        Date from = Date.from(java.time.LocalDate.of(2026, 2, 1).atStartOfDay(ZoneId.systemDefault()).toInstant());
        Date to = Date.from(java.time.LocalDate.of(2026, 2, 28).atTime(23, 59, 59)
                .atZone(ZoneId.systemDefault()).toInstant());
        stubGroupedResults("from PatientModel p, KarteBean k", rows(
                row("F001", 2L),
                row("F002", 1L)));
        stubGroupedResults("from PatientVisitModel p where p.pvtDate", rows(
                row("F001", 11L),
                row("F002", 4L)));
        stubGroupedResults("from DocumentModel d where d.started", rows(
                row("F001", 5L)));
        stubGroupedResults("from SchemaModel s where s.started", rows(
                row("F002", 3L)));
        stubGroupedResults("from AttachmentModel a where a.started", rows(
                row("F001", 1L)));
        stubGroupedResults("from RegisteredDiagnosisModel r where r.started", rows(
                row("F001", 6L),
                row("F002", 2L)));
        stubGroupedResults("from LetterModule l where l.started", rows(
                row("F002", 7L)));
        stubGroupedResults("from NLaboModule l where l.sampleDate", rows(
                row("F001", 9L)));

        Map<String, ActivityModel> monthly = service.countMonthlyActivitiesBulk(facilities, from, to);

        ActivityModel alpha = monthly.get("F001");
        assertThat(alpha.getFromDate()).isEqualTo(from);
        assertThat(alpha.getToDate()).isEqualTo(to);
        assertThat(alpha.getNumOfPatients()).isEqualTo(2L);
        assertThat(alpha.getNumOfPatientVisits()).isEqualTo(11L);
        assertThat(alpha.getNumOfKarte()).isEqualTo(5L);
        assertThat(alpha.getNumOfAttachments()).isEqualTo(1L);
        assertThat(alpha.getNumOfDiagnosis()).isEqualTo(6L);
        assertThat(alpha.getNumOfLabTests()).isEqualTo(9L);

        ActivityModel beta = monthly.get("F002");
        assertThat(beta.getFromDate()).isEqualTo(from);
        assertThat(beta.getToDate()).isEqualTo(to);
        assertThat(beta.getNumOfPatients()).isEqualTo(1L);
        assertThat(beta.getNumOfPatientVisits()).isEqualTo(4L);
        assertThat(beta.getNumOfImages()).isEqualTo(3L);
        assertThat(beta.getNumOfDiagnosis()).isEqualTo(2L);
        assertThat(beta.getNumOfLetters()).isEqualTo(7L);
    }

    @Test
    void sendMonthlyActivities_reusesFacilityListAndAvoidsPerFacilityReload() {
        stubGroupedResults("from UserModel u where u.memberType", rows(row("F001", 2L), row("F002", 1L)));
        stubGroupedResults("from PatientModel p group by p.facilityId", rows(row("F001", 10L), row("F002", 8L)));
        stubGroupedResults("from PatientVisitModel p where p.status!=:status", rows(row("F001", 20L), row("F002", 5L)));
        stubGroupedResults("from DocumentModel d where d.status='F'", rows(row("F001", 7L)));
        stubGroupedResults("from SchemaModel s where s.status='F'", rows(row("F002", 8L)));
        stubGroupedResults("from AttachmentModel a where a.status='F'", rows(row("F001", 4L)));
        stubGroupedResults("from RegisteredDiagnosisModel r group by", rows(row("F001", 9L), row("F002", 2L)));
        stubGroupedResults("from LetterModule l where l.status='F'", rows(row("F001", 2L)));
        stubGroupedResults("from NLaboModule l group by", rows(row("F002", 6L)));

        stubGroupedResults("from PatientModel p, KarteBean k", rows(row("F001", 2L), row("F002", 1L)));
        stubGroupedResults("from PatientVisitModel p where p.pvtDate", rows(row("F001", 11L), row("F002", 4L)));
        stubGroupedResults("from DocumentModel d where d.started", rows(row("F001", 5L)));
        stubGroupedResults("from SchemaModel s where s.started", rows(row("F002", 3L)));
        stubGroupedResults("from AttachmentModel a where a.started", rows(row("F001", 1L)));
        stubGroupedResults("from RegisteredDiagnosisModel r where r.started", rows(row("F001", 6L), row("F002", 2L)));
        stubGroupedResults("from LetterModule l where l.started", rows(row("F002", 7L)));
        stubGroupedResults("from NLaboModule l where l.sampleDate", rows(row("F001", 9L)));

        service.sendMonthlyActivities(2026, 1);

        assertThat(service.mailCalls).hasSize(2);
        OidSender sender = service.mailCalls.get(0).sender();
        assertThat(sender).isNotNull();
        assertThat(service.mailCalls.get(1).sender()).isSameAs(sender);
        assertThat(service.mailCalls.get(0).payload()[0].getFlag()).isEqualTo("M");
        assertThat(service.mailCalls.get(0).payload()[1].getFlag()).isEqualTo("T");
        assertThat(service.mailCalls.get(0).payload()[1].getDbSize()).isEqualTo("42 MB");

        verify(em).createQuery("from FacilityModel f");
        verify(em, never()).createQuery("from FacilityModel f where f.facilityId=:fid");
        verify(em).createNativeQuery(DB_SIZE_SQL);
    }

    private Query resolveQuery(String jpql) {
        if ("from FacilityModel f".equals(jpql)) {
            return facilityListQuery;
        }
        for (Map.Entry<String, Query> entry : queryByMarker.entrySet()) {
            if (jpql.contains(entry.getKey())) {
                return entry.getValue();
            }
        }
        throw new AssertionError("Unexpected JPQL: " + jpql);
    }

    private void stubGroupedResults(String marker, List<Object[]> rows) {
        Query query = mock(Query.class, RETURNS_SELF);
        when(query.getResultList()).thenReturn(rows);
        queryByMarker.put(marker, query);
    }

    private static List<Object[]> rows(Object[]... rows) {
        return List.of(rows);
    }

    private static Object[] row(String facilityId, long count) {
        return new Object[]{facilityId, count};
    }

    private static FacilityModel facility(String id, String name, String zip, String address, String tel, String fax) {
        FacilityModel facility = new FacilityModel();
        facility.setFacilityId(id);
        facility.setFacilityName(name);
        facility.setZipCode(zip);
        facility.setAddress(address);
        facility.setTelephone(tel);
        facility.setFacsimile(fax);
        return facility;
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getSuperclass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    private static final class TestSystemServiceBean extends SystemServiceBean {
        private final List<MailCall> mailCalls = new ArrayList<>();

        @Override
        public void mailActivities(ActivityModel[] ams, OidSender sender) {
            mailCalls.add(new MailCall(ams, sender));
        }
    }

    private record MailCall(ActivityModel[] payload, OidSender sender) {
    }
}
