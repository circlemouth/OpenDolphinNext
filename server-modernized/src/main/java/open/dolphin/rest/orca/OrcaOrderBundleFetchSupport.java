package open.dolphin.rest.orca;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import open.dolphin.infomodel.BundleDolphin;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.ModuleInfoBean;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.rest.dto.orca.OrderBundleFetchResponse;
import open.dolphin.rest.dto.orca.OrcaOrderInputSetDetailResponse;
import open.dolphin.rest.dto.orca.OrcaOrderInputSetListResponse;
import open.dolphin.rest.dto.orca.OrcaOrderInteractionCheckResponse;

final class OrcaOrderBundleFetchSupport {

    private OrcaOrderBundleFetchSupport() {
    }

    static List<OrderBundleFetchResponse.OrderBundleEntry> collectBundles(
            List<DocumentModel> documents,
            String entity,
            Function<ModuleModel, BundleDolphin> decoder) {
        List<OrderBundleFetchResponse.OrderBundleEntry> bundles = new ArrayList<>();
        for (DocumentModel document : documents) {
            if (document.getModules() == null) {
                continue;
            }
            for (ModuleModel module : document.getModules()) {
                ModuleInfoBean info = module.getModuleInfoBean();
                String moduleEntity = info != null ? info.getEntity() : null;
                if (!matchesEntity(entity, moduleEntity)) {
                    continue;
                }
                BundleDolphin bundle = decoder.apply(module);
                if (bundle == null) {
                    continue;
                }
                bundles.add(toEntry(document, module, moduleEntity, info, bundle));
            }
        }
        return bundles;
    }

    static OrderBundleFetchResponse buildResponse(
            String runId,
            String patientId,
            List<OrderBundleFetchResponse.OrderBundleEntry> bundles) {
        OrderBundleFetchResponse response = new OrderBundleFetchResponse();
        response.setApiResult("00");
        response.setApiResultMessage("処理終了");
        response.setRunId(runId);
        response.setPatientId(patientId);
        response.setBundles(bundles);
        response.setRecordsReturned(bundles.size());
        return response;
    }

    static OrcaOrderInputSetListResponse buildInputSetListResponse(
            String runId,
            String traceId,
            List<OrcaOrderInputSetListResponse.Item> rows,
            String entity,
            int page,
            int size) {
        List<OrcaOrderInputSetListResponse.Item> filtered = rows.stream()
                .filter(Objects::nonNull)
                .map(row -> {
                    row.setEntity(OrcaOrderBundleRequestSupport.normalizeEntityResponse(row.getEntity()));
                    return row;
                })
                .filter(row -> entity == null
                        || OrcaOrderBundle600SubtypeSupport.matchesInputSetEntity(
                                entity, row.getEntity(), row.getClassCode()))
                .sorted(Comparator.comparing(OrcaOrderInputSetListResponse.Item::getSetCode))
                .collect(Collectors.toList());
        int fromIndex = Math.min(filtered.size(), (page - 1) * size);
        int toIndex = Math.min(filtered.size(), fromIndex + size);
        OrcaOrderInputSetListResponse response = new OrcaOrderInputSetListResponse();
        response.setTotalCount(filtered.size());
        response.setRunId(runId);
        response.setTraceId(traceId);
        response.setItems(new ArrayList<>(filtered.subList(fromIndex, toIndex)));
        return response;
    }

    static OrcaOrderInputSetDetailResponse buildInputSetDetailResponse(
            String runId,
            String traceId,
            String setCode,
            OrcaOrderInputSetDetailResponse.Bundle bundle) {
        OrcaOrderInputSetDetailResponse response = new OrcaOrderInputSetDetailResponse();
        response.setOk(true);
        response.setSetCode(setCode);
        response.setBundle(bundle);
        response.setRunId(runId);
        response.setTraceId(traceId);
        return response;
    }

    static OrcaOrderInteractionCheckResponse buildInteractionResponse(
            String runId,
            String traceId,
            List<OrcaOrderInteractionCheckResponse.Pair> rows) {
        OrcaOrderInteractionCheckResponse response = new OrcaOrderInteractionCheckResponse();
        response.setOk(true);
        response.setPairs(rows);
        response.setTotalCount(rows.size());
        response.setRunId(runId);
        response.setTraceId(traceId);
        return response;
    }

    private static boolean matchesEntity(String requestedEntity, String moduleEntity) {
        return OrcaOrderBundleRequestSupport.entitiesMatch(requestedEntity, moduleEntity);
    }

    private static OrderBundleFetchResponse.OrderBundleEntry toEntry(
            DocumentModel document,
            ModuleModel module,
            String moduleEntity,
            ModuleInfoBean info,
            BundleDolphin bundle) {
        OrderBundleFetchResponse.OrderBundleEntry entry = new OrderBundleFetchResponse.OrderBundleEntry();
        entry.setDocumentId(document.getId());
        entry.setModuleId(module.getId());
        entry.setEntity(OrcaOrderBundleRequestSupport.normalizeEntityResponse(moduleEntity));
        entry.setBundleName(OrcaOrderBundleDisplaySupport.resolveBundleName(bundle, info));
        entry.setBundleNumber(bundle.getBundleNumber());
        entry.setSubtype(OrcaOrderBundle600SubtypeSupport.resolveSubtype(
                moduleEntity,
                null,
                info != null ? info.getStampMemo() : null));
        entry.setClassCode(bundle.getClassCode());
        entry.setClassCodeSystem(bundle.getClassCodeSystem());
        entry.setClassName(bundle.getClassName());
        entry.setAdmin(bundle.getAdmin());
        entry.setAdminCode(bundle.getAdminCode());
        entry.setAdminCodeSystem(bundle.getAdminCodeSystem());
        entry.setAdminMemo(bundle.getAdminMemo());
        entry.setMemo(bundle.getMemo());
        entry.setStarted(OrcaOrderBundleRequestSupport.formatDate(module.getStarted()));
        UserModel enteredBy = OrcaOrderBundleDisplaySupport.resolveEnteredByUser(module, document);
        entry.setEnteredByName(OrcaOrderBundleDisplaySupport.resolveEnteredByName(enteredBy));
        entry.setEnteredByRole(OrcaOrderBundleDisplaySupport.resolveEnteredByRole(enteredBy));
        List<OrderBundleFetchResponse.OrderBundleItem> items =
                OrcaOrderBundleRecommendationSupport.toItems(moduleEntity, bundle.getClaimItem());
        entry.setBodyPart(OrcaOrderBundleRecommendationSupport.extractBodyPart(items));
        entry.setItems(OrcaOrderBundleRecommendationSupport.removeBodyPartItems(items));
        return entry;
    }
}
