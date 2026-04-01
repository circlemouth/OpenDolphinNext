package open.dolphin.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.Date;
import java.util.List;
import open.dolphin.infomodel.AttachmentModel;
import open.dolphin.infomodel.DocInfoModel;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.ExtRefModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.SchemaModel;
import open.dolphin.infomodel.UserModel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

class KarteRevisionServiceBeanAttachmentCloneTest {

    private KarteRevisionServiceBean service;
    private KarteServiceBean karteServiceBean;

    @BeforeEach
    void setUp() throws Exception {
        service = new KarteRevisionServiceBean();
        karteServiceBean = Mockito.mock(KarteServiceBean.class);
        setField(service, "karteServiceBean", karteServiceBean);
    }

    @Test
    void createRevisionFromSourceCarriesAttachmentsIntoNewRevision() {
        DocumentModel source = buildSourceDocumentWithAttachment();
        UserModel actor = buildActor("FAC_A:actor01", 401L, "Actual Actor");
        when(karteServiceBean.getDocuments(List.of(55L))).thenReturn(List.of(source));
        when(karteServiceBean.addDocument(any(DocumentModel.class))).thenReturn(88L);

        long createdId = service.createRevisionFromSource(55L, 44L, "restore", actor);

        ArgumentCaptor<DocumentModel> captor = ArgumentCaptor.forClass(DocumentModel.class);
        verify(karteServiceBean).addDocument(captor.capture());
        DocumentModel created = captor.getValue();

        assertThat(createdId).isEqualTo(88L);
        assertThat(created.getAttachment()).hasSize(1);
        assertThat(created.getAttachment().get(0)).isNotSameAs(source.getAttachment().get(0));
        assertThat(created.getAttachment().get(0).getDocumentModel()).isSameAs(created);
        assertThat(created.getAttachment().get(0).getFileName()).isEqualTo("report.txt");
        assertThat(created.getAttachment().get(0).getLinkId()).isEqualTo(44L);
        assertThat(created.getAttachment().get(0).getStatus()).isEqualTo("F");
        assertThat(created.getUserModel()).isSameAs(actor);
        assertThat(created.getAttachment().get(0).getUserModel()).isSameAs(actor);
    }

    @Test
    void createRevisionFromSourceSetsParentRevisionMetadataForAppendOnlyRule() {
        DocumentModel source = buildSourceDocumentWithAttachment();
        UserModel actor = buildActor("FAC_A:actor01", 401L, "Actual Actor");
        when(karteServiceBean.getDocuments(List.of(55L))).thenReturn(List.of(source));
        when(karteServiceBean.addDocument(any(DocumentModel.class))).thenReturn(91L);

        long createdId = service.createRevisionFromSource(55L, 44L, "revise", actor);

        ArgumentCaptor<DocumentModel> captor = ArgumentCaptor.forClass(DocumentModel.class);
        verify(karteServiceBean).addDocument(captor.capture());
        DocumentModel created = captor.getValue();
        DocInfoModel info = created.getDocInfoModel();

        assertThat(createdId).isEqualTo(91L);
        assertThat(created.getId()).isZero();
        assertThat(created.getLinkId()).isEqualTo(44L);
        assertThat(created.getLinkRelation()).isEqualTo("revise");
        assertThat(created.getStatus()).isEqualTo("F");
        assertThat(info.getParentPk()).isEqualTo(44L);
        assertThat(info.getParentIdRelation()).isEqualTo("revise");
        assertThat(info.getStatus()).isEqualTo("F");
        assertThat(info.getDocPk()).isZero();
        assertThat(info.getDocId()).isNotEqualTo("DOC-55");
        assertThat(created.getUserModel()).isSameAs(actor);
        assertThat(created.getUserModel()).isNotSameAs(source.getUserModel());
    }

    @Test
    void createRevisionFromSourceRebindsModuleAndSchemaActorsToActualActor() {
        DocumentModel source = buildSourceDocumentWithAttachment();
        UserModel actor = buildActor("FAC_A:actor01", 401L, "Actual Actor");
        when(karteServiceBean.getDocuments(List.of(55L))).thenReturn(List.of(source));
        when(karteServiceBean.addDocument(any(DocumentModel.class))).thenReturn(92L);

        service.createRevisionFromSource(55L, 44L, "revise", actor);

        ArgumentCaptor<DocumentModel> captor = ArgumentCaptor.forClass(DocumentModel.class);
        verify(karteServiceBean).addDocument(captor.capture());
        DocumentModel created = captor.getValue();

        assertThat(created.getModules()).allMatch(module -> module.getUserModel() == actor);
        assertThat(created.getSchema()).allMatch(schema -> schema.getUserModel() == actor);
    }

    private static DocumentModel buildSourceDocumentWithAttachment() {
        Date now = new Date(1_709_251_200_000L);
        DocumentModel document = new DocumentModel();
        document.setId(55L);
        document.setStarted(now);
        document.setConfirmed(now);
        document.setRecorded(now);
        document.setStatus("F");

        KarteBean karte = new KarteBean();
        karte.setId(300L);
        document.setKarteBean(karte);

        UserModel user = new UserModel();
        user.setId(400L);
        user.setCommonName("Doctor");
        document.setUserModel(user);

        document.getDocInfoModel().setDocId("DOC-55");
        document.getDocInfoModel().setDocPk(55L);

        ModuleModel module = new ModuleModel();
        module.setId(510L);
        module.setDocumentModel(document);
        module.setKarteBean(karte);
        module.setUserModel(user);
        module.setStatus("F");
        document.addModule(module);

        SchemaModel schema = new SchemaModel();
        schema.setId(520L);
        schema.setDocumentModel(document);
        schema.setKarteBean(karte);
        schema.setUserModel(user);
        schema.setStatus("F");
        schema.setUri("s3://bucket/schema.png");
        schema.setDigest("schema-digest");
        schema.setExtRefModel(new ExtRefModel());
        document.addSchema(schema);

        AttachmentModel attachment = new AttachmentModel();
        attachment.setId(500L);
        attachment.setFileName("report.txt");
        attachment.setContentType("text/plain");
        attachment.setContentBytes(new byte[] {1, 2, 3});
        attachment.setDocumentModel(document);
        attachment.setKarteBean(karte);
        attachment.setUserModel(user);
        attachment.setStatus("F");
        document.addAttachment(attachment);
        return document;
    }

    private static UserModel buildActor(String userId, long pk, String name) {
        UserModel actor = new UserModel();
        actor.setUserId(userId);
        actor.setId(pk);
        actor.setCommonName(name);
        return actor;
    }

    private static void setField(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }
}
