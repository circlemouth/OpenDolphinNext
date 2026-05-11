package open.dolphin.rest;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class ProtectedExportAuthorizationMatrixTest {

    private static final Path MATRIX_PATH = Path.of("docs/contracts/protected-export-authorization-matrix.md");

    @Test
    void protectedExportAttachmentAndReportRoutesAreCoveredByAuthorizationMatrix() throws IOException {
        String matrix = Files.readString(resolveMatrixPath());
        List<RestRouteInventorySupport.RouteDefinition> routes = RestRouteInventorySupport.discoverRoutes();
        Set<String> protectedRouteKeys = routes.stream()
                .filter(ProtectedExportAuthorizationMatrixTest::isProtectedExportAttachmentOrReportRoute)
                .map(RestRouteInventorySupport.RouteDefinition::key)
                .collect(Collectors.toCollection(java.util.TreeSet::new));

        assertThat(protectedRouteKeys).isNotEmpty();
        assertThat(protectedRouteKeys).allMatch(routeKey -> matrix.contains("`" + routeKey + "`"));
        assertThat(matrix)
                .contains("## Protected Route Matrix")
                .contains("## Misuse Cases")
                .contains("server-side session")
                .contains("operation-specific capability")
                .contains("append-only")
                .contains("no-store")
                .contains("raw ORCA body")
                .contains("Authorization")
                .contains("storage key");
    }

    private static boolean isProtectedExportAttachmentOrReportRoute(RestRouteInventorySupport.RouteDefinition route) {
        String path = route.path().toLowerCase(Locale.ROOT);
        if (path.contains("/revisions/export")) {
            return true;
        }
        if (path.startsWith("/api/orca/official/reports/")) {
            return true;
        }
        if (path.startsWith("/api/patients/") && path.contains("/images")) {
            return true;
        }
        if (path.equals("/api/karte/document") || path.startsWith("/api/karte/document/")) {
            return true;
        }
        return path.startsWith("/api/karte/attachment/")
                || path.startsWith("/api/karte/image/")
                || path.startsWith("/api/karte/docinfo/all/");
    }

    private static Path resolveMatrixPath() {
        if (Files.exists(MATRIX_PATH)) {
            return MATRIX_PATH;
        }
        Path moduleRelative = Path.of("..").resolve(MATRIX_PATH).normalize();
        if (Files.exists(moduleRelative)) {
            return moduleRelative;
        }
        return MATRIX_PATH;
    }
}
