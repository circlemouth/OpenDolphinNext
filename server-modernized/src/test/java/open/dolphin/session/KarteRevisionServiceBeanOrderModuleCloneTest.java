package open.dolphin.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.Date;
import java.util.List;
import java.util.Map;
import open.dolphin.infomodel.BundleDolphin;
import open.dolphin.infomodel.ClaimItem;
import open.dolphin.infomodel.DocInfoModel;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.DocumentModelCloner;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.ModuleInfoBean;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.rest.dto.KarteRevisionDiffResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class KarteRevisionServiceBeanOrderModuleCloneTest {

    private KarteRevisionServiceBean service;
    private KarteServiceBean karteServiceBean;

    @BeforeEach
    void setUp() throws Exception {
        service = new KarteRevisionServiceBean();
        karteServiceBean = mock(KarteServiceBean.class);
        setField(service, "karteServiceBean", karteServiceBean);
    }

    @Test
    void restoreRevisionPreservesOrderModuleMetadataPayloadAndRebindsParentReferences() {
        DocumentModel source = buildOrderDocument(55L, "DOC-55", 0L, "TEST-DRUG-001", "テスト薬剤");
        UserModel actor = actor();
        when(karteServiceBean.getDocuments(List.of(55L))).thenReturn(List.of(source));
        when(karteServiceBean.addDocument(any(DocumentModel.class))).thenReturn(88L);

        long createdId = service.createRevisionFromSource(55L, 44L, "restore", actor);

        ArgumentCaptor<DocumentModel> captor = ArgumentCaptor.forClass(DocumentModel.class);
        verify(karteServiceBean).addDocument(captor.capture());
        DocumentModel created = captor.getValue();
        ModuleModel createdModule = created.getModules().get(0);

        assertThat(createdId).isEqualTo(88L);
        assertThat(created.getId()).isZero();
        assertThat(created.getLinkId()).isEqualTo(44L);
        assertThat(created.getLinkRelation()).isEqualTo("restore");
        assertThat(created.getUserModel()).isSameAs(actor);
        assertThat(created.getDocInfoModel().getParentPk()).isEqualTo(44L);
        assertThat(created.getDocInfoModel().getParentIdRelation()).isEqualTo("restore");
        assertThat(created.getDocInfoModel().getDocId()).isNotEqualTo("DOC-55");
        assertThat(created.getModules()).hasSize(1);
        assertThat(createdModule).isNotSameAs(source.getModules().get(0));
        assertThat(createdModule.getDocumentModel()).isSameAs(created);
        assertThat(createdModule.getKarteBean()).isSameAs(source.getKarteBean());
        assertThat(createdModule.getUserModel()).isSameAs(actor);
        assertThat(createdModule.getLinkId()).isEqualTo(44L);
        assertThat(createdModule.getLinkRelation()).isEqualTo("restore");
        assertThat(createdModule.getStatus()).isEqualTo(IInfoModel.STATUS_FINAL);
        assertThat(createdModule.getModuleInfoBean().getEntity()).isEqualTo(IInfoModel.ENTITY_MED_ORDER);
        assertThat(createdModule.getModuleInfoBean().getStampName()).isEqualTo("テスト処方");
        assertThat(createdModule.getBeanJson()).contains("TEST-DRUG-001", "テスト薬剤", "1日1回");
        assertThat(createdModule.getModel()).isInstanceOf(BundleDolphin.class);
        assertThat(createdModule.getModel()).isNotSameAs(source.getModules().get(0).getModel());

        BundleDolphin sourceBundle = (BundleDolphin) source.getModules().get(0).getModel();
        BundleDolphin createdBundle = (BundleDolphin) createdModule.getModel();
        sourceBundle.getClaimItem()[0].setName("改ざん後薬剤");
        source.getModules().get(0).getModuleInfoBean().setStampName("改ざん後スタンプ");

        assertThat(createdBundle.getClaimItem()[0].getName()).isEqualTo("テスト薬剤");
        assertThat(createdModule.getModuleInfoBean().getStampName()).isEqualTo("テスト処方");
    }

    @Test
    void diffRevisionsIncludesOrderModuleEntityWhenPayloadDigestChanges() {
        DocumentModel from = buildOrderDocument(10L, "DOC-10", 0L, "TEST-DRUG-001", "テスト薬剤");
        DocumentModel to = buildOrderDocument(11L, "DOC-11", 10L, "TEST-DRUG-002", "変更後テスト薬剤");
        when(karteServiceBean.getDocuments(List.of(10L))).thenReturn(List.of(from));
        when(karteServiceBean.getDocuments(List.of(11L))).thenReturn(List.of(to));

        KarteRevisionDiffResponse response = service.diffRevisions(10L, 11L);

        assertThat(response).isNotNull();
        assertThat(response.getFromRevisionId()).isEqualTo(10L);
        assertThat(response.getToRevisionId()).isEqualTo(11L);
        assertThat(response.getChangedEntities()).contains(IInfoModel.ENTITY_MED_ORDER);
        Map<String, Object> summary = response.getSummary();
        assertThat(asStringList(summary.get("moduleEntitiesFrom"))).contains(IInfoModel.ENTITY_MED_ORDER);
        assertThat(asStringList(summary.get("moduleEntitiesTo"))).contains(IInfoModel.ENTITY_MED_ORDER);
        assertThat(summary.get("changedEntitiesCount")).isEqualTo(1);
    }

    @Test
    void documentModelClonerDoesNotAliasMutableNestedOrderBundleData() {
        DocumentModel source = buildOrderDocument(77L, "DOC-77", 0L, "TEST-DRUG-001", "テスト薬剤");

        DocumentModel clone = DocumentModelCloner.deepClone(source);

        assertThat(clone).isNotSameAs(source);
        assertThat(clone.getDocInfoModel()).isNotSameAs(source.getDocInfoModel());
        assertThat(clone.getModules()).hasSize(1);
        ModuleModel clonedModule = clone.getModules().get(0);
        ModuleModel sourceModule = source.getModules().get(0);
        assertThat(clonedModule).isNotSameAs(sourceModule);
        assertThat(clonedModule.getDocumentModel()).isSameAs(clone);
        assertThat(clonedModule.getModuleInfoBean()).isNotSameAs(sourceModule.getModuleInfoBean());
        assertThat(clonedModule.getModuleInfoBean().getEntity()).isEqualTo(IInfoModel.ENTITY_MED_ORDER);
        assertThat(clonedModule.getBeanJson()).isEqualTo(sourceModule.getBeanJson());
        assertThat(clonedModule.getModel()).isInstanceOf(BundleDolphin.class);
        assertThat(clonedModule.getModel()).isNotSameAs(sourceModule.getModel());

        BundleDolphin sourceBundle = (BundleDolphin) sourceModule.getModel();
        BundleDolphin clonedBundle = (BundleDolphin) clonedModule.getModel();
        assertThat(clonedBundle.getClaimItem()[0]).isNotSameAs(sourceBundle.getClaimItem()[0]);

        sourceBundle.setOrderName("改ざん後セット");
        sourceBundle.getClaimItem()[0].setName("改ざん後薬剤");
        sourceModule.getModuleInfoBean().setEntity(IInfoModel.ENTITY_INJECTION_ORDER);

        assertThat(clonedBundle.getOrderName()).isEqualTo("テスト薬剤セット");
        assertThat(clonedBundle.getClaimItem()[0].getName()).isEqualTo("テスト薬剤");
        assertThat(clonedModule.getModuleInfoBean().getEntity()).isEqualTo(IInfoModel.ENTITY_MED_ORDER);
    }

    private static DocumentModel buildOrderDocument(long id, String docId, long parentPk, String itemCode, String itemName) {
        Date now = new Date(1_709_251_200_000L + id);

        KarteBean karte = new KarteBean();
        karte.setId(501L);

        UserModel user = new UserModel();
        user.setId(601L);
        user.setUserId("F001:doctor01");
        user.setCommonName("テスト医師");

        DocumentModel document = new DocumentModel();
        document.setId(id);
        document.setKarteBean(karte);
        document.setUserModel(user);
        document.setStarted(now);
        document.setConfirmed(now);
        document.setRecorded(now);
        document.setStatus(IInfoModel.STATUS_FINAL);
        document.setLinkId(parentPk);
        document.setLinkRelation(parentPk > 0L ? "revise" : null);

        DocInfoModel info = document.getDocInfoModel();
        info.setDocPk(id);
        info.setDocId(docId);
        info.setTitle("外来カルテ");
        info.setDocType(IInfoModel.DOCTYPE_KARTE);
        info.setPurpose(IInfoModel.PURPOSE_RECORD);
        info.setStatus(IInfoModel.STATUS_FINAL);
        info.setParentPk(parentPk);
        info.setParentIdRelation(parentPk > 0L ? "revise" : null);
        info.setConfirmDate(now);
        info.setFirstConfirmDate(now);

        ModuleModel module = new ModuleModel();
        module.setId(id * 10);
        module.setDocumentModel(document);
        module.setKarteBean(karte);
        module.setUserModel(user);
        module.setStarted(now);
        module.setConfirmed(now);
        module.setRecorded(now);
        module.setStatus(IInfoModel.STATUS_FINAL);
        ModuleInfoBean moduleInfo = module.getModuleInfoBean();
        moduleInfo.setEntity(IInfoModel.ENTITY_MED_ORDER);
        moduleInfo.setStampName("テスト処方");
        moduleInfo.setStampRole(IInfoModel.ROLE_P);
        moduleInfo.setStampNumber(1);
        module.setModel(buildOrderBundle(itemCode, itemName));
        module.setBeanJson(ModelUtils.encodeModule(module));
        document.addModule(module);
        return document;
    }

    private static BundleDolphin buildOrderBundle(String itemCode, String itemName) {
        BundleDolphin bundle = new BundleDolphin();
        bundle.setOrderName("テスト薬剤セット");
        bundle.setClassCode("212");
        bundle.setClassCodeSystem("Claim007");
        bundle.setClassName("処方");
        bundle.setAdmin("1日1回");
        bundle.setAdminCode("TEST-USAGE-001");
        bundle.setAdminCodeSystem("Claim007");
        bundle.setAdminMemo("テスト医師コメント");
        bundle.setBundleNumber("1");
        bundle.setMemo("テスト医師コメント");

        ClaimItem item = new ClaimItem();
        item.setCode(itemCode);
        item.setCodeSystem("Claim007");
        item.setName(itemName);
        item.setNumber("1");
        item.setUnit("錠");
        bundle.setClaimItem(new ClaimItem[]{item});
        return bundle;
    }

    private static UserModel actor() {
        UserModel actor = new UserModel();
        actor.setId(701L);
        actor.setUserId("F001:actor01");
        actor.setCommonName("実行医師");
        return actor;
    }

    @SuppressWarnings("unchecked")
    private static List<String> asStringList(Object value) {
        return (List<String>) value;
    }

    private static void setField(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }
}
