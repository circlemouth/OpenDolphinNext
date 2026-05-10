package open.dolphin.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doAnswer;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.MultivaluedHashMap;
import jakarta.ws.rs.core.StreamingOutput;
import jakarta.ws.rs.core.UriInfo;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import javax.imageio.ImageIO;
import open.dolphin.rest.dto.PatientImageEntryResponse;
import open.dolphin.rest.dto.PatientImageUploadResponse;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.TestServerConfigurationResolvers;
import open.dolphin.security.audit.AuthoritativeAuditRepository;
import open.dolphin.security.audit.AuditTrailService;
import open.dolphin.session.PatientImageServiceBean;
import open.dolphin.session.PatientServiceBean;
import open.dolphin.storage.attachment.AttachmentStorageManager;
import open.dolphin.storage.attachment.AttachmentStorageMode;
import org.jboss.resteasy.plugins.providers.multipart.InputPart;
import org.jboss.resteasy.plugins.providers.multipart.MultipartFormDataInput;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PatientImagesResourceTest {

    @InjectMocks
    private PatientImagesResource resource;

    @Mock
    private PatientServiceBean patientServiceBean;

    @Mock
    private PatientImageServiceBean patientImageServiceBean;

    @Mock
    private AuditTrailService auditTrailService;

    @Mock
    private AuthoritativeAuditRepository authoritativeAuditRepository;

    @Mock
    private AttachmentStorageManager attachmentStorageManager;

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpServletResponse response;

    @Mock
    private UriInfo uriInfo;

    @Mock
    private jakarta.ws.rs.core.UriBuilder uriBuilder;

    @Mock
    private MultipartFormDataInput input;

    @Mock
    private InputPart part;

    @BeforeEach
    void setUp() throws Exception {
        setField(resource, "httpServletRequest", request);
        setField(resource, "httpServletResponse", response);
        setField(resource, "uriInfo", uriInfo);
        setField(resource, "configurationResolver", configurationResolver(
                String.valueOf(5L * 1024L * 1024L), "4096", "4096"));

        lenient().when(request.getRemoteUser()).thenReturn("F001:user01");
        lenient().when(request.getRemoteAddr()).thenReturn("127.0.0.1");
        lenient().when(request.getRequestURI()).thenReturn("/openDolphin/api/patients/P001/images");
        Map<String, String> headers = new java.util.HashMap<>();
        headers.put("User-Agent", "JUnit");
        headers.put("X-Request-Id", "req-1");
        lenient().when(request.getHeader(anyString()))
                .thenAnswer(invocation -> headers.get(invocation.getArgument(0, String.class)));
        lenient().when(request.isUserInRole("ADMIN")).thenReturn(false);
        lenient().when(uriInfo.getAbsolutePathBuilder()).thenReturn(uriBuilder);
        lenient().when(uriBuilder.path(anyString())).thenReturn(uriBuilder);
        lenient().when(uriBuilder.build())
                .thenReturn(java.net.URI.create("https://example.test/app/api/patients/P001/images/10"));
        lenient().when(patientServiceBean.getPatientById("F001", "P001"))
                .thenReturn(new open.dolphin.infomodel.PatientModel());
        lenient().when(attachmentStorageManager.getMode()).thenReturn(AttachmentStorageMode.S3);
        lenient().when(authoritativeAuditRepository.isWritePathAvailable()).thenReturn(true);

        lenient().when(input.getFormDataMap()).thenReturn(Map.of("file", List.of(part)));
        MultivaluedHashMap<String, String> partHeaders = new MultivaluedHashMap<>();
        partHeaders.add("Content-Disposition", "form-data; name=\"file\"; filename=\"test.png\"");
        lenient().when(part.getHeaders()).thenReturn(partHeaders);
    }

    @Test
    void upload_rejectsSpoofedContentTypePayload() throws Exception {
        when(part.getMediaType()).thenReturn(MediaType.valueOf("image/png"));
        when(part.getBody(eq(java.io.InputStream.class), any())).thenReturn(
                new ByteArrayInputStream("not-an-image".getBytes()));

        assertThatThrownBy(() -> resource.upload("P001", input))
                .isInstanceOf(WebApplicationException.class)
                .extracting(ex -> ((WebApplicationException) ex).getResponse().getStatus())
                .isEqualTo(415);
    }

    @Test
    void upload_rejectsBrokenImageEvenWithMagicHeader() throws Exception {
        byte[] brokenPng = new byte[] {
                (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
                0x00, 0x01, 0x02
        };
        when(part.getMediaType()).thenReturn(MediaType.valueOf("image/png"));
        when(part.getBody(eq(java.io.InputStream.class), any())).thenReturn(new ByteArrayInputStream(brokenPng));

        assertThatThrownBy(() -> resource.upload("P001", input))
                .isInstanceOf(WebApplicationException.class)
                .extracting(ex -> ((WebApplicationException) ex).getResponse().getStatus())
                .isEqualTo(400);
    }

    @Test
    void upload_acceptsValidPngAndNormalizesPayload() throws Exception {
        byte[] png = createPng(40, 30);
        when(part.getMediaType()).thenReturn(MediaType.valueOf("image/png"));
        when(part.getBody(eq(java.io.InputStream.class), any())).thenReturn(new ByteArrayInputStream(png));
        when(patientImageServiceBean.uploadImage(eq("F001"), eq("P001"), eq("F001:user01"),
                eq("test.png"), eq("image/png"), any(Path.class), any(Long.class)))
                .thenReturn(new PatientImageServiceBean.UploadResult(10L, 20L, java.util.Date.from(Instant.parse("2024-01-01T00:00:00Z"))));

        PatientImageUploadResponse response = resource.upload("P001", input);

        assertThat(response.getImageId()).isEqualTo(20L);
        assertThat(response.getDocumentId()).isEqualTo(10L);
        ArgumentCaptor<Path> pathCaptor = ArgumentCaptor.forClass(Path.class);
        verify(patientImageServiceBean).uploadImage(eq("F001"), eq("P001"), eq("F001:user01"),
                eq("test.png"), eq("image/png"), pathCaptor.capture(), any(Long.class));
        assertThat(Files.exists(pathCaptor.getValue())).isFalse();
    }

    @Test
    void upload_rejectsSvgActiveContent() throws Exception {
        when(part.getMediaType()).thenReturn(MediaType.valueOf("image/svg+xml"));

        assertThatThrownBy(() -> resource.upload("P001", input))
                .isInstanceOf(WebApplicationException.class)
                .extracting(ex -> ((WebApplicationException) ex).getResponse().getStatus())
                .isEqualTo(415);
    }

    @Test
    void upload_rejectsOversizedPayloadDuringStreaming() throws Exception {
        setField(resource, "configurationResolver", configurationResolver("1024", "4096", "4096"));
        byte[] payload = new byte[2048];
        payload[0] = (byte) 0x89;
        payload[1] = 0x50;
        payload[2] = 0x4E;
        payload[3] = 0x47;
        payload[4] = 0x0D;
        payload[5] = 0x0A;
        payload[6] = 0x1A;
        payload[7] = 0x0A;
        when(part.getMediaType()).thenReturn(MediaType.valueOf("image/png"));
        when(part.getBody(eq(java.io.InputStream.class), any())).thenReturn(new ByteArrayInputStream(payload));

        assertThatThrownBy(() -> resource.upload("P001", input))
                .isInstanceOf(WebApplicationException.class)
                .extracting(ex -> ((WebApplicationException) ex).getResponse().getStatus())
                .isEqualTo(413);
    }

    @Test
    void upload_rejectsOversizedDimensions() throws Exception {
        setField(resource, "configurationResolver", configurationResolver(
                String.valueOf(5L * 1024L * 1024L), "10", "10"));

        byte[] png = createPng(100, 50);
        when(part.getMediaType()).thenReturn(MediaType.valueOf("image/png"));
        when(part.getBody(eq(java.io.InputStream.class), any())).thenReturn(new ByteArrayInputStream(png));

        assertThatThrownBy(() -> resource.upload("P001", input))
                .isInstanceOf(WebApplicationException.class)
                .extracting(ex -> ((WebApplicationException) ex).getResponse().getStatus())
                .isEqualTo(413);
    }

    @Test
    void upload_returnsNotFoundWhenPatientIsInaccessible() {
        when(patientServiceBean.getPatientById("F001", "P999")).thenReturn(null);

        assertThatThrownBy(() -> resource.upload("P999", input))
                .isInstanceOf(WebApplicationException.class)
                .extracting(ex -> ((WebApplicationException) ex).getResponse().getStatus())
                .isEqualTo(404);
        verify(patientImageServiceBean, never()).uploadImage(anyString(), anyString(), anyString(), anyString(), anyString(), any(Path.class), any(Long.class));
    }

    @Test
    void upload_returnsServiceUnavailableWhenAuditWritePathIsUnavailableBeforeParsingMultipart() {
        when(authoritativeAuditRepository.isWritePathAvailable()).thenReturn(false);

        assertThatThrownBy(() -> resource.upload("P001", input))
                .isInstanceOf(WebApplicationException.class)
                .extracting(ex -> ((WebApplicationException) ex).getResponse().getStatus())
                .isEqualTo(503);
        verify(input, never()).getFormDataMap();
        verify(patientImageServiceBean, never()).uploadImage(anyString(), anyString(), anyString(), anyString(), anyString(), any(Path.class), any(Long.class));
    }

    @Test
    void list_returnsNoStoreHeaders() {
        PatientImageEntryResponse entry = new PatientImageEntryResponse();
        entry.setImageId(10L);
        when(patientImageServiceBean.listImages("F001", "P001")).thenReturn(List.of(entry));

        Response actual = resource.list("P001");

        assertThat(actual.getStatus()).isEqualTo(200);
        assertThat(actual.getHeaderString("Cache-Control")).isEqualTo("private, no-store, max-age=0, must-revalidate");
        assertThat(actual.getHeaderString("Pragma")).isEqualTo("no-cache");
        assertThat(actual.getHeaderString("Expires")).isEqualTo("0");
        @SuppressWarnings("unchecked")
        List<PatientImageEntryResponse> items = (List<PatientImageEntryResponse>) actual.getEntity();
        assertThat(items).hasSize(1);
        assertThat(items.get(0).getDownloadUrl()).isEqualTo("https://example.test/app/api/patients/P001/images/10");
        verify(response).setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
    }

    @Test
    void download_returnsNoStoreHeaders() throws Exception {
        byte[] bytes = new byte[] {1, 2, 3};
        PatientImageServiceBean.DownloadHandle handle = new PatientImageServiceBean.DownloadHandle(
                10L, "test.png", "image/png", bytes.length, "s3://test-bucket/path/test.png", "digest-1");
        when(patientImageServiceBean.getImageForDownload("F001", "P001", 10L)).thenReturn(handle);
        doAnswer(invocation -> {
            OutputStream out = invocation.getArgument(1, OutputStream.class);
            try {
                out.write(bytes);
            } catch (Exception ex) {
                throw new IllegalStateException(ex);
            }
            return null;
        }).when(attachmentStorageManager).writeBinaryTo(any(), any(OutputStream.class));

        Response actual = resource.download("P001", 10L);

        assertThat(actual.getStatus()).isEqualTo(200);
        assertThat(actual.getHeaderString("Cache-Control")).isEqualTo("private, no-store, max-age=0, must-revalidate");
        assertThat(actual.getHeaderString("Pragma")).isEqualTo("no-cache");
        assertThat(actual.getHeaderString("Expires")).isEqualTo("0");
        assertThat(actual.getHeaderString("Content-Length")).isEqualTo("3");
        assertThat(actual.getHeaderString("Content-Disposition")).isEqualTo("attachment; filename=\"test.png\"");
        assertThat(toBytes(actual.getEntity())).containsExactly(bytes);
        verify(attachmentStorageManager).writeBinaryTo(argThat(attachment ->
                        attachment.getId() == 10L
                                && "s3://test-bucket/path/test.png".equals(attachment.getUri())
                                && "test.png".equals(attachment.getFileName())
                                && attachment.getContentSize() == 3L),
                any(OutputStream.class));
        verify(response).setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
    }

    @Test
    void download_rejectsWhenUriIsMissing() throws Exception {
        PatientImageServiceBean.DownloadHandle handle = new PatientImageServiceBean.DownloadHandle(
                12L, "inline.png", "image/png", 4L, null, "digest-inline");
        when(patientImageServiceBean.getImageForDownload("F001", "P001", 12L)).thenReturn(handle);

        assertThatThrownBy(() -> resource.download("P001", 12L))
                .isInstanceOf(WebApplicationException.class)
                .extracting(ex -> ((WebApplicationException) ex).getResponse().getStatus())
                .isEqualTo(500);
        verify(attachmentStorageManager, never()).writeBinaryTo(any(), any(OutputStream.class));
    }

    @Test
    void download_returnsPdfPayloadWithNoStoreHeaders() throws Exception {
        byte[] bytes = "%PDF-1.4\nmock\n".getBytes(StandardCharsets.UTF_8);
        PatientImageServiceBean.DownloadHandle handle = new PatientImageServiceBean.DownloadHandle(
                11L, "report.pdf", "application/pdf", bytes.length, "s3://test-bucket/path/report.pdf", "digest-2");
        when(patientImageServiceBean.getImageForDownload("F001", "P001", 11L)).thenReturn(handle);
        doAnswer(invocation -> {
            OutputStream out = invocation.getArgument(1, OutputStream.class);
            try {
                out.write(bytes);
            } catch (Exception ex) {
                throw new IllegalStateException(ex);
            }
            return null;
        }).when(attachmentStorageManager).writeBinaryTo(any(), any(OutputStream.class));

        Response actual = resource.download("P001", 11L);

        assertThat(actual.getStatus()).isEqualTo(200);
        assertThat(actual.getMediaType().toString()).isEqualTo("application/pdf");
        assertThat(actual.getHeaderString("Cache-Control")).isEqualTo("private, no-store, max-age=0, must-revalidate");
        assertThat(actual.getHeaderString("Content-Disposition")).isEqualTo("attachment; filename=\"report.pdf\"");
        assertThat(toBytes(actual.getEntity())).containsExactly(bytes);
    }

    @Test
    void download_returnsNotFoundWhenAttachmentDoesNotExist() {
        when(patientImageServiceBean.getImageForDownload("F001", "P001", 999L)).thenReturn(null);

        assertThatThrownBy(() -> resource.download("P001", 999L))
                .isInstanceOf(WebApplicationException.class)
                .extracting(ex -> ((WebApplicationException) ex).getResponse().getStatus())
                .isEqualTo(404);
    }

    private static byte[] createPng(int width, int height) throws Exception {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        image.setRGB(0, 0, new Color(255, 0, 0, 255).getRGB());
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            ImageIO.write(image, "png", out);
            return out.toByteArray();
        }
    }

    private static byte[] toBytes(Object entity) {
        assertThat(entity).isInstanceOf(StreamingOutput.class);
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            ((StreamingOutput) entity).write(out);
            return out.toByteArray();
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    private static ServerConfigurationResolver configurationResolver(String maxBytes, String maxWidth, String maxHeight) {
        return TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_PATIENT_IMAGES_ENABLED, "true",
                ServerConfigurationResolver.KEY_PATIENT_IMAGES_MAX_BYTES, maxBytes,
                ServerConfigurationResolver.KEY_PATIENT_IMAGES_MAX_WIDTH, maxWidth,
                ServerConfigurationResolver.KEY_PATIENT_IMAGES_MAX_HEIGHT, maxHeight);
    }
}
