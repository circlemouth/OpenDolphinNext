package open.dolphin.orca.transport;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.net.Authenticator;
import java.net.CookieHandler;
import java.net.ProxySelector;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLParameters;
import javax.net.ssl.SSLSession;
import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.ServerRuntimeConfiguration;
import open.dolphin.runtime.config.TestServerConfigurationResolvers;
import org.junit.jupiter.api.Test;

class OrcaHttpClientResilienceTest {

    private static final OrcaTransportSettings SETTINGS =
            OrcaTransportSettings.fromAdminConfig("http://localhost:18080", false, "orca", "orca",
                    TestServerConfigurationResolvers.resolver());

    @Test
    void getRetriesHttp5xxAndEventuallySucceeds() {
        SequencedHttpClient httpClient = new SequencedHttpClient(List.of(
                ResponseSpec.response(503, "<xmlio2><res><Api_Result>E900</Api_Result></res></xmlio2>", "application/xml", 0),
                ResponseSpec.response(200, "<xmlio2><res><Api_Result>0000</Api_Result></res></xmlio2>", "application/xml", 0)));
        OrcaHttpClient client = new OrcaHttpClient(httpClient, transportHttpSettings(
                ServerConfigurationResolver.KEY_ORCA_API_RETRY_NETWORK_MAX, "2",
                ServerConfigurationResolver.KEY_ORCA_API_RETRY_NETWORK_BACKOFF_MS, "1"));

        OrcaHttpClient.OrcaHttpResponse response = client.get(SETTINGS, "/api01rv2/systeminfv2", null,
                "application/xml", "req-r1", "trace-r1");

        assertEquals(200, response.status());
        assertEquals(2, httpClient.sendCount());
    }

    @Test
    void getTimesOutByDeadlineWhenNetworkErrorContinues() {
        SequencedHttpClient httpClient = new SequencedHttpClient(List.of(
                ResponseSpec.failure(new IOException("network down"), 0)));
        OrcaHttpClient client = new OrcaHttpClient(httpClient, transportHttpSettings(
                ServerConfigurationResolver.KEY_ORCA_API_RETRY_NETWORK_MAX, "10",
                ServerConfigurationResolver.KEY_ORCA_API_RETRY_NETWORK_BACKOFF_MS, "10",
                ServerConfigurationResolver.KEY_ORCA_API_TOTAL_TIMEOUT_MS, "40ms"));

        OrcaGatewayException error = assertThrows(OrcaGatewayException.class,
                () -> client.get(SETTINGS, "/api01rv2/systeminfv2", null,
                        "application/xml", "req-r2", "trace-r2"));

        assertTrue(error.getMessage().contains("[deadline]"));
        assertTrue(httpClient.sendCount() >= 1);
    }

    @Test
    void concurrentGetRequestsDoNotSerializeAllCalls() throws Exception {
        SequencedHttpClient httpClient = new SequencedHttpClient(List.of(
                ResponseSpec.response(200, "<xmlio2><res><Api_Result>0000</Api_Result></res></xmlio2>", "application/xml", 120)));
        OrcaHttpClient client = new OrcaHttpClient(httpClient, transportHttpSettings(
                ServerConfigurationResolver.KEY_ORCA_API_RETRY_NETWORK_MAX, "0",
                ServerConfigurationResolver.KEY_ORCA_API_TOTAL_TIMEOUT_MS, "5000ms"));

        ExecutorService executor = Executors.newFixedThreadPool(4);
        try {
            Future<OrcaHttpClient.OrcaHttpResponse> f1 = executor.submit(() -> client.get(SETTINGS,
                    "/api01rv2/systeminfv2", null, "application/xml", "req-c1", "trace-c1"));
            Future<OrcaHttpClient.OrcaHttpResponse> f2 = executor.submit(() -> client.get(SETTINGS,
                    "/api01rv2/systeminfv2", null, "application/xml", "req-c2", "trace-c2"));

            assertEquals(200, f1.get(3, TimeUnit.SECONDS).status());
            assertEquals(200, f2.get(3, TimeUnit.SECONDS).status());
        } finally {
            executor.shutdownNow();
        }

        assertTrue(httpClient.maxInFlight() >= 2,
                "Expected overlapping requests but maxInFlight=" + httpClient.maxInFlight());
    }

