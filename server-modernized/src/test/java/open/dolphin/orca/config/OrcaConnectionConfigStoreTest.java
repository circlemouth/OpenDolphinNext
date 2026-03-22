package open.dolphin.orca.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import open.dolphin.orca.transport.OrcaConnectionPolicyException;
import open.dolphin.runtime.RuntimeStateRepository;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.TestServerConfigurationResolvers;
import open.dolphin.security.OrcaCredentialSecurityConfig;
import open.dolphin.security.SecondFactorSecurityConfig;
import open.dolphin.security.totp.TotpSecretProtector;
import open.dolphin.testsupport.MicroProfileConfigTestSupport;
import org.junit.jupiter.api.Test;

class OrcaConnectionConfigStoreTest {

    private static final String STATE_CATEGORY = "orca_connection_config";
    private static final String STATE_KEY = "default";

    @Test
    void updatePersistsFacilitiesAndExplicitDefault() throws Exception {
        TotpSecretProtector protector = buildProtector(1);
        Map<String, String> db = new LinkedHashMap<>();
        OrcaConnectionConfigStore store = newStore(protector, db);

        OrcaConnectionConfigStore.UpdateRequest update = new OrcaConnectionConfigStore.UpdateRequest(
                Boolean.TRUE,
                "https://weborca-trial.orca.med.or.jp",
                443,
                "trial",
                "weborcatrial",
                Boolean.FALSE,
                null
        );

        OrcaConnectionConfigRecord saved = store.update("F001", update, null, null, "RUN-TEST", "FACILITY:admin");
        assertNotNull(saved);
        assertEquals("F001", saved.getFacilityId());

        assertEquals("F001", store.updateDefaultFacilityId("F001", "RUN-DEFAULT", "FACILITY:admin"));

        String rawJson = db.get(STATE_CATEGORY + ":" + STATE_KEY);
        assertNotNull(rawJson);
        assertTrue(rawJson.contains("\"defaultFacilityId\":\"F001\""));
        assertTrue(rawJson.contains("\"facilities\""));
        assertTrue(rawJson.contains("\"F001\""));
        assertTrue(!rawJson.contains("\"passwordEncrypted\":\"weborcatrial\""));

        OrcaConnectionConfigStore reloaded = newStore(protector, db);
        OrcaConnectionConfigRecord snapshot = reloaded.getSnapshot();
        assertNotNull(snapshot);
        assertEquals("https://weborca-trial.orca.med.or.jp", snapshot.getServerUrl());
        assertEquals(443, snapshot.getPort());
        assertEquals("trial", snapshot.getUsername());
        assertEquals("F001", reloaded.getDefaultFacilityId());

        OrcaConnectionConfigStore.ResolvedOrcaConnection resolved = reloaded.resolve();
        assertEquals("https://weborca-trial.orca.med.or.jp", resolved.baseUrl());
        assertEquals("trial", resolved.username());
        assertEquals("weborcatrial", resolved.password());
    }

    @Test
    void facilitySpecificUpdateDoesNotMutateExplicitDefaultAndUnknownFacilityFailsClosed() throws Exception {
        TotpSecretProtector protector = buildProtector(1);
        Map<String, String> db = new LinkedHashMap<>();
        OrcaConnectionConfigStore store = newStore(protector, db);

        store.update("DEFAULT", new OrcaConnectionConfigStore.UpdateRequest(
                Boolean.TRUE,
                "https://default.example.orca",
                443,
                "default-user",
                "default-pass",
                Boolean.FALSE,
                null
        ), null, null, "RUN-DEFAULT", "FACILITY:admin");
        store.updateDefaultFacilityId("DEFAULT", "RUN-DEFAULT", "FACILITY:admin");

        store.update("F001", new OrcaConnectionConfigStore.UpdateRequest(
                Boolean.TRUE,
                "https://facility.example.orca",
                443,
                "facility-user",
                "facility-pass",
                Boolean.FALSE,
                null
        ), null, null, "RUN-F001", "FACILITY:admin");

        OrcaConnectionConfigRecord defaultSnapshot = store.getSnapshot();
        assertNotNull(defaultSnapshot);
        assertEquals("https://default.example.orca", defaultSnapshot.getServerUrl());
        assertEquals("default-user", defaultSnapshot.getUsername());
        assertEquals("DEFAULT", store.getDefaultFacilityId());

        OrcaConnectionConfigRecord facilitySnapshot = store.getSnapshot("F001");
        assertNotNull(facilitySnapshot);
        assertEquals("F001", facilitySnapshot.getFacilityId());
        assertEquals("https://facility.example.orca", facilitySnapshot.getServerUrl());

        assertNull(store.getSnapshot("UNKNOWN"));
        OrcaConnectionPolicyException unresolved = assertThrows(
                OrcaConnectionPolicyException.class,
                () -> store.resolve("UNKNOWN"));
        assertEquals(OrcaConnectionConfigStore.REASON_CODE_FACILITY_CONFIGURATION_MISSING, unresolved.getErrorCategory());
    }

