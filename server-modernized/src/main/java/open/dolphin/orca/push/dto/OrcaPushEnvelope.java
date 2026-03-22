package open.dolphin.orca.push.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class OrcaPushEnvelope {

    private String command;
    private String reqId;
    private String subId;
    private String message;
    private OrcaPushEventData data;

    public String getCommand() {
        return command;
    }

    public void setCommand(String command) {
        this.command = command;
    }

    public String getReqId() {
        return reqId;
    }

    public void setReqId(String reqId) {
        this.reqId = reqId;
    }

    public String getSubId() {
        return subId;
    }

    public void setSubId(String subId) {
        this.subId = subId;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public OrcaPushEventData getData() {
        return data;
    }

    public void setData(OrcaPushEventData data) {
        this.data = data;
    }
}
