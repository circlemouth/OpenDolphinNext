package open.dolphin.rest;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
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
                .collect(java.util.stream.Collectors.toSet());

        assertThat(classNames)
                .contains("open.dolphin.rest.KarteDocumentWriteResource")
                .contains("open.dolphin.rest.AdminAccessPasswordResetResource")
                .contains("open.dolphin.rest.AdminOrcaUserLinkResource")
                .contains("open.dolphin.rest.OperationsHealthResource")
                .contains("open.dolphin.rest.PvtWorkerHealthResource")
                .contains("open.dolphin.rest.orca.OrcaChartSupportResource")
                .contains("open.dolphin.rest.orca.OrcaMedicalOutpatientResource")
                .contains("open.dolphin.rest.orca.OrcaReportDocumentResource")
                .contains("open.orca.rest.OrcaFacilityResource")
                .contains("open.orca.rest.OrcaPatientDiseaseResource")
                .doesNotContain("open.dolphin.touch.DolphinResourceASP")
                .doesNotContain("open.dolphin.rest.PatientResource")
                .doesNotContain("open.dolphin.rest.NLabResource")
                .doesNotContain("open.dolphin.rest.ReportingResource")
                .doesNotContain("open.dolphin.rest.ChartEventResource")
                .doesNotContain("open.dolphin.rest.PVTResource2")
                .doesNotContain("open.dolphin.rest.ScheduleResource")
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
                .doesNotContain("open.dolphin.rest.OrcaBridgeResource");
    }
}
