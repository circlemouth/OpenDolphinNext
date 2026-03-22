package open.dolphin.orca.push;

import jakarta.enterprise.context.ApplicationScoped;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import javax.net.ssl.SSLContext;
import open.dolphin.orca.transport.OrcaTlsSupport;

@ApplicationScoped
public class JdkOrcaPushSocketFactory implements OrcaPushSocketFactory {

    @Override
    public CompletableFuture<WebSocket> open(ConnectRequest request, WebSocket.Listener listener) {
        HttpClient.Builder clientBuilder = HttpClient.newBuilder();
        if ((request.clientCertificateP12() != null && request.clientCertificateP12().length > 0)
                || (request.caCertificate() != null && request.caCertificate().length > 0)) {
            SSLContext sslContext = OrcaTlsSupport.buildSslContext(
                    request.clientCertificateP12(),
                    request.clientCertificatePassphrase(),
                    request.caCertificate());
            clientBuilder.sslContext(sslContext);
        }
        if (request.connectTimeoutMs() != null && request.connectTimeoutMs() > 0) {
            clientBuilder.connectTimeout(Duration.ofMillis(request.connectTimeoutMs()));
        }
        WebSocket.Builder builder = clientBuilder.build().newWebSocketBuilder();
        if (request.tenantId() != null && !request.tenantId().isBlank()) {
            builder.header("X-GINBEE-TENANT-ID", request.tenantId());
        }
        return builder.buildAsync(URI.create(request.websocketUrl()), listener);
    }
}
