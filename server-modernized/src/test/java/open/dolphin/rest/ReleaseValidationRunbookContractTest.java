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

    @Test
    void releaseValidationDefinesSanitizedOrcaBillingReportLiveProfile() throws IOException {
        String runbook = Files.readString(Path.of("../docs/runbooks/release-validation.md"));

        assertThat(runbook)
                .contains("ORCA billing/report live profile")
                .contains("candidate discovery")
                .contains("exact selected-candidate preflight")
                .contains("income-info")
                .contains("/api/orca/official/reports/{type}")
                .contains("orca_billing_cache")
                .contains("orca_report_snapshot")
                .contains("server-generated storage key/digest")
                .contains("storageUploadStatus")
                .contains("reportBinaryAvailable")
                .contains("OrcaReportBinaryStorageService")
                .contains("raw ORCA body")
                .contains("raw invoice number")
                .contains("raw `Data_Id`")
                .contains("HAR、trace、video、screenshot")
                .contains("ORCA由来 snapshot/cache");
    }

    @Test
    void orcaConnectionContractDefinesBillingReportLiveEvidenceBoundary() throws IOException {
        String contract = Files.readString(Path.of("../docs/contracts/orca-connection.md"));

        assertThat(contract)
                .contains("Billing / Report Live Validation Profile")
                .contains("exact selected-candidate preflight")
                .contains("income-info")
                .contains("/api/orca/official/reports/{type}")
                .contains("orca_billing_cache")
                .contains("orca_report_snapshot")
                .contains("server-generated storage key/digest")
                .contains("storageUploadStatus")
                .contains("reportBinaryAvailable")
                .contains("OrcaReportBinaryStorageService")
                .contains("digest verification")
                .contains("会計済み、収納済み、レセプト正本化、帳票正本化の証明ではない");
    }
}
