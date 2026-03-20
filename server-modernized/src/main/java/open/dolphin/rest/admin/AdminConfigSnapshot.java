package open.dolphin.rest.admin;

public class AdminConfigSnapshot {

    private String orcaEndpoint;
    private Boolean mswEnabled;
    private Boolean verifyAdminDelivery;
    private Boolean chartsDisplayEnabled;
    private Boolean chartsSendEnabled;
    private String chartsMasterSource;
    private String deliveryId;
    private String deliveryVersion;
    private String deliveryEtag;
    private String deliveredAt;
    private String note;
    private String environment;
    private String deliveryMode;
    private String source;
    private Boolean verified;

    public AdminConfigSnapshot copy() {
        AdminConfigSnapshot copy = new AdminConfigSnapshot();
        copy.orcaEndpoint = orcaEndpoint;
        copy.mswEnabled = mswEnabled;
        copy.verifyAdminDelivery = verifyAdminDelivery;
        copy.chartsDisplayEnabled = chartsDisplayEnabled;
        copy.chartsSendEnabled = chartsSendEnabled;
        copy.chartsMasterSource = chartsMasterSource;
        copy.deliveryId = deliveryId;
        copy.deliveryVersion = deliveryVersion;
        copy.deliveryEtag = deliveryEtag;
        copy.deliveredAt = deliveredAt;
        copy.note = note;
        copy.environment = environment;
        copy.deliveryMode = deliveryMode;
        copy.source = source;
        copy.verified = verified;
        return copy;
    }

    public String getOrcaEndpoint() {
        return orcaEndpoint;
    }

    public void setOrcaEndpoint(String orcaEndpoint) {
        this.orcaEndpoint = orcaEndpoint;
    }

    public Boolean getMswEnabled() {
        return mswEnabled;
    }

    public void setMswEnabled(Boolean mswEnabled) {
        this.mswEnabled = mswEnabled;
    }

    public Boolean getVerifyAdminDelivery() {
        return verifyAdminDelivery;
    }

    public void setVerifyAdminDelivery(Boolean verifyAdminDelivery) {
        this.verifyAdminDelivery = verifyAdminDelivery;
    }

    public Boolean getChartsDisplayEnabled() {
        return chartsDisplayEnabled;
    }

    public void setChartsDisplayEnabled(Boolean chartsDisplayEnabled) {
        this.chartsDisplayEnabled = chartsDisplayEnabled;
    }

    public Boolean getChartsSendEnabled() {
        return chartsSendEnabled;
    }

    public void setChartsSendEnabled(Boolean chartsSendEnabled) {
        this.chartsSendEnabled = chartsSendEnabled;
    }

    public String getChartsMasterSource() {
        return chartsMasterSource;
    }

    public void setChartsMasterSource(String chartsMasterSource) {
        this.chartsMasterSource = chartsMasterSource;
    }

    public String getDeliveryId() {
        return deliveryId;
    }

    public void setDeliveryId(String deliveryId) {
        this.deliveryId = deliveryId;
    }

    public String getDeliveryVersion() {
        return deliveryVersion;
    }

    public void setDeliveryVersion(String deliveryVersion) {
        this.deliveryVersion = deliveryVersion;
    }

    public String getDeliveryEtag() {
        return deliveryEtag;
    }

    public void setDeliveryEtag(String deliveryEtag) {
        this.deliveryEtag = deliveryEtag;
    }

    public String getDeliveredAt() {
        return deliveredAt;
    }

    public void setDeliveredAt(String deliveredAt) {
        this.deliveredAt = deliveredAt;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public String getEnvironment() {
        return environment;
    }

    public void setEnvironment(String environment) {
        this.environment = environment;
    }

    public String getDeliveryMode() {
        return deliveryMode;
    }

    public void setDeliveryMode(String deliveryMode) {
        this.deliveryMode = deliveryMode;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public Boolean getVerified() {
        return verified;
    }

    public void setVerified(Boolean verified) {
        this.verified = verified;
    }
}
