package open.dolphin.metrics;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@ApplicationScoped
public class OrcaPushMetricsRegistrar {

    static final String METRIC_CONNECTED = "opendolphin_orca_push_connected";
    static final String METRIC_EVENTS_RECEIVED = "opendolphin_orca_push_events_received_total";
    static final String METRIC_EVENTS_DUPLICATE = "opendolphin_orca_push_events_duplicate_total";
    static final String METRIC_EVENTS_FAILED = "opendolphin_orca_push_events_failed_total";
    static final String METRIC_RECONNECT = "opendolphin_orca_push_reconnect_total";
    static final String METRIC_RECOVERY = "opendolphin_orca_push_recovery_total";

    private final Map<String, AtomicInteger> connectedGaugeValues = new ConcurrentHashMap<>();

    @Inject
    MeterRegistry meterRegistry;

    public void markConnected(String facilityId) {
        gauge(facilityId).set(1);
    }

    public void markDisconnected(String facilityId) {
        gauge(facilityId).set(0);
    }

    public void recordReceived(String facilityId, String eventName, String mode) {
        counter(METRIC_EVENTS_RECEIVED, facilityId, eventName, "success", mode);
    }

    public void recordDuplicate(String facilityId, String eventName, String mode) {
        counter(METRIC_EVENTS_DUPLICATE, facilityId, eventName, "duplicate", mode);
    }

    public void recordFailure(String facilityId, String eventName, String mode) {
        counter(METRIC_EVENTS_FAILED, facilityId, eventName, "failed", mode);
    }

    public void recordReconnect(String facilityId, String mode) {
        counter(METRIC_RECONNECT, facilityId, "reconnect", "success", mode);
    }

    public void recordRecovery(String facilityId, String mode, String outcome) {
        counter(METRIC_RECOVERY, facilityId, "recovery", outcome, mode);
    }

    private void counter(String name, String facilityId, String eventName, String outcome, String mode) {
        if (meterRegistry == null) {
            return;
        }
        meterRegistry.counter(
                name,
                "facilityId", safeTag(facilityId),
                "eventName", safeTag(eventName),
                "outcome", safeTag(outcome),
                "mode", safeTag(mode))
                .increment();
    }

    private AtomicInteger gauge(String facilityId) {
        return connectedGaugeValues.computeIfAbsent(safeTag(facilityId), key -> {
            AtomicInteger value = new AtomicInteger();
            if (meterRegistry != null) {
                Gauge.builder(METRIC_CONNECTED, value, AtomicInteger::get)
                        .tag("facilityId", key)
                        .register(meterRegistry);
            }
            return value;
        });
    }

    private String safeTag(String value) {
        return value == null || value.isBlank() ? "unknown" : value;
    }
}
