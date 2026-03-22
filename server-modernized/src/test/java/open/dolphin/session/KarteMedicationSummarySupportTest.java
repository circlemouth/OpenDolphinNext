package open.dolphin.session;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Date;
import java.util.List;
import open.dolphin.infomodel.BundleDolphin;
import open.dolphin.infomodel.ClaimItem;
import open.dolphin.infomodel.DocInfoModel;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.ModuleInfoBean;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.rest.dto.RoutineMedicationResponse;
import open.dolphin.rest.dto.RpHistoryEntryResponse;
import org.junit.jupiter.api.Test;

class KarteMedicationSummarySupportTest {

    private final KarteMedicationSummarySupport support = new KarteMedicationSummarySupport();

    @Test
    void toRoutineMedicationResponsesPrefersDocumentTitleAndMapsDrugMetadata() {
        DocumentModel document = document(
                10L,
                "定期薬A",
                "SOAP",
                new Date(1_710_000_000_000L),
                encodedMedModule("アムロジピン", "5", "mg", "朝食後", "定期処方メモ"));

        List<RoutineMedicationResponse> responses = support.toRoutineMedicationResponses(List.of(document));

        assertThat(responses).hasSize(1);
        RoutineMedicationResponse response = responses.get(0);
        assertThat(response.getId()).isEqualTo(10L);
        assertThat(response.getName()).isEqualTo("定期薬A");
        assertThat(response.getMemo()).isEqualTo("定期処方メモ");
        assertThat(response.getCategory()).isEqualTo("SOAP");
        assertThat(response.getModuleList()).hasSize(1);
        assertThat(response.getModuleList().get(0).getModuleInfoBean().getEntity()).isEqualTo(IInfoModel.ENTITY_MED_ORDER);
    }

    @Test
    void toRpHistoryEntriesLastOnlySkipsLaterDocumentsOnSameIssuedDateAndIgnoresBrokenPayloads() {
        DocumentModel latestSameDay = document(
                20L,
                "same-day latest",
                "KARTE",
                new Date(1_710_086_400_000L),
                encodedMedModule("ロキソニン", "2", "錠", "夕食後", "first memo"));
        latestSameDay.setConfirmed(new Date(1_710_086_400_000L));

        DocumentModel olderSameDay = document(
                21L,
                "same-day older",
                "KARTE",
                new Date(1_710_082_800_000L),
                encodedMedModule("ムコダイン", "3", "錠", "毎食後", "second memo"));
        olderSameDay.setConfirmed(new Date(1_710_082_800_000L));

        DocumentModel brokenPayload = document(
                22L,
                "broken",
                "KARTE",
                new Date(1_710_172_800_000L),
                brokenMedModule());
        brokenPayload.setConfirmed(new Date(1_710_172_800_000L));

        List<RpHistoryEntryResponse> entries = support.toRpHistoryEntries(
                List.of(olderSameDay, latestSameDay, brokenPayload),
                true);

        assertThat(entries).hasSize(1);
        RpHistoryEntryResponse entry = entries.get(0);
        assertThat(entry.getMemo()).isEqualTo("same-day latest");
        assertThat(entry.getRpList()).hasSize(1);
        assertThat(entry.getRpList().get(0).getName()).isEqualTo("ロキソニン");
        assertThat(entry.getRpList().get(0).getAmount()).isEqualTo("2錠");
        assertThat(entry.getRpList().get(0).getMemo()).isEqualTo("first memo");
    }

    private static DocumentModel document(long id, String title, String docType, Date started, ModuleModel module) {
        DocumentModel document = new DocumentModel();
        document.setId(id);
        document.setStarted(started);
        document.setRecorded(started);
        DocInfoModel info = new DocInfoModel();
        info.setTitle(title);
        info.setDocType(docType);
        document.setDocInfoModel(info);
        document.setModules(List.of(module));
        return document;
    }

    private static ModuleModel encodedMedModule(
            String name,
            String number,
            String unit,
            String admin,
            String stampMemo) {
        ModuleModel module = new ModuleModel();
        module.setId(System.nanoTime());
        ModuleInfoBean info = new ModuleInfoBean();
        info.setEntity(IInfoModel.ENTITY_MED_ORDER);
        info.setStampName(name + "処方");
        info.setStampMemo(stampMemo);
        module.setModuleInfoBean(info);

        BundleDolphin bundle = new BundleDolphin();
        bundle.setAdmin(admin);
        bundle.setBundleNumber("bundle-1");
        ClaimItem item = new ClaimItem();
        item.setCode("100001");
        item.setClassCode("212");
        item.setName(name);
        item.setNumber(number);
        item.setUnit(unit);
        item.setMemo(stampMemo);
        bundle.setClaimItem(new ClaimItem[]{item});
        module.setModel(bundle);
        module.setBeanJson(ModelUtils.encodeModule(module));
        module.setModel(null);
        return module;
    }

    private static ModuleModel brokenMedModule() {
        ModuleModel module = new ModuleModel();
        module.setId(999L);
        ModuleInfoBean info = new ModuleInfoBean();
        info.setEntity(IInfoModel.ENTITY_MED_ORDER);
        info.setStampName("broken");
        module.setModuleInfoBean(info);
        module.setBeanJson("{broken-json");
        return module;
    }
}
