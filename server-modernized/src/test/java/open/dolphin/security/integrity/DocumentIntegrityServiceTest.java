package open.dolphin.security.integrity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.ws.rs.WebApplicationException;
import java.io.IOException;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;
import open.dolphin.infomodel.AttachmentModel;
import open.dolphin.infomodel.DocInfoModel;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.ExtRefModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.SchemaModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.runtime.config.ServerConfigurationResolver;
import open.dolphin.runtime.config.TestServerConfigurationResolvers;
import open.dolphin.security.audit.SessionAuditDispatcher;
import open.dolphin.session.framework.SessionTraceManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;

class DocumentIntegrityServiceTest {

    private static final String MODE_KEY = ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_MODE;
    private static final String KEYRING_PATH_KEY = ServerConfigurationResolver.KEY_DOCUMENT_INTEGRITY_KEYRING_PATH;
    private static final String PRIMARY_KEY_B64 = "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=";
    private static final String NEXT_KEY_B64 = "QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVowMTIzNDU=";

    @TempDir
    Path tempDir;

    private DocumentIntegrityService service;
    private EntityManager em;
    private Path enforceKeyringPath;
    private Path rotatedKeyringPath;

    @BeforeEach
    void setUp() throws Exception {
        enforceKeyringPath = writeKeyring("enforce-keyring.json", """
                {
                  "algorithm": "HMAC-SHA256",
                  "keys": [
                    {"keyId":"v1","status":"active","hmacKeyB64":"%s"}
                  ]
                }
                """.formatted(PRIMARY_KEY_B64));
        rotatedKeyringPath = writeKeyring("rotated-keyring.json", """
                {
                  "algorithm": "HMAC-SHA256",
                  "keys": [
                    {"keyId":"v2","status":"active","hmacKeyB64":"%s"},
                    {"keyId":"v1","status":"verify-only","hmacKeyB64":"%s"}
                  ]
                }
                """.formatted(NEXT_KEY_B64, PRIMARY_KEY_B64));

        service = new DocumentIntegrityService();
        em = mock(EntityManager.class);
        setField(service, "em", em);
        setField(service, "config", configFor("enforce", enforceKeyringPath));
        setField(service, "sessionAuditDispatcher", mock(SessionAuditDispatcher.class));
        setField(service, "sessionTraceManager", mock(SessionTraceManager.class));
    }

    @Test
    void canonicalBytes_areStable_whenCollectionOrderDiffers() throws Exception {
        DocumentModel ordered = buildDocument(false);
        DocumentModel reversed = buildDocument(true);

        byte[] left = invokeCanonicalBytes(service, ordered);
        byte[] right = invokeCanonicalBytes(service, reversed);

        assertThat(left).isEqualTo(right);
    }

    @Test
    void verify_fails_onOneByteTamper() throws Exception {
        DocumentModel original = buildDocument(false);
        DocumentIntegrityEntity stored = buildStoredSeal(service, original, PRIMARY_KEY_B64, "v1");
        when(em.find(DocumentIntegrityEntity.class, original.getId())).thenReturn(stored);

        assertThatCode(() -> service.verifyDocumentOnRead(original)).doesNotThrowAnyException();

        DocumentModel tampered = buildDocument(false);
        tampered.getModules().get(0).setBeanJson("{\"a\":2,\"z\":9}");

        assertThatThrownBy(() -> service.verifyDocumentOnRead(tampered))
                .isInstanceOf(WebApplicationException.class)
                .satisfies(throwable -> {
                    WebApplicationException ex = (WebApplicationException) throwable;
                    assertThat(ex.getResponse().getStatus()).isEqualTo(409);
                    @SuppressWarnings("unchecked")
                    Map<String, Object> body = (Map<String, Object>) ex.getResponse().getEntity();
                    assertThat(body.get("errorCode")).isEqualTo("document_integrity_conflict");
                });
    }

