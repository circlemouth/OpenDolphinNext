package open.dolphin.rest.orca;

import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.session.KarteServiceBean;

final class OrcaOrderBundleQuerySupport {

    private OrcaOrderBundleQuerySupport() {
    }

    static DocumentModel fetchDocument(KarteServiceBean karteServiceBean, long documentId) {
        List<DocumentModel> list = karteServiceBean.getDocumentsWithModules(List.of(documentId));
        if (list == null || list.isEmpty()) {
            return null;
        }
        return list.get(0);
    }

    static List<DocumentModel> resolveDocuments(KarteServiceBean karteServiceBean, KarteBean karte, Date fromDate) {
        return resolveDocuments(karteServiceBean, karte, fromDate, Integer.MAX_VALUE);
    }

    static List<DocumentModel> resolveDocuments(KarteServiceBean karteServiceBean, KarteBean karte, Date fromDate, int limit) {
        List<open.dolphin.infomodel.DocInfoModel> docInfos =
                karteServiceBean.getDocumentList(karte.getId(), fromDate, true);
        if (docInfos == null || docInfos.isEmpty()) {
            return List.of();
        }
        List<Long> ids = docInfos.stream()
                .map(open.dolphin.infomodel.DocInfoModel::getDocPk)
                .filter(id -> id != null && id > 0)
                .limit(Math.max(1, limit))
                .collect(Collectors.toList());
        if (ids.isEmpty()) {
            return List.of();
        }
        return karteServiceBean.getDocumentsWithModules(ids);
    }
}
