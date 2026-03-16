package open.dolphin.rest;

import java.util.Collections;
import java.util.Enumeration;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;

/**
 * BlockWrapper
 *
 * @author Kazushi Minagawa, Digital Globe, Inc
 */
public final class BlockWrapper extends HttpServletRequestWrapper {
    
    private String remoteUser;
    // Allow LogFilter to inject correlation headers so downstream code can rely on request.getHeader().
    private final Map<String, String> headerOverrides = new ConcurrentHashMap<>();


    public BlockWrapper(HttpServletRequest request) {
        super(request);
    }

    @Override
    public String getRemoteUser() {
        return remoteUser;
    }
    
    public void setRemoteUser(String remoteUser) {
        this.remoteUser = remoteUser;
    }

    public void setHeader(String name, String value) {
        if (name == null || name.isBlank()) {
            return;
        }
        String key = name.trim().toLowerCase(Locale.ROOT);
        if (value == null || value.isBlank()) {
            headerOverrides.remove(key);
            return;
        }
        headerOverrides.put(key, value.trim());
    }

    @Override
    public String getHeader(String name) {
        if (name == null) {
            return super.getHeader(name);
        }
        String override = headerOverrides.get(name.trim().toLowerCase(Locale.ROOT));
        if (override != null) {
            return override;
        }
        return super.getHeader(name);
    }

    @Override
    public Enumeration<String> getHeaders(String name) {
        String override = getHeader(name);
        if (override != null) {
            return Collections.enumeration(Collections.singletonList(override));
        }
        return super.getHeaders(name);
    }

    @Override
    public Enumeration<String> getHeaderNames() {
        Set<String> names = new LinkedHashSet<>();
        Enumeration<String> existing = super.getHeaderNames();
        if (existing != null) {
            while (existing.hasMoreElements()) {
                String value = existing.nextElement();
                if (value != null && !value.isBlank()) {
                    names.add(value);
                }
            }
        }
        for (String key : headerOverrides.keySet()) {
            if (key != null && !key.isBlank()) {
                names.add(key);
            }
        }
        return Collections.enumeration(names);
    }

    public String getShortUser() {
        if (remoteUser == null || remoteUser.isBlank()) {
            return "-";
        }
        int separator = remoteUser.lastIndexOf(':');
        if (separator >= 0 && separator + 1 < remoteUser.length()) {
            return remoteUser.substring(separator + 1);
        }
        return remoteUser;
    }

    public String getRequestURIForLog() {
        String requestUri = getRequestURI();
        if (requestUri == null || requestUri.isBlank()) {
            return requestUri;
        }

        String uriForLog;
        if (requestUri.startsWith("/openDolphin/resources")) {
            uriForLog = requestUri.substring(22);
        } else if (requestUri.startsWith("/openDolphin/api")) {
            uriForLog = requestUri.substring(18);
        } else {
            uriForLog = requestUri;
        }
        return maskLegacyUserPath(uriForLog);
    }

    private String maskLegacyUserPath(String uri) {
        return uri;
    }
}