    @Test
    void verify_acceptsExternalizedAttachmentWithDigestAndUri() throws Exception {
        DocumentModel document = buildDocument(false);
        AttachmentModel attachment = document.getAttachment().get(0);
        attachment.setDigest("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
        attachment.setUri("s3://test-bucket/attachments/doc-100/att-21-a.txt");
        attachment.setContentBytes(null);

        DocumentIntegrityEntity stored = buildStoredSeal(service, document, PRIMARY_KEY_B64, "v1");
        when(em.find(DocumentIntegrityEntity.class, document.getId())).thenReturn(stored);

        assertThatCode(() -> service.verifyDocumentOnRead(document)).doesNotThrowAnyException();
    }

    @Test
    void sealDocument_persistsFullyPopulatedIntegrityRowForNewDocument() {
        DocumentModel document = buildDocument(false);
        when(em.find(DocumentIntegrityEntity.class, document.getId())).thenReturn(null);

        service.sealDocument(document);

        ArgumentCaptor<DocumentIntegrityEntity> captor = ArgumentCaptor.forClass(DocumentIntegrityEntity.class);
        verify(em).persist(captor.capture());
        DocumentIntegrityEntity persisted = captor.getValue();
        assertThat(persisted.getDocumentId()).isEqualTo(document.getId());
        assertThat(persisted.getSealVersion()).isEqualTo("v1");
        assertThat(persisted.getHashAlg()).isEqualTo("SHA-256");
        assertThat(persisted.getSealAlg()).isEqualTo("HMAC-SHA256");
        assertThat(persisted.getContentHash()).isNotBlank();
        assertThat(persisted.getSeal()).isNotBlank();
        assertThat(persisted.getKeyId()).isEqualTo("v1");
        assertThat(persisted.getSealedAt()).isNotNull();
        assertThat(persisted.getCreatedAt()).isNotNull();
    }

    @Test
    void verifyAcceptsVerifyOnlyKeyAfterRotation() throws Exception {
        DocumentModel document = buildDocument(false);
        DocumentIntegrityEntity stored = buildStoredSeal(service, document, PRIMARY_KEY_B64, "v1");
        when(em.find(DocumentIntegrityEntity.class, document.getId())).thenReturn(stored);
        setField(service, "config", configFor("enforce", rotatedKeyringPath));

        assertThatCode(() -> service.verifyDocumentOnRead(document)).doesNotThrowAnyException();
    }

    @Test
    void verifyFailsClosedWhenStoredKeyMissingInEnforceMode() throws Exception {
        DocumentModel document = buildDocument(false);
        DocumentIntegrityEntity stored = buildStoredSeal(service, document, PRIMARY_KEY_B64, "v1");
        stored.setKeyId("missing-key");
        when(em.find(DocumentIntegrityEntity.class, document.getId())).thenReturn(stored);

        assertThatThrownBy(() -> service.verifyDocumentOnRead(document))
                .isInstanceOf(WebApplicationException.class)
                .satisfies(throwable -> {
                    WebApplicationException ex = (WebApplicationException) throwable;
                    @SuppressWarnings("unchecked")
                    Map<String, Object> body = (Map<String, Object>) ex.getResponse().getEntity();
                    assertThat(body.get("details")).asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP)
                            .containsEntry("reasonCode", "key_not_found");
                });
    }

    @Test
    void verifyContinuesInPermissiveModeWhenStoredKeyMissing() throws Exception {
        DocumentModel document = buildDocument(false);
        DocumentIntegrityEntity stored = buildStoredSeal(service, document, PRIMARY_KEY_B64, "v1");
        stored.setKeyId("missing-key");
        when(em.find(DocumentIntegrityEntity.class, document.getId())).thenReturn(stored);
        setField(service, "config", configFor("permissive", enforceKeyringPath));

        assertThatCode(() -> service.verifyDocumentOnRead(document)).doesNotThrowAnyException();
    }

    @Test
    void canonical_moduleHash_ignoresJsonKeyOrder() throws Exception {
        DocumentModel left = buildDocument(false);
        left.getModules().get(0).setBeanJson("{\"z\":1,\"a\":2}");
        DocumentModel right = buildDocument(false);
        right.getModules().get(0).setBeanJson("{\"a\":2,\"z\":1}");

        assertThat(invokeCanonicalBytes(service, left)).isEqualTo(invokeCanonicalBytes(service, right));
    }

    private DocumentIntegrityConfig configFor(String mode, Path keyringPath) {
        return new DocumentIntegrityConfig(TestServerConfigurationResolvers.resolver(
                MODE_KEY, mode,
                KEYRING_PATH_KEY, keyringPath.toString()));
    }

    private Path writeKeyring(String fileName, String json) throws IOException {
        Path path = tempDir.resolve(fileName).toAbsolutePath();
        Files.writeString(path, json);
        return path;
    }

    private static DocumentIntegrityEntity buildStoredSeal(DocumentIntegrityService service,
                                                           DocumentModel document,
                                                           String keyB64,
                                                           String keyId) throws Exception {
        byte[] canonicalBytes = invokeCanonicalBytes(service, document);
        String contentHash = invokeSha256Hex(service, canonicalBytes);
        String seal = invokeHmacSha256Hex(service, java.util.Base64.getDecoder().decode(keyB64), contentHash);

        DocumentIntegrityEntity entity = new DocumentIntegrityEntity();
        entity.setDocumentId(document.getId());
        entity.setSealVersion("v1");
        entity.setHashAlg("SHA-256");
        entity.setContentHash(contentHash);
        entity.setSealAlg("HMAC-SHA256");
        entity.setSeal(seal);
        entity.setKeyId(keyId);
        entity.setSealedAt(Instant.now());
        entity.setCreatedAt(Instant.now());
        entity.setSealedBy("test-user");
        return entity;
    }

