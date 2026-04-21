package open.dolphin.testsupport;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import open.dolphin.infomodel.BundleDolphin;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.ModuleModel;
import org.junit.jupiter.api.Test;

class CanonicalOrderDocumentFixtureTest {

    @Test
    void buildsCanonicalDocumentWithMedTreatmentAndRadiologyOrderModules() {
        DocumentModel document = CanonicalOrderDocumentFixture.builder()
                .documentId(42L)
                .docId("DOC-CANONICAL-ORDER-042")
                .build();

        assertThat(document.getId()).isEqualTo(42L);
        assertThat(document.getDocInfoModel().getDocPk()).isEqualTo(42L);
        assertThat(document.getDocInfoModel().getDocId()).isEqualTo("DOC-CANONICAL-ORDER-042");
        assertThat(document.getDocInfoModel().getDocType()).isEqualTo(IInfoModel.DOCTYPE_KARTE);
        assertThat(document.getDocInfoModel().getPurpose()).isEqualTo(IInfoModel.PURPOSE_RECORD);
        assertThat(document.getStatus()).isEqualTo(IInfoModel.STATUS_FINAL);
        assertThat(document.getModules()).hasSize(3);
        assertThat(document.getModules())
                .extracting(module -> module.getModuleInfoBean().getEntity())
                .containsExactly(
                        IInfoModel.ENTITY_MED_ORDER,
                        IInfoModel.ENTITY_TREATMENT,
                        IInfoModel.ENTITY_RADIOLOGY_ORDER);

        assertOrderModule(document, 0, IInfoModel.ENTITY_MED_ORDER, "Fixture medication set", "212", "FIX-MED-001");
        assertOrderModule(document, 1, IInfoModel.ENTITY_TREATMENT, "Fixture treatment set", "400", "FIX-TRT-001");
        assertOrderModule(document, 2, IInfoModel.ENTITY_RADIOLOGY_ORDER, "Fixture radiology set", "700", "FIX-RAD-001");
    }

    @Test
    void revisionParentAndLinkRelationApplyToDocumentDocInfoAndAllModules() {
        DocumentModel revision = CanonicalOrderDocumentFixture.builder()
                .documentId(88L)
                .docId("DOC-CANONICAL-ORDER-088")
                .revisionParent(77L, "restore")
                .build();

        assertThat(revision.getLinkId()).isEqualTo(77L);
        assertThat(revision.getLinkRelation()).isEqualTo("restore");
        assertThat(revision.getDocInfoModel().getParentPk()).isEqualTo(77L);
        assertThat(revision.getDocInfoModel().getParentIdRelation()).isEqualTo("restore");
        assertThat(revision.getModules()).hasSize(3);
        assertThat(revision.getModules()).allSatisfy(module -> {
            assertThat(module.getDocumentModel()).isSameAs(revision);
            assertThat(module.getLinkId()).isEqualTo(77L);
            assertThat(module.getLinkRelation()).isEqualTo("restore");
            assertThat(module.getKarteBean()).isSameAs(revision.getKarteBean());
            assertThat(module.getUserModel()).isSameAs(revision.getUserModel());
            assertThat(module.getStarted()).isEqualTo(revision.getStarted());
            assertThat(module.getConfirmed()).isEqualTo(revision.getConfirmed());
            assertThat(module.getStatus()).isEqualTo(IInfoModel.STATUS_FINAL);
        });
    }

    @Test
    void canonicalOrderEntitiesExposeExistingInfoModelConstantsInFixtureOrder() {
        List<String> entities = CanonicalOrderDocumentFixture.canonicalOrderEntities();

        assertThat(entities).containsExactly(
                IInfoModel.ENTITY_MED_ORDER,
                IInfoModel.ENTITY_TREATMENT,
                IInfoModel.ENTITY_RADIOLOGY_ORDER);
    }

    private static void assertOrderModule(
            DocumentModel document,
            int index,
            String entity,
            String orderName,
            String classCode,
            String firstItemCode) {
        ModuleModel module = document.getModules().get(index);
        assertThat(module.getDocumentModel()).isSameAs(document);
        assertThat(module.getKarteBean()).isSameAs(document.getKarteBean());
        assertThat(module.getUserModel()).isSameAs(document.getUserModel());
        assertThat(module.getStarted()).isEqualTo(document.getStarted());
        assertThat(module.getConfirmed()).isEqualTo(document.getConfirmed());
        assertThat(module.getStatus()).isEqualTo(IInfoModel.STATUS_FINAL);
        assertThat(module.getModuleInfoBean().getEntity()).isEqualTo(entity);
        assertThat(module.getModuleInfoBean().getStampRole()).isEqualTo(IInfoModel.ROLE_P);
        assertThat(module.getBeanJson()).isNotBlank();
        assertThat(module.getModel()).isInstanceOf(BundleDolphin.class);

        Object decoded = ModelUtils.decodeModule(module);
        assertThat(decoded).isInstanceOf(BundleDolphin.class);
        BundleDolphin decodedBundle = (BundleDolphin) decoded;
        assertThat(decodedBundle.getOrderName()).isEqualTo(orderName);
        assertThat(decodedBundle.getClassCode()).isEqualTo(classCode);
        assertThat(decodedBundle.getClassCodeSystem()).isEqualTo("Claim007");
        assertThat(decodedBundle.getClaimItem()).isNotEmpty();
        assertThat(decodedBundle.getClaimItem()[0].getCode()).isEqualTo(firstItemCode);
    }
}
