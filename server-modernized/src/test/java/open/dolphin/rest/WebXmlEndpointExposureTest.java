package open.dolphin.rest;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.ws.rs.GET;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class WebXmlEndpointExposureTest {

    @Test
    void webXmlKeepsOnlyApiFilterMappings() throws IOException {
        String webXml = Files.readString(Path.of("src/main/webapp/WEB-INF/web.xml"));
        assertThat(webXml)
                .contains("<url-pattern>/api/*</url-pattern>")
                .doesNotContain("<url-pattern>/resources/*</url-pattern>")
                .doesNotContain("<url-pattern>/orca/*</url-pattern>")
                .doesNotContain("resteasy.resources")
                .doesNotContain("HttpServletDispatcher")
                .doesNotContain("ResteasyBootstrap");
    }

    @Test
    void applicationRegistersCurrentResourcesWithoutLegacyEndpoints() {
        Set<String> classNames = new OpenDolphinRestApplication().getClasses().stream()
                .map(Class::getName)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        assertThat(classNames)
                .contains("open.dolphin.rest.ScheduleResource")
                .contains("open.dolphin.rest.EncounterResource")
                .contains("open.dolphin.rest.LocalMedicalSummaryResource")
                .contains("open.dolphin.rest.LocalDiagnosisResource")
                .contains("open.dolphin.rest.OperationsHealthResource")
                .contains("open.dolphin.rest.AdminOrcaCapabilitiesResource")
                .contains("open.dolphin.rest.AdminOrcaUserLinkResource")
                .contains("open.dolphin.rest.PvtWorkerHealthResource")
                .contains("open.dolphin.rest.PatientModV2OutpatientResource")
                .contains("open.dolphin.rest.orca.OrcaChartSupportResource")
                .contains("open.dolphin.rest.orca.OrcaReportDocumentResource")
                .contains("open.dolphin.rest.orca.OrcaOrderMasterResource")
                .contains("open.dolphin.rest.orca.OrcaPatientSyncStatusResource")
                .doesNotContain("open.dolphin.rest.KarteDocumentWriteResource")
                .doesNotContain("open.dolphin.touch.DolphinResourceASP")
                .doesNotContain("open.dolphin.rest.PatientResource")
                .doesNotContain("open.dolphin.rest.NLabResource")
                .doesNotContain("open.dolphin.rest.ReportingResource")
                .doesNotContain("open.dolphin.rest.ChartEventResource")
                .doesNotContain("open.dolphin.rest.PVTResource2")
                .doesNotContain("open.dolphin.rest.PVTResource")
                .doesNotContain("open.dolphin.rest.ServerInfoResource")
                .doesNotContain("open.dolphin.rest.AdminSecurityResource")
                .doesNotContain("open.dolphin.rest.PatientModV2OutpatientMockResource")
                .doesNotContain("open.orca.rest.OrcaMasterApiAliasResource")
                .doesNotContain("open.dolphin.rest.OrcaAcceptanceListResource")
                .doesNotContain("open.dolphin.rest.OrcaSystemManagementResource")
                .doesNotContain("open.dolphin.rest.OrcaReportResource")
                .doesNotContain("open.dolphin.rest.OrcaDiseaseApiResource")
                .doesNotContain("open.dolphin.rest.OrcaMedicalApiResource")
                .doesNotContain("open.dolphin.rest.OrcaAdditionalApiResource")
                .doesNotContain("open.dolphin.rest.orca.OrcaMedicalAdministrationResource")
                .doesNotContain("open.dolphin.rest.OrcaBridgeResource")
                .doesNotContain("open.dolphin.rest.AdminAccessPasswordResetResource")
                .doesNotContain("open.dolphin.rest.orca.OrcaMedicalOutpatientResource")
                .doesNotContain("open.dolphin.rest.orca.OrcaDiseaseResource")
                .doesNotContain("open.dolphin.rest.orca.OrcaLocalMedicalOutpatientResource")
                .doesNotContain("open.orca.rest.OrcaResource")
                .doesNotContain("open.orca.rest.OrcaFacilityResource")
                .doesNotContain("open.orca.rest.OrcaPatientDiseaseResource")
                .doesNotContain("open.dolphin.rest.OperationsReadinessResource");

        Set<String> routeKeys = RestRouteInventorySupport.routeKeys(RestRouteInventorySupport.discoverRoutes());
        assertThat(routeKeys)
                .contains(
                        "POST /api/orca/official/appointments/list",
                        "POST /api/charts/document-drafts",
                        "GET /api/orca/master/drug",
                        "GET /api/local/order/bundles",
                        "GET /api/admin/internal/orca/patients/sync/status")
                .doesNotContain(
                        "GET /api/orca/queue",
                        "POST /api/orca/pusheventgetv2",
                        "DELETE /api/orca/queue",
                        "POST /api/karte/document",
                        "PUT /api/karte/document",
                        "DELETE /api/karte/document/{*}",
                        "PUT /api/karte/document/{*}")
                .allMatch(routeKey -> !routeKey.contains(" /api/orca/")
                        || routeKey.contains(" /api/orca/official/")
                        || routeKey.contains(" /api/orca/master/"));

        assertThat(OperationsHealthResource.class.getAnnotation(jakarta.ws.rs.Path.class))
                .isNotNull()
                .extracting(jakarta.ws.rs.Path::value)
                .isEqualTo("/health");
        String readinessPath = Arrays.stream(OperationsHealthResource.class.getDeclaredMethods())
                .filter(method -> method.getName().equals("readiness"))
                .filter(method -> method.isAnnotationPresent(GET.class))
                .map(method -> method.getAnnotation(jakarta.ws.rs.Path.class))
                .filter(Objects::nonNull)
                .map(jakarta.ws.rs.Path::value)
                .findFirst()
                .orElseThrow();
        assertThat(readinessPath).isEqualTo("/readiness");
    }
}
