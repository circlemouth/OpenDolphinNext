package open.dolphin.reporting;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.OutputStream;
import java.math.BigInteger;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.GeneralSecurityException;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.Security;
import java.security.cert.Certificate;
import java.security.cert.X509Certificate;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Date;
import java.util.Locale;
import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter;
import org.bouncycastle.cert.jcajce.JcaX509v3CertificateBuilder;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.operator.ContentSigner;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;
import org.junit.jupiter.api.Test;

class PdfSigningServiceTest {

    private static final char[] PASSWORD = "changeit".toCharArray();
    private static final String VALID_ALIAS = "opendolphin-report";
    private static final Locale LOCALE = Locale.JAPAN;

    static {
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
    }

    @Test
    void renderWithoutSigningConfigProducesPdf() throws Exception {
        Path output = Files.createTempFile("reporting-preview-", ".pdf");
        try {
            PdfRenderer renderer = new PdfRenderer(new ReportTemplateEngine(resolveTemplateRoot()),
                    new PdfDocumentWriter(), new PdfSigningService());
            Path rendered = renderer.render("patient_summary", sampleContext(), output, null);

            assertEquals(output, rendered);
            assertTrue(Files.exists(output));
            assertTrue(Files.size(output) > 0L);
        } finally {
            Files.deleteIfExists(output);
        }
    }

    @Test
    void signFailsClosedWhenTsaIsUnreachable() throws Exception {
        Path pdf = createUnsignedPdf();
        Path keystore = createKeystore(VALID_ALIAS);
        PdfSigningService service = new PdfSigningService();
        SigningConfig config = new SigningConfig.Builder()
                .keystorePath(keystore)
                .keystorePassword(PASSWORD)
                .keyAlias(VALID_ALIAS)
                .tsaUrl("http://127.0.0.1:9/tsa")
                .build();

        IOException ex = assertThrows(IOException.class, () -> service.sign(pdf, config));
        assertEquals("Failed to sign PDF", ex.getMessage());
        assertNotNull(ex.getCause());
        assertTrue(Files.exists(pdf));
    }

    @Test
    void signFailsWhenKeyAliasIsMissing() throws Exception {
        Path pdf = createUnsignedPdf();
        Path keystore = createKeystore(VALID_ALIAS);
        PdfSigningService service = new PdfSigningService();
        SigningConfig config = new SigningConfig.Builder()
                .keystorePath(keystore)
                .keystorePassword(PASSWORD)
                .keyAlias("missing-alias")
                .build();

        IOException ex = assertThrows(IOException.class, () -> service.sign(pdf, config));
        assertEquals("Failed to sign PDF", ex.getMessage());
        assertNotNull(ex.getCause());
    }

    @Test
    void signWithoutTsaSucceeds() throws Exception {
        Path pdf = createUnsignedPdf();
        Path keystore = createKeystore(VALID_ALIAS);
        PdfSigningService service = new PdfSigningService();
        SigningConfig config = new SigningConfig.Builder()
                .keystorePath(keystore)
                .keystorePassword(PASSWORD)
                .keyAlias(VALID_ALIAS)
                .reason("Medical record export")
                .location("Tokyo, JP")
                .build();

        assertDoesNotThrow(() -> service.sign(pdf, config));
        assertTrue(Files.exists(pdf));
        assertTrue(Files.size(pdf) > 0L);
    }

    private Path createUnsignedPdf() throws IOException {
        Path pdf = Files.createTempFile("reporting-source-", ".pdf");
        PdfDocumentWriter writer = new PdfDocumentWriter();
        writer.write("<body><h1>Fixture</h1><p>Signed export fixture</p></body>", sampleContext(), pdf);
        return pdf;
    }

    private Path createKeystore(String alias) throws Exception {
        KeyPair keyPair = generateKeyPair();
        X509Certificate certificate = selfSignedCertificate(keyPair);
        KeyStore keyStore = KeyStore.getInstance("PKCS12");
        keyStore.load(null, PASSWORD);
        keyStore.setKeyEntry(alias, keyPair.getPrivate(), PASSWORD, new Certificate[] {certificate});

        Path keystore = Files.createTempFile("reporting-keystore-", ".p12");
        try (OutputStream outputStream = Files.newOutputStream(keystore)) {
            keyStore.store(outputStream, PASSWORD);
        }
        return keystore;
    }

    private KeyPair generateKeyPair() throws GeneralSecurityException {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        return generator.generateKeyPair();
    }

    private X509Certificate selfSignedCertificate(KeyPair keyPair) throws Exception {
        Date notBefore = Date.from(ZonedDateTime.now(ZoneId.of("UTC")).minusDays(1).toInstant());
        Date notAfter = Date.from(ZonedDateTime.now(ZoneId.of("UTC")).plusDays(365).toInstant());
        X500Name subject = new X500Name("CN=OpenDolphin Reporting Test");
        JcaX509v3CertificateBuilder builder = new JcaX509v3CertificateBuilder(subject,
                BigInteger.valueOf(System.currentTimeMillis()), notBefore, notAfter, subject, keyPair.getPublic());
        ContentSigner signer = new JcaContentSignerBuilder("SHA256withRSA")
                .setProvider(BouncyCastleProvider.PROVIDER_NAME)
                .build(keyPair.getPrivate());
        return new JcaX509CertificateConverter()
                .setProvider(BouncyCastleProvider.PROVIDER_NAME)
                .getCertificate(builder.build(signer));
    }

    private ReportContext sampleContext() {
        return ReportContext.builder(LOCALE)
                .documentTitle("患者サマリー")
                .patient("山田 太郎", LocalDate.of(1985, 5, 23))
                .attendingDoctor("医師 山田花子")
                .encounterDate(LocalDate.of(2026, 3, 27))
                .generatedAt(ZonedDateTime.now(ZoneId.of("UTC")))
                .addSummaryItem("主訴", "Chief Complaint", "発熱と咽頭痛")
                .addSummaryItem("アレルギー", "Allergies", "特記事項なし")
                .build();
    }

    private Path resolveTemplateRoot() {
        Path cwd = Paths.get("").toAbsolutePath();
        Path repoRoot = cwd.getFileName() != null && "reporting".equals(cwd.getFileName().toString())
                ? cwd.getParent()
                : cwd;
        Path templateRoot = repoRoot.resolve("server-modernized").resolve("reporting").resolve("templates");
        assertTrue(Files.isDirectory(templateRoot), "reporting templates directory must exist");
        return templateRoot;
    }
}
