package open.dolphin.reporting;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.Security;
import java.security.Signature;
import java.security.cert.Certificate;
import java.security.cert.X509Certificate;
import java.util.Calendar;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import com.lowagie.text.pdf.PdfDate;
import com.lowagie.text.pdf.PdfDictionary;
import com.lowagie.text.pdf.PdfName;
import com.lowagie.text.pdf.PdfPKCS7;
import com.lowagie.text.pdf.PdfReader;
import com.lowagie.text.pdf.PdfSignature;
import com.lowagie.text.pdf.PdfSignatureAppearance;
import com.lowagie.text.pdf.PdfStamper;
import com.lowagie.text.pdf.PdfString;
import com.lowagie.text.pdf.TSAClient;
import com.lowagie.text.pdf.TSAClientBouncyCastle;
import com.lowagie.text.ExceptionConverter;

/**
 * Applies digital signatures (and optional timestamps) to generated PDFs.
 */
public final class PdfSigningService {

    static {
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
    }

    public void sign(Path pdfPath, SigningConfig config) throws IOException {
        Objects.requireNonNull(pdfPath, "pdfPath must not be null");
        Objects.requireNonNull(config, "config must not be null");
        try {
            signInternal(pdfPath, config);
        } catch (ExceptionConverter ex) {
            Exception cause = ex.getException();
            if (cause == null) {
                cause = ex;
            }
            throw new IOException("Failed to sign PDF", cause);
        } catch (GeneralSecurityException | IOException ex) {
            throw new IOException("Failed to sign PDF", ex);
        }
    }

    private void signInternal(Path pdfPath, SigningConfig config) throws GeneralSecurityException, IOException {
        KeyStore keyStore = loadKeyStore(config);
        if (!keyStore.containsAlias(config.getKeyAlias())) {
            throw new GeneralSecurityException("Key alias not found: " + config.getKeyAlias());
        }
        PrivateKey privateKey = (PrivateKey) keyStore.getKey(config.getKeyAlias(), config.getKeystorePassword());
        if (privateKey == null) {
            throw new GeneralSecurityException("Private key not available for alias: " + config.getKeyAlias());
        }
        Certificate[] chain = keyStore.getCertificateChain(config.getKeyAlias());
        if (chain == null || chain.length == 0) {
            throw new GeneralSecurityException("Certificate chain missing for alias: " + config.getKeyAlias());
        }

        Path tempFile = Files.createTempFile("opendolphin-report-", ".pdf");
        try (InputStream inputStream = Files.newInputStream(pdfPath);
                OutputStream outputStream = Files.newOutputStream(tempFile)) {
            PdfReader reader = new PdfReader(inputStream);
            try {
                PdfStamper stamper = PdfStamper.createSignature(reader, outputStream, '\0', null, true);
                PdfSignatureAppearance appearance = stamper.getSignatureAppearance();
                appearance.setReason(config.getReason());
                appearance.setLocation(config.getLocation());
                appearance.setCertificationLevel(PdfSignatureAppearance.NOT_CERTIFIED);

                Calendar signDate = Calendar.getInstance();
                appearance.setSignDate((Calendar) signDate.clone());

                PdfSignature signatureDictionary = new PdfSignature(PdfName.ADOBE_PPKLITE, PdfName.ADBE_PKCS7_DETACHED);
                if (!isBlank(config.getReason())) {
                    signatureDictionary.setReason(config.getReason());
                }
                if (!isBlank(config.getLocation())) {
                    signatureDictionary.setLocation(config.getLocation());
                }
                signatureDictionary.setDate(new PdfDate(signDate));

                PdfPKCS7 pkcs7 = new PdfPKCS7(privateKey, chain, null, "SHA256",
                        BouncyCastleProvider.PROVIDER_NAME, false);
                String signerName = PdfPKCS7.getSubjectFields((X509Certificate) chain[0]).getField("CN");
                if (!isBlank(signerName)) {
                    signatureDictionary.setName(signerName);
                }

                appearance.setCryptoDictionary(signatureDictionary);

                Map<PdfName, Integer> exclusionSizes = new HashMap<>();
                int estimatedSignatureSize = 16384;
                exclusionSizes.put(PdfName.CONTENTS, estimatedSignatureSize * 2 + 2);
                appearance.preClose(exclusionSizes);

                String encryptionAlgorithm = resolveEncryptionAlgorithm(privateKey);
                MessageDigest messageDigest = MessageDigest.getInstance("SHA-256",
                        BouncyCastleProvider.PROVIDER_NAME);
                Signature signature = Signature.getInstance("SHA256with" + encryptionAlgorithm,
                        BouncyCastleProvider.PROVIDER_NAME);
                signature.initSign(privateKey);
                try (InputStream rangeStream = appearance.getRangeStream()) {
                    byte[] buffer = new byte[8192];
                    int read;
                    while ((read = rangeStream.read(buffer)) > 0) {
                        messageDigest.update(buffer, 0, read);
                        signature.update(buffer, 0, read);
                    }
                }
                byte[] hash = messageDigest.digest();
                byte[] signedDigest = signature.sign();
                pkcs7.setExternalDigest(signedDigest, null, encryptionAlgorithm);

                TSAClient tsaClient = null;
                if (!isBlank(config.getTsaUrl())) {
                    TSAClientBouncyCastle client = new TSAClientBouncyCastle(config.getTsaUrl(), config.getTsaUsername(),
                            toNullableString(config.getTsaPassword()));
                    client.setDigestName("SHA-256");
                    tsaClient = client;
                }

                Calendar signingTime = (Calendar) signDate.clone();
                byte[] encodedSignature = pkcs7.getEncodedPKCS7(hash, signingTime, tsaClient, null);

                if (encodedSignature.length > estimatedSignatureSize) {
                    throw new GeneralSecurityException(
                            "Encoded signature size exceeds reserved placeholder: " + encodedSignature.length);
                }

                byte[] paddedSignature = new byte[estimatedSignatureSize];
                System.arraycopy(encodedSignature, 0, paddedSignature, 0, encodedSignature.length);

                PdfDictionary updateDictionary = new PdfDictionary();
                updateDictionary.put(PdfName.CONTENTS, new PdfString(paddedSignature).setHexWriting(true));
                appearance.close(updateDictionary);
            } finally {
                reader.close();
            }
        }
        Files.move(tempFile, pdfPath, StandardCopyOption.REPLACE_EXISTING);
    }

    private KeyStore loadKeyStore(SigningConfig config) throws GeneralSecurityException, IOException {
        try (InputStream keyStream = Files.newInputStream(config.getKeystorePath())) {
            KeyStore keyStore = KeyStore.getInstance("PKCS12");
            keyStore.load(keyStream, config.getKeystorePassword());
            return keyStore;
        }
    }

    private String resolveEncryptionAlgorithm(PrivateKey key) {
        String algorithm = key.getAlgorithm();
        if ("RSA".equalsIgnoreCase(algorithm)) {
            return "RSA";
        }
        if ("DSA".equalsIgnoreCase(algorithm)) {
            return "DSA";
        }
        if ("EC".equalsIgnoreCase(algorithm) || "ECDSA".equalsIgnoreCase(algorithm)) {
            return "ECDSA";
        }
        return algorithm;
    }

    private String toNullableString(char[] value) {
        return value == null ? null : new String(value);
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
