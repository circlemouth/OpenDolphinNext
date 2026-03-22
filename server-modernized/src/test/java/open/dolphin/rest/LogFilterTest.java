package open.dolphin.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.WriteListener;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.ByteArrayOutputStream;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.logging.Handler;
import java.util.logging.Level;
import java.util.logging.LogRecord;
import java.util.logging.Logger;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.security.audit.AuditEventPayload;
import open.dolphin.security.audit.SessionAuditDispatcher;
import org.jboss.logmanager.MDC;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class LogFilterTest {

    private static final String TRACE_ID_HEADER = "X-Trace-Id";

    private LogFilter filter;

    @BeforeEach
    void setUp() throws Exception {
        filter = new LogFilter();
    }

    @AfterEach
    void cleanUpMdc() {
        MDC.remove("traceId");
    }

    @Test
    void unauthenticatedIdentityTokenRequestIsRejected() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        stubResponseOutput(response);

        Map<String, Object> attributes = new HashMap<>();
        doAnswer(invocation -> {
            attributes.put(invocation.getArgument(0, String.class), invocation.getArgument(1));
            return null;
        }).when(request).setAttribute(anyString(), any());
        when(request.getAttribute(anyString())).thenAnswer(invocation -> attributes.get(invocation.getArgument(0, String.class)));

        Map<String, String> headers = new HashMap<>();
        headers.put(TRACE_ID_HEADER, "client-trace-id");
        when(request.getHeader(anyString())).thenAnswer(invocation -> headers.get(invocation.getArgument(0, String.class)));
        when(request.getRequestURI()).thenReturn("/openDolphin/api/admin/token/identity");
        when(request.getMethod()).thenReturn("POST");
        when(request.getRemoteAddr()).thenReturn("192.0.2.10");

        filter.doFilter(request, response, chain);

        verify(response).setHeader(TRACE_ID_HEADER, "client-trace-id");
        verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        verify(chain, never()).doFilter(any(ServletRequest.class), eq(response));
        assertEquals("client-trace-id", attributes.get(LogFilter.class.getName() + ".TRACE_ID"));
    }

    @Test
    void authenticatedIdentityTokenRequestPassesThrough() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        HttpSession session = mock(HttpSession.class);
        when(session.getAttribute(AuthSessionSupport.AUTH_ACTOR_ID)).thenReturn("F001:user01");
        when(request.getSession(false)).thenReturn(session);

        Map<String, Object> attributes = new HashMap<>();
        doAnswer(invocation -> {
            attributes.put(invocation.getArgument(0, String.class), invocation.getArgument(1));
            return null;
        }).when(request).setAttribute(anyString(), any());
        when(request.getAttribute(anyString())).thenAnswer(invocation -> attributes.get(invocation.getArgument(0, String.class)));

        Map<String, String> headers = new HashMap<>();
        headers.put(TRACE_ID_HEADER, "trace-authenticated");
        when(request.getHeader(anyString())).thenAnswer(invocation -> headers.get(invocation.getArgument(0, String.class)));
        when(request.getRequestURI()).thenReturn("/openDolphin/api/admin/token/identity");
        when(request.getMethod()).thenReturn("POST");
        when(request.getRemoteAddr()).thenReturn("192.0.2.12");

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(any(ServletRequest.class), eq(response));
    }

    @Test
    void sessionLoginIsAllowedWithoutAuthenticatedPrincipal() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);

        when(request.getHeader(anyString())).thenReturn(null);
        when(request.getRequestURI()).thenReturn("/openDolphin/api/session/login");
        when(request.getContextPath()).thenReturn("/openDolphin");
        when(request.getMethod()).thenReturn("POST");
        when(request.getRemoteAddr()).thenReturn("192.0.2.21");

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(any(ServletRequest.class), eq(response));
        verify(response, never()).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    }

    @Test
    void healthReadinessIsAllowedWithoutAuthenticatedPrincipal() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);

        when(request.getHeader(anyString())).thenReturn(null);
        when(request.getRequestURI()).thenReturn("/openDolphin/api/health/readiness");
        when(request.getContextPath()).thenReturn("/openDolphin");
        when(request.getMethod()).thenReturn("GET");
        when(request.getRemoteAddr()).thenReturn("192.0.2.22");

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(any(ServletRequest.class), eq(response));
        verify(response, never()).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    }

    @Test
    void operationsReadinessRequiresAuthenticatedPrincipal() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        stubResponseOutput(response);

        when(request.getHeader(anyString())).thenReturn(null);
        when(request.getRequestURI()).thenReturn("/openDolphin/api/operations/readiness");
        when(request.getContextPath()).thenReturn("/openDolphin");
        when(request.getMethod()).thenReturn("GET");
        when(request.getRemoteAddr()).thenReturn("192.0.2.23");

        filter.doFilter(request, response, chain);

        verify(chain, never()).doFilter(any(ServletRequest.class), eq(response));
        verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    }

    @Test
    void unauthorizedRequestGeneratesTraceIdAndLogs() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        stubResponseOutput(response);

        Map<String, Object> attributes = new HashMap<>();
        doAnswer(invocation -> {
            attributes.put(invocation.getArgument(0, String.class), invocation.getArgument(1));
            return null;
        }).when(request).setAttribute(anyString(), any());
        when(request.getAttribute(anyString())).thenAnswer(invocation -> attributes.get(invocation.getArgument(0, String.class)));

        Map<String, String> headers = new HashMap<>();
        when(request.getHeader(anyString())).thenAnswer(invocation -> headers.get(invocation.getArgument(0, String.class)));
        when(request.getRequestURI()).thenReturn("/openDolphin/resources/protected");
        when(request.getMethod()).thenReturn("POST");
        when(request.getRemoteAddr()).thenReturn("192.0.2.11");

        TestLogHandler handler = new TestLogHandler();
        Logger appLogger = Logger.getLogger("open.dolphin");
        Level originalLevel = appLogger.getLevel();
        boolean originalUseParent = appLogger.getUseParentHandlers();
        appLogger.setLevel(Level.ALL);
        appLogger.setUseParentHandlers(false);
        appLogger.addHandler(handler);

        try {
            filter.doFilter(request, response, chain);
        } finally {
            appLogger.removeHandler(handler);
            appLogger.setUseParentHandlers(originalUseParent);
            appLogger.setLevel(originalLevel);
        }

        ArgumentCaptor<String> traceCaptor = ArgumentCaptor.forClass(String.class);
        verify(response).setHeader(eq(TRACE_ID_HEADER), traceCaptor.capture());
        String traceId = traceCaptor.getValue();
        assertNotNull(traceId);

        verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        verify(chain, never()).doFilter(any(ServletRequest.class), any(ServletResponse.class));

        List<LogRecord> records = handler.records();
        LogRecord record = records.stream()
                .filter(r -> r.getMessage() != null && r.getMessage().contains("Unauthorized user"))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Missing unauthorized log record"));
        System.out.println("Captured unauthorized log: " + record.getLevel() + " " + record.getMessage());
        assertTrue(record.getMessage().contains("traceId=" + traceId));
        assertTrue(record.getLevel().intValue() >= Level.WARNING.intValue());

        String storedTrace = (String) attributes.get(LogFilter.class.getName() + ".TRACE_ID");
        assertEquals(traceId, storedTrace);
        UUID.fromString(traceId); // validate UUID format in message
    }

    private void setField(String fieldName, Object value) throws Exception {
        Field field = LogFilter.class.getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(filter, value);
    }

    @Test
    void headerCredentialsAreExplicitlyRejected() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        stubResponseOutput(response);

        Map<String, Object> attributes = new HashMap<>();
        doAnswer(invocation -> {
            attributes.put(invocation.getArgument(0, String.class), invocation.getArgument(1));
            return null;
        }).when(request).setAttribute(anyString(), any());
        when(request.getAttribute(anyString())).thenAnswer(invocation -> attributes.get(invocation.getArgument(0, String.class)));
        Map<String, String> headers = new HashMap<>();
        headers.put("Authorization", "Basic ZjAwMTp1c2VyMDE6UmF3UGFzczEyMw==");
        when(request.getHeader(anyString())).thenAnswer(invocation -> headers.get(invocation.getArgument(0, String.class)));
        when(request.getRequestURI()).thenReturn("/openDolphin/resources/protected");
        when(request.getMethod()).thenReturn("POST");
        when(request.getRemoteAddr()).thenReturn("192.0.2.30");

        filter.doFilter(request, response, chain);

        verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        verify(chain, never()).doFilter(any(ServletRequest.class), any(ServletResponse.class));
    }

    @Test
    void sessionUserIsResolvedForRemotePrincipal() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        HttpSession session = mock(HttpSession.class);
        when(session.getAttribute(AuthSessionSupport.AUTH_ACTOR_ID)).thenReturn("F001:session-user");
        when(request.getSession(false)).thenReturn(session);

        Map<String, Object> attributes = new HashMap<>();
        doAnswer(invocation -> {
            attributes.put(invocation.getArgument(0, String.class), invocation.getArgument(1));
            return null;
        }).when(request).setAttribute(anyString(), any());
        when(request.getAttribute(anyString())).thenAnswer(invocation -> attributes.get(invocation.getArgument(0, String.class)));
        when(request.getHeader(anyString())).thenReturn(null);
        when(request.getRequestURI()).thenReturn("/openDolphin/resources/user/F001:session-user");
        when(request.getMethod()).thenReturn("GET");
        when(request.getRemoteAddr()).thenReturn("192.0.2.77");

        filter.doFilter(request, response, chain);

        ArgumentCaptor<ServletRequest> wrappedReqCaptor = ArgumentCaptor.forClass(ServletRequest.class);
        verify(chain).doFilter(wrappedReqCaptor.capture(), eq(response));
        HttpServletRequest wrapped = (HttpServletRequest) wrappedReqCaptor.getValue();
        assertEquals("F001:session-user", wrapped.getRemoteUser());
    }

    @Test
    void errorResponseAuditUsesUnifiedFailureMetadata() throws Exception {
        SessionAuditDispatcher dispatcher = mock(SessionAuditDispatcher.class);
        setField("sessionAuditDispatcher", dispatcher);

        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        HttpSession session = mock(HttpSession.class);
        when(session.getAttribute(AuthSessionSupport.AUTH_ACTOR_ID)).thenReturn("F001:doctor01");
        when(request.getSession(false)).thenReturn(session);
        FilterChain chain = (req, res) -> {
            HttpServletRequest httpReq = (HttpServletRequest) req;
            httpReq.setAttribute(AbstractResource.ERROR_CODE_ATTRIBUTE, "mock_error");
            httpReq.setAttribute(AbstractResource.ERROR_MESSAGE_ATTRIBUTE, "mock failure");
            Map<String, Object> errorDetails = new HashMap<>();
            errorDetails.put("detailKey", "detailValue");
            errorDetails.put("patientId", "P0001");
            errorDetails.put("query", "name=secret");
            errorDetails.put("rawXml", "<Patient_ID>P0001</Patient_ID>");
            errorDetails.put("Authorization", "Bearer secret");
            httpReq.setAttribute(AbstractResource.ERROR_DETAILS_ATTRIBUTE, errorDetails);
            HttpServletResponse httpRes = (HttpServletResponse) res;
            httpRes.setStatus(HttpServletResponse.SC_BAD_REQUEST);
        };
        stubResponseOutput(response);

        Map<String, Object> attributes = new HashMap<>();
        doAnswer(invocation -> {
            attributes.put(invocation.getArgument(0, String.class), invocation.getArgument(1));
            return null;
        }).when(request).setAttribute(anyString(), any());
        when(request.getAttribute(anyString())).thenAnswer(invocation -> attributes.get(invocation.getArgument(0, String.class)));

        Map<String, String> headers = new HashMap<>();
        when(request.getHeader(anyString())).thenAnswer(invocation -> headers.get(invocation.getArgument(0, String.class)));
        when(request.getRequestURI()).thenReturn("/openDolphin/resources/error");
        when(request.getMethod()).thenReturn("GET");
        when(request.getRemoteAddr()).thenReturn("192.0.2.50");
        when(response.getStatus()).thenReturn(HttpServletResponse.SC_BAD_REQUEST);

        filter.doFilter(request, response, chain);

        ArgumentCaptor<AuditEventPayload> payloadCaptor = ArgumentCaptor.forClass(AuditEventPayload.class);
        ArgumentCaptor<String> errorCodeCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> errorMessageCaptor = ArgumentCaptor.forClass(String.class);
        verify(dispatcher).record(payloadCaptor.capture(), eq(AuditEventEnvelope.Outcome.FAILURE),
                errorCodeCaptor.capture(), errorMessageCaptor.capture());

        assertEquals("mock_error", errorCodeCaptor.getValue());
        assertEquals("mock failure", errorMessageCaptor.getValue());
        Map<String, Object> details = payloadCaptor.getValue().getDetails();
        assertEquals("failed", details.get("status"));
        assertEquals(HttpServletResponse.SC_BAD_REQUEST, details.get("httpStatus"));
        assertEquals("mock_error", details.get("errorCode"));
        assertEquals("mock_error", details.get("reason"));
        assertEquals("mock failure", details.get("errorMessage"));
        assertFalse(details.containsKey("detailKey"));
        assertFalse(details.containsKey("patientId"));
        assertFalse(details.containsKey("query"));
        assertFalse(details.containsKey("rawXml"));
        assertFalse(details.containsKey("Authorization"));
        assertEquals(Boolean.TRUE, details.get("validationError"));
    }

    @Test
    void unauthorizedAuditIncludesErrorCodeAndMessage() throws Exception {
        SessionAuditDispatcher dispatcher = mock(SessionAuditDispatcher.class);
        setField("sessionAuditDispatcher", dispatcher);

        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        stubResponseOutput(response);

        Map<String, Object> attributes = new HashMap<>();
        doAnswer(invocation -> {
            attributes.put(invocation.getArgument(0, String.class), invocation.getArgument(1));
            return null;
        }).when(request).setAttribute(anyString(), any());
        when(request.getAttribute(anyString())).thenAnswer(invocation -> attributes.get(invocation.getArgument(0, String.class)));

        Map<String, String> headers = new HashMap<>();
        headers.put("X-Facility-Id", "HACKED-FACILITY");
        when(request.getHeader(anyString())).thenAnswer(invocation -> headers.get(invocation.getArgument(0, String.class)));
        when(request.getRequestURI()).thenReturn("/openDolphin/resources/protected");
        when(request.getMethod()).thenReturn("POST");
        when(request.getRemoteAddr()).thenReturn("192.0.2.51");

        filter.doFilter(request, response, chain);

        ArgumentCaptor<AuditEventPayload> payloadCaptor = ArgumentCaptor.forClass(AuditEventPayload.class);
        ArgumentCaptor<String> errorCodeCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> errorMessageCaptor = ArgumentCaptor.forClass(String.class);
        verify(dispatcher).record(payloadCaptor.capture(), eq(AuditEventEnvelope.Outcome.FAILURE),
                errorCodeCaptor.capture(), errorMessageCaptor.capture());

        assertEquals("unauthorized", errorCodeCaptor.getValue());
        assertEquals("Authentication required", errorMessageCaptor.getValue());
        Map<String, Object> details = payloadCaptor.getValue().getDetails();
        assertEquals("failed", details.get("status"));
        assertEquals("unauthorized", details.get("errorCode"));
        assertEquals("Authentication required", details.get("errorMessage"));
        assertEquals("authentication_failed", details.get("reason"));
        assertFalse(details.containsKey("facilityIdHeader"));
        assertFalse(details.containsKey("facilityId"));
    }

    @Test
    void unauthorizedAuditUsesResolvedClientIpFromForwardedHeader() throws Exception {
        SessionAuditDispatcher dispatcher = mock(SessionAuditDispatcher.class);
        setField("sessionAuditDispatcher", dispatcher);

        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        stubResponseOutput(response);

        Map<String, Object> attributes = new HashMap<>();
        doAnswer(invocation -> {
            attributes.put(invocation.getArgument(0, String.class), invocation.getArgument(1));
            return null;
        }).when(request).setAttribute(anyString(), any());
        when(request.getAttribute(anyString())).thenAnswer(invocation -> attributes.get(invocation.getArgument(0, String.class)));

        Map<String, String> headers = new HashMap<>();
        headers.put("X-Forwarded-For", "198.51.100.10, 127.0.0.1");
        when(request.getHeader(anyString())).thenAnswer(invocation -> headers.get(invocation.getArgument(0, String.class)));
        when(request.getRequestURI()).thenReturn("/openDolphin/resources/protected");
        when(request.getMethod()).thenReturn("GET");
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");

        filter.doFilter(request, response, chain);

        ArgumentCaptor<AuditEventPayload> payloadCaptor = ArgumentCaptor.forClass(AuditEventPayload.class);
        verify(dispatcher).record(payloadCaptor.capture(), eq(AuditEventEnvelope.Outcome.FAILURE),
                eq("unauthorized"), eq("Authentication required"));
        assertEquals("198.51.100.10", payloadCaptor.getValue().getIpAddress());
    }

    @Test
    void facilityHeaderDoesNotOverridePrincipal() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        HttpSession session = mock(HttpSession.class);
        when(session.getAttribute(AuthSessionSupport.AUTH_ACTOR_ID)).thenReturn("F001:doctor01");
        when(request.getSession(false)).thenReturn(session);

        Map<String, Object> attributes = new HashMap<>();
        doAnswer(invocation -> {
            attributes.put(invocation.getArgument(0, String.class), invocation.getArgument(1));
            return null;
        }).when(request).setAttribute(anyString(), any());
        when(request.getAttribute(anyString())).thenAnswer(invocation -> attributes.get(invocation.getArgument(0, String.class)));

        Map<String, String> headers = new HashMap<>();
        headers.put("X-Facility-Id", "SPOOF");
        when(request.getHeader(anyString())).thenAnswer(invocation -> headers.get(invocation.getArgument(0, String.class)));
        when(request.getRequestURI()).thenReturn("/openDolphin/resources/protected");
        when(request.getMethod()).thenReturn("GET");
        when(request.getRemoteAddr()).thenReturn("192.0.2.70");

        filter.doFilter(request, response, chain);

        ArgumentCaptor<ServletRequest> wrappedReqCaptor = ArgumentCaptor.forClass(ServletRequest.class);
        verify(chain).doFilter(wrappedReqCaptor.capture(), eq(response));
        HttpServletRequest wrapped = (HttpServletRequest) wrappedReqCaptor.getValue();
        assertEquals("F001:doctor01", wrapped.getRemoteUser());
    }

    @Test
    void passwordOnlyHeaderDoesNotLeakPrincipal() throws Exception {
        SessionAuditDispatcher dispatcher = mock(SessionAuditDispatcher.class);
        setField("sessionAuditDispatcher", dispatcher);

        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        stubResponseOutput(response);

        Map<String, Object> attributes = new HashMap<>();
        doAnswer(invocation -> {
            attributes.put(invocation.getArgument(0, String.class), invocation.getArgument(1));
            return null;
        }).when(request).setAttribute(anyString(), any());
        when(request.getAttribute(anyString())).thenAnswer(invocation -> attributes.get(invocation.getArgument(0, String.class)));

        Map<String, String> headers = new HashMap<>();
        headers.put("password", "SuperSecretPassword");
        when(request.getHeader(anyString())).thenAnswer(invocation -> headers.get(invocation.getArgument(0, String.class)));
        when(request.getRequestURI()).thenReturn("/openDolphin/resources/protected");
        when(request.getMethod()).thenReturn("GET");
        when(request.getRemoteAddr()).thenReturn("192.0.2.60");

        filter.doFilter(request, response, chain);

        ArgumentCaptor<AuditEventPayload> payloadCaptor = ArgumentCaptor.forClass(AuditEventPayload.class);
        verify(dispatcher).record(payloadCaptor.capture(), eq(AuditEventEnvelope.Outcome.FAILURE),
                eq("unauthorized"), eq("Authentication required"));

        AuditEventPayload payload = payloadCaptor.getValue();
        assertEquals("anonymous", payload.getActorId());
        assertFalse(payload.getDetails().containsKey("principal"));
        payload.getDetails().values().forEach(value -> assertFalse("SuperSecretPassword".equals(value)));
    }

    @Test
    void nonCompositePrincipalIsRejected() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        stubResponseOutput(response);
        HttpSession session = mock(HttpSession.class);
        when(session.getAttribute(AuthSessionSupport.AUTH_ACTOR_ID)).thenReturn("doctor01");
        when(request.getSession(false)).thenReturn(session);

        Map<String, Object> attributes = new HashMap<>();
        doAnswer(invocation -> {
            attributes.put(invocation.getArgument(0, String.class), invocation.getArgument(1));
            return null;
        }).when(request).setAttribute(anyString(), any());
        when(request.getAttribute(anyString())).thenAnswer(invocation -> attributes.get(invocation.getArgument(0, String.class)));

        Map<String, String> headers = new HashMap<>();
        when(request.getHeader(anyString())).thenAnswer(invocation -> headers.get(invocation.getArgument(0, String.class)));
        when(request.getRequestURI()).thenReturn("/openDolphin/resources/protected");
        when(request.getMethod()).thenReturn("GET");
        when(request.getRemoteAddr()).thenReturn("192.0.2.90");

        filter.doFilter(request, response, chain);

        verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        verify(chain, never()).doFilter(any(ServletRequest.class), any(ServletResponse.class));
    }

    @Test
    void invalidTraceAndRequestIdHeadersAreSanitized() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        stubResponseOutput(response);

        Map<String, Object> attributes = new HashMap<>();
        doAnswer(invocation -> {
            attributes.put(invocation.getArgument(0, String.class), invocation.getArgument(1));
            return null;
        }).when(request).setAttribute(anyString(), any());
        when(request.getAttribute(anyString())).thenAnswer(invocation -> attributes.get(invocation.getArgument(0, String.class)));

        String badTrace = "bad\r\ntrace";
        String badRequest = "bad<script>";
        Map<String, String> headers = new HashMap<>();
        headers.put("X-Trace-Id", badTrace);
        headers.put("X-Request-Id", badRequest);
        when(request.getHeader(anyString())).thenAnswer(invocation -> headers.get(invocation.getArgument(0, String.class)));
        when(request.getRequestURI()).thenReturn("/openDolphin/resources/protected");
        when(request.getMethod()).thenReturn("GET");
        when(request.getRemoteAddr()).thenReturn("192.0.2.91");

        filter.doFilter(request, response, chain);

        ArgumentCaptor<String> traceCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> requestCaptor = ArgumentCaptor.forClass(String.class);
        verify(response).setHeader(eq("X-Trace-Id"), traceCaptor.capture());
        verify(response).setHeader(eq("X-Request-Id"), requestCaptor.capture());

        String sanitizedTrace = traceCaptor.getValue();
        String sanitizedRequest = requestCaptor.getValue();
        assertNotEquals(badTrace, sanitizedTrace);
        assertNotEquals(badRequest, sanitizedRequest);
        UUID.fromString(sanitizedTrace);
        UUID.fromString(sanitizedRequest);
        assertEquals(sanitizedTrace, attributes.get(LogFilter.class.getName() + ".TRACE_ID"));
        assertEquals(sanitizedRequest, attributes.get(LogFilter.class.getName() + ".REQUEST_ID"));
    }

    private void stubResponseOutput(HttpServletResponse response) throws Exception {
        when(response.isCommitted()).thenReturn(false);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        when(response.getOutputStream()).thenReturn(new ServletOutputStream() {
            @Override
            public boolean isReady() {
                return true;
            }

            @Override
            public void setWriteListener(WriteListener listener) {
                // no-op
            }

            @Override
            public void write(int b) {
                out.write(b);
            }
        });
    }

    private static final class TestLogHandler extends Handler {

        private final List<LogRecord> records = new CopyOnWriteArrayList<>();

        @Override
        public void publish(LogRecord record) {
            records.add(record);
        }

        @Override
        public void flush() {
            // no-op
        }

        @Override
        public void close() {
            records.clear();
        }

        List<LogRecord> records() {
            return records;
        }
    }
}
