package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.List;
import open.dolphin.infomodel.BundleDolphin;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.ModuleInfoBean;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.rest.dto.orca.OrderBundleFetchResponse;
import org.junit.jupiter.api.Test;

class OrcaOrderBundleFetchSupportTest {

    @Test
    void collectBundlesCanonicalizesChargeClassNameOnOutput() {
        DocumentModel document = new DocumentModel();
        document.setId(100L);

        ModuleInfoBean info = new ModuleInfoBean();
        info.setEntity(IInfoModel.ENTITY_BASE_CHARGE_ORDER);
        info.setStampName("bundle-name");

        BundleDolphin bundle = new BundleDolphin();
        bundle.setOrderName("bundle-name");
        bundle.setBundleNumber("1");
        bundle.setClassCode("110");
        bundle.setClassCodeSystem("Claim007");
        bundle.setClassName("fallback-name");

        ModuleModel module = new ModuleModel();
        module.setId(200L);
        module.setModuleInfoBean(info);
        module.setModel(bundle);
        document.setModules(List.of(module));

        List<OrderBundleFetchResponse.OrderBundleEntry> entries = OrcaOrderBundleFetchSupport.collectBundles(
                List.of(document),
                IInfoModel.ENTITY_BASE_CHARGE_ORDER,
                ignored -> bundle);

        assertEquals(1, entries.size());
        OrderBundleFetchResponse.OrderBundleEntry entry = entries.get(0);
        assertNotNull(entry);
        assertEquals("基本診療料", entry.getClassName());
        assertEquals("110", entry.getClassCode());
    }

    @Test
    void collectBundlesCanonicalizesRadiologyClassNameOnOutput() {
        DocumentModel document = new DocumentModel();
        document.setId(101L);

        ModuleInfoBean info = new ModuleInfoBean();
        info.setEntity(IInfoModel.ENTITY_RADIOLOGY_ORDER);
        info.setStampName("radiology-bundle");

        BundleDolphin bundle = new BundleDolphin();
        bundle.setOrderName("radiology-bundle");
        bundle.setBundleNumber("1");
        bundle.setClassCode("701");
        bundle.setClassCodeSystem("Claim007");
        bundle.setClassName("UNTRUSTED_LABEL");

        ModuleModel module = new ModuleModel();
        module.setId(201L);
        module.setModuleInfoBean(info);
        module.setModel(bundle);
        document.setModules(List.of(module));

        List<OrderBundleFetchResponse.OrderBundleEntry> entries = OrcaOrderBundleFetchSupport.collectBundles(
                List.of(document),
                IInfoModel.ENTITY_RADIOLOGY_ORDER,
                ignored -> bundle);

        assertEquals(1, entries.size());
        OrderBundleFetchResponse.OrderBundleEntry entry = entries.get(0);
        assertNotNull(entry);
        assertEquals("画像診断", entry.getClassName());
        assertEquals("701", entry.getClassCode());
    }
}
