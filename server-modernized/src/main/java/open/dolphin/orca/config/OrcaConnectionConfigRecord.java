package open.dolphin.orca.config;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Persistent record for ORCA/WebORCA connection settings.
 *
 * <p>Secrets are stored as encrypted strings (AES-GCM via {@code TotpSecretProtector}).</p>
 */
public class OrcaConnectionConfigRecord {

    private int version = 1;

    private String updatedAt;
    private String facilityId;
    private String defaultFacilityId;

    /**
     * Multi-facility container. When present in the top-level JSON, each entry is scoped by facilityId.
     */
    private Map<String, OrcaConnectionConfigRecord> facilities;

    private Boolean useWeborca;
    private String serverUrl;
    private Integer port;
    private String username;
    private String pushUrl;
    private String pushTenantId;

    private String passwordEncrypted;
    private String passwordUpdatedAt;

    private Boolean clientAuthEnabled;
    private String clientCertificateFileName;
    private String clientCertificateUploadedAt;
    private String clientCertificateP12Encrypted;

    private String clientCertificatePassphraseEncrypted;
    private String clientCertificatePassphraseUpdatedAt;

    private String caCertificateFileName;
    private String caCertificateUploadedAt;
    private String caCertificateEncrypted;

    public int getVersion() {
        return version;
    }

    public void setVersion(int version) {
        this.version = version;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getFacilityId() {
        return facilityId;
    }

    public void setFacilityId(String facilityId) {
        this.facilityId = facilityId;
    }

    public String getDefaultFacilityId() {
        return defaultFacilityId;
    }

    public void setDefaultFacilityId(String defaultFacilityId) {
        this.defaultFacilityId = defaultFacilityId;
    }

    public Map<String, OrcaConnectionConfigRecord> getFacilities() {
        return facilities == null ? null : new LinkedHashMap<>(facilities);
    }

    public void setFacilities(Map<String, OrcaConnectionConfigRecord> facilities) {
        this.facilities = facilities == null ? null : new LinkedHashMap<>(facilities);
    }

    public Boolean getUseWeborca() {
        return useWeborca;
    }

    public void setUseWeborca(Boolean useWeborca) {
        this.useWeborca = useWeborca;
    }

    public String getServerUrl() {
        return serverUrl;
    }

    public void setServerUrl(String serverUrl) {
        this.serverUrl = serverUrl;
    }

    public Integer getPort() {
        return port;
    }

    public void setPort(Integer port) {
        this.port = port;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPushUrl() {
        return pushUrl;
    }

    public void setPushUrl(String pushUrl) {
        this.pushUrl = pushUrl;
    }

    public String getPushTenantId() {
        return pushTenantId;
    }

    public void setPushTenantId(String pushTenantId) {
        this.pushTenantId = pushTenantId;
    }

    public String getPasswordEncrypted() {
        return passwordEncrypted;
    }

    public void setPasswordEncrypted(String passwordEncrypted) {
        this.passwordEncrypted = passwordEncrypted;
    }

    public String getPasswordUpdatedAt() {
        return passwordUpdatedAt;
    }

    public void setPasswordUpdatedAt(String passwordUpdatedAt) {
        this.passwordUpdatedAt = passwordUpdatedAt;
    }

    public Boolean getClientAuthEnabled() {
        return clientAuthEnabled;
    }

    public void setClientAuthEnabled(Boolean clientAuthEnabled) {
        this.clientAuthEnabled = clientAuthEnabled;
    }

    public String getClientCertificateFileName() {
        return clientCertificateFileName;
    }

    public void setClientCertificateFileName(String clientCertificateFileName) {
        this.clientCertificateFileName = clientCertificateFileName;
    }

    public String getClientCertificateUploadedAt() {
        return clientCertificateUploadedAt;
    }

    public void setClientCertificateUploadedAt(String clientCertificateUploadedAt) {
        this.clientCertificateUploadedAt = clientCertificateUploadedAt;
    }

    public String getClientCertificateP12Encrypted() {
        return clientCertificateP12Encrypted;
    }

    public void setClientCertificateP12Encrypted(String clientCertificateP12Encrypted) {
        this.clientCertificateP12Encrypted = clientCertificateP12Encrypted;
    }

    public String getClientCertificatePassphraseEncrypted() {
        return clientCertificatePassphraseEncrypted;
    }

    public void setClientCertificatePassphraseEncrypted(String clientCertificatePassphraseEncrypted) {
        this.clientCertificatePassphraseEncrypted = clientCertificatePassphraseEncrypted;
    }

    public String getClientCertificatePassphraseUpdatedAt() {
        return clientCertificatePassphraseUpdatedAt;
    }

    public void setClientCertificatePassphraseUpdatedAt(String clientCertificatePassphraseUpdatedAt) {
        this.clientCertificatePassphraseUpdatedAt = clientCertificatePassphraseUpdatedAt;
    }

    public String getCaCertificateFileName() {
        return caCertificateFileName;
    }

    public void setCaCertificateFileName(String caCertificateFileName) {
        this.caCertificateFileName = caCertificateFileName;
    }

    public String getCaCertificateUploadedAt() {
        return caCertificateUploadedAt;
    }

    public void setCaCertificateUploadedAt(String caCertificateUploadedAt) {
        this.caCertificateUploadedAt = caCertificateUploadedAt;
    }

    public String getCaCertificateEncrypted() {
        return caCertificateEncrypted;
    }

    public void setCaCertificateEncrypted(String caCertificateEncrypted) {
        this.caCertificateEncrypted = caCertificateEncrypted;
    }
}
