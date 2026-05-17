package open.dolphin.rest.dto;

import java.util.ArrayList;
import java.util.List;

public final class LegacyKarteListResponse {

    private LegacyKarteListResponse() {
    }

    public static final class DocumentListResponse {
        private List<KarteRevisionDocumentResponse> list;

        public List<KarteRevisionDocumentResponse> getList() {
            return list;
        }

        public void setList(List<KarteRevisionDocumentResponse> list) {
            this.list = list;
        }

        public static DocumentListResponse ofMapped(List<KarteRevisionDocumentResponse> documents) {
            DocumentListResponse response = new DocumentListResponse();
            if (documents == null || documents.isEmpty()) {
                response.setList(List.of());
                return response;
            }
            response.setList(List.copyOf(documents));
            return response;
        }
    }

    public static final class ModuleListResponse {
        private List<KarteRevisionDocumentResponse.ModuleResponse> list;

        public List<KarteRevisionDocumentResponse.ModuleResponse> getList() {
            return list;
        }

        public void setList(List<KarteRevisionDocumentResponse.ModuleResponse> list) {
            this.list = list;
        }

        public static ModuleListResponse ofMapped(List<KarteRevisionDocumentResponse.ModuleResponse> modules) {
            ModuleListResponse response = new ModuleListResponse();
            response.setList(modules != null ? List.copyOf(modules) : List.of());
            return response;
        }
    }

    public static final class ModuleListListResponse {
        private List<ModuleListResponse> list;

        public List<ModuleListResponse> getList() {
            return list;
        }

        public void setList(List<ModuleListResponse> list) {
            this.list = list;
        }

        public static ModuleListListResponse ofMapped(List<List<KarteRevisionDocumentResponse.ModuleResponse>> groupedModules) {
            ModuleListListResponse response = new ModuleListListResponse();
            if (groupedModules == null || groupedModules.isEmpty()) {
                response.setList(List.of());
                return response;
            }
            List<ModuleListResponse> mapped = new ArrayList<>(groupedModules.size());
            for (List<KarteRevisionDocumentResponse.ModuleResponse> modules : groupedModules) {
                mapped.add(ModuleListResponse.ofMapped(modules));
            }
            response.setList(List.copyOf(mapped));
            return response;
        }
    }

    public static final class PatientFreeDocumentResponse {
        private long id;
        private String facilityPatId;
        private java.util.Date confirmed;
        private String comment;
        private String contentHash;

        public long getId() {
            return id;
        }

        public void setId(long id) {
            this.id = id;
        }

        public String getFacilityPatId() {
            return facilityPatId;
        }

        public void setFacilityPatId(String facilityPatId) {
            this.facilityPatId = facilityPatId;
        }

        public java.util.Date getConfirmed() {
            return confirmed;
        }

        public void setConfirmed(java.util.Date confirmed) {
            this.confirmed = confirmed;
        }

        public String getComment() {
            return comment;
        }

        public void setComment(String comment) {
            this.comment = comment;
        }

        public String getContentHash() {
            return contentHash;
        }

        public void setContentHash(String contentHash) {
            this.contentHash = contentHash;
        }

        public static PatientFreeDocumentResponse of(long id, String facilityPatId, java.util.Date confirmed, String comment) {
            return of(id, facilityPatId, confirmed, comment, null);
        }

        public static PatientFreeDocumentResponse of(long id, String facilityPatId, java.util.Date confirmed, String comment, String contentHash) {
            if (facilityPatId == null && confirmed == null && comment == null && id == 0L) {
                return null;
            }
            PatientFreeDocumentResponse response = new PatientFreeDocumentResponse();
            response.setId(id);
            response.setFacilityPatId(facilityPatId);
            response.setConfirmed(confirmed);
            response.setComment(comment);
            response.setContentHash(contentHash);
            return response;
        }
    }
}
