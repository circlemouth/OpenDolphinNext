package open.dolphin.rest;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.FilterConfig;
import jakarta.servlet.ServletContext;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/**
 * Serves the SPA index with per-session CSRF token injection and no-store cache policy.
 */
public class SpaIndexSecurityFilter implements Filter {

    static final String INDEX_RESOURCE_PATH = "/index.html";

    private static final String CACHE_CONTROL_VALUE = "private, no-store, max-age=0, must-revalidate";

    private volatile String indexTemplate;

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        if (filterConfig == null) {
            throw new ServletException("FilterConfig is required");
        }
        ServletContext servletContext = filterConfig.getServletContext();
        if (servletContext == null) {
            throw new ServletException("ServletContext is required");
        }
        indexTemplate = loadIndexTemplate(servletContext);
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        if (!(request instanceof HttpServletRequest httpRequest) || !(response instanceof HttpServletResponse httpResponse)) {
            chain.doFilter(request, response);
            return;
        }

        if (!isSpaHtmlCandidateRequest(httpRequest)) {
            chain.doFilter(request, response);
            return;
        }

        String template = indexTemplate;
        if (template == null || template.isBlank()) {
            throw new ServletException("CSRF index template is not initialized");
        }

        String token = CsrfTokenSupport.getOrCreateToken(httpRequest);
        String body = template.replace(CsrfTokenSupport.CSRF_PLACEHOLDER, token);

        SecurityHeadersFilter.applyHeaders(httpRequest, httpResponse);
        applyNoStoreHeaders(httpResponse);
        httpResponse.setStatus(HttpServletResponse.SC_OK);
        httpResponse.setCharacterEncoding(StandardCharsets.UTF_8.name());
        httpResponse.setContentType("text/html;charset=UTF-8");

        if (!"HEAD".equalsIgnoreCase(httpRequest.getMethod())) {
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            httpResponse.setContentLength(bytes.length);
            httpResponse.getOutputStream().write(bytes);
        }
    }

    @Override
    public void destroy() {
        indexTemplate = null;
    }

    private static boolean isSpaHtmlCandidateRequest(HttpServletRequest request) {
        if (request == null) {
            return false;
        }
        String method = request.getMethod();
        if (!"GET".equalsIgnoreCase(method) && !"HEAD".equalsIgnoreCase(method)) {
            return false;
        }

        String path = normalizePath(request);
        if (path == null) {
            return false;
        }
        if (path.startsWith("/api")) {
            return false;
        }

        if ("/".equals(path) || path.endsWith("/index.html")) {
            return true;
        }
        if (path.contains(".")) {
            return false;
        }

        String accept = request.getHeader("Accept");
        if (accept == null) {
            return false;
        }
        String lower = accept.toLowerCase(Locale.ROOT);
        return lower.contains("text/html") || lower.contains("*/*");
    }

    private static String normalizePath(HttpServletRequest request) {
        String uri = request.getRequestURI();
        if (uri == null || uri.isBlank()) {
            return null;
        }
        String context = request.getContextPath();
        if (context != null && !context.isBlank() && uri.startsWith(context)) {
            String stripped = uri.substring(context.length());
            return stripped.isEmpty() ? "/" : stripped;
        }
        return uri;
    }

    private static void applyNoStoreHeaders(HttpServletResponse response) {
        response.setHeader("Cache-Control", CACHE_CONTROL_VALUE);
        response.setHeader("Pragma", "no-cache");
        response.setDateHeader("Expires", 0L);
    }

    static String loadIndexTemplate(ServletContext servletContext) throws ServletException {
        try (InputStream stream = servletContext.getResourceAsStream(INDEX_RESOURCE_PATH)) {
            if (stream == null) {
                throw new ServletException("index.html not found at " + INDEX_RESOURCE_PATH);
            }
            byte[] body = stream.readAllBytes();
            String template = new String(body, StandardCharsets.UTF_8);
            if (!template.contains(CsrfTokenSupport.CSRF_PLACEHOLDER)) {
                throw new ServletException("index.html missing CSRF placeholder: " + CsrfTokenSupport.CSRF_PLACEHOLDER);
            }
            return template;
        } catch (IOException ex) {
            throw new ServletException("Failed to load index.html template", ex);
        }
    }
}
