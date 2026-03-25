package open.dolphin.rest;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.Instant;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;
import open.dolphin.infomodel.Factor2Credential;
import open.dolphin.infomodel.Factor2CredentialType;
import open.dolphin.security.SecondFactorSecurityConfig;
import open.dolphin.security.totp.TotpHelper;
import open.dolphin.security.totp.TotpSecretProtector;

@ApplicationScoped
public class TotpVerificationSupport {

    private static final Logger LOGGER = Logger.getLogger(TotpVerificationSupport.class.getName());

    @PersistenceContext
    private EntityManager em;

    @Inject
    private SecondFactorSecurityConfig secondFactorSecurityConfig;

    public VerificationResult verifyCurrentCode(long userPk, String code) {
        if (userPk <= 0L || code == null || code.isBlank()) {
            return VerificationResult.invalid();
        }

        String normalizedCode = code.trim();
        if (!normalizedCode.matches("\\d{6}")) {
            return VerificationResult.invalid();
        }
        int numericCode = Integer.parseInt(normalizedCode);

        Factor2Credential credential = findVerifiedTotpCredential(userPk);
        if (credential == null || credential.getSecret() == null || credential.getSecret().isBlank()) {
            return VerificationResult.missingCredential();
        }

        TotpSecretProtector protector =
                secondFactorSecurityConfig != null ? secondFactorSecurityConfig.getTotpSecretProtector() : null;
        if (protector == null) {
            return VerificationResult.missingCredential();
        }
        final String secret;
        try {
            secret = protector.decrypt(credential.getSecret());
        } catch (RuntimeException e) {
            LOGGER.log(Level.WARNING,
                    "Failed to decrypt TOTP secret (userPk={0}, credentialId={1})",
                    new Object[]{userPk, credential.getId()});
            return VerificationResult.missingCredential();
        }

        if (!TotpHelper.verifyCurrentWindow(secret, numericCode)) {
            return VerificationResult.invalid();
        }

        Instant now = Instant.now();
        credential.setLastUsedAt(now);
        credential.setUpdatedAt(now);
        em.merge(credential);
        return VerificationResult.success();
    }

    private Factor2Credential findVerifiedTotpCredential(long userPk) {
        List<Factor2Credential> list = em.createQuery(
                        "from Factor2Credential f where f.userPK=:userPK and f.credentialType=:type and f.verified=true order by f.updatedAt desc",
                        Factor2Credential.class)
                .setParameter("userPK", userPk)
                .setParameter("type", Factor2CredentialType.TOTP)
                .setMaxResults(1)
                .getResultList();
        return list.isEmpty() ? null : list.get(0);
    }

    public enum VerificationStatus {
        SUCCESS,
        INVALID,
        MISSING_CREDENTIAL
    }

    public record VerificationResult(VerificationStatus status) {
        public static VerificationResult success() {
            return new VerificationResult(VerificationStatus.SUCCESS);
        }

        public static VerificationResult invalid() {
            return new VerificationResult(VerificationStatus.INVALID);
        }

        public static VerificationResult missingCredential() {
            return new VerificationResult(VerificationStatus.MISSING_CREDENTIAL);
        }

        public boolean succeeded() {
            return status == VerificationStatus.SUCCESS;
        }
    }
}