    @Test
    void updateRejectsInsecureHttpInProduction() throws Exception {
        try (AutoCloseable ignored = MicroProfileConfigTestSupport.withConfig(
                ServerConfigurationResolver.KEY_ENVIRONMENT, "production")) {
            TotpSecretProtector protector = buildProtector(1);
            Map<String, String> db = new LinkedHashMap<>();
            OrcaConnectionConfigStore store = newStore(protector, db);

            OrcaConnectionConfigStore.UpdateRequest update = new OrcaConnectionConfigStore.UpdateRequest(
                    Boolean.TRUE,
                    "http://weborca.example.test",
                    80,
                    "trial",
                    "weborcatrial",
                    Boolean.FALSE,
                    null
            );

            OrcaConnectionPolicyException ex = assertThrows(
                    OrcaConnectionPolicyException.class,
                    () -> store.update("F001", update, null, null, "RUN-TEST", "FACILITY:admin")
            );

            assertEquals("weborca_requires_https", ex.getErrorCategory());
        }
    }

    @Test
    void initRejectsLegacySingleRecordConfig() throws Exception {
        TotpSecretProtector protector = buildProtector(1);
        Map<String, String> db = new LinkedHashMap<>();
        db.put(STATE_CATEGORY + ":" + STATE_KEY, """
                {
                  "version": 1,
                  "serverUrl": "https://legacy.example.orca",
                  "port": 443,
                  "username": "legacy-user",
                  "passwordEncrypted": "encrypted",
                  "useWeborca": true
                }
                """);

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> newStore(protector, db)
        );

        assertEquals(
                "Legacy single-record ORCA connection config is no longer supported. Migrate to the facilities format.",
                ex.getMessage()
        );
    }

    @Test
    void updateDefaultFacilityRejectsUnknownFacility() throws Exception {
        TotpSecretProtector protector = buildProtector(1);
        OrcaConnectionConfigStore store = newStore(protector, new LinkedHashMap<>());

        OrcaConnectionPolicyException ex = assertThrows(
                OrcaConnectionPolicyException.class,
                () -> store.updateDefaultFacilityId("UNKNOWN", "RUN-DEFAULT", "FACILITY:admin"));

        assertEquals(OrcaConnectionConfigStore.REASON_CODE_FACILITY_CONFIGURATION_MISSING, ex.getErrorCategory());
    }

    @Test
    void orcaCredentialProtectorIsSeparatedFromTotpProtector() throws Exception {
        OrcaCredentialSecurityConfig orcaConfig = new OrcaCredentialSecurityConfig();
        setField(orcaConfig, "configurationResolver", TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_ORCA_CREDENTIALS_AES_KEY_B64, keyBase64(11)));
        orcaConfig.init();

        SecondFactorSecurityConfig secondFactorConfig = new SecondFactorSecurityConfig();
        setField(secondFactorConfig, "configurationResolver", TestServerConfigurationResolvers.resolver(
                ServerConfigurationResolver.KEY_FACTOR2_AES_KEY_B64, keyBase64(51),
                ServerConfigurationResolver.KEY_FIDO2_RP_ID, "localhost",
                ServerConfigurationResolver.KEY_FIDO2_RP_NAME, "OpenDolphin",
                ServerConfigurationResolver.KEY_FIDO2_ALLOWED_ORIGINS, "https://localhost:8443"));
        secondFactorConfig.init();

        String cipher = orcaConfig.getCredentialProtector().encrypt("orca-secret");
        assertEquals("orca-secret", orcaConfig.getCredentialProtector().decrypt(cipher));
        assertThrows(IllegalStateException.class, () -> secondFactorConfig.getTotpSecretProtector().decrypt(cipher));
    }

    private OrcaConnectionConfigStore newStore(TotpSecretProtector protector, Map<String, String> db) throws Exception {
        OrcaConnectionConfigStore store = new OrcaConnectionConfigStore();

        RuntimeStateRepository repository = mock(RuntimeStateRepository.class);
        when(repository.findPayload(eq(STATE_CATEGORY), eq(STATE_KEY)))
                .thenAnswer(invocation -> Optional.ofNullable(db.get(STATE_CATEGORY + ":" + STATE_KEY)));
        doAnswer(invocation -> {
            String key = invocation.getArgument(0, String.class) + ":" + invocation.getArgument(1, String.class);
            String payload = invocation.getArgument(2, String.class);
            db.put(key, payload);
            return null;
        }).when(repository).upsertPayload(any(String.class), any(String.class), any(String.class), any(Instant.class));

        OrcaCredentialSecurityConfig credentialSecurityConfig = mock(OrcaCredentialSecurityConfig.class);
        when(credentialSecurityConfig.getCredentialProtector()).thenReturn(protector);

        setField(store, "orcaCredentialSecurityConfig", credentialSecurityConfig);
        setField(store, "stateRepository", repository);
        store.init();
        return store;
    }

    private TotpSecretProtector buildProtector(int seed) {
        return TotpSecretProtector.fromBase64(keyBase64(seed));
    }

    private String keyBase64(int seed) {
        byte[] key = new byte[32];
        for (int i = 0; i < key.length; i++) {
            key[i] = (byte) (seed + i);
        }
        return Base64.getEncoder().encodeToString(key);
    }

    private static void setField(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }
}
