package open.dolphin.orca.push;

import java.net.http.WebSocket;
import java.util.concurrent.CompletableFuture;

public interface OrcaPushSocketFactory {

    CompletableFuture<WebSocket> open(ConnectRequest request, WebSocket.Listener listener);

    record ConnectRequest(
            String websocketUrl,
            String tenantId,
            Integer connectTimeoutMs,
            Integer idleTimeoutSeconds,
            byte[] clientCertificateP12,
            String clientCertificatePassphrase,
            byte[] caCertificate) {
    }
}
