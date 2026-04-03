package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Date;
import java.util.List;
import open.dolphin.infomodel.BundleDolphin;
import open.dolphin.infomodel.ClaimItem;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.ModuleInfoBean;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.rest.dto.orca.OrderBundleMutationRequest;
import org.junit.jupiter.api.Test;

class OrcaOrderBundleMutationSupportTest {

    @Test
    void buildDocumentPrioritizesExplicitBodyPartOverLegacyBodyPartItems() {
        OrderBundleMutationRequest.BundleOperation operation = new OrderBundleMutationRequest.BundleOperation();
        operation.setEntity(IInfoModel.ENTITY_MED_ORDER);
        operation.setBundleName("降圧薬セット");
        operation.setAdmin("静注");
        operation.setAdminCode("4101");
        operation.setAdminCodeSystem("Claim007");
        OrderBundleMutationRequest.BundleItem bodyPart = new OrderBundleMutationRequest.BundleItem();
        bodyPart.setCode("002999");
        bodyPart.setName("右下肢");
        operation.setBodyPart(bodyPart);
        OrderBundleMutationRequest.BundleItem legacyBodyPart = new OrderBundleMutationRequest.BundleItem();
        legacyBodyPart.setCode("002111");
        legacyBodyPart.setName("旧部位");
        OrderBundleMutationRequest.BundleItem drug = new OrderBundleMutationRequest.BundleItem();
        drug.setCode("100001");
        drug.setName("アムロジピン");
        operation.setItems(List.of(legacyBodyPart, drug));

        DocumentModel document = OrcaOrderBundleMutationSupport.buildDocument(new KarteBean(), new UserModel(), operation, new Date(0L));

        BundleDolphin bundle = (BundleDolphin) document.getModules().get(0).getModel();
        assertEquals("静注", bundle.getAdmin());
        assertEquals("4101", bundle.getAdminCode());
        assertEquals("Claim007", bundle.getAdminCodeSystem());
        ClaimItem[] claimItems = bundle.getClaimItem();
        assertNotNull(claimItems);
        assertEquals(2, claimItems.length);
        assertEquals("002999", claimItems[0].getCode());
        assertEquals("100001", claimItems[1].getCode());
    }

    @Test
    void updateDocumentWithBundleReusesExistingModuleIdWhenRequestOmitsIt() {
        DocumentModel document = new DocumentModel();
        document.setKarteBean(new KarteBean());
        ModuleModel existing = new ModuleModel();
        existing.setId(42L);
        existing.setModuleInfoBean(new ModuleInfoBean());
        document.setModules(List.of(existing));

        OrderBundleMutationRequest.BundleOperation operation = new OrderBundleMutationRequest.BundleOperation();
        operation.setEntity(IInfoModel.ENTITY_TREATMENT);
        operation.setBundleName("処置セット");

        OrcaOrderBundleMutationSupport.updateDocumentWithBundle(document, new UserModel(), operation, new Date(0L));

        assertEquals(42L, document.getModules().get(0).getId());
        assertEquals("オーダー", document.getDocInfoModel().getTitle());
    }
    @Test
    void buildDocumentStoresGenericFlagAndUserCommentOutsideVisibleMemo() {
        OrderBundleMutationRequest.BundleOperation operation = new OrderBundleMutationRequest.BundleOperation();
        operation.setEntity(IInfoModel.ENTITY_MED_ORDER);
        operation.setBundleName("処方セット");
        OrderBundleMutationRequest.BundleItem drug = new OrderBundleMutationRequest.BundleItem();
        drug.setCode("620000001");
        drug.setName("アムロジピン");
        drug.setQuantity("1");
        drug.setUnit("錠");
        drug.setMemo("レセプトコメント");
        drug.setGenericFlg("no");
        drug.setUserComment("食後");
        operation.setItems(List.of(drug));

        DocumentModel document = OrcaOrderBundleMutationSupport.buildDocument(new KarteBean(), new UserModel(), operation, new Date(0L));

        BundleDolphin bundle = (BundleDolphin) document.getModules().get(0).getModel();
        ClaimItem[] claimItems = bundle.getClaimItem();
        assertNotNull(claimItems);
        assertEquals(1, claimItems.length);
        assertTrue(claimItems[0].getMemo().startsWith("__orca_meta__:"));
        assertTrue(claimItems[0].getMemo().contains("\"genericFlg\":\"no\""));
        assertTrue(claimItems[0].getMemo().contains("\"userComment\":\"食後\""));
        assertTrue(claimItems[0].getMemo().endsWith("レセプトコメント"));
    }
}
