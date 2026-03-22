package open.dolphin.msg;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.TestServerConfigurationResolvers;

class OidSenderTest {

    @Test
    void resolvesSmtpSettingsFromTypedRuntimeConfiguration() {
        ServerConfigurationResolver resolver = TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_SMTP_HOST, "smtp.example.test",
                ServerConfigurationResolver.KEY_SMTP_PORT, "2525",
                ServerConfigurationResolver.KEY_SMTP_FROM, "noreply@example.test",
                ServerConfigurationResolver.KEY_SMTP_BCC, "audit@example.test",
                ServerConfigurationResolver.KEY_SMTP_STARTTLS, "true",
                ServerConfigurationResolver.KEY_SMTP_ACTIVITY_TO, "activity@example.test");

        OidSender sender = new OidSender(resolver);
        OidSender.ResolvedSmtpSettings settings = sender.resolveSmtpSettings();

        assertNotNull(settings);
        assertEquals("smtp.example.test", settings.properties().getProperty("mail.smtp.host"));
        assertEquals("2525", settings.properties().getProperty("mail.smtp.port"));
        assertEquals("false", settings.properties().getProperty("mail.smtp.auth"));
        assertEquals("true", settings.properties().getProperty("mail.smtp.starttls.enable"));
        assertEquals("noreply@example.test", settings.fromAddress());
        assertEquals("audit@example.test", settings.bccAddress());
        assertFalse(settings.authRequired());
        assertEquals("activity@example.test", sender.resolveActivityRecipient());
    }

    @Test
    void rejectsAuthenticatedSmtpWithoutCredentials() {
        ServerConfigurationResolver resolver = TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_SMTP_HOST, "smtp.example.test",
                ServerConfigurationResolver.KEY_SMTP_FROM, "noreply@example.test",
                ServerConfigurationResolver.KEY_SMTP_AUTH, "true");

        OidSender sender = new OidSender(resolver);

        assertNull(sender.resolveSmtpSettings());
    }
}
