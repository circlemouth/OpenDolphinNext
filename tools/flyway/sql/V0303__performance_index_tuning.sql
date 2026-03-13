-- P6-10: index tuning for heavy paths (karte history, patient image listing, patient search)

SET search_path TO opendolphin, public;

CREATE INDEX IF NOT EXISTS d_document_karte_status_started_id_idx
    ON d_document (karte_id, status, started DESC, id DESC);

CREATE INDEX IF NOT EXISTS d_attachment_doc_linkrelation_status_id_idx
    ON d_attachment (doc_id, linkrelation, status, id DESC);

CREATE INDEX IF NOT EXISTS d_patient_facility_telephone_prefix_idx
    ON d_patient (facilityid, telephone text_pattern_ops);

CREATE INDEX IF NOT EXISTS d_patient_facility_mobilephone_prefix_idx
    ON d_patient (facilityid, mobilephone text_pattern_ops);

CREATE INDEX IF NOT EXISTS d_patient_facility_zipcode_prefix_idx
    ON d_patient (facilityid, zipcode text_pattern_ops);

CREATE INDEX IF NOT EXISTS d_patient_appmemo_trgm_idx
    ON d_patient USING gin (appmemo gin_trgm_ops);
