package open.dolphin.orca.transport;

/**
 * Enumerates ORCA API endpoints handled by the wrapper.
 */
public enum OrcaEndpoint {

    ACCEPTANCE_LIST("/api01rv2/acceptlstv2", true, true, null,
            "Acceptance_Date"),
    APPOINTMENT_LIST("/api01rv2/appointlstv2", true, true, null,
            "Appointment_Date"),
    PATIENT_APPOINTMENT_LIST("/api01rv2/appointlst2v2", true, true, null,
            "Patient_ID", "Base_Date"),
    BILLING_SIMULATION("/api01rv2/acsimulatev2", true, true, null,
            "Patient_ID", "Perform_Date"),
    VISIT_LIST("/api01rv2/visitptlstv2", true, false, null,
            "Request_Number", "Visit_Date"),
    PATIENT_ID_LIST("/api01rv2/patientlst1v2", true, true, null,
            "Base_StartDate", "Base_EndDate"),
    PATIENT_BATCH("/api01rv2/patientlst2v2", true, true, null,
            "Patient_ID_Information"),
    PATIENT_NAME_SEARCH("/api01rv2/patientlst3v2", true, true, null,
            "WholeName"),
    INSURANCE_COMBINATION("/api01rv2/patientlst6v2", true, false, null,
            "Reqest_Number", "Patient_ID", "Base_Date", "Start_Date", "End_Date"),
    FORMER_NAME_HISTORY("/api01rv2/patientlst8v2", true, false, null,
            "Patient_ID"),
    APPOINTMENT_MUTATION("/orca14/appointmodv2", true, true, null,
            "Patient_ID", "Appointment_Date", "Appointment_Time"),
    ACCEPTANCE_MUTATION("/orca11/acceptmodv2", true, false, null,
            "Request_Number", "Patient_ID"),
    SYSTEM_MANAGEMENT_LIST("/api01rv2/system01lstv2", true, true, null,
            "Request_Number"),
    MANAGE_USERS("/orca101/manageusersv2", true, false, null,
            "Request_Number"),
    INSURANCE_PROVIDER("/api01rv2/insprogetv2", true, false, null),
    PRESCRIPTION_REPORT("/api01rv2/prescriptionv2", true, false,
            "application/json"),
    PATIENT_GET("/api01rv2/patientgetv2", "GET", false, false, null),
    PATIENT_MOD("/orca12/patientmodv2", true, true, null,
            "Patient_ID"),
    PATIENT_MEMO_LIST("/api01rv2/patientlst7v2", true, false, null),
    PATIENT_MEMO_MOD("/orca06/patientmemomodv2", true, false, null,
            "Patient_ID", "Request_Number"),
    DISEASE_GET("/api01rv2/diseasegetv2", true, true, null,
            "Patient_ID"),
    DISEASE_MOD_V3("/orca22/diseasev3", true, true, null,
            "Patient_ID", "Perform_Date"),
    MEDICAL_GET("/api01rv2/medicalgetv2", true, true, null,
            "Request_Number", "Patient_ID"),
    MEDICAL_MOD("/api21/medicalmodv2", true, true, null,
            "Patient_ID", "Perform_Date"),
    TEMP_MEDICAL_GET("/api01rv2/tmedicalgetv2", true, false, null,
            "Request_Number"),
    INCOME_INFO("/api01rv2/incomeinfv2", true, false, null,
            "Patient_ID", "Base_Date"),
    SUBJECTIVES_LIST("/api01rv2/subjectiveslstv2", true, false, null,
            "Request_Number"),
    SUBJECTIVES_MOD("/orca25/subjectivesv2", true, true, null,
            "Patient_ID", "Perform_Date", "InOut", "Department_Code",
            "Insurance_Combination_Number", "Subjectives_Detail_Record", "Subjectives_Code"),
    CONTRAINDICATION_CHECK("/api01rv2/contraindicationcheckv2",
            true, false, null,
            "Patient_ID", "Perform_Month"),
    MEDICATION_GET("/api01rv2/medicationgetv2", true, false, null,
            "Request_Number", "Request_Code"),
    MEDICATION_MOD("/orca102/medicatonmodv2", true, true, null,
            "Request_Number"),
    MASTER_LAST_UPDATE("/orca51/masterlastupdatev3", false, false, null),
    SYSTEM_INFO("/api01rv2/systeminfv2", true, false, null,
            "Request_Date", "Request_Time"),
    SYSTEM_DAILY("/api01rv2/system01dailyv2", true, false, null,
            "Request_Number"),
    INSURANCE_LIST("/api01rv2/insuranceinf1v2", true, false, null,
            "Request_Number", "Base_Date"),
    MEDICAL_SET("/orca21/medicalsetv2", true, false, null,
            "Request_Number"),
    PUSH_EVENT_GET("/api01rv2/pusheventgetv2", true, false,
            "application/json"),
    MEDICINE_NOTEBOOK_REPORT("/api01rv2/medicinenotebookv2",
            true, false, "application/json"),
    KARTENO1_REPORT("/api01rv2/karteno1v2", true, false,
            "application/json"),
    KARTENO3_REPORT("/api01rv2/karteno3v2", true, false,
            "application/json"),
    INVOICE_RECEIPT_REPORT("/api01rv2/invoicereceiptv2", true,
            false, "application/json"),
    STATEMENT_REPORT("/api01rv2/statementv2", true, false,
            "application/json");

    private final String path;
    private final String method;
    private final boolean requiresBody;
    private final boolean usesQueryFromMeta;
    private final String accept;
    private final String[] requiredFields;

    OrcaEndpoint(String path, boolean requiresBody, boolean usesQueryFromMeta, String accept,
            String... requiredFields) {
        this(path, "POST", requiresBody, usesQueryFromMeta, accept, requiredFields);
    }

    OrcaEndpoint(String path, String method, boolean requiresBody, boolean usesQueryFromMeta,
            String accept, String... requiredFields) {
        this.path = path;
        this.method = method;
        this.requiresBody = requiresBody;
        this.usesQueryFromMeta = usesQueryFromMeta;
        this.accept = accept;
        this.requiredFields = requiredFields != null ? requiredFields : new String[0];
    }

    public String getPath() {
        return path;
    }

    public String getMethod() {
        return method;
    }

    public boolean requiresBody() {
        return requiresBody;
    }

    public boolean usesQueryFromMeta() {
        return usesQueryFromMeta;
    }

    public String getAccept() {
        return accept;
    }

    public java.util.List<String> requiredFields() {
        return java.util.List.of(requiredFields);
    }
}
