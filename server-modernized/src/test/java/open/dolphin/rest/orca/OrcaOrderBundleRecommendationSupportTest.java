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
    void toItemsAndExtractBodyPartKeepLegacyBodyPartInItems() {
        ClaimItem bodyPart = claimItem("0021001", "胸部", "1", null, null);
        ClaimItem drug = claimItem("100001", "アムロジピン", "2", "錠", "朝");

        List<OrderBundleFetchResponse.OrderBundleItem> items =
                OrcaOrderBundleRecommendationSupport.toItems(new ClaimItem[]{bodyPart, drug});

        assertEquals(2, items.size());
        assertEquals("0021001", items.get(0).getCode());
        assertEquals("0021001", OrcaOrderBundleRecommendationSupport.extractBodyPart(items).getCode());
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
        assertEquals("out", template.getPrescriptionLocation());
        assertEquals("regular", template.getPrescriptionTiming());
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
