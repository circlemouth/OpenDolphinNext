package open.dolphin.rest;

import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HEAD;
import jakarta.ws.rs.OPTIONS;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

final class RestRouteInventorySupport {

    private static final String API_PREFIX = "/api";
    private static final Pattern PATH_PARAMETER_PATTERN = Pattern.compile("\\{[^}]+\\}");

    private RestRouteInventorySupport() {
    }

    static List<RouteDefinition> discoverRoutes() {
        return discoverRoutes(new OpenDolphinRestApplication().getClasses());
    }

    static List<RouteDefinition> discoverRoutes(Set<Class<?>> registeredClasses) {
        return registeredClasses.stream()
                .filter(RestRouteInventorySupport::hasJaxRsPath)
                .flatMap(resourceClass -> Arrays.stream(resourceClass.getDeclaredMethods())
                        .flatMap(method -> toRouteDefinitions(resourceClass, method).stream()))
                .sorted((left, right) -> left.key().compareTo(right.key()))
                .collect(Collectors.toCollection(ArrayList::new));
    }

    static Set<String> routeKeys(List<RouteDefinition> routes) {
        return routes.stream()
                .map(RouteDefinition::key)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private static List<RouteDefinition> toRouteDefinitions(Class<?> resourceClass, Method method) {
        List<String> httpMethods = httpMethods(method);
        if (httpMethods.isEmpty()) {
            return List.of();
        }
        String classPath = resolveClassPath(resourceClass);
        String methodPath = resolveMethodPath(method);
        String routePath = normalizePath(API_PREFIX + classPath + methodPath);
        Set<String> produces = resolveProduces(resourceClass, method);
        return httpMethods.stream()
                .map(httpMethod -> new RouteDefinition(httpMethod, routePath, produces))
                .collect(Collectors.toList());
    }

    private static boolean hasJaxRsPath(Class<?> resourceClass) {
        return resolveClassPath(resourceClass) != null;
    }

    private static String resolveClassPath(Class<?> resourceClass) {
        for (Class<?> current = resourceClass; current != null && current != Object.class; current = current.getSuperclass()) {
            Path path = current.getDeclaredAnnotation(Path.class);
            if (path != null) {
                return normalizeSegment(path.value());
            }
        }
        return null;
    }

    private static String resolveMethodPath(Method method) {
        Path path = method.getAnnotation(Path.class);
        if (path == null) {
            return "";
        }
        return normalizeSegment(path.value());
    }

    private static Set<String> resolveProduces(Class<?> resourceClass, Method method) {
        Produces methodProduces = method.getAnnotation(Produces.class);
        if (methodProduces != null) {
            return Arrays.stream(methodProduces.value())
                    .filter(Objects::nonNull)
                    .collect(Collectors.toCollection(LinkedHashSet::new));
        }
        Produces classProduces = findProduces(resourceClass);
        if (classProduces != null) {
            return Arrays.stream(classProduces.value())
                    .filter(Objects::nonNull)
                    .collect(Collectors.toCollection(LinkedHashSet::new));
        }
        return Set.of();
    }

    private static Produces findProduces(Class<?> resourceClass) {
        for (Class<?> current = resourceClass; current != null && current != Object.class; current = current.getSuperclass()) {
            Produces produces = current.getDeclaredAnnotation(Produces.class);
            if (produces != null) {
                return produces;
            }
        }
        return null;
    }

    private static List<String> httpMethods(Method method) {
        List<String> methods = new ArrayList<>(2);
        if (method.isAnnotationPresent(GET.class)) {
            methods.add("GET");
        }
        if (method.isAnnotationPresent(POST.class)) {
            methods.add("POST");
        }
        if (method.isAnnotationPresent(PUT.class)) {
            methods.add("PUT");
        }
        if (method.isAnnotationPresent(DELETE.class)) {
            methods.add("DELETE");
        }
        if (method.isAnnotationPresent(HEAD.class)) {
            methods.add("HEAD");
        }
        if (method.isAnnotationPresent(OPTIONS.class)) {
            methods.add("OPTIONS");
        }
        return methods;
    }

    private static String normalizeSegment(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String normalized = value.trim().replaceAll("/{2,}", "/");
        if (!normalized.startsWith("/")) {
            normalized = "/" + normalized;
        }
        return normalized;
    }

    private static String normalizePath(String path) {
        String normalized = path == null ? "" : path.trim();
        normalized = normalized.replaceAll("/{2,}", "/");
        normalized = PATH_PARAMETER_PATTERN.matcher(normalized).replaceAll("{*}");
        if (!normalized.startsWith("/")) {
            normalized = "/" + normalized;
        }
        if (normalized.length() > 1 && normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    record RouteDefinition(String method, String path, Set<String> produces) {
        String key() {
            return method + " " + path;
        }
    }
}
