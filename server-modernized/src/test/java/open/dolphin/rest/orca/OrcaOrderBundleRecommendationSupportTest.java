package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.List;
import open.dolphin.infomodel.BundleDolphin;
import open.dolphin.infomodel.ClaimItem;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.rest.dto.orca.OrderBundleFetchResponse;
import open.dolphin.rest.dto.orca.OrderBundleRecommendationResponse;
import org.junit.jupiter.api.Test;

class OrcaOrderBundleRecommendationSupportTest {

    @Test
    void toItemsAndExtractBodyPartSeparateLegacyBodyPartFromItems() {
        ClaimItem bodyPart = claimItem("0021001", "CHEST", "1", null, null);
        ClaimItem drug = claimItem("100001", "AMLODIPINE", "2", "tablet", "morning");

        List<OrderBundleFetchResponse.OrderBundleItem> items =
                OrcaOrderBundleRecommendationSupport.toItems(IInfoModel.ENTITY_TREATMENT, new ClaimItem[]{bodyPart, drug});
        List<OrderBundleFetchResponse.OrderBundleItem> filtered =
                OrcaOrderBundleRecommendationSupport.removeBodyPartItems(items);

        assertEquals(2, items.size());
        assertEquals("0021001", items.get(0).getCode());
        assertEquals(OrcaOrderBundleRecommendationSupport.ROW_ROLE_BODY_PART, items.get(0).getRowRole());
        assertEquals("0021001", OrcaOrderBundleRecommendationSupport.extractBodyPart(items).getCode());
        assertEquals(1, filtered.size());
        assertEquals("100001", filtered.get(0).getCode());
        assertEquals(OrcaOrderBundleRecommendationSupport.ROW_ROLE_MAIN, filtered.get(0).getRowRole());
    }

    @Test
    void toRecommendationTemplateSeparatesBodyPartMaterialAndCommentItems() {
        BundleDolphin bundle = new BundleDolphin();
        bundle.setBundleNumber("1");
        bundle.setClassCode("212");
        bundle.setClassCodeSystem("Claim007");
        bundle.setClassName("RP");
        bundle.setAdmin("oral");
        bundle.setAdminCode("4101");
        bundle.setAdminCodeSystem("Claim007");
        bundle.setClaimItem(new ClaimItem[]{
                claimItem("0021001", "CHEST", "1", null, null),
                claimItem("700123", "SYRINGE", "1", "bottle", null),
                claimItem("0085001", "COMMENT", "1", null, "after-meal"),
                claimItem("100001", "AMLODIPINE", "2", "tablet", "morning")
        });

        OrderBundleRecommendationResponse.OrderRecommendationTemplate template =
                OrcaOrderBundleRecommendationSupport.toRecommendationTemplate(
                        "SET-A",
                        bundle,
                        IInfoModel.ENTITY_MED_ORDER,
                        null);

        assertNotNull(template.getBodyPart());
        assertEquals("0021001", template.getBodyPart().getCode());
        assertEquals(OrcaOrderBundleRecommendationSupport.ROW_ROLE_BODY_PART, template.getBodyPart().getRowRole());
        assertEquals(1, template.getMaterialItems().size());
        assertEquals(OrcaOrderBundleRecommendationSupport.ROW_ROLE_MATERIAL, template.getMaterialItems().get(0).getRowRole());
        assertEquals(1, template.getCommentItems().size());
        assertEquals(OrcaOrderBundleRecommendationSupport.ROW_ROLE_COMMENT, template.getCommentItems().get(0).getRowRole());
        assertEquals(1, template.getItems().size());
        assertEquals("100001", template.getItems().get(0).getCode());
        assertEquals(OrcaOrderBundleRecommendationSupport.ROW_ROLE_MAIN, template.getItems().get(0).getRowRole());
        assertEquals("212", template.getClassCode());
        assertEquals("Claim007", template.getClassCodeSystem());
        assertEquals("RP", template.getClassName());
        assertEquals("4101", template.getAdminCode());
        assertEquals("Claim007", template.getAdminCodeSystem());
        assertEquals("out", template.getPrescriptionLocation());
        assertEquals("regular", template.getPrescriptionTiming());
    }

    @Test
    void toRecommendationTemplateKeepsPrescriptionClassSemanticsForOtherClassCodes() {
        BundleDolphin tonyo = new BundleDolphin();
        tonyo.setBundleNumber("1");
        tonyo.setClassCode("222");
        tonyo.setClaimItem(new ClaimItem[]{claimItem("620000001", "AMLODIPINE", "1", "tablet", null)});

        OrderBundleRecommendationResponse.OrderRecommendationTemplate tonyoTemplate =
                OrcaOrderBundleRecommendationSupport.toRecommendationTemplate(
                        "PRN",
                        tonyo,
                        IInfoModel.ENTITY_MED_ORDER,
                        null);

        assertEquals("out", tonyoTemplate.getPrescriptionLocation());
        assertEquals("tonyo", tonyoTemplate.getPrescriptionTiming());

        BundleDolphin gaiyo = new BundleDolphin();
        gaiyo.setBundleNumber("1");
        gaiyo.setClassCode("231");
        gaiyo.setClaimItem(new ClaimItem[]{claimItem("620000002", "LOXONIN", "1", "tablet", null)});

        OrderBundleRecommendationResponse.OrderRecommendationTemplate gaiyoTemplate =
                OrcaOrderBundleRecommendationSupport.toRecommendationTemplate(
                        "TOPICAL",
                        gaiyo,
                        IInfoModel.ENTITY_MED_ORDER,
                        null);

        assertEquals("in", gaiyoTemplate.getPrescriptionLocation());
        assertEquals("regular", gaiyoTemplate.getPrescriptionTiming());
    }

    @Test
    void toRecommendationTemplateKeepsRadiologySevenPrefixRowsAsMainItems() {
        BundleDolphin bundle = new BundleDolphin();
        bundle.setBundleNumber("3");
        bundle.setClassCode("700");
        bundle.setClassCodeSystem("Claim007");
        bundle.setClassName("Radiology");
        bundle.setClaimItem(new ClaimItem[]{
                claimItem("002001", "CHEST", "1", "part", null),
                claimItem("700000001", "RAD_MAIN_A", "1", "bottle", null),
                claimItem("700000099", "RAD_MAIN_B", "1", "bottle", null)
        });

        OrderBundleRecommendationResponse.OrderRecommendationTemplate template =
                OrcaOrderBundleRecommendationSupport.toRecommendationTemplate(
                        "CHEST_CT",
                        bundle,
                        IInfoModel.ENTITY_RADIOLOGY_ORDER,
                        null);

        assertNotNull(template.getBodyPart());
        assertEquals("002001", template.getBodyPart().getCode());
        assertEquals(0, template.getMaterialItems().size());
        assertEquals(
                List.of("700000001", "700000099"),
                template.getItems().stream().map(OrderBundleFetchResponse.OrderBundleItem::getCode).toList());
    }

    private static ClaimItem claimItem(String code, String name, String number, String unit, String memo) {
        ClaimItem item = new ClaimItem();
        item.setCode(code);
        item.setName(name);
        item.setNumber(number);
        item.setUnit(unit);
        item.setMemo(memo);
        return item;
    }
}
