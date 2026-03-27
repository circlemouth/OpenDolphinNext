package open.dolphin.orca.push;

import java.net.http.WebSocket;
import java.util.Arrays;
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
        public ConnectRequest {
            clientCertificateP12 = copyBytes(clientCertificateP12);
            caCertificate = copyBytes(caCertificate);
        }

        @Override
        public byte[] clientCertificateP12() {
            return copyBytes(clientCertificateP12);
        }

        @Override
        public byte[] caCertificate() {
            return copyBytes(caCertificate);
        }

        private static byte[] copyBytes(byte[] bytes) {
            return bytes == null ? null : Arrays.copyOf(bytes, bytes.length);
        }
    }
}
