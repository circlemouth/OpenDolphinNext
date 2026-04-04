package open.dolphin.rest.dto.orca;

import java.util.List;

/**
 * Response payload for order recommendation API.
 */
public class OrderBundleRecommendationResponse {

    private String apiResult;
    private String apiResultMessage;
    private String runId;
    private String patientId;
    private String entity;
    private int recordsScanned;
    private int recordsReturned;
    private List<OrderRecommendationEntry> recommendations;

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

    public String getEntity() {
        return entity;
    }

    public void setEntity(String entity) {
        this.entity = entity;
    }

    public int getRecordsScanned() {
        return recordsScanned;
    }

    public void setRecordsScanned(int recordsScanned) {
        this.recordsScanned = recordsScanned;
    }

    public int getRecordsReturned() {
        return recordsReturned;
    }

    public void setRecordsReturned(int recordsReturned) {
        this.recordsReturned = recordsReturned;
    }

    public List<OrderRecommendationEntry> getRecommendations() {
        return recommendations;
    }

    public void setRecommendations(List<OrderRecommendationEntry> recommendations) {
        this.recommendations = recommendations;
    }

    public static class OrderRecommendationEntry {
        private String key;
        private String entity;
        private String source;
        private int count;
        private String lastUsedAt;
        private OrderRecommendationTemplate template;

        public String getKey() {
            return key;
        }

        public void setKey(String key) {
            this.key = key;
        }

        public String getEntity() {
            return entity;
        }

        public void setEntity(String entity) {
            this.entity = entity;
        }

        public String getSource() {
            return source;
        }

        public void setSource(String source) {
            this.source = source;
        }

        public int getCount() {
            return count;
        }

        public void setCount(int count) {
            this.count = count;
        }

        public String getLastUsedAt() {
            return lastUsedAt;
        }

        public void setLastUsedAt(String lastUsedAt) {
            this.lastUsedAt = lastUsedAt;
        }

        public OrderRecommendationTemplate getTemplate() {
            return template;
        }

        public void setTemplate(OrderRecommendationTemplate template) {
            this.template = template;
        }
    }

    public static class OrderRecommendationTemplate {
        private String bundleName;
        private String admin;
        private String adminCode;
        private String adminCodeSystem;
        private String bundleNumber;
        private String subtype;
        private BacteriaOrderMetadata bacteria;
        private String classCode;
        private String classCodeSystem;
        /** Canonical className resolved on the server. */
        private String className;
        /** Local-only. Not sent to ORCA medicalmodv2. */
        private String adminMemo;
        /** Local-only. Not sent to ORCA medicalmodv2. */
        private String memo;
        private String prescriptionLocation;
        private String prescriptionTiming;
        private List<OrderBundleFetchResponse.OrderBundleItem> items;
        private List<OrderBundleFetchResponse.OrderBundleItem> materialItems;
        private List<OrderBundleFetchResponse.OrderBundleItem> commentItems;
        private OrderBundleFetchResponse.OrderBundleItem bodyPart;

        public String getBundleName() {
            return bundleName;
        }

        public void setBundleName(String bundleName) {
            this.bundleName = bundleName;
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

        public String getPrescriptionLocation() {
            return prescriptionLocation;
        }

        public void setPrescriptionLocation(String prescriptionLocation) {
            this.prescriptionLocation = prescriptionLocation;
        }

        public String getPrescriptionTiming() {
            return prescriptionTiming;
        }

        public void setPrescriptionTiming(String prescriptionTiming) {
            this.prescriptionTiming = prescriptionTiming;
        }

        public List<OrderBundleFetchResponse.OrderBundleItem> getItems() {
            return items;
        }

        public void setItems(List<OrderBundleFetchResponse.OrderBundleItem> items) {
            this.items = items;
        }

        public List<OrderBundleFetchResponse.OrderBundleItem> getMaterialItems() {
            return materialItems;
        }

        public void setMaterialItems(List<OrderBundleFetchResponse.OrderBundleItem> materialItems) {
            this.materialItems = materialItems;
        }

        public List<OrderBundleFetchResponse.OrderBundleItem> getCommentItems() {
            return commentItems;
        }

        public void setCommentItems(List<OrderBundleFetchResponse.OrderBundleItem> commentItems) {
            this.commentItems = commentItems;
        }

        public OrderBundleFetchResponse.OrderBundleItem getBodyPart() {
            return bodyPart;
        }

        public void setBodyPart(OrderBundleFetchResponse.OrderBundleItem bodyPart) {
            this.bodyPart = bodyPart;
        }
    }
}
