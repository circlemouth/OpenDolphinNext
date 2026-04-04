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
import open.dolphin.rest.dto.orca.BacteriaOrderMetadata;
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
        BundleDolphin bundle = new BundleDolphin();
        bundle.setOrderName(operation.getBundleName());
        bundle.setBundleNumber(OrcaOrderBundleRequestSupport.hasText(operation.getBundleNumber()) ? operation.getBundleNumber() : "1");
        bundle.setAdmin(operation.getAdmin());
        bundle.setAdminCode(operation.getAdminCode());
        bundle.setAdminCodeSystem(operation.getAdminCodeSystem());
        bundle.setAdminMemo(operation.getAdminMemo());
        bundle.setMemo(operation.getMemo());
        String entity = resolveEntity(operation);
        OrcaChargeClassSupport.ChargeClassMeta chargeClassMeta = OrcaChargeClassSupport.resolveCanonicalChargeClassMeta(
                entity,
                operation.getClassCode(),
                resolvePrimaryItemCategory(operation));
        String classCode = chargeClassMeta != null
                ? chargeClassMeta.classCode()
                : OrcaChargeClassCanonicalSupport.canonicalClassCode(entity, operation.getClassCode());
        if (OrcaOrderBundleRequestSupport.hasText(classCode)) {
            bundle.setClassCode(classCode);
            bundle.setClassCodeSystem(ClaimConst.CLASS_CODE_ID);
        }
        String canonicalClassName = chargeClassMeta != null
                ? chargeClassMeta.className()
                : OrcaOrderBundleRequestSupport.resolveCanonicalClassName(
                        entity,
                        bundle.getClassCode(),
                        OrcaChargeClassCanonicalSupport.canonicalClassName(
                                entity,
                                bundle.getClassCode(),
                                operation.getClassName()));
        if (OrcaOrderBundleRequestSupport.hasText(canonicalClassName)) {
            bundle.setClassName(canonicalClassName);
        } else if (!OrcaChargeClassSupport.isChargeEntity(entity)
                && OrcaOrderBundleRequestSupport.hasText(operation.getBundleName())) {
            bundle.setClassName(operation.getBundleName());
        }
        bundle.setClaimItem(toClaimItems(operation));

        ModuleModel module = new ModuleModel();
        ModuleInfoBean info = new ModuleInfoBean();
        info.setStampName(operation.getBundleName() != null ? operation.getBundleName() : resolveTitle(operation));
        info.setStampRole(IInfoModel.ROLE_P);
        info.setEntity(resolveEntity(operation));
        info.setStampMemo(OrcaOrderBundle600SubtypeSupport.updateStampMemo(
                info.getStampMemo(), info.getEntity(), operation.getSubtype(), operation.getBacteria()));
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
        String entity = resolveEntity(operation);
        boolean useBacteriaMetadata = IInfoModel.ENTITY_BACTERIA_ORDER.equals(entity)
                && operation != null
                && operation.getBacteria() != null;
        appendClaimItems(converted, entity, operation != null ? operation.getItems() : null, useBacteriaMetadata);
        appendClaimItems(converted, entity, operation != null ? operation.getMaterialItems() : null, useBacteriaMetadata);
        appendClaimItems(converted, entity, operation != null ? operation.getCommentItems() : null, useBacteriaMetadata);
        ClaimItem explicitBodyPart = toExplicitBodyPartClaimItem(entity, operation != null ? operation.getBodyPart() : null);
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
        if (useBacteriaMetadata) {
            converted.addAll(toBacteriaCommentItems(operation.getBacteria()));
        }
        return converted.isEmpty() ? null : converted.toArray(new ClaimItem[0]);
    }

    private static void appendClaimItems(
            List<ClaimItem> target,
            String entity,
            List<OrderBundleMutationRequest.BundleItem> items,
            boolean useBacteriaMetadata) {
        if (items == null || items.isEmpty()) {
            return;
        }
        for (OrderBundleMutationRequest.BundleItem item : items) {
            if (useBacteriaMetadata && isCommentItem(item)) {
                continue;
            }
            ClaimItem claimItem = toClaimItem(entity, item);
            if (claimItem != null && !containsEquivalentClaimItem(target, claimItem)) {
                target.add(claimItem);
            }
        }
    }

    private static boolean containsEquivalentClaimItem(List<ClaimItem> items, ClaimItem candidate) {
        if (candidate == null || items == null || items.isEmpty()) {
            return false;
        }
        for (ClaimItem item : items) {
            if (item == null) {
                continue;
            }
            if (java.util.Objects.equals(OrcaOrderBundleRequestSupport.trimToNull(item.getCode()), OrcaOrderBundleRequestSupport.trimToNull(candidate.getCode()))
                    && java.util.Objects.equals(OrcaOrderBundleRequestSupport.trimToNull(item.getName()), OrcaOrderBundleRequestSupport.trimToNull(candidate.getName()))
                    && java.util.Objects.equals(OrcaOrderBundleRequestSupport.trimToNull(item.getNumber()), OrcaOrderBundleRequestSupport.trimToNull(candidate.getNumber()))
                    && java.util.Objects.equals(OrcaOrderBundleRequestSupport.trimToNull(item.getUnit()), OrcaOrderBundleRequestSupport.trimToNull(candidate.getUnit()))
                    && java.util.Objects.equals(OrcaOrderBundleRequestSupport.trimToNull(item.getMemo()), OrcaOrderBundleRequestSupport.trimToNull(candidate.getMemo()))) {
                return true;
            }
        }
        return false;
    }

    private static boolean isCommentItem(OrderBundleMutationRequest.BundleItem item) {
        if (item == null) {
            return false;
        }
        String code = OrcaOrderBundleRequestSupport.trimToNull(item.getCode());
        return OrcaOrderBundleRecommendationSupport.isCommentCode(code)
                || OrcaOrderBundleRecommendationSupport.ROW_ROLE_COMMENT.equals(
                        OrcaOrderBundleRequestSupport.normalizeRowRole(item.getRowRole()));
    }

    private static ClaimItem toExplicitBodyPartClaimItem(String entity, OrderBundleMutationRequest.BundleItem item) {
        if (item == null) {
            return null;
        }
        String code = OrcaOrderBundleRequestSupport.trimToNull(item.getCode());
        if (!OrcaOrderBundleRecommendationSupport.isBodyPartCode(code)) {
            return null;
        }
        return toClaimItem(entity, item);
    }

    private static ClaimItem toClaimItem(String entity, OrderBundleMutationRequest.BundleItem item) {
        if (item == null || item.getName() == null || item.getName().isBlank()) {
            return null;
        }
        OrcaOrderBundleItemMemoSupport.ParsedItem parsedMemo = OrcaOrderBundleItemMemoSupport.parse(item.getMemo());
        String genericFlg = OrcaOrderBundleItemMemoSupport.normalizeGenericFlg(
                OrcaOrderBundleRequestSupport.hasText(item.getGenericFlg()) ? item.getGenericFlg() : parsedMemo.genericFlg());
        String userComment = OrcaOrderBundleItemMemoSupport.normalizeUserComment(
                OrcaOrderBundleRequestSupport.hasText(item.getUserComment()) ? item.getUserComment() : parsedMemo.userComment());
        String rowRole = OrcaOrderBundleRecommendationSupport.resolveRowRole(
                entity, item.getCode(), item.getRowRole(), item.getRowSubtype());
        String rowSubtype = OrcaOrderBundleRecommendationSupport.resolveRowSubtype(
                entity, item.getCode(), rowRole, item.getRowSubtype(), parsedMemo.rowSubtype());
        String category = OrcaOrderBundleItemMemoSupport.normalizeCategory(
                OrcaOrderBundleRequestSupport.hasText(item.getCategory()) ? item.getCategory() : parsedMemo.category());
        String masterCategory = OrcaOrderBundleItemMemoSupport.normalizeMasterCategory(
                OrcaOrderBundleRequestSupport.hasText(item.getMasterCategory()) ? item.getMasterCategory() : parsedMemo.masterCategory());
        String itemNumber = OrcaOrderBundleItemMemoSupport.normalizeText(
                OrcaOrderBundleRequestSupport.hasText(item.getSelectionCommentItemNumber())
                        ? item.getSelectionCommentItemNumber()
                        : OrcaOrderBundleRequestSupport.hasText(item.getItemNumber())
                                ? item.getItemNumber()
                                : parsedMemo.itemNumber());
        String itemNumberBranch = OrcaOrderBundleItemMemoSupport.normalizeText(
                OrcaOrderBundleRequestSupport.hasText(item.getSelectionCommentItemNumberBranch())
                        ? item.getSelectionCommentItemNumberBranch()
                        : OrcaOrderBundleRequestSupport.hasText(item.getItemNumberBranch())
                                ? item.getItemNumberBranch()
                                : parsedMemo.itemNumberBranch());
        ClaimItem claimItem = new ClaimItem();
        claimItem.setName(item.getName());
        claimItem.setCode(item.getCode());
        claimItem.setNumber(item.getQuantity());
        claimItem.setUnit(item.getUnit());
        claimItem.setMemo(OrcaOrderBundleItemMemoSupport.format(
                genericFlg,
                userComment,
                rowRole,
                rowSubtype,
                category,
                masterCategory,
                itemNumber,
                itemNumberBranch,
                parsedMemo.memoText()));
        return claimItem;
    }

    private static List<ClaimItem> toBacteriaCommentItems(BacteriaOrderMetadata metadata) {
        List<ClaimItem> items = new ArrayList<>();
        if (metadata == null) {
            return items;
        }
        appendBacteriaComment(items, metadata.getSpecimen());
        if (metadata.getCarrierComments() != null) {
            for (BacteriaOrderMetadata.CarrierComment comment : metadata.getCarrierComments()) {
                if (sameComment(metadata.getSpecimen(), comment)) {
                    continue;
                }
                appendBacteriaComment(items, comment);
            }
        }
        return items;
    }

    private static boolean sameComment(BacteriaOrderMetadata.CarrierComment left, BacteriaOrderMetadata.CarrierComment right) {
        if (left == null || right == null) {
            return false;
        }
        return java.util.Objects.equals(OrcaOrderBundleRequestSupport.trimToNull(left.getCode()), OrcaOrderBundleRequestSupport.trimToNull(right.getCode()))
                && java.util.Objects.equals(OrcaOrderBundleRequestSupport.trimToNull(left.getName()), OrcaOrderBundleRequestSupport.trimToNull(right.getName()))
                && java.util.Objects.equals(OrcaOrderBundleRequestSupport.trimToNull(left.getInputValue()), OrcaOrderBundleRequestSupport.trimToNull(right.getInputValue()));
    }

    private static void appendBacteriaComment(List<ClaimItem> target, BacteriaOrderMetadata.CarrierComment comment) {
        String code = comment != null ? OrcaOrderBundleRequestSupport.trimToNull(comment.getCode()) : null;
        if (code == null) {
            return;
        }
        ClaimItem item = new ClaimItem();
        item.setCode(code);
        if (code.matches("^842\\d{6}$")) {
            item.setName(OrcaOrderBundleRequestSupport.trimToNull(comment.getName()));
            item.setNumber(OrcaOrderBundleRequestSupport.trimToNull(comment.getInputValue()));
            item.setUnit("");
        } else if (code.matches("^830\\d{6}$")) {
            item.setName(OrcaOrderBundleRequestSupport.trimToNull(comment.getInputValue()));
            item.setNumber("");
            item.setUnit("");
        } else {
            item.setName(OrcaOrderBundleRequestSupport.trimToNull(comment.getName()));
            item.setNumber("");
            item.setUnit("");
        }
        item.setMemo(OrcaOrderBundleItemMemoSupport.format(
                null,
                null,
                OrcaOrderBundleRecommendationSupport.ROW_ROLE_COMMENT,
                null,
                comment.getCategory(),
                null,
                comment.getItemNumber(),
                comment.getItemNumberBranch(),
                ""));
        if (OrcaOrderBundleRequestSupport.hasText(item.getName()) || OrcaOrderBundleRequestSupport.hasText(item.getNumber())) {
            target.add(item);
        }
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
                if (OrcaOrderBundleRequestSupport.hasText(item.getMasterCategory())) {
                    return OrcaOrderBundleItemMemoSupport.normalizeMasterCategory(item.getMasterCategory());
                }
                OrcaOrderBundleItemMemoSupport.ParsedItem parsedMemo = OrcaOrderBundleItemMemoSupport.parse(item.getMemo());
                return parsedMemo.masterCategory();
            }
        }
        return null;
    }

    private static String resolveEntity(OrderBundleMutationRequest.BundleOperation operation) {
        String normalizedEntity = operation.getEntity() != null && !operation.getEntity().isBlank()
                ? OrcaOrderBundleRequestSupport.normalizeEntityStorage(operation.getEntity())
                : null;
        if (OrcaOrderBundleRequestSupport.isPhysiologyOrder(normalizedEntity)) {
            return normalizedEntity;
        }
        if (normalizedEntity != null) {
            return normalizedEntity;
        }
        return IInfoModel.ENTITY_TREATMENT;
    }

    private static String resolveTitle(OrderBundleMutationRequest.BundleOperation operation) {
        return IInfoModel.ENTITY_MED_ORDER.equals(resolveEntity(operation)) ? "処方" : "オーダー";
    }
}
