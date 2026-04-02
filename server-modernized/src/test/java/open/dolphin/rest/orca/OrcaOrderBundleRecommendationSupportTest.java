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
        ClaimItem bodyPart = claimItem("0021001", "胸部", "1", null, null);
        ClaimItem drug = claimItem("100001", "アムロジピン", "2", "錠", "朝");

        List<OrderBundleFetchResponse.OrderBundleItem> items =
                OrcaOrderBundleRecommendationSupport.toItems(new ClaimItem[]{bodyPart, drug});
        List<OrderBundleFetchResponse.OrderBundleItem> filtered =
                OrcaOrderBundleRecommendationSupport.removeBodyPartItems(items);

        assertEquals(2, items.size());
        assertEquals("0021001", items.get(0).getCode());
        assertEquals("0021001", OrcaOrderBundleRecommendationSupport.extractBodyPart(items).getCode());
        assertEquals(1, filtered.size());
        assertEquals("100001", filtered.get(0).getCode());
    }

    @Test
    void toRecommendationTemplateSeparatesBodyPartMaterialAndCommentItems() {
        BundleDolphin bundle = new BundleDolphin();
        bundle.setBundleNumber("1");
        bundle.setClassCode("212");
        bundle.setAdmin("内服");
        bundle.setClaimItem(new ClaimItem[]{
                claimItem("0021001", "胸部", "1", null, null),
                claimItem("700123", "シリンジ", "1", "本", null),
                claimItem("0085001", "コメント", "1", null, "食後"),
                claimItem("100001", "アムロジピン", "2", "錠", "朝")
        });

        OrderBundleRecommendationResponse.OrderRecommendationTemplate template =
                OrcaOrderBundleRecommendationSupport.toRecommendationTemplate(
                        "降圧薬セット",
                        bundle,
                        IInfoModel.ENTITY_MED_ORDER);

        assertNotNull(template.getBodyPart());
        assertEquals("0021001", template.getBodyPart().getCode());
        assertEquals(1, template.getMaterialItems().size());
        assertEquals(1, template.getCommentItems().size());
        assertEquals(1, template.getItems().size());
        assertEquals("100001", template.getItems().get(0).getCode());
        assertEquals("out", template.getPrescriptionLocation());
        assertEquals("regular", template.getPrescriptionTiming());
    }

    @Test
    void toRecommendationTemplateKeepsPrescriptionClassSemanticsForOtherClassCodes() {
        BundleDolphin tonyo = new BundleDolphin();
        tonyo.setBundleNumber("1");
        tonyo.setClassCode("222");
        tonyo.setClaimItem(new ClaimItem[]{claimItem("620000001", "アムロジピン", "1", "錠", null)});

        OrderBundleRecommendationResponse.OrderRecommendationTemplate tonyoTemplate =
                OrcaOrderBundleRecommendationSupport.toRecommendationTemplate(
                        "頓用RP",
                        tonyo,
                        IInfoModel.ENTITY_MED_ORDER);

        assertEquals("out", tonyoTemplate.getPrescriptionLocation());
        assertEquals("tonyo", tonyoTemplate.getPrescriptionTiming());

        BundleDolphin gaiyo = new BundleDolphin();
        gaiyo.setBundleNumber("1");
        gaiyo.setClassCode("231");
        gaiyo.setClaimItem(new ClaimItem[]{claimItem("620000002", "ロキソニン", "1", "錠", null)});

        OrderBundleRecommendationResponse.OrderRecommendationTemplate gaiyoTemplate =
                OrcaOrderBundleRecommendationSupport.toRecommendationTemplate(
                        "外用RP",
                        gaiyo,
                        IInfoModel.ENTITY_MED_ORDER);

        assertEquals("in", gaiyoTemplate.getPrescriptionLocation());
        assertEquals("regular", gaiyoTemplate.getPrescriptionTiming());
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
