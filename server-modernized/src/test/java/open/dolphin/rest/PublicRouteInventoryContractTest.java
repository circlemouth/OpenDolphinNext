package open.dolphin.rest;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HEAD;
import jakarta.ws.rs.OPTIONS;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class PublicRouteInventoryContractTest {

    private static final String API_PREFIX = "/api";
    private static final Pattern PATH_PARAMETER_PATTERN = Pattern.compile("\\{[^}]+\\}");
    private static final Set<String> BLOCKED_ROUTE_KEYS = Set.of(
            "POST /api/admin/access/users/{*}/password-reset",
            "GET /api/pvt/{*}",
            "POST /api/pvt",
            "PUT /api/pvt/{*}",
            "PUT /api/pvt/memo/{*}",
            "DELETE /api/pvt/{*}",
            "POST /api/orca/patientmodv2/outpatient",
            "POST /api/karte/document/pvt/{*}",
            "POST /api/orca/medical/outpatient",
            "POST /api/orca/local-medical/outpatient",
            "GET /api/orca/disease/import/{*}",
            "GET /api/orca/disease/name/{*}",
            "GET /api/orca/disease/active/{*}",
            "GET /api/orca/facilitycode",
            "GET /api/orca/deptinfo",
            "GET /api/orca/tensu/shinku/{*}",
            "GET /api/orca/tensu/name/{*}",
            "GET /api/orca/tensu/code/{*}",
            "GET /api/orca/general/{*}",
            "GET /api/orca/stamp/{*}",
            "GET /api/operations/readiness",
            "GET /api/orca/queue",
            "DELETE /api/orca/queue",
            "POST /api/orca/pusheventgetv2");

    @Test
    void publicRoutesRemainNormalizedAndExcludeBlockedRoutes() {
        Set<Class<?>> registeredClasses = new OpenDolphinRestApplication().getClasses();
        List<RouteDefinition> routes = discoverRoutes(registeredClasses);
        List<String> routeKeys = routes.stream()
                .map(RouteDefinition::key)
                .collect(Collectors.toList());

        assertThat(routeKeys).doesNotHaveDuplicates();
        assertThat(routeKeys).doesNotContainAnyElementsOf(BLOCKED_ROUTE_KEYS);
        assertThat(routes)
                .filteredOn(route -> route.path().startsWith("/api/orca/"))
                .filteredOn(route -> route.produces().stream().anyMatch(PublicRouteInventoryContractTest::isTextPlain))
                .isEmpty();
        assertThat(routeKeys).doesNotContain("GET /api/operations/readiness");
        assertThat(routeKeys).doesNotContain(
                "POST /api/orca/patient/mutation",
                "POST /api/orca/patients/local-search",
                "POST /api/orca/chart/subjectives",
                "POST /api/orca/medical/records");
        assertThat(routeKeys).contains(
                "POST /api/local/patients/mutation",
                "POST /api/local/patients/search",
                "POST /api/local/charts/subjectives",
                "POST /api/local/charts/medical-records");
        assertThat(routeKeys).contains("GET /api/local-summary/encounters/{*}/medical-summary");
    }

    @Test
    void applicationDoesNotRegisterBlockedClasses() {
        Set<String> classNames = new OpenDolphinRestApplication().getClasses().stream()
                .map(Class::getName)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        assertThat(classNames).doesNotContain(
                "open.dolphin.rest.AdminAccessPasswordResetResource",
                "open.dolphin.rest.PVTResource",
                "open.dolphin.rest.PatientModV2OutpatientResource",
                "open.dolphin.rest.orca.OrcaMedicalOutpatientResource",
                "open.dolphin.rest.orca.OrcaDiseaseResource",
                "open.dolphin.rest.orca.OrcaLocalMedicalOutpatientResource",
                "open.orca.rest.OrcaResource",
                "open.orca.rest.OrcaFacilityResource",
                "open.orca.rest.OrcaPatientDiseaseResource");
    }

    private static List<RouteDefinition> discoverRoutes(Set<Class<?>> registeredClasses) {
        return registeredClasses.stream()
                .filter(PublicRouteInventoryContractTest::hasJaxRsPath)
                .flatMap(resourceClass -> Arrays.stream(resourceClass.getDeclaredMethods())
                        .flatMap(method -> toRouteDefinitions(resourceClass, method).stream()))
                .sorted((left, right) -> left.key().compareTo(right.key()))
                .collect(Collectors.toCollection(ArrayList::new));
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

    private static boolean isTextPlain(String mediaType) {
        if (mediaType == null || mediaType.isBlank()) {
            return false;
        }
        String normalized = mediaType.trim().toLowerCase(Locale.ROOT);
        int separator = normalized.indexOf(';');
        if (separator >= 0) {
            normalized = normalized.substring(0, separator).trim();
        }
        return MediaType.TEXT_PLAIN.equalsIgnoreCase(normalized);
    }

    private record RouteDefinition(String method, String path, Set<String> produces) {
        private String key() {
            return method + " " + path;
        }
    }
}
