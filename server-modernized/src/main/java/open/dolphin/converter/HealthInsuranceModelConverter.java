package open.dolphin.converter;

import open.dolphin.infomodel.HealthInsuranceModel;
import open.dolphin.infomodel.IInfoModel;

/**
 *
 * @author Kazushi Minagawa, Digital Globe, Inc.
 */
public final class HealthInsuranceModelConverter implements IInfoModelConverter {

    private HealthInsuranceModel model;

    public HealthInsuranceModelConverter() {
    }

    public long getId() {
        return model.getId();
    }

    public String getBeanJson() {
        return model.getBeanJson();
    }

    @Override
    public void setModel(IInfoModel model) {
        HealthInsuranceModel source = (HealthInsuranceModel) model;
        HealthInsuranceModel copy = new HealthInsuranceModel();
        copy.setId(source.getId());
        copy.setBeanJson(source.getBeanJson());
        this.model = copy;
    }
}
