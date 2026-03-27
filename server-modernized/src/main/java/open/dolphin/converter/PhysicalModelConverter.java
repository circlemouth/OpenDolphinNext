package open.dolphin.converter;

import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.PhysicalModel;

/**
 *
 * @author Kazushi Minagawa, Digital Globe, Inc.
 */
public final class PhysicalModelConverter implements IInfoModelConverter {

    private PhysicalModel model;

    public PhysicalModelConverter() {
    }

    public long getHeightId() {
        return model.getHeightId();
    }

    public long getWeightId() {
        return model.getWeightId();
    }

    // factor
    public String getHeight() {
        return model.getHeight();
    }

    // identifiedDate
    public String getIdentifiedDate() {
        return model.getIdentifiedDate();
    }

    // memo
    public String getMemo() {
        return model.getMemo();
    }

    public String getWeight() {
        return model.getWeight();
    }

    @Override
    public void setModel(IInfoModel model) {
        PhysicalModel source = (PhysicalModel) model;
        PhysicalModel copy = new PhysicalModel();
        copy.setHeightId(source.getHeightId());
        copy.setWeightId(source.getWeightId());
        copy.setHeight(source.getHeight());
        copy.setIdentifiedDate(source.getIdentifiedDate());
        copy.setMemo(source.getMemo());
        copy.setWeight(source.getWeight());
        this.model = copy;
    }
}
