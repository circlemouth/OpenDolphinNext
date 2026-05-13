package open.dolphin.rest;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.ws.rs.core.MediaType;
import java.lang.reflect.Field;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import open.dolphin.rest.orca.AbstractOrcaRestResource;
import org.junit.jupiter.api.Test;

class PublicRouteInventoryContractTest {

    private static final Set<String> EXPECTED_OFFICIAL_ROUTE_KEYS = Set.of(
            "GET /api/orca/official/disease-master/name/{*}",
            "GET /api/orca/official/appointments/list",
            "GET /api/orca/official/appointments/medical-information",
            "GET /api/orca/official/appointments/patient",
            "GET /api/orca/official/appointments/selector-options",
            "GET /api/orca/official/patientgetv2",
            "POST /api/orca/official/appointments/list",
            "POST /api/orca/official/appointments/mutation",
            "POST /api/orca/official/appointments/patient",
            "POST /api/orca/official/billing/estimate",
            "POST /api/orca/official/chart-support/contraindication-check",
            "POST /api/orca/official/chart-support/disease-mod-v3",
            "POST /api/orca/official/chart-support/income-info",
            "POST /api/orca/official/chart-support/medical-mod-v2",
            "POST /api/orca/official/chart-support/medication-get",
            "POST /api/orca/official/chart-support/subjectives-mod-v2",
            "POST /api/orca/official/insurance/combinations",
            "POST /api/orca/official/patientmodv2/outpatient/create",
            "POST /api/orca/official/patientmodv2/outpatient/update",
            "POST /api/orca/official/patients/batch",
            "POST /api/orca/official/patients/former-names",
            "POST /api/orca/official/patients/id-list",
            "POST /api/orca/official/patients/import",
            "POST /api/orca/official/patients/name-search",
            "POST /api/orca/official/patients/sync/run",
            "POST /api/orca/official/reports/{*}",
            "POST /api/orca/official/visits/acceptance-list",
            "POST /api/orca/official/visits/acceptance-operation",
            "POST /api/orca/official/visits/identifier-preflight",
            "POST /api/orca/official/visits/list",
            "POST /api/orca/official/visits/mutation");

    private static final Set<String> EXPECTED_MASTER_ROUTE_KEYS = Set.of(
            "GET /api/orca/master/address",
            "GET /api/orca/master/bodypart",
            "GET /api/orca/master/comment",
            "GET /api/orca/master/drug",
            "GET /api/orca/master/etensu",
            "GET /api/orca/master/generic-class",
            "GET /api/orca/master/generic-price",
            "GET /api/orca/master/hokenja",
            "GET /api/orca/master/kensa-sort",
            "GET /api/orca/master/material",
            "GET /api/orca/master/order/inputsets",
            "GET /api/orca/master/order/inputsets/{*}",
            "GET /api/orca/master/reference/status",
            "GET /api/orca/master/youhou",
            "POST /api/orca/master/order/interactions/check");

    private static final Set<String> EXPECTED_LOCAL_ROUTE_KEYS = Set.of(
            "GET /api/local/diagnoses/{*}",
            "GET /api/local/encounters/{*}/medical-summary",
            "GET /api/local/encounters/orca-transmissions/review",
            "GET /api/local/order/bundles",
            "GET /api/local/order/recommendations",
            "GET /api/local/orca/medical-candidates/from-chart/{*}/latest",
            "GET /api/local/prescription-orders",
            "POST /api/local/charts/medical-records",
            "POST /api/local/charts/subjectives",
            "POST /api/local/encounters/{*}/close-and-send-to-billing",
            "POST /api/local/encounters/orca-transmissions/{*}/reconcile-temporary-medical",
            "POST /api/local/orca/medical-candidates/from-chart/{*}",
            "POST /api/local/order/bundles",
            "POST /api/local/patients/search",
            "POST /api/local/prescription-orders/authority",
            "POST /api/local/prescription-orders/authority/{*}/cancel",
            "POST /api/local/prescription-orders/authority/{*}/change",
            "POST /api/local/prescription-orders/authority/{*}/finalize",
            "POST /api/local/prescription-orders/authority/{*}/reissue",
            "POST /api/local/prescription-orders/authority/{*}/resend",
            "POST /api/local/prescription-orders/authority/{*}/stop",
            "POST /api/local/prescription-orders",
            "POST /api/local/prescription-orders/do-import");

