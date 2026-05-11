package open.dolphin.reporting.api;

import java.util.ArrayList;
import java.util.List;

/**
 * JSON payload accepted by /reporting/karte.
 */
public class ReportingPayload {

    private String template;
    private String locale;
    private String documentTitle;
    private ReportingPatientPayload patient;
    private String attendingDoctor;
    private String encounterDate;
    private String generatedAt;
    private List<ReportingSummaryItemPayload> summaryItems = new ArrayList<>();
    private List<ReportingChartRevisionEventPayload> chartRevisionEvents = new ArrayList<>();
    private List<ReportingPrescriptionEventPayload> prescriptionEvents = new ArrayList<>();
    private List<ReportingOrcaEventPayload> orcaEvents = new ArrayList<>();
    private ReportingSigningPayload signing;
    private String outputFileName;

    public String getTemplate() {
        return template;
    }

    public void setTemplate(String template) {
        this.template = template;
    }

    public String getLocale() {
        return locale;
    }

    public void setLocale(String locale) {
        this.locale = locale;
    }

    public String getDocumentTitle() {
        return documentTitle;
    }

    public void setDocumentTitle(String documentTitle) {
        this.documentTitle = documentTitle;
    }

    public ReportingPatientPayload getPatient() {
        return patient;
    }

    public void setPatient(ReportingPatientPayload patient) {
        this.patient = patient;
    }

    public String getAttendingDoctor() {
        return attendingDoctor;
    }

    public void setAttendingDoctor(String attendingDoctor) {
        this.attendingDoctor = attendingDoctor;
    }

    public String getEncounterDate() {
        return encounterDate;
    }

    public void setEncounterDate(String encounterDate) {
        this.encounterDate = encounterDate;
    }

    public String getGeneratedAt() {
        return generatedAt;
    }

    public void setGeneratedAt(String generatedAt) {
        this.generatedAt = generatedAt;
    }

    public List<ReportingSummaryItemPayload> getSummaryItems() {
        return summaryItems;
    }

    public void setSummaryItems(List<ReportingSummaryItemPayload> summaryItems) {
        this.summaryItems = summaryItems == null ? new ArrayList<>() : new ArrayList<>(summaryItems);
    }

    public List<ReportingChartRevisionEventPayload> getChartRevisionEvents() {
        return chartRevisionEvents;
    }

    public void setChartRevisionEvents(List<ReportingChartRevisionEventPayload> chartRevisionEvents) {
        this.chartRevisionEvents = chartRevisionEvents == null
                ? new ArrayList<>()
                : new ArrayList<>(chartRevisionEvents);
    }

    public List<ReportingPrescriptionEventPayload> getPrescriptionEvents() {
        return prescriptionEvents;
    }

    public void setPrescriptionEvents(List<ReportingPrescriptionEventPayload> prescriptionEvents) {
        this.prescriptionEvents = prescriptionEvents == null
                ? new ArrayList<>()
                : new ArrayList<>(prescriptionEvents);
    }

    public List<ReportingOrcaEventPayload> getOrcaEvents() {
        return orcaEvents;
    }

    public void setOrcaEvents(List<ReportingOrcaEventPayload> orcaEvents) {
        this.orcaEvents = orcaEvents == null ? new ArrayList<>() : new ArrayList<>(orcaEvents);
    }

    public ReportingSigningPayload getSigning() {
        return signing;
    }

    public void setSigning(ReportingSigningPayload signing) {
        this.signing = signing;
    }

    public String getOutputFileName() {
        return outputFileName;
    }

    public void setOutputFileName(String outputFileName) {
        this.outputFileName = outputFileName;
    }
}
