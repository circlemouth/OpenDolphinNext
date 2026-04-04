package open.dolphin.rest.dto.orca;

import java.util.List;

/**
 * Response payload for order bundle fetch API.
 */
public class OrderBundleFetchResponse {

    private String apiResult;
    private String apiResultMessage;
    private String runId;
    private String patientId;
    private int recordsReturned;
    private List<OrderBundleEntry> bundles;

    public String getApiResult() {
        return apiResult;
    }

    public void setApiResult(String apiResult) {
        this.apiResult = apiResult;
    }

    public String getApiResultMessage() {
        return apiResultMessage;
    }

    public void setApiResultMessage(String apiResultMessage) {
        this.apiResultMessage = apiResultMessage;
    }

    public String getRunId() {
        return runId;
    }

    public void setRunId(String runId) {
        this.runId = runId;
    }

    public String getPatientId() {
        return patientId;
    }

    public void setPatientId(String patientId) {
        this.patientId = patientId;
    }

    public int getRecordsReturned() {
        return recordsReturned;
    }

    public void setRecordsReturned(int recordsReturned) {
        this.recordsReturned = recordsReturned;
    }

    public List<OrderBundleEntry> getBundles() {
        return bundles;
    }

    public void setBundles(List<OrderBundleEntry> bundles) {
        this.bundles = bundles;
    }

    public static class OrderBundleEntry {
        private Long documentId;
        private Long moduleId;
        private String entity;
        private String bundleName;
        private String bundleNumber;
        private String subtype;
        private BacteriaOrderMetadata bacteria;
        private String classCode;
        private String classCodeSystem;
        /** Canonical className resolved on the server. */
        private String className;
        /** Local-only. Not sent to ORCA medicalmodv2. */
        private String admin;
        private String adminCode;
        private String adminCodeSystem;
        /** Local-only. Not sent to ORCA medicalmodv2. */
        private String adminMemo;
        /** Local-only. Not sent to ORCA medicalmodv2. */
        private String memo;
        private String started;
        private String enteredByName;
        private String enteredByRole;
        private OrderBundleItem bodyPart;
        private List<OrderBundleItem> items;
        private List<OrderBundleItem> materialItems;
        private List<OrderBundleItem> commentItems;

        public Long getDocumentId() {
            return documentId;
        }

        public void setDocumentId(Long documentId) {
            this.documentId = documentId;
        }

        public Long getModuleId() {
            return moduleId;
        }

        public void setModuleId(Long moduleId) {
            this.moduleId = moduleId;
        }

        public String getEntity() {
            return entity;
        }

        public void setEntity(String entity) {
            this.entity = entity;
        }

        public String getBundleName() {
            return bundleName;
        }

        public void setBundleName(String bundleName) {
            this.bundleName = bundleName;
        }

        public String getBundleNumber() {
            return bundleNumber;
        }

        public void setBundleNumber(String bundleNumber) {
            this.bundleNumber = bundleNumber;
        }

        public String getSubtype() {
            return subtype;
        }

        public void setSubtype(String subtype) {
            this.subtype = subtype;
        }

        public BacteriaOrderMetadata getBacteria() {
            return bacteria;
        }

        public void setBacteria(BacteriaOrderMetadata bacteria) {
            this.bacteria = bacteria;
        }

        public String getClassCode() {
            return classCode;
        }

        public void setClassCode(String classCode) {
            this.classCode = classCode;
        }

        public String getClassCodeSystem() {
            return classCodeSystem;
        }

        public void setClassCodeSystem(String classCodeSystem) {
            this.classCodeSystem = classCodeSystem;
        }

        public String getClassName() {
            return className;
        }

        public void setClassName(String className) {
            this.className = className;
        }

        public String getAdmin() {
            return admin;
        }

        public void setAdmin(String admin) {
            this.admin = admin;
        }

        public String getAdminCode() {
            return adminCode;
        }

        public void setAdminCode(String adminCode) {
            this.adminCode = adminCode;
        }

        public String getAdminCodeSystem() {
            return adminCodeSystem;
        }

        public void setAdminCodeSystem(String adminCodeSystem) {
            this.adminCodeSystem = adminCodeSystem;
        }