    private static byte[] invokeCanonicalBytes(DocumentIntegrityService service, DocumentModel document) throws Exception {
        Method method = DocumentIntegrityService.class.getDeclaredMethod("canonicalBytes", DocumentModel.class);
        method.setAccessible(true);
        return (byte[]) method.invoke(service, document);
    }

    private static String invokeSha256Hex(DocumentIntegrityService service, byte[] value) throws Exception {
        Method method = DocumentIntegrityService.class.getDeclaredMethod("sha256Hex", byte[].class);
        method.setAccessible(true);
        return (String) method.invoke(service, (Object) value);
    }

    private static String invokeHmacSha256Hex(DocumentIntegrityService service, byte[] key, String value) throws Exception {
        Method method = DocumentIntegrityService.class.getDeclaredMethod("hmacSha256Hex", byte[].class, String.class);
        method.setAccessible(true);
        return (String) method.invoke(service, key, value);
    }

    private static DocumentModel buildDocument(boolean reverseOrder) {
        Date now = Date.from(Instant.parse("2026-03-02T00:00:00Z"));

        DocumentModel document = new DocumentModel();
        document.setId(100L);
        document.setStarted(now);
        document.setConfirmed(now);
        document.setRecorded(now);
        document.setStatus("T");

        DocInfoModel docInfo = new DocInfoModel();
        docInfo.setDocId("DOC-100");
        docInfo.setDocType("KARTE");
        document.setDocInfoModel(docInfo);

        KarteBean karte = new KarteBean();
        karte.setId(200L);
        PatientModel patient = new PatientModel();
        patient.setPatientId("P-001");
        karte.setPatientModel(patient);
        document.setKarteBean(karte);

        UserModel creator = new UserModel();
        creator.setUserId("fid:test-user");
        document.setUserModel(creator);

        ModuleModel module1 = new ModuleModel();
        module1.setId(10L);
        module1.getModuleInfoBean().setEntity("medOrder");
        module1.setBeanJson("{\"z\":1,\"a\":2}");

        ModuleModel module2 = new ModuleModel();
        module2.setId(20L);
        module2.getModuleInfoBean().setEntity("progressCourse");
        module2.setBeanJson("{\"text\":\"SOAP\"}");

        List<ModuleModel> modules = reverseOrder ? List.of(module2, module1) : List.of(module1, module2);
        document.setModules(modules);

        SchemaModel schema1 = new SchemaModel();
        schema1.setId(11L);
        ExtRefModel ext1 = new ExtRefModel();
        ext1.setHref("schema://1");
        schema1.setExtRefModel(ext1);
        schema1.setUri("s3://bucket/images/11.png");
        schema1.setDigest("digest-11");

        SchemaModel schema2 = new SchemaModel();
        schema2.setId(12L);
        ExtRefModel ext2 = new ExtRefModel();
        ext2.setHref("schema://2");
        schema2.setExtRefModel(ext2);
        schema2.setUri("s3://bucket/images/12.png");
        schema2.setDigest("digest-12");

        List<SchemaModel> schemas = reverseOrder ? List.of(schema2, schema1) : List.of(schema1, schema2);
        document.setSchema(schemas);

        AttachmentModel attachment1 = new AttachmentModel();
        attachment1.setId(21L);
        attachment1.setFileName("a.txt");
        attachment1.setContentType("text/plain");
        attachment1.setContentSize(3L);
        attachment1.setUri("s3://bucket/attachments/a.txt");
        attachment1.setDigest("digest-a");
        attachment1.setContentBytes(new byte[]{0x21, 0x22, 0x23});

        AttachmentModel attachment2 = new AttachmentModel();
        attachment2.setId(22L);
        attachment2.setFileName("b.txt");
        attachment2.setContentType("text/plain");
        attachment2.setContentSize(4L);
        attachment2.setUri("s3://bucket/attachments/b.txt");
        attachment2.setDigest("digest-b");
        attachment2.setContentBytes(new byte[]{0x31, 0x32, 0x33, 0x34});

        List<AttachmentModel> attachments = reverseOrder ? List.of(attachment2, attachment1)
                : List.of(attachment1, attachment2);
        document.setAttachment(attachments);

        return document;
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
