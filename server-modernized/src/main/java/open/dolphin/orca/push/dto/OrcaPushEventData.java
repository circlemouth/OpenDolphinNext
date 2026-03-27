package open.dolphin.orca.push.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public class OrcaPushEventData {

    private String id;
    private String uuid;
    private String event;
    private String user;
    private String time;
    @JsonProperty("body")
    private OrcaPushBody body;

    public OrcaPushEventData() {
    }

    public OrcaPushEventData(OrcaPushEventData source) {
        if (source == null) {
            return;
        }
        this.id = source.id;
        this.uuid = source.uuid;
        this.event = source.event;
        this.user = source.user;
        this.time = source.time;
        this.body = copyBody(source.body);
    }

    public static OrcaPushEventData copyOf(OrcaPushEventData source) {
        return source == null ? null : new OrcaPushEventData(source);
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getUuid() {
        return uuid;
    }

    public void setUuid(String uuid) {
        this.uuid = uuid;
    }

    public String getEvent() {
        return event;
    }

    public void setEvent(String event) {
        this.event = event;
    }

    public String getUser() {
        return user;
    }

    public void setUser(String user) {
        this.user = user;
    }

    public String getTime() {
        return time;
    }

    public void setTime(String time) {
        this.time = time;
    }

    public OrcaPushBody getBody() {
        return body;
    }

    public void setBody(OrcaPushBody body) {
        this.body = copyBody(body);
    }

    private static OrcaPushBody copyBody(OrcaPushBody source) {
        if (source instanceof OrcaPushMedicalBody medicalBody) {
            return OrcaPushMedicalBody.copyOf(medicalBody);
        }
        if (source instanceof OrcaPushReceptionBody receptionBody) {
            return OrcaPushReceptionBody.copyOf(receptionBody);
        }
        return source;
    }
}
