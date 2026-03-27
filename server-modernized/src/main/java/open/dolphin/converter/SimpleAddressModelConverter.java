package open.dolphin.converter;

import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.SimpleAddressModel;

/**
 *
 * @author Kazushi Minagawa, Digital Globe, Inc.
 */
public final class SimpleAddressModelConverter implements IInfoModelConverter {

    private SimpleAddressModel model;

    public SimpleAddressModelConverter() {
    }

    public String getZipCode() {
        return model.getZipCode();
    }

    public String getAddress() {
        return model.getAddress();
    }

    @Override
    public void setModel(IInfoModel model) {
        SimpleAddressModel source = (SimpleAddressModel) model;
        SimpleAddressModel copy = new SimpleAddressModel();
        copy.setZipCode(source.getZipCode());
        copy.setAddress(source.getAddress());
        this.model = copy;
    }
}