    @Test
    void incompleteSettingsFailsFast() {
        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> OrcaTransportSettings.fromAdminConfig(null, false, null, null));
        assertTrue(error.getMessage().contains("baseUrl is required"));
    }

    private static ServerRuntimeConfiguration.OrcaTransportHttpSettings transportHttpSettings(String... entries) {
        return TestServerConfigurationResolvers.resolver(entries).orcaTransportHttp();
    }

    private record ResponseSpec(int status, String body, String contentType, IOException failure, long delayMs) {
        private static ResponseSpec response(int status, String body, String contentType, long delayMs) {
            return new ResponseSpec(status, body, contentType, null, delayMs);
        }

        private static ResponseSpec failure(IOException ex, long delayMs) {
            return new ResponseSpec(0, null, null, ex, delayMs);
        }
    }

    private static final class SequencedHttpClient extends HttpClient {
        private final ArrayDeque<ResponseSpec> plans;
        private final AtomicInteger sendCount = new AtomicInteger();
        private final AtomicInteger inFlight = new AtomicInteger();
        private final AtomicInteger maxInFlight = new AtomicInteger();

        private SequencedHttpClient(List<ResponseSpec> plans) {
            this.plans = new ArrayDeque<>(plans);
        }

        int sendCount() {
            return sendCount.get();
        }

        int maxInFlight() {
            return maxInFlight.get();
        }

        @Override
        public Optional<CookieHandler> cookieHandler() {
            return Optional.empty();
        }

        @Override
        public Optional<Duration> connectTimeout() {
            return Optional.of(Duration.ofSeconds(1));
        }

        @Override
        public Redirect followRedirects() {
            return Redirect.NEVER;
        }

        @Override
        public Optional<ProxySelector> proxy() {
            return Optional.empty();
        }

        @Override
        public SSLContext sslContext() {
            return null;
        }

        @Override
        public SSLParameters sslParameters() {
            return new SSLParameters();
        }

        @Override
        public Optional<Authenticator> authenticator() {
            return Optional.empty();
        }

        @Override
        public Version version() {
            return Version.HTTP_1_1;
        }

        @Override
        public Optional<Executor> executor() {
            return Optional.empty();
        }

        @Override
        public <T> HttpResponse<T> send(HttpRequest request, HttpResponse.BodyHandler<T> responseBodyHandler)
                throws IOException {
            sendCount.incrementAndGet();
            int current = inFlight.incrementAndGet();
            maxInFlight.accumulateAndGet(current, Math::max);
            try {
                ResponseSpec plan = plans.peekFirst();
                if (plan == null) {
                    throw new IOException("No stub response configured");
                }
                if (plan.delayMs > 0) {
                    try {
                        Thread.sleep(plan.delayMs);
                    } catch (InterruptedException ex) {
                        Thread.currentThread().interrupt();
                        throw new IOException("interrupted", ex);
                    }
                }
                if (plan.failure != null) {
                    plans.pollFirst();
                    throw plan.failure;
                }
                if (plans.size() > 1) {
                    plans.pollFirst();
                }
                Map<String, List<String>> headerMap = new LinkedHashMap<>();
                if (plan.contentType != null) {
                    headerMap.put("Content-Type", List.of(plan.contentType));
                }
                HttpHeaders headers = HttpHeaders.of(headerMap, (key, value) -> true);
                @SuppressWarnings("unchecked")
                T body = (T) plan.body;
                return new StubHttpResponse<>(request, plan.status, body, headers);
            } finally {
                inFlight.decrementAndGet();
            }
        }

        @Override
        public <T> CompletableFuture<HttpResponse<T>> sendAsync(HttpRequest request,
                HttpResponse.BodyHandler<T> responseBodyHandler) {
            return CompletableFuture.failedFuture(new UnsupportedOperationException("Not implemented"));
        }

        @Override
        public <T> CompletableFuture<HttpResponse<T>> sendAsync(HttpRequest request,
                HttpResponse.BodyHandler<T> responseBodyHandler,
                HttpResponse.PushPromiseHandler<T> pushPromiseHandler) {
            return CompletableFuture.failedFuture(new UnsupportedOperationException("Not implemented"));
        }
    }

    private static final class StubHttpResponse<T> implements HttpResponse<T> {
        private final HttpRequest request;
        private final int status;
        private final T body;
        private final HttpHeaders headers;

        private StubHttpResponse(HttpRequest request, int status, T body, HttpHeaders headers) {
            this.request = request;
            this.status = status;
            this.body = body;
            this.headers = headers;
        }

        @Override
        public int statusCode() {
            return status;
        }

        @Override
        public HttpRequest request() {
            return request;
        }

        @Override
        public Optional<HttpResponse<T>> previousResponse() {
            return Optional.empty();
        }

        @Override
        public HttpHeaders headers() {
            return headers;
        }

        @Override
        public T body() {
            return body;
        }

        @Override
        public Optional<SSLSession> sslSession() {
            return Optional.empty();
        }

        @Override
        public URI uri() {
            return request.uri();
        }

        @Override
        public HttpClient.Version version() {
            return HttpClient.Version.HTTP_1_1;
        }
    }
}
