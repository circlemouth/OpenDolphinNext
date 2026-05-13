package open.dolphin.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.core.Response;
import java.lang.reflect.Field;
import java.util.Locale;
import open.dolphin.infomodel.UserModel;
import open.dolphin.reporting.ReportingResult;
import open.dolphin.rest.dto.chart.ChartRevisionDraftResponse;
import open.dolphin.session.ChartRevisionDraftService;
import open.dolphin.session.ChartRevisionExportService;
import open.dolphin.session.UserServiceBean;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ChartRevisionResourceTest {

    private ChartRevisionResource resource;
    private ChartRevisionDraftService draftService;
    private ChartRevisionExportService exportService;
    private UserServiceBean userServiceBean;
    private HttpServletRequest request;

    @BeforeEach
    void setUp() throws Exception {
        resource = new ChartRevisionResource();
        draftService = mock(ChartRevisionDraftService.class);
        exportService = mock(ChartRevisionExportService.class);
        userServiceBean = mock(UserServiceBean.class);
        request = mock(HttpServletRequest.class);
        setField(resource, "draftService", draftService);
        setField(resource, "exportService", exportService);
        setField(resource, "userServiceBean", userServiceBean);
        when(request.getRemoteUser()).thenReturn("F001:user01");
    }

    @Test
    void createDocumentDraftUsesChartRevisionAuthorityAndAuthenticatedActor() {
        UserModel user = new UserModel();
        user.setId(101L);
        ChartRevisionDraftResponse expected = new ChartRevisionDraftResponse();
        expected.setChartId(10L);
        expected.setRevisionId(11L);
        expected.setRevisionNumber(1);
        expected.setStatus("DRAFT");
        expected.setDocPk(10L);
        when(userServiceBean.getUser("F001:user01")).thenReturn(user);
        when(draftService.createDraft("F001", 101L, "{\"karteBean\":{\"id\":201}}"))
                .thenReturn(expected);

        ChartRevisionDraftResponse response = resource.createDocumentDraft(
                request,
                "{\"karteBean\":{\"id\":201}}");

        assertThat(response).isSameAs(expected);
        verify(draftService).createDraft("F001", 101L, "{\"karteBean\":{\"id\":201}}");
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
