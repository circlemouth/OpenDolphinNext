package open.dolphin.security;

import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.security.totp.TotpSecretProtector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@ApplicationScoped
public class OrcaCredentialSecurityConfig {

    private static final Logger LOGGER = LoggerFactory.getLogger(OrcaCredentialSecurityConfig.class);

    @Inject
    private ServerConfigurationResolver configurationResolver;

    private TotpSecretProtector credentialProtector;

    @PostConstruct
    public void init() {
        this.credentialProtector = TotpSecretProtector.fromBase64(resolveOrcaKey());
    }

    public TotpSecretProtector getCredentialProtector() {
        return credentialProtector;
    }

    private String resolveOrcaKey() {
        String key = configurationResolver.orcaSecretProtection().aesKeyBase64();
        if (key == null || key.isBlank()) {
            LOGGER.error("{} must be provided via Secrets Manager.", ServerConfigurationResolver.KEY_ORCA_CREDENTIALS_AES_KEY_B64);
            throw new IllegalStateException("Configuration " + ServerConfigurationResolver.KEY_ORCA_CREDENTIALS_AES_KEY_B64
                    + " is required for ORCA credential encryption");
        }
        return key.trim();
    }
}
