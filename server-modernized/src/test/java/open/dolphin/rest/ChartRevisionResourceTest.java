package open.dolphin.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.core.Response;
import java.lang.reflect.Field;
import java.util.Locale;
import open.dolphin.reporting.ReportingResult;
import open.dolphin.session.ChartRevisionExportService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ChartRevisionResourceTest {

    private ChartRevisionResource resource;
    private ChartRevisionExportService exportService;
    private HttpServletRequest request;

    @BeforeEach
    void setUp() throws Exception {
        resource = new ChartRevisionResource();
        exportService = mock(ChartRevisionExportService.class);
        request = mock(HttpServletRequest.class);
        setField(resource, "exportService", exportService);
        when(request.getRemoteUser()).thenReturn("F001:user01");
    }

    @Test
    void printChartPdfUsesServerDerivedExportPayloadWithInlineDisposition() {
        byte[] bytes = "%PDF-single".getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        when(exportService.exportChartPdf(10L, "F001"))
                .thenReturn(new ReportingResult(bytes, "chart-revisions-10.pdf", "patient_summary", Locale.JAPAN));

        Response response = resource.printChartPdf(request, 10L);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(response.getMediaType().toString()).isEqualTo("application/pdf");
        assertThat(response.getHeaderString("Content-Disposition"))
                .isEqualTo("inline; filename=\"chart-revisions-10.pdf\"");
        assertThat((byte[]) response.getEntity()).isEqualTo(bytes);
        verify(exportService).exportChartPdf(10L, "F001");
    }

    @Test
    void printChartPeriodPdfUsesSameBoundedPeriodExportServiceWithInlineDisposition() {
        byte[] bytes = "%PDF-period".getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        when(exportService.exportChartPeriodPdf("F001", "2026-05-01", "2026-05-31", 501L))
                .thenReturn(new ReportingResult(
                        bytes,
                        "chart-revisions-2026-05-01-2026-05-31.pdf",
                        "patient_summary",
                        Locale.JAPAN));

        Response response = resource.printChartPeriodPdf(request, "2026-05-01", "2026-05-31", 501L);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(response.getMediaType().toString()).isEqualTo("application/pdf");
        assertThat(response.getHeaderString("Content-Disposition"))
                .isEqualTo("inline; filename=\"chart-revisions-2026-05-01-2026-05-31.pdf\"");
        assertThat((byte[]) response.getEntity()).isEqualTo(bytes);
        verify(exportService).exportChartPeriodPdf("F001", "2026-05-01", "2026-05-31", 501L);
    }

    @Test
    void exportChartPdfKeepsAttachmentDisposition() {
        byte[] bytes = "%PDF-export".getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        when(exportService.exportChartPdf(10L, "F001"))
                .thenReturn(new ReportingResult(bytes, "chart-revisions-10.pdf", "patient_summary", Locale.JAPAN));

        Response response = resource.exportChartPdf(request, 10L);

        assertThat(response.getHeaderString("Content-Disposition"))
                .isEqualTo("attachment; filename=\"chart-revisions-10.pdf\"");
        verify(exportService).exportChartPdf(10L, "F001");
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