    private static final Set<String> EXPECTED_ADMIN_INTERNAL_ROUTE_KEYS = Set.of(
            "GET /api/admin/internal/orca/patients/sync/status");

    @Test
    void publicRoutesFollowTaxonomyInventory() {
        List<RestRouteInventorySupport.RouteDefinition> routes = RestRouteInventorySupport.discoverRoutes();
        Set<String> routeKeys = RestRouteInventorySupport.routeKeys(routes);

        assertThat(routeKeys).hasSize(routes.size());
        assertThat(routes)
                .filteredOn(route -> route.path().startsWith("/api/orca/"))
                .filteredOn(route -> route.produces().stream().anyMatch(PublicRouteInventoryContractTest::isTextPlain))
                .isEmpty();

        Set<String> officialRoutes = collectByPrefix(routeKeys, "/api/orca/official/");
        Set<String> masterRoutes = collectByPrefix(routeKeys, "/api/orca/master/");
        Set<String> localRoutes = collectByPrefix(routeKeys, "/api/local/");
        Set<String> adminInternalRoutes = collectByPrefix(routeKeys, "/api/admin/internal/");

        assertThat(officialRoutes).containsExactlyInAnyOrderElementsOf(EXPECTED_OFFICIAL_ROUTE_KEYS);
        assertThat(masterRoutes).containsExactlyInAnyOrderElementsOf(EXPECTED_MASTER_ROUTE_KEYS);
        assertThat(localRoutes).containsExactlyInAnyOrderElementsOf(EXPECTED_LOCAL_ROUTE_KEYS);
        assertThat(adminInternalRoutes).containsExactlyInAnyOrderElementsOf(EXPECTED_ADMIN_INTERNAL_ROUTE_KEYS);
        assertThat(routeKeys)
                .noneMatch(routeKey -> routeKey.contains(" /api/orca/queue"))
                .noneMatch(routeKey -> routeKey.contains(" /api/orca/pusheventgetv2"));

        assertThat(routes)
                .filteredOn(route -> route.path().startsWith("/api/orca/"))
                .allMatch(route -> route.path().startsWith("/api/orca/official/")
                        || route.path().startsWith("/api/orca/master/"));
        assertThat(routeKeys)
                .filteredOn(routeKey -> routeKey.contains(" /api/local/diagnoses"))
                .containsExactly("GET /api/local/diagnoses/{*}");
        assertThat(routeKeys)
                .noneMatch(routeKey -> routeKey.contains(" /api/prescriptions"));
        assertThat(localRoutes)
                .allMatch(routeKey -> !isOfficialLike(routeKey));
        assertThat(routeKeys).contains(
                "GET /api/orca/official/patientgetv2",
                "POST /api/orca/official/patientmodv2/outpatient/create",
                "POST /api/orca/official/patientmodv2/outpatient/update",
                "POST /api/local/patients/search");
        assertThat(routeKeys)
                .noneMatch(PublicRouteInventoryContractTest::isDisallowedPatientCrudSurface);
    }

    @Test
    void applicationDoesNotRegisterLegacyAliasClasses() {
        Set<String> classNames = new OpenDolphinRestApplication().getClasses().stream()
                .map(Class::getName)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        assertThat(classNames).contains(
                "open.dolphin.rest.orca.OrcaOrderMasterResource",
                "open.dolphin.rest.orca.OrcaPatientSyncStatusResource");
        assertThat(classNames).doesNotContain(
                "open.dolphin.rest.AdminAccessPasswordResetResource",
                "open.dolphin.rest.PVTResource",
                "open.dolphin.rest.orca.OrcaMedicalOutpatientResource",
                "open.dolphin.rest.orca.OrcaDiseaseResource",
                "open.dolphin.rest.orca.OrcaLocalMedicalOutpatientResource",
                "open.orca.rest.OrcaResource",
                "open.orca.rest.OrcaFacilityResource",
                "open.orca.rest.OrcaPatientDiseaseResource");
    }

