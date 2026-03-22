package open.dolphin.rest.orca;

import open.dolphin.infomodel.IInfoModel;
import org.slf4j.Logger;

final class OrcaOrderInputSetMetadataSupport {

    private OrcaOrderInputSetMetadataSupport() {
    }

    static OrcaOrderInputSetSupport.ClassMetadata resolveClassMetadata(String receiptCode, Logger logger) {
        try {
            int number = Integer.parseInt(receiptCode);
            if (number >= 110 && number <= 125) {
                return new OrcaOrderInputSetSupport.ClassMetadata(IInfoModel.ENTITY_BASE_CHARGE_ORDER, "診断料");
            }
            if (number >= 130 && number <= 150) {
                return new OrcaOrderInputSetSupport.ClassMetadata(IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER, "指導・在宅");
            }
            if (number >= 200 && number <= 299) {
                return new OrcaOrderInputSetSupport.ClassMetadata(IInfoModel.ENTITY_MED_ORDER, "RP");
            }
            if (number >= 300 && number <= 399) {
                return new OrcaOrderInputSetSupport.ClassMetadata(IInfoModel.ENTITY_INJECTION_ORDER, "注射");
            }
            if (number >= 400 && number <= 499) {
                return new OrcaOrderInputSetSupport.ClassMetadata(IInfoModel.ENTITY_TREATMENT, "処置");
            }
            if (number >= 500 && number <= 599) {
                return new OrcaOrderInputSetSupport.ClassMetadata(IInfoModel.ENTITY_SURGERY_ORDER, "手術");
            }
            if (number >= 600 && number <= 699) {
                return new OrcaOrderInputSetSupport.ClassMetadata(IInfoModel.ENTITY_LABO_TEST, "検査");
            }
            if (number >= 700 && number <= 799) {
                return new OrcaOrderInputSetSupport.ClassMetadata(IInfoModel.ENTITY_RADIOLOGY_ORDER, "放射線");
            }
            if (number >= 800 && number <= 899) {
                return new OrcaOrderInputSetSupport.ClassMetadata(IInfoModel.ENTITY_OTHER_ORDER, "その他");
            }
        } catch (NumberFormatException e) {
            logger.debug("Failed to resolve entity from receipt code {}", receiptCode);
        }
        return new OrcaOrderInputSetSupport.ClassMetadata(IInfoModel.ENTITY_GENERAL_ORDER, "汎用");
    }
}
