package open.dolphin.rest.admin;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class AdminConfigSnapshot {

    private Boolean chartsDisplayEnabled;
    private Boolean chartsSendEnabled;
    private String chartsMasterSource;
    private String deliveryId;
    private String deliveryVersion;
    private String deliveryEtag;
    private String deliveredAt;
    private String source;

    public AdminConfigSnapshot copy() {
        AdminConfigSnapshot copy = new AdminConfigSnapshot();
        copy.chartsDisplayEnabled = chartsDisplayEnabled;
        copy.chartsSendEnabled = chartsSendEnabled;
        copy.chartsMasterSource = chartsMasterSource;
        copy.deliveryId = deliveryId;
        copy.deliveryVersion = deliveryVersion;
        copy.deliveryEtag = deliveryEtag;
        copy.deliveredAt = deliveredAt;
        copy.source = source;
        return copy;
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

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }
}
