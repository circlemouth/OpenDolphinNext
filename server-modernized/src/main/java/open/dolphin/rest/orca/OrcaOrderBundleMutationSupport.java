package open.dolphin.rest.orca;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import open.dolphin.infomodel.BundleDolphin;
import open.dolphin.infomodel.ClaimConst;
import open.dolphin.infomodel.ClaimItem;
import open.dolphin.infomodel.DocInfoModel;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.ModuleInfoBean;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.rest.dto.orca.OrderBundleMutationRequest;

final class OrcaOrderBundleMutationSupport {

    private OrcaOrderBundleMutationSupport() {
    }

    static DocumentModel buildDocument(
            KarteBean karte,
            UserModel user,
            OrderBundleMutationRequest.BundleOperation operation,
            Date performDate) {
        Date now = new Date();
        DocumentModel document = new DocumentModel();
        document.setKarteBean(karte);
        document.setUserModel(user);
        document.setStarted(performDate);
        document.setConfirmed(performDate);
        document.setRecorded(now);
        document.setStatus(IInfoModel.STATUS_FINAL);

        DocInfoModel info = document.getDocInfoModel();
        info.setDocId(UUID.randomUUID().toString().replace("-", ""));
        info.setDocType(IInfoModel.DOCTYPE_KARTE);
        info.setTitle(resolveTitle(operation));
        info.setPurpose(IInfoModel.PURPOSE_RECORD);
        info.setVersionNumber("1.0");

        ModuleModel module = buildModule(karte, user, document, operation, performDate, now);
        document.setModules(List.of(module));
        return document;
    }

    static void updateDocumentWithBundle(
            DocumentModel document,
            UserModel user,
            OrderBundleMutationRequest.BundleOperation operation,
            Date performDate) {
        Date now = new Date();
        document.setStarted(performDate);
        document.setConfirmed(performDate);
        document.setRecorded(now);
        document.setStatus(IInfoModel.STATUS_FINAL);
        DocInfoModel info = document.getDocInfoModel();
        if (info != null) {
            info.setTitle(resolveTitle(operation));
        }
        ModuleModel module = buildModule(document.getKarteBean(), user, document, operation, performDate, now);
        if (operation.getModuleId() != null && operation.getModuleId() > 0) {
            module.setId(operation.getModuleId());
        } else if (document.getModules() != null && !document.getModules().isEmpty()) {
            module.setId(document.getModules().get(0).getId());
        }
        document.setModules(List.of(module));
    }

    private static ModuleModel buildModule(
            KarteBean karte,
            UserModel user,
            DocumentModel document,
            OrderBundleMutationRequest.BundleOperation operation,
            Date performDate,
            Date now) {
        String resolvedEntity = resolveEntity(operation);
        OrcaChargeClassSupport.ChargeClassMeta chargeClassMeta = OrcaChargeClassSupport.resolveCanonicalChargeClassMeta(
                resolvedEntity,
                operation.getClassCode(),
                resolvePrimaryItemCategory(operation));
        BundleDolphin bundle = new BundleDolphin();
        bundle.setOrderName(operation.getBundleName());
        bundle.setBundleNumber(OrcaOrderBundleRequestSupport.hasText(operation.getBundleNumber()) ? operation.getBundleNumber() : "1");
        bundle.setAdmin(operation.getAdmin());
        bundle.setAdminCode(operation.getAdminCode());
        bundle.setAdminCodeSystem(operation.getAdminCodeSystem());
        bundle.setAdminMemo(operation.getAdminMemo());
        bundle.setMemo(operation.getMemo());
        if (chargeClassMeta != null) {
            bundle.setClassName(chargeClassMeta.className());
        } else if (OrcaOrderBundleRequestSupport.hasText(operation.getClassName())) {
            bundle.setClassName(operation.getClassName());
        } else if (!OrcaChargeClassSupport.isChargeEntity(resolvedEntity)
                && OrcaOrderBundleRequestSupport.hasText(operation.getBundleName())) {
            bundle.setClassName(operation.getBundleName());
        }
        if (chargeClassMeta != null) {
            bundle.setClassCode(chargeClassMeta.classCode());
            bundle.setClassCodeSystem(chargeClassMeta.classCodeSystem());
        } else if (OrcaOrderBundleRequestSupport.hasText(operation.getClassCode())) {
            bundle.setClassCode(operation.getClassCode());
            bundle.setClassCodeSystem(OrcaOrderBundleRequestSupport.hasText(operation.getClassCodeSystem())
                    ? operation.getClassCodeSystem()
                    : ClaimConst.CLASS_CODE_ID);
        }
        bundle.setClaimItem(toClaimItems(operation));

        ModuleModel module = new ModuleModel();
        ModuleInfoBean info = new ModuleInfoBean();
        info.setStampName(operation.getBundleName() != null ? operation.getBundleName() : resolveTitle(operation));
        info.setStampRole(IInfoModel.ROLE_P);
        info.setEntity(resolvedEntity);
        info.setStampMemo(OrcaOrderBundle600SubtypeSupport.updateStampMemo(
                info.getStampMemo(), info.getEntity(), operation.getSubtype()));
        info.setStampNumber(0);
        module.setModuleInfoBean(info);
        module.setModel(bundle);
        module.setBeanJson(ModelUtils.encodeModule(module));
        module.setKarteBean(karte);
        module.setUserModel(user);
        module.setStarted(performDate);
        module.setConfirmed(performDate);
        module.setRecorded(now);
        module.setStatus(IInfoModel.STATUS_FINAL);
        module.setDocumentModel(document);
        return module;
    }

