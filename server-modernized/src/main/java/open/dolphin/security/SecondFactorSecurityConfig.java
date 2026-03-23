package open.dolphin.security;

import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import open.dolphin.security.totp.TotpSecretProtector;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * ２要素認証に関するセキュリティ設定を集約するクラス。
 */
@ApplicationScoped
public class SecondFactorSecurityConfig {

    private static final Logger LOGGER = LoggerFactory.getLogger(SecondFactorSecurityConfig.class);

    @Inject
    private ServerConfigurationResolver configurationResolver;

    private TotpSecretProtector totpSecretProtector;

    @PostConstruct
    public void init() {
        this.totpSecretProtector = TotpSecretProtector.fromBase64(resolveTotpKey());
    }

    public TotpSecretProtector getTotpSecretProtector() {
        return totpSecretProtector;
    }

    private String resolveTotpKey() {
        String key = configurationResolver.factor2().aesKeyBase64();
        if (key == null || key.isBlank()) {
            LOGGER.error("{} must be provided via Secrets Manager.", ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64);
            throw new IllegalStateException("Configuration " + ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64
                    + " is required for TOTP encryption");
        }
        return key.trim();
    }
}
