package open.dolphin.orca.push;

import java.net.http.WebSocket;
import java.nio.ByteBuffer;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.logging.Level;
import java.util.logging.Logger;
import open.dolphin.metrics.OrcaPushMetricsRegistrar;
import open.dolphin.orca.config.OrcaConnectionConfigStore;
import open.dolphin.runtime.config.ServerRuntimeConfiguration;

public class OrcaPushClient implements WebSocket.Listener, AutoCloseable {

    private static final Logger LOGGER = Logger.getLogger(OrcaPushClient.class.getName());
    private static final List<String> SUBSCRIPTIONS = List.of("patient_accept", "patient_account");

    private final String facilityId;
    private final OrcaConnectionConfigStore.ResolvedOrcaConnection connection;
    private final ServerRuntimeConfiguration.OrcaPushSettings settings;
    private final OrcaPushSocketFactory socketFactory;
    private final OrcaPushEventRouter router;
    private final OrcaPushStateStore stateStore;
    private final OrcaPushRecoveryService recoveryService;
    private final OrcaPushMetricsRegistrar metricsRegistrar;
    private final ScheduledExecutorService scheduler;
    private final AtomicBoolean closed = new AtomicBoolean();
    private final StringBuilder messageBuffer = new StringBuilder();

    private volatile WebSocket webSocket;
    private volatile ScheduledFuture<?> pingTask;
    private volatile int reconnectAttempt;

    public OrcaPushClient(
            String facilityId,
            OrcaConnectionConfigStore.ResolvedOrcaConnection connection,
            ServerRuntimeConfiguration.OrcaPushSettings settings,
            OrcaPushSocketFactory socketFactory,
            OrcaPushEventRouter router,
            OrcaPushStateStore stateStore,
            OrcaPushRecoveryService recoveryService,
            OrcaPushMetricsRegistrar metricsRegistrar) {
        this.facilityId = facilityId;
        this.connection = connection;
        this.settings = settings;
        this.socketFactory = socketFactory;
        this.router = router;
        this.stateStore = stateStore;
        this.recoveryService = recoveryService;
        this.metricsRegistrar = metricsRegistrar;
        this.scheduler = Executors.newSingleThreadScheduledExecutor(new ThreadFactory() {
            @Override
            public Thread newThread(Runnable runnable) {
                Thread thread = new Thread(runnable, "orca-push-" + facilityId);
                thread.setDaemon(true);
                return thread;
            }
        });
    }

    public void start() {
        if (closed.get() || connection == null || connection.pushUrl() == null || connection.pushUrl().isBlank()) {
            return;
        }
        stateStore.markConnecting(facilityId, connection.pushUrl());
        socketFactory.open(new OrcaPushSocketFactory.ConnectRequest(
                connection.pushUrl(),
                connection.pushTenantId(),
                settings.connectTimeoutMs(),
                settings.idleTimeoutSeconds(),
                connection.clientCertificateP12(),
                connection.clientCertificatePassphrase(),
                connection.caCertificate()), this)
                .whenComplete((socket, throwable) -> {
                    if (throwable != null) {
                        stateStore.markDisconnected(facilityId, connection.pushUrl(), throwable.getMessage());
                        scheduleReconnect();
                    } else {
                        this.webSocket = socket;
                    }
                });
    }

    @Override
    public void onOpen(WebSocket webSocket) {
        this.webSocket = webSocket;
        reconnectAttempt = 0;
        stateStore.markConnected(facilityId, connection.pushUrl());
        metricsRegistrar.markConnected(facilityId);
        sendSubscribe();
        schedulePing();
        recoveryService.recoverReconnect(facilityId, connection.pushUrl());
        WebSocket.Listener.super.onOpen(webSocket);
    }

    @Override
    public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
        messageBuffer.append(data);
        if (last) {
            String message = messageBuffer.toString();
            messageBuffer.setLength(0);
            router.route(facilityId, connection.pushUrl(), message);
        }
        webSocket.request(1);
        return CompletableFuture.completedFuture(null);
    }

    @Override
    public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
        metricsRegistrar.markDisconnected(facilityId);
        stateStore.markDisconnected(facilityId, connection.pushUrl(), reason);
        if (!closed.get()) {
            scheduleReconnect();
        }
        return CompletableFuture.completedFuture(null);
    }

    @Override
    public void onError(WebSocket webSocket, Throwable error) {
        metricsRegistrar.markDisconnected(facilityId);
        stateStore.markDisconnected(facilityId, connection.pushUrl(), error != null ? error.getMessage() : "websocket_error");
        if (!closed.get()) {
            scheduleReconnect();
        }
    }

    @Override
    public CompletionStage<?> onPing(WebSocket webSocket, ByteBuffer message) {
        webSocket.request(1);
        return CompletableFuture.completedFuture(null);
    }

    @Override
    public CompletionStage<?> onPong(WebSocket webSocket, ByteBuffer message) {
        webSocket.request(1);
        return CompletableFuture.completedFuture(null);
    }

    private void sendSubscribe() {
        WebSocket socket = webSocket;
        if (socket == null) {
            return;
        }
        String payload = "{\"command\":\"subscribe\",\"events\":[\"patient_accept\",\"patient_account\"]}";
        socket.sendText(payload, true);
    }

    private void schedulePing() {
        if (settings.pingIntervalSeconds() == null || settings.pingIntervalSeconds() <= 0) {
            return;
        }
        cancelPing();
        pingTask = scheduler.scheduleAtFixedRate(() -> {
            WebSocket socket = webSocket;
            if (socket != null && !closed.get()) {
                socket.sendPing(ByteBuffer.wrap("ping".getBytes(java.nio.charset.StandardCharsets.UTF_8)));
            }
        }, settings.pingIntervalSeconds(), settings.pingIntervalSeconds(), TimeUnit.SECONDS);
    }

    private void cancelPing() {
        if (pingTask != null) {
            pingTask.cancel(true);
            pingTask = null;
        }
    }

    private void scheduleReconnect() {
        long initial = settings.reconnectInitialDelayMs() != null ? settings.reconnectInitialDelayMs() : 1000L;
        long max = settings.reconnectMaxDelayMs() != null ? settings.reconnectMaxDelayMs() : 30000L;
        long delay = Math.min(max, initial * (1L << Math.min(reconnectAttempt, 10)));
        reconnectAttempt++;
        metricsRegistrar.recordReconnect(facilityId, settings.shadowMode() ? "shadow" : "live");
        scheduler.schedule(() -> {
            if (!closed.get()) {
                start();
            }
        }, delay, TimeUnit.MILLISECONDS);
    }

    @Override
    public void close() {
        closed.set(true);
        cancelPing();
        WebSocket socket = webSocket;
        if (socket != null) {
            try {
                socket.sendClose(WebSocket.NORMAL_CLOSURE, "shutdown")
                        .orTimeout(Duration.ofSeconds(1).toMillis(), TimeUnit.MILLISECONDS);
            } catch (RuntimeException ex) {
                LOGGER.log(Level.FINE, "Failed to close ORCA push websocket cleanly", ex);
                socket.abort();
            }
        }
        scheduler.shutdownNow();
        metricsRegistrar.markDisconnected(facilityId);
    }
}
