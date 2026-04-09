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
    void toItemsDropsLegacyBodyPartResurrectionOutsideRadiology700() {
        ClaimItem bodyPart = claimItem("0021001", "CHEST", "1", null, null);
        ClaimItem drug = claimItem("100001", "AMLODIPINE", "2", "tablet", "morning");

        List<OrderBundleFetchResponse.OrderBundleItem> items =
                OrcaOrderBundleRecommendationSupport.toItems(IInfoModel.ENTITY_TREATMENT, new ClaimItem[]{bodyPart, drug});
        List<OrderBundleFetchResponse.OrderBundleItem> filtered =
                OrcaOrderBundleRecommendationSupport.removeBodyPartItems(IInfoModel.ENTITY_TREATMENT, "400", items);

        assertEquals(2, items.size());
        assertEquals("0021001", items.get(0).getCode());
        assertEquals(OrcaOrderBundleRecommendationSupport.ROW_ROLE_BODY_PART, items.get(0).getRowRole());
        assertEquals(null, OrcaOrderBundleRecommendationSupport.extractBodyPart(IInfoModel.ENTITY_TREATMENT, "400", items));
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
        ClaimItem material = claimItem("700000123", "SYRINGE", "1", "bottle", null);
        material.setMemo(OrcaOrderBundleItemMemoSupport.format(
                null,
                null,
                OrcaOrderBundleRecommendationSupport.ROW_ROLE_MATERIAL,
                null,
                null,
                null,
                null,
                null,
                null));
        bundle.setClaimItem(new ClaimItem[]{
                claimItem("0021001", "CHEST", "1", null, null),
                material,
                claimItem("850100001", "COMMENT", "1", null, "after-meal"),
                claimItem("100001", "AMLODIPINE", "2", "tablet", "morning")
        });

        OrderBundleRecommendationResponse.OrderRecommendationTemplate template =
                OrcaOrderBundleRecommendationSupport.toRecommendationTemplate(
                        "SET-A",
                        bundle,
                        IInfoModel.ENTITY_MED_ORDER,
                        null);

        assertEquals(null, template.getBodyPart());
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
    void toRecommendationTemplateCanonicalizesChargeClassNameFromClassCode() {
        BundleDolphin bundle = new BundleDolphin();
        bundle.setBundleNumber("1");
        bundle.setClassCode("110");
        bundle.setClassCodeSystem("Claim007");
        bundle.setClassName("BundleFallback");
        bundle.setClaimItem(new ClaimItem[]{claimItem("110000110", "INITIAL", "1", "times", null)});

        OrderBundleRecommendationResponse.OrderRecommendationTemplate template =
                OrcaOrderBundleRecommendationSupport.toRecommendationTemplate(
                        "BASE",
                        bundle,
                        IInfoModel.ENTITY_BASE_CHARGE_ORDER,
                        null);

        assertEquals("基本診療料", template.getClassName());
    }

    @Test
    void toRecommendationTemplateSeparatesTreatmentBodyPartMaterialAndCommentItems() {
        BundleDolphin bundle = new BundleDolphin();
        bundle.setBundleNumber("3");
        bundle.setClassCode("400");
        bundle.setClassCodeSystem("Claim007");
        bundle.setClassName("処置");
        bundle.setClaimItem(new ClaimItem[]{
                claimItem("002001", "KNEE", "1", "part", null),
                claimItem("140000610", "WOUND_CARE", "1", "times", null),
                claimItem("700000021", "GAUZE", "2", "sheet", null),
                claimItem("850100002", "COMMENT", "1", null, "after-cleaning")
        });

        OrderBundleRecommendationResponse.OrderRecommendationTemplate template =
                OrcaOrderBundleRecommendationSupport.toRecommendationTemplate(
                        "WOUND_CARE",
                        bundle,
                        IInfoModel.ENTITY_TREATMENT,
                        null);

        assertEquals(null, template.getBodyPart());
        assertEquals(1, template.getMaterialItems().size());
        assertEquals("700000021", template.getMaterialItems().get(0).getCode());
        assertEquals(OrcaOrderBundleRecommendationSupport.ROW_ROLE_MATERIAL, template.getMaterialItems().get(0).getRowRole());
        assertEquals(1, template.getCommentItems().size());
        assertEquals("850100002", template.getCommentItems().get(0).getCode());
        assertEquals(OrcaOrderBundleRecommendationSupport.ROW_ROLE_COMMENT, template.getCommentItems().get(0).getRowRole());
        assertEquals(1, template.getItems().size());
        assertEquals("140000610", template.getItems().get(0).getCode());
        assertEquals(OrcaOrderBundleRecommendationSupport.ROW_ROLE_MAIN, template.getItems().get(0).getRowRole());
        assertEquals("400", template.getClassCode());
        assertEquals("Claim007", template.getClassCodeSystem());
        assertEquals("処置", template.getClassName());
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
        bundle.setClassName("画像診断");
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
