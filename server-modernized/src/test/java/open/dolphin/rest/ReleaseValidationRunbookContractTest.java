package open.dolphin.rest;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class ReleaseValidationRunbookContractTest {

    @Test
    void releaseValidationIncludesOrcaBillingReportAndReadinessGates() throws IOException {
        String runbook = Files.readString(Path.of("../docs/runbooks/release-validation.md"));

        assertThat(runbook)
                .contains("PublicRouteInventoryContractTest")
                .contains("WebXmlEndpointExposureTest")
                .contains("OrcaChartSupportResourceTest")
                .contains("OrcaReportDocumentResourceTest")
                .contains("OrcaBillingCacheStoreTest")
                .contains("OperationsHealthResourceTest")
                .contains("orcaBillingCache")
                .contains("server-generated storage key/digest")
                .doesNotContain("OrcaReportResource");
    }
}
