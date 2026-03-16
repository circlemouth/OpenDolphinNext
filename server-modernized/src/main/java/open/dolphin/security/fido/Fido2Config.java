package open.dolphin.security.fido;

import java.util.Arrays;
import java.util.List;
import open.dolphin.runtime.config.ServerRuntimeConfiguration;

/**
 * FIDO2 / WebAuthn の設定値。
 */
public class Fido2Config {

    private final String relyingPartyId;
    private final String relyingPartyName;
    private final List<String> allowedOrigins;

    public Fido2Config(String relyingPartyId, String relyingPartyName, List<String> allowedOrigins) {
        this.relyingPartyId = relyingPartyId;
        this.relyingPartyName = relyingPartyName;
        this.allowedOrigins = allowedOrigins == null ? List.of() : List.copyOf(allowedOrigins);
    }

    public String getRelyingPartyId() {
        return relyingPartyId;
    }

    public String getRelyingPartyName() {
        return relyingPartyName;
    }

    public List<String> getAllowedOrigins() {
        return List.copyOf(allowedOrigins);
    }

    public static Fido2Config fromSettings(ServerRuntimeConfiguration.Fido2Settings settings) {
        List<String> allowedOrigins = settings == null || settings.allowedOrigins() == null
                ? List.of()
                : Arrays.stream(settings.allowedOrigins().toArray(String[]::new))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .toList();
        return new Fido2Config(
                settings != null ? settings.relyingPartyId() : null,
                settings != null ? settings.relyingPartyName() : null,
                allowedOrigins);
    }
}
