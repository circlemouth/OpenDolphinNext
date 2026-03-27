package open.dolphin.shared.converter;

import java.util.Arrays;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.SchemaModel;
import open.dolphin.infomodel.UserModel;

public abstract class ISchemaModel<T extends IExtRefModel> implements java.io.Serializable {

    private long id;

    private String confirmed;

    private String started;

    private String ended;

    private String recorded;

    private long linkId;

    private String linkRelation;

    private String status;

    private UserModel userModel;

    private KarteBean karteBean;

    private T extRef;

    private String uri;

    private String digest;

    private byte[] imageBytes;

    protected abstract T createExtRefModel();

    public ISchemaModel() {
        extRef = createExtRefModel();
    }

    public long getId() {
        return id;
    }

    public void setId(long id) {
        this.id = id;
    }

    public String getConfirmed() {
        return confirmed;
    }

    public void setConfirmed(String confirmed) {
        this.confirmed = confirmed;
    }

    public String getStarted() {
        return started;
    }

    public void setStarted(String started) {
        this.started = started;
    }

    public String getEnded() {
        return ended;
    }

    public void setEnded(String ended) {
        this.ended = ended;
    }

    public String getRecorded() {
        return recorded;
    }

    public void setRecorded(String recorded) {
        this.recorded = recorded;
    }

    public long getLinkId() {
        return linkId;
    }

    public void setLinkId(long linkId) {
        this.linkId = linkId;
    }

    public String getLinkRelation() {
        return linkRelation;
    }

    public void setLinkRelation(String linkRelation) {
        this.linkRelation = linkRelation;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public UserModel getUserModel() {
        return copyUserModel(userModel);
    }

    public void setUserModel(UserModel userModel) {
        this.userModel = copyUserModel(userModel);
    }

    public KarteBean getKarteBean() {
        return copyKarteBean(karteBean);
    }

    public void setKarteBean(KarteBean karteBean) {
        this.karteBean = copyKarteBean(karteBean);
    }

    public T getExtRefModel() {
        return copyExtRefModel(extRef);
    }

    public void setExtRefModel(T extRef) {
        this.extRef = copyExtRefModel(extRef);
    }

    public String getUri() {
        return uri;
    }

    public void setUri(String uri) {
        this.uri = uri;
    }

    public String getDigest() {
        return digest;
    }

    public void setDigest(String digest) {
        this.digest = digest;
    }

    public byte[] getImageBytes() {
        return imageBytes == null ? null : Arrays.copyOf(imageBytes, imageBytes.length);
    }

    public void setImageBytes(byte[] imageBytes) {
        this.imageBytes = imageBytes == null ? null : Arrays.copyOf(imageBytes, imageBytes.length);
    }

    public void fromModel(SchemaModel model) {
        this.setId(model.getId());
        this.setConfirmed(IOSHelper.toDateStr(model.getConfirmed()));
        this.setStarted(IOSHelper.toDateStr(model.getStarted()));
        this.setEnded(IOSHelper.toDateStr(model.getEnded()));
        this.setRecorded(IOSHelper.toDateStr(model.getRecorded()));
        this.setLinkId(model.getLinkId());
        this.setLinkRelation(model.getLinkRelation());
        this.setStatus(model.getStatus());

        T ext = getExtRefModel();
        ext.fromModel(model.getExtRefModel());
        this.setExtRefModel(ext);

        this.setUri(model.getUri());
        this.setDigest(model.getDigest());
        this.setImageBytes(model.getImageBytes());
    }

    public SchemaModel toModel() {
        SchemaModel ret = new SchemaModel();

        ret.setId(this.getId());
        ret.setConfirmed(IOSHelper.toDate(this.getConfirmed()));
        ret.setStarted(IOSHelper.toDate(this.getStarted()));
        ret.setEnded(IOSHelper.toDate(this.getEnded()));
        ret.setRecorded(IOSHelper.toDate(this.getRecorded()));
        ret.setLinkId(this.getLinkId());
        ret.setLinkRelation(this.getLinkRelation());
        ret.setStatus(this.getStatus());
        ret.setUserModel(this.getUserModel());
        ret.setKarteBean(this.getKarteBean());
        ret.setExtRefModel(this.getExtRefModel().toModel());
        ret.setUri(this.getUri());
        ret.setDigest(this.getDigest());
        ret.setImageBytes(this.getImageBytes());

        return ret;
    }

    private UserModel copyUserModel(UserModel source) {
        if (source == null) {
            return null;
        }
        UserModel copy = new UserModel();
        copy.setId(source.getId());
        return copy;
    }

    private KarteBean copyKarteBean(KarteBean source) {
        if (source == null) {
            return null;
        }
        KarteBean copy = new KarteBean();
        copy.setId(source.getId());
        return copy;
    }

    @SuppressWarnings("unchecked")
    private T copyExtRefModel(T source) {
        if (source == null) {
            return null;
        }
        T copy = createExtRefModel();
        copy.fromModel(source.toModel());
        return copy;
    }
}