        public String getAdminMemo() {
            return adminMemo;
        }

        public void setAdminMemo(String adminMemo) {
            this.adminMemo = adminMemo;
        }

        public String getMemo() {
            return memo;
        }

        public void setMemo(String memo) {
            this.memo = memo;
        }

        public String getStarted() {
            return started;
        }

        public void setStarted(String started) {
            this.started = started;
        }

        public String getEnteredByName() {
            return enteredByName;
        }

        public void setEnteredByName(String enteredByName) {
            this.enteredByName = enteredByName;
        }

        public String getEnteredByRole() {
            return enteredByRole;
        }

        public void setEnteredByRole(String enteredByRole) {
            this.enteredByRole = enteredByRole;
        }

        public OrderBundleItem getBodyPart() {
            return bodyPart;
        }

        public void setBodyPart(OrderBundleItem bodyPart) {
            this.bodyPart = bodyPart;
        }

        public List<OrderBundleItem> getItems() {
            return items;
        }

        public void setItems(List<OrderBundleItem> items) {
            this.items = items;
        }

        public List<OrderBundleItem> getMaterialItems() {
            return materialItems;
        }

        public void setMaterialItems(List<OrderBundleItem> materialItems) {
            this.materialItems = materialItems;
        }

        public List<OrderBundleItem> getCommentItems() {
            return commentItems;
        }

        public void setCommentItems(List<OrderBundleItem> commentItems) {
            this.commentItems = commentItems;
        }
    }

    public static class OrderBundleItem {
        private String code;
        private String name;
        private String quantity;
        private String unit;
        private String memo;
        private String genericFlg;
        private String userComment;
        private String masterCategory;
        private String selectionCommentItemNumber;
        private String selectionCommentItemNumberBranch;
        private String rowRole;
        private String rowSubtype;
        private String category;
        private String itemNumber;
        private String itemNumberBranch;

        public String getCode() {
            return code;
        }

        public void setCode(String code) {
            this.code = code;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getQuantity() {
            return quantity;
        }

        public void setQuantity(String quantity) {
            this.quantity = quantity;
        }

        public String getUnit() {
            return unit;
        }

        public void setUnit(String unit) {
            this.unit = unit;
        }

        public String getMemo() {
            return memo;
        }

        public void setMemo(String memo) {
            this.memo = memo;
        }

        public String getGenericFlg() {
            return genericFlg;
        }

        public void setGenericFlg(String genericFlg) {
            this.genericFlg = genericFlg;
        }

        public String getUserComment() {
            return userComment;
        }

        public void setUserComment(String userComment) {
            this.userComment = userComment;
        }

        public String getMasterCategory() {
            return masterCategory;
        }

        public void setMasterCategory(String masterCategory) {
            this.masterCategory = masterCategory;
        }

        public String getSelectionCommentItemNumber() {
            return selectionCommentItemNumber;
        }

        public void setSelectionCommentItemNumber(String selectionCommentItemNumber) {
            this.selectionCommentItemNumber = selectionCommentItemNumber;
        }

        public String getSelectionCommentItemNumberBranch() {
            return selectionCommentItemNumberBranch;
        }

        public void setSelectionCommentItemNumberBranch(String selectionCommentItemNumberBranch) {
            this.selectionCommentItemNumberBranch = selectionCommentItemNumberBranch;
        }

        public String getRowRole() {
            return rowRole;
        }

        public void setRowRole(String rowRole) {
            this.rowRole = rowRole;
        }

        public String getRowSubtype() {
            return rowSubtype;
        }

        public void setRowSubtype(String rowSubtype) {
            this.rowSubtype = rowSubtype;
        }

        public String getCategory() {
            return category;
        }

        public void setCategory(String category) {
            this.category = category;
        }

        public String getItemNumber() {
            return itemNumber;
        }

        public void setItemNumber(String itemNumber) {
            this.itemNumber = itemNumber;
        }

        public String getItemNumberBranch() {
            return itemNumberBranch;
        }

        public void setItemNumberBranch(String itemNumberBranch) {
            this.itemNumberBranch = itemNumberBranch;
        }
    }
}
