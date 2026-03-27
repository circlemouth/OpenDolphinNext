package open.dolphin.persistence.query;

import jakarta.persistence.EntityManager;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.ModuleModel;

import java.util.List;
import java.util.function.Supplier;

/**
 * カルテ文書の読取系クエリを集約する query service。
 */
public class KarteDocumentQueryService {

    private static final String QUERY_DOCUMENT_BY_IDS =
            "FROM DocumentModel d WHERE d.id IN (:ids) ORDER BY d.id";
    private static final String QUERY_MODULES_BY_DOC_IDS =
            "FROM ModuleModel m JOIN FETCH m.document d WHERE d.id IN (:ids) ORDER BY d.id,m.moduleInfo.stampNumber";

    private final Supplier<EntityManager> emProvider;

    public KarteDocumentQueryService(Supplier<EntityManager> emProvider) {
        this.emProvider = emProvider;
    }

    public List<DocumentModel> findDocumentsByIds(List<Long> ids) {
        return emProvider.get().createQuery(QUERY_DOCUMENT_BY_IDS, DocumentModel.class)
                .setParameter("ids", ids)
                .getResultList();
    }

    public List<ModuleModel> findModulesByDocumentIds(List<Long> ids) {
        return emProvider.get().createQuery(QUERY_MODULES_BY_DOC_IDS, ModuleModel.class)
                .setParameter("ids", ids)
                .getResultList();
    }
}