    private static ClaimItem[] toClaimItems(OrderBundleMutationRequest.BundleOperation operation) {
        List<ClaimItem> converted = new ArrayList<>();
        List<OrderBundleMutationRequest.BundleItem> items = operation != null ? operation.getItems() : null;
        if (items != null) {
            for (OrderBundleMutationRequest.BundleItem item : items) {
                ClaimItem claimItem = toClaimItem(item);
                if (claimItem != null) {
                    converted.add(claimItem);
                }
            }
        }
        ClaimItem explicitBodyPart = toClaimItem(operation != null ? operation.getBodyPart() : null);
        if (explicitBodyPart != null) {
            List<ClaimItem> prioritized = new ArrayList<>();
            prioritized.add(explicitBodyPart);
            for (ClaimItem claimItem : converted) {
                if (claimItem != null && !OrcaOrderBundleRecommendationSupport.isBodyPartCode(claimItem.getCode())) {
                    prioritized.add(claimItem);
                }
            }
            converted = prioritized;
        }
        return converted.isEmpty() ? null : converted.toArray(new ClaimItem[0]);
    }

    private static ClaimItem toClaimItem(OrderBundleMutationRequest.BundleItem item) {
        if (item == null || item.getName() == null || item.getName().isBlank()) {
            return null;
        }
        OrcaOrderBundleItemMemoSupport.ParsedItem parsedMemo = OrcaOrderBundleItemMemoSupport.parse(item.getMemo());
        String genericFlg = OrcaOrderBundleItemMemoSupport.normalizeGenericFlg(
                OrcaOrderBundleRequestSupport.hasText(item.getGenericFlg()) ? item.getGenericFlg() : parsedMemo.genericFlg());
        String userComment = OrcaOrderBundleItemMemoSupport.normalizeUserComment(
                OrcaOrderBundleRequestSupport.hasText(item.getUserComment()) ? item.getUserComment() : parsedMemo.userComment());
        String masterCategory = OrcaOrderBundleItemMemoSupport.normalizeMasterCategory(
                OrcaOrderBundleRequestSupport.hasText(item.getMasterCategory()) ? item.getMasterCategory() : parsedMemo.masterCategory());
        String itemNumber = OrcaOrderBundleItemMemoSupport.normalizeMetaText(
                OrcaOrderBundleRequestSupport.hasText(item.getSelectionCommentItemNumber())
                        ? item.getSelectionCommentItemNumber()
                        : parsedMemo.itemNumber());
        String itemNumberBranch = OrcaOrderBundleItemMemoSupport.normalizeMetaText(
                OrcaOrderBundleRequestSupport.hasText(item.getSelectionCommentItemNumberBranch())
                        ? item.getSelectionCommentItemNumberBranch()
                        : parsedMemo.itemNumberBranch());
        ClaimItem claimItem = new ClaimItem();
        claimItem.setName(item.getName());
        claimItem.setCode(item.getCode());
        claimItem.setNumber(item.getQuantity());
        claimItem.setUnit(item.getUnit());
        claimItem.setMemo(OrcaOrderBundleItemMemoSupport.format(
                genericFlg,
                userComment,
                masterCategory,
                itemNumber,
                itemNumberBranch,
                parsedMemo.memoText()));
        return claimItem;
    }

    private static String resolvePrimaryItemCategory(OrderBundleMutationRequest.BundleOperation operation) {
        if (operation == null || operation.getItems() == null) {
            return null;
        }
        for (OrderBundleMutationRequest.BundleItem item : operation.getItems()) {
            if (item == null) {
                continue;
            }
            if (OrcaOrderBundleRequestSupport.hasText(item.getName()) || OrcaOrderBundleRequestSupport.hasText(item.getCode())) {
                return OrcaOrderBundleItemMemoSupport.normalizeMasterCategory(item.getMasterCategory());
            }
        }
        return null;
    }

    private static String resolveEntity(OrderBundleMutationRequest.BundleOperation operation) {
        if (operation.getEntity() != null && !operation.getEntity().isBlank()) {
            return OrcaOrderBundleRequestSupport.normalizeEntityStorage(operation.getEntity());
        }
        return IInfoModel.ENTITY_TREATMENT;
    }

    private static String resolveTitle(OrderBundleMutationRequest.BundleOperation operation) {
        return IInfoModel.ENTITY_MED_ORDER.equals(resolveEntity(operation)) ? "処方" : "オーダー";
    }
}