    @Test
    void routeSharedAuditActionsFollowTaxonomyPrefixes() throws Exception {
        assertThat(readStringConstant(PatientModV2OutpatientResource.class, "CREATE_AUDIT_ACTION"))
                .startsWith("ORCA_OFFICIAL_")
                .doesNotContain("OFFICIAL" + "_PATIENT_");
        assertThat(readStringConstant(PatientModV2OutpatientResource.class, "UPDATE_AUDIT_ACTION"))
                .startsWith("ORCA_OFFICIAL_")
                .doesNotContain("OFFICIAL" + "_PATIENT_");
        assertThat(readStringConstant(OrcaPatientApiResource.class, "AUDIT_ACTION"))
                .isEqualTo("ORCA_OFFICIAL_GET_PATIENT");
        assertThat(readStringConstant(open.dolphin.rest.orca.AbstractOrcaWrapperResource.class,
                "AUDIT_APPOINTMENT_OUTPATIENT_ACTION"))
                .isEqualTo("ORCA_OFFICIAL_APPOINTMENT_OUTPATIENT");
        assertThat(readStringConstant(open.dolphin.rest.orca.AbstractOrcaWrapperResource.class,
                "AUDIT_SYNC_PATIENTS_ACTION"))
                .isEqualTo("ORCA_OFFICIAL_SYNC_PATIENTS");
        assertThat(AbstractOrcaRestResource.resolveAuditScope("/api/orca/official/patientgetv2"))
                .isEqualTo("official");
        assertThat(AbstractOrcaRestResource.resolveAuditScope("/api/orca/master/order/inputsets"))
                .isEqualTo("master");
        assertThat(AbstractOrcaRestResource.resolveAuditScope("/api/local/order/recommendations"))
                .isEqualTo("local");
        assertThat(AbstractOrcaRestResource.resolveAuditScope("/api/admin/internal/orca/patients/sync/status"))
                .isEqualTo("admin-internal");
    }

    private static Set<String> collectByPrefix(Set<String> routeKeys, String prefix) {
        return routeKeys.stream()
                .filter(routeKey -> routeKey.contains(" " + prefix))
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private static boolean isOfficialLike(String routeKey) {
        String normalized = routeKey.toLowerCase(Locale.ROOT);
        return normalized.contains("patientmodv2")
                || normalized.contains("patientgetv2")
                || normalized.contains("medical-mod-v2")
                || normalized.contains("medicalmodv2")
                || normalized.contains("subjectivesv2")
                || normalized.contains("manageusersv2")
                || normalized.contains("incomeinfv2")
                || normalized.contains("patientlst");
    }

    private static boolean isDisallowedPatientCrudSurface(String routeKey) {
        String normalized = routeKey.toLowerCase(Locale.ROOT);
        if (!normalized.contains("/api/local/patient")
                && !normalized.contains("/api/orca/official/patient")) {
            return false;
        }
        if (normalized.equals("post /api/local/patients/search")
                || normalized.equals("get /api/orca/official/patientgetv2")
                || normalized.equals("post /api/orca/official/patientmodv2/outpatient/create")
                || normalized.equals("post /api/orca/official/patientmodv2/outpatient/update")) {
            return false;
        }
        if (normalized.startsWith("delete ")) {
            return true;
        }
        if (normalized.startsWith("put /api/local/patient")
                || normalized.startsWith("patch /api/local/patient")
                || normalized.startsWith("post " + "/api/local/patients/" + "mutation")) {
            return true;
        }
        return normalized.contains("/api/local/patient") && !normalized.equals("post /api/local/patients/search");
    }

    private static boolean isTextPlain(String mediaType) {
        if (mediaType == null || mediaType.isBlank()) {
            return false;
        }
        String normalized = mediaType.trim().toLowerCase(Locale.ROOT);
        int separator = normalized.indexOf(';');
        if (separator >= 0) {
            normalized = normalized.substring(0, separator).trim();
        }
        return MediaType.TEXT_PLAIN.equalsIgnoreCase(normalized);
    }

    private static String readStringConstant(Class<?> type, String fieldName) throws Exception {
        Field field = type.getDeclaredField(fieldName);
        field.setAccessible(true);
        return (String) field.get(null);
    }
}
