package open.dolphin.shared.converter;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

public class IAllergyPackage<T extends IAllergyModel> implements Serializable {

    private long ptPK;

    private List<T> added;

    private List<T> modified;

    private List<T> deleted;

    public List<T> getAdded() {
        return added == null ? null : new ArrayList<>(added);
    }

    public void setAdded(List<T> added) {
        this.added = added == null ? null : new ArrayList<>(added);
    }

    public List<T> getModified() {
        return modified == null ? null : new ArrayList<>(modified);
    }

    public void setModified(List<T> modified) {
        this.modified = modified == null ? null : new ArrayList<>(modified);
    }

    public List<T> getDeleted() {
        return deleted == null ? null : new ArrayList<>(deleted);
    }

    public void setDeleted(List<T> deleted) {
        this.deleted = deleted == null ? null : new ArrayList<>(deleted);
    }

    public long getPtPK() {
        return ptPK;
    }

    public void setPtPK(long ptPK) {
        this.ptPK = ptPK;
    }
}
